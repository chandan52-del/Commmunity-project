import { getPool } from '../db.js'
import { badRequest, notFound, conflict, HttpError } from '../middleware/errorHandler.js'

const MAINT_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled']
const ACTIVE_STATUSES = ['scheduled', 'in_progress']
const SORTS = ['start_at', '-start_at', 'created_at', '-created_at']
const SORT_MAP = { start_at: 'mw.start_at', created_at: 'mw.created_at' }

// scheduled → in_progress → completed; any non-terminal → cancelled
const ALLOWED_TRANSITIONS = {
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

const toISO = (v) => (v instanceof Date ? v.toISOString() : v)

export function maintenanceJson(row) {
  return {
    id: row.id,
    hall_id: row.hall_id,
    hall_name: row.hall_name ?? undefined,
    title: row.title,
    reason: row.reason ?? null,
    start_at: toISO(row.start_at),
    end_at: toISO(row.end_at),
    status: row.status,
    created_by: row.created_by ?? null,
    created_at: toISO(row.created_at),
    updated_at: toISO(row.updated_at),
  }
}

const SELECT = `
  SELECT mw.*, h.name AS hall_name
  FROM maintenance_windows mw
  JOIN halls h ON h.id = mw.hall_id`

function parseDT(value, field) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    throw badRequest('Request validation failed', [{ field, message: `${field} must be an ISO 8601 datetime` }])
  }
  return d
}

function validateFields(input, { partial = false } = {}) {
  const errors = []
  const out = {}
  const need = (cond, f, msg) => { if (!cond) errors.push({ field: f, message: msg }) }

  if (!partial || input.hall_id !== undefined) {
    const ok = Number.isInteger(Number(input.hall_id)) && Number(input.hall_id) > 0
    need(ok, 'hall_id', 'hall_id must be a positive integer')
    if (ok) out.hall_id = Number(input.hall_id)
  }
  if (!partial || input.title !== undefined) {
    need(typeof input.title === 'string' && input.title.trim().length >= 2 && input.title.length <= 160,
      'title', 'title must be 2-160 characters')
    if (typeof input.title === 'string') out.title = input.title.trim()
  }
  if (input.reason !== undefined && input.reason !== null) {
    need(typeof input.reason === 'string' && input.reason.length <= 2000, 'reason', 'reason must be a string <= 2000 chars')
    if (typeof input.reason === 'string') out.reason = input.reason
  } else if (input.reason === null) {
    out.reason = null
  }
  if (!partial || input.start_at !== undefined) {
    out.start_at = input.start_at !== undefined ? parseDT(input.start_at, 'start_at') : undefined
  }
  if (!partial || input.end_at !== undefined) {
    out.end_at = input.end_at !== undefined ? parseDT(input.end_at, 'end_at') : undefined
  }
  if (input.status !== undefined) {
    need(MAINT_STATUSES.includes(input.status), 'status', `status must be one of: ${MAINT_STATUSES.join(', ')}`)
    if (MAINT_STATUSES.includes(input.status)) out.status = input.status
  }
  if (errors.length) throw badRequest('Request validation failed', errors)
  return out
}

function assertRange(start, end) {
  if (!(end > start)) {
    throw badRequest('Request validation failed', [{ field: 'end_at', message: 'end_at must be after start_at' }])
  }
}

async function lockHall(conn, hallId) {
  const [rows] = await conn.query('SELECT id FROM halls WHERE id = ?', [hallId])
  if (!rows[0]) throw notFound('Hall not found')
  await conn.query('SELECT id FROM halls WHERE id = ? FOR UPDATE', [hallId])
  return rows[0]
}

async function assertNoBookingOverlap(conn, hallId, start, end) {
  const [bookings] = await conn.query(
    `SELECT id, booking_ref, start_at, end_at FROM bookings
     WHERE hall_id = ? AND status = 'approved' AND start_at < ? AND end_at > ?`,
    [hallId, end, start],
  )
  if (bookings.length) {
    throw new HttpError(409, 'BOOKING_CONFLICT',
      'The maintenance window overlaps an existing approved booking',
      bookings.map((b) => ({ type: 'booking', id: b.id, booking_ref: b.booking_ref, start_at: toISO(b.start_at), end_at: toISO(b.end_at) })))
  }
}

export async function listMaintenance(query) {
  const where = []
  const params = []
  if (query.hall_id !== undefined && query.hall_id !== '') {
    const n = Number(query.hall_id)
    if (!Number.isInteger(n) || n < 1) throw badRequest('Request validation failed', [{ field: 'hall_id', message: 'hall_id must be a positive integer' }])
    where.push('mw.hall_id = ?')
    params.push(n)
  }
  if (query.status) {
    if (!MAINT_STATUSES.includes(query.status)) {
      throw badRequest('Request validation failed', [{ field: 'status', message: `status must be one of: ${MAINT_STATUSES.join(', ')}` }])
    }
    where.push('mw.status = ?')
    params.push(query.status)
  }
  if (query.from) {
    where.push('mw.end_at > ?')
    params.push(parseDT(query.from, 'from'))
  }
  if (query.to) {
    where.push('mw.start_at < ?')
    params.push(parseDT(query.to, 'to'))
  }
  const sort = query.sort ?? '-start_at'
  if (!SORTS.includes(sort)) {
    throw badRequest('Request validation failed', [{ field: 'sort', message: `sort must be one of: ${SORTS.join(', ')}` }])
  }
  const field = sort.replace(/^-/, '')
  const dir = sort.startsWith('-') ? 'DESC' : 'ASC'
  const orderBy = `${SORT_MAP[field] ?? 'mw.start_at'} ${dir}, mw.id DESC`

  const page = Number(query.page) || 1
  const pageSize = Number(query.page_size) || 20
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw badRequest('Request validation failed', [{ field: 'page_size', message: 'page must be >=1 and page_size 1-100' }])
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const pool = getPool()
  const [countRows] = await pool.query(`SELECT COUNT(*) AS n FROM maintenance_windows mw ${whereSql}`, params)
  const total = countRows[0].n
  const [rows] = await pool.query(`${SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize])
  return {
    data: rows.map(maintenanceJson),
    pagination: { page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) },
  }
}

export async function createMaintenance(adminId, body) {
  const input = validateFields(body ?? {})
  if (input.status === undefined) input.status = 'scheduled'
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await lockHall(conn, input.hall_id)
    assertRange(input.start_at, input.end_at)
    if (ACTIVE_STATUSES.includes(input.status)) {
      await assertNoBookingOverlap(conn, input.hall_id, input.start_at, input.end_at)
    }
    const [res] = await conn.query(
      `INSERT INTO maintenance_windows (hall_id, title, reason, start_at, end_at, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.hall_id, input.title, input.reason ?? null, input.start_at, input.end_at, input.status, adminId],
    )
    const [rows] = await conn.query(`${SELECT} WHERE mw.id = ?`, [res.insertId])
    await conn.commit()
    return maintenanceJson(rows[0])
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function updateMaintenance(id, body) {
  const patch = validateFields(body ?? {}, { partial: true })
  if (Object.keys(patch).length === 0) {
    throw badRequest('Request validation failed', [{ field: '_', message: 'At least one field must be provided' }])
  }
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query(`${SELECT} WHERE mw.id = ? FOR UPDATE`, [id])
    const mw = rows[0]
    if (!mw) throw notFound('Maintenance window not found')

    // status transition validation
    if (patch.status !== undefined && patch.status !== mw.status) {
      if (!ALLOWED_TRANSITIONS[mw.status]?.includes(patch.status)) {
        throw conflict(`Cannot transition maintenance window from '${mw.status}' to '${patch.status}'`)
      }
    }

    const merged = {
      hall_id: patch.hall_id ?? mw.hall_id,
      title: patch.title ?? mw.title,
      reason: patch.reason !== undefined ? patch.reason : mw.reason,
      start_at: patch.start_at ?? mw.start_at,
      end_at: patch.end_at ?? mw.end_at,
      status: patch.status ?? mw.status,
    }
    assertRange(merged.start_at, merged.end_at)

    const hallChanged = merged.hall_id !== mw.hall_id
    const needsOverlapCheck = ACTIVE_STATUSES.includes(merged.status) &&
      (hallChanged || patch.start_at !== undefined || patch.end_at !== undefined || patch.status !== undefined)

    if (hallChanged) {
      // Lock both hall rows in ascending id order to prevent deadlock.
      const ids = [mw.hall_id, merged.hall_id].sort((a, b) => a - b)
      for (const hid of ids) await lockHall(conn, hid)
    } else if (needsOverlapCheck || patch.hall_id !== undefined) {
      await lockHall(conn, merged.hall_id)
    }
    if (needsOverlapCheck) {
      await assertNoBookingOverlap(conn, merged.hall_id, merged.start_at, merged.end_at)
    }

    await conn.query(
      `UPDATE maintenance_windows SET hall_id = ?, title = ?, reason = ?, start_at = ?, end_at = ?, status = ? WHERE id = ?`,
      [merged.hall_id, merged.title, merged.reason, merged.start_at, merged.end_at, merged.status, id],
    )
    const [out] = await conn.query(`${SELECT} WHERE mw.id = ?`, [id])
    await conn.commit()
    return maintenanceJson(out[0])
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function cancelMaintenance(id) {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query('SELECT id, status FROM maintenance_windows WHERE id = ? FOR UPDATE', [id])
    const mw = rows[0]
    if (!mw) throw notFound('Maintenance window not found')
    if (!ACTIVE_STATUSES.includes(mw.status)) {
      throw conflict(`Maintenance window cannot be cancelled from status '${mw.status}'`)
    }
    await conn.query(`UPDATE maintenance_windows SET status = 'cancelled' WHERE id = ?`, [id])
    await conn.commit()
    return { id }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
