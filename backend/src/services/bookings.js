import { getPool } from '../db.js'
import { badRequest, notFound, forbidden, conflict, HttpError } from '../middleware/errorHandler.js'

const BOOKING_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'completed']
const CUSTOMER_SORTS = ['start_at', '-start_at', 'created_at', '-created_at', 'status']
const ADMIN_SORTS = ['start_at', '-start_at', 'created_at', '-created_at', 'status']

const toISO = (v) => (v instanceof Date ? v.toISOString() : v)

export function bookingJson(row, { includeCustomer = false } = {}) {
  const out = {
    id: row.id,
    booking_ref: row.booking_ref,
    user_id: row.user_id,
    hall_id: row.hall_id,
    hall_name: row.hall_name ?? undefined,
    event_name: row.event_name,
    event_type: row.event_type,
    start_at: toISO(row.start_at),
    end_at: toISO(row.end_at),
    guest_count: row.guest_count ?? null,
    quoted_amount: row.quoted_amount ?? null,
    status: row.status,
    customer_notes: row.customer_notes ?? null,
    created_at: toISO(row.created_at),
    updated_at: toISO(row.updated_at),
  }
  if (includeCustomer || row.customer_name !== undefined) {
    out.customer_name = row.customer_name ?? null
    out.customer_email = row.customer_email ?? null
  }
  if (row.admin_notes !== undefined) out.admin_notes = row.admin_notes ?? null
  if (row.reviewed_by !== undefined) {
    out.reviewed_by = row.reviewed_by ?? null
    out.reviewed_at = row.reviewed_at ? toISO(row.reviewed_at) : null
  }
  return out
}

const BOOKING_SELECT = `
  SELECT b.*, h.name AS hall_name, u.full_name AS customer_name, u.email AS customer_email
  FROM bookings b
  JOIN halls h ON h.id = b.hall_id
  JOIN users u ON u.id = b.user_id`

function parseDateParam(value, field) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    throw badRequest('Request validation failed', [{ field, message: `${field} must be an ISO 8601 datetime` }])
  }
  return d
}

export function validateBookingBody(body) {
  const errors = []
  const out = {}
  const req = (f, cond, msg) => {
    if (!cond) errors.push({ field: f, message: msg })
  }
  req('hall_id', Number.isInteger(Number(body.hall_id)) && Number(body.hall_id) > 0, 'hall_id must be a positive integer')
  req('event_name', typeof body.event_name === 'string' && body.event_name.trim().length >= 2 && body.event_name.length <= 160, 'event_name must be 2-160 characters')
  req('event_type', typeof body.event_type === 'string' && body.event_type.trim().length >= 2 && body.event_type.length <= 64, 'event_type must be 2-64 characters')
  const start = body.start_at ? parseDateParam(body.start_at, 'start_at') : null
  const end = body.end_at ? parseDateParam(body.end_at, 'end_at') : null
  if (start && end && end <= start) errors.push({ field: 'end_at', message: 'end_at must be after start_at' })
  if (body.guest_count !== undefined && body.guest_count !== null) {
    const n = Number(body.guest_count)
    if (!Number.isInteger(n) || n < 1 || n > 100000) errors.push({ field: 'guest_count', message: 'guest_count must be an integer 1-100000' })
    else out.guest_count = n
  }
  if (body.customer_notes !== undefined && body.customer_notes !== null) {
    if (typeof body.customer_notes !== 'string' || body.customer_notes.length > 2000) {
      errors.push({ field: 'customer_notes', message: 'customer_notes must be a string <= 2000 chars' })
    } else out.customer_notes = body.customer_notes
  }
  if (errors.length) throw badRequest('Request validation failed', errors)
  return {
    hall_id: Number(body.hall_id),
    event_name: body.event_name.trim(),
    event_type: body.event_type.trim(),
    start_at: start,
    end_at: end,
    guest_count: out.guest_count ?? null,
    customer_notes: out.customer_notes ?? null,
  }
}

async function findConflict(conn, hallId, start, end, excludeBookingId = null) {
  const [bookings] = await conn.query(
    `SELECT id, booking_ref, start_at, end_at FROM bookings
     WHERE hall_id = ? AND status = 'approved' AND start_at < ? AND end_at > ?
       ${excludeBookingId ? 'AND id <> ?' : ''}`,
    excludeBookingId ? [hallId, end, start, excludeBookingId] : [hallId, end, start],
  )
  const [maintenance] = await conn.query(
    `SELECT id, title, start_at, end_at FROM maintenance_windows
     WHERE hall_id = ? AND status IN ('scheduled','in_progress') AND start_at < ? AND end_at > ?`,
    [hallId, end, start],
  )
  return { bookings, maintenance }
}

function bookingConflict({ bookings, maintenance }, message = 'The requested time range overlaps an existing approved booking or maintenance window', details = null) {
  return new HttpError(
    409,
    'BOOKING_CONFLICT',
    message,
    details ?? [
      ...bookings.map((b) => ({ type: 'booking', id: b.id, booking_ref: b.booking_ref, start_at: toISO(b.start_at), end_at: toISO(b.end_at) })),
      ...maintenance.map((m) => ({ type: 'maintenance', id: m.id, title: m.title, start_at: toISO(m.start_at), end_at: toISO(m.end_at) })),
    ],
  )
}

export async function createBooking(userId, body) {
  const input = validateBookingBody(body)
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [halls] = await conn.query('SELECT * FROM halls WHERE id = ? FOR UPDATE', [input.hall_id])
    const hall = halls[0]
    if (!hall) throw notFound('Hall not found')
    if (hall.status !== 'active') throw conflict('Hall is not available for booking')
    if (input.guest_count !== null && input.guest_count > hall.capacity) {
      throw badRequest('Request validation failed', [
        { field: 'guest_count', message: `guest_count exceeds hall capacity (${hall.capacity})` },
      ])
    }
    const conflictRows = await findConflict(conn, hall.id, input.start_at, input.end_at)
    if (conflictRows.bookings.length || conflictRows.maintenance.length) {
      throw bookingConflict(conflictRows)
    }

    // booking_ref CH-YYYY-NNNNN generated after id is known, inside this txn.
    const tempRef = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const [res] = await conn.query(
      `INSERT INTO bookings (booking_ref, user_id, hall_id, event_name, event_type, start_at, end_at, guest_count, quoted_amount, status, customer_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [tempRef, userId, hall.id, input.event_name, input.event_type, input.start_at, input.end_at, input.guest_count, hall.base_price, input.customer_notes],
    )
    const id = res.insertId
    const year = new Date().getUTCFullYear()
    const bookingRef = `CH-${year}-${String(id).padStart(5, '0')}`
    await conn.query('UPDATE bookings SET booking_ref = ? WHERE id = ?', [bookingRef, id])
    await conn.query(
      `INSERT INTO booking_events (booking_id, actor_id, from_status, to_status, note)
       VALUES (?, ?, NULL, 'pending', 'Booking request submitted')`,
      [id, userId],
    )
    await conn.commit()

    const [rows] = await conn.query(`${BOOKING_SELECT} WHERE b.id = ?`, [id])
    return bookingJson(rows[0])
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

function bookingFilters(query, { admin = false } = {}) {
  const where = []
  const params = []
  if (query.status) {
    if (!BOOKING_STATUSES.includes(query.status)) {
      throw badRequest('Request validation failed', [{ field: 'status', message: `status must be one of: ${BOOKING_STATUSES.join(', ')}` }])
    }
    where.push('b.status = ?')
    params.push(query.status)
  }
  if (query.hall_id) {
    const n = Number(query.hall_id)
    if (!Number.isInteger(n) || n < 1) throw badRequest('Request validation failed', [{ field: 'hall_id', message: 'hall_id must be a positive integer' }])
    where.push('b.hall_id = ?')
    params.push(n)
  }
  if (query.user_id && admin) {
    const n = Number(query.user_id)
    if (!Number.isInteger(n) || n < 1) throw badRequest('Request validation failed', [{ field: 'user_id', message: 'user_id must be a positive integer' }])
    where.push('b.user_id = ?')
    params.push(n)
  }
  if (query.from) {
    where.push('b.start_at >= ?')
    params.push(parseDateParam(query.from, 'from'))
  }
  if (query.to) {
    where.push('b.start_at < ?')
    params.push(parseDateParam(query.to, 'to'))
  }
  if (query.search && admin) {
    where.push('(b.booking_ref LIKE ? OR b.event_name LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)')
    const like = `%${String(query.search).slice(0, 120)}%`
    params.push(like, like, like, like)
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
}

function parseSort(query, allowed) {
  const sort = query.sort ?? '-created_at'
  if (!allowed.includes(sort)) {
    throw badRequest('Request validation failed', [{ field: 'sort', message: `sort must be one of: ${allowed.join(', ')}` }])
  }
  const desc = sort.startsWith('-')
  const field = sort.replace(/^-/, '')
  const map = { start_at: 'b.start_at', created_at: 'b.created_at', status: 'b.status' }
  return `ORDER BY ${map[field] ?? 'b.created_at'} ${desc ? 'DESC' : 'ASC'}, b.id DESC`
}

function intQuery(query, field, { min = 1, max } = {}) {
  if (query[field] === undefined || query[field] === '') return undefined
  const n = Number(query[field])
  if (!Number.isInteger(n) || n < min || (max !== undefined && n > max)) {
    throw badRequest('Request validation failed', [{ field, message: `${field} must be an integer ${min}-${max ?? '∞'}` }])
  }
  return n
}

export async function listBookings(user, query) {
  const admin = user.role === 'admin'
  const { whereSql, params } = bookingFilters(query, { admin })
  // Customers always see only their own bookings; admins may optionally filter by user_id.
  const scopeSql = admin && query.user_id ? '' : 'b.user_id = ?'
  const conditions = [scopeSql, whereSql.replace(/^WHERE /, '')].filter(Boolean)
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const scopedParams = admin && query.user_id ? params : [user.id, ...params]
  const page = intQuery(query, 'page') ?? 1
  const pageSize = intQuery(query, 'page_size', { max: 100 }) ?? 20
  const pool = getPool()

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS n FROM bookings b JOIN users u ON u.id = b.user_id ${whereClause}`,
    scopedParams,
  )
  const total = countRows[0].n
  const [rows] = await pool.query(
    `${BOOKING_SELECT} ${whereClause} ${parseSort(query, CUSTOMER_SORTS)} LIMIT ? OFFSET ?`,
    [...scopedParams, pageSize, (page - 1) * pageSize],
  )
  return {
    data: rows.map((r) => bookingJson(r, { includeCustomer: admin })),
    pagination: { page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) },
  }
}

export async function adminListBookings(query) {
  const { whereSql, params } = bookingFilters(query, { admin: true })
  const page = intQuery(query, 'page') ?? 1
  const pageSize = intQuery(query, 'page_size', { max: 100 }) ?? 20
  const pool = getPool()

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS n FROM bookings b JOIN users u ON u.id = b.user_id ${whereSql}`,
    params,
  )
  const total = countRows[0].n
  const [rows] = await pool.query(
    `${BOOKING_SELECT} ${whereSql} ${parseSort(query, ADMIN_SORTS)} LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  )

  // Status counts under the same non-status filters (queue badges).
  const countFilters = { ...query }
  delete countFilters.status
  const { whereSql: countWhere, params: countParams } = bookingFilters(countFilters, { admin: true })
  const [statusRows] = await pool.query(
    `SELECT b.status, COUNT(*) AS n FROM bookings b JOIN users u ON u.id = b.user_id ${countWhere} GROUP BY b.status`,
    countParams,
  )
  const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0, completed: 0 }
  for (const r of statusRows) counts[r.status] = r.n

  return {
    data: rows.map((r) => bookingJson(r, { includeCustomer: true })),
    pagination: { page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) },
    counts,
  }
}

export async function getBookingForUser(bookingId, user) {
  const pool = getPool()
  const [rows] = await pool.query(
    `${BOOKING_SELECT} WHERE b.id = ?`,
    [bookingId],
  )
  const booking = rows[0]
  if (!booking) throw notFound('Booking not found')
  if (user.role !== 'admin' && booking.user_id !== user.id) {
    throw forbidden('You can only access your own bookings')
  }
  const [events] = await pool.query(
    `SELECT be.id, be.from_status, be.to_status, be.note, be.created_at, u.full_name AS actor_name
     FROM booking_events be LEFT JOIN users u ON u.id = be.actor_id
     WHERE be.booking_id = ? ORDER BY be.id`,
    [bookingId],
  )
  return {
    ...bookingJson(booking, { includeCustomer: user.role === 'admin' }),
    events: events.map((e) => ({
      id: e.id,
      from_status: e.from_status,
      to_status: e.to_status,
      note: e.note,
      actor_name: e.actor_name,
      created_at: toISO(e.created_at),
    })),
  }
}

export async function cancelBooking(bookingId, user, reason) {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [bookingId])
    const booking = rows[0]
    if (!booking) throw notFound('Booking not found')
    if (user.role !== 'admin' && booking.user_id !== user.id) {
      throw forbidden('You can only cancel your own bookings')
    }
    if (!['pending', 'approved'].includes(booking.status)) {
      throw conflict(`Booking cannot be cancelled from status '${booking.status}'`)
    }
    await conn.query(
      `UPDATE bookings SET status = 'cancelled' WHERE id = ?`,
      [bookingId],
    )
    await conn.query(
      `INSERT INTO booking_events (booking_id, actor_id, from_status, to_status, note)
       VALUES (?, ?, ?, 'cancelled', ?)`,
      [bookingId, user.id, booking.status, reason ?? 'Booking cancelled'],
    )
    await conn.commit()
    const [out] = await conn.query(`${BOOKING_SELECT} WHERE b.id = ?`, [bookingId])
    return bookingJson(out[0], { includeCustomer: user.role === 'admin' })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function transitionBooking(bookingId, adminId, action, adminNotes) {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [bookingId])
    const booking = rows[0]
    if (!booking) throw notFound('Booking not found')
    if (booking.status !== 'pending') {
      throw conflict(`Booking cannot be ${action === 'approve' ? 'approved' : 'rejected'} from status '${booking.status}'`)
    }

    if (action === 'approve') {
      // Lock the hall row — serializes concurrent approvals for this hall.
      const [halls] = await conn.query('SELECT id, capacity FROM halls WHERE id = ? FOR UPDATE', [booking.hall_id])
      const hall = halls[0]
      if (!hall) throw notFound('Hall not found')
      if (booking.guest_count !== null && booking.guest_count > hall.capacity) {
        throw new HttpError(
          409, 'BOOKING_CONFLICT',
          'Booking can no longer be approved: guest count exceeds current hall capacity',
          [{ type: 'capacity', guest_count: booking.guest_count, capacity: hall.capacity }],
        )
      }
      const conflicts = await findConflict(conn, hall.id, booking.start_at, booking.end_at, booking.id)
      if (conflicts.bookings.length || conflicts.maintenance.length) {
        throw bookingConflict(conflicts)
      }
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    await conn.query(
      `UPDATE bookings SET status = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(3), admin_notes = COALESCE(?, admin_notes) WHERE id = ?`,
      [newStatus, adminId, adminNotes ?? null, bookingId],
    )
    await conn.query(
      `INSERT INTO booking_events (booking_id, actor_id, from_status, to_status, note)
       VALUES (?, ?, 'pending', ?, ?)`,
      [bookingId, adminId, newStatus, adminNotes ?? null],
    )
    await conn.commit()
    const [out] = await conn.query(`${BOOKING_SELECT} WHERE b.id = ?`, [bookingId])
    return bookingJson(out[0], { includeCustomer: true })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
