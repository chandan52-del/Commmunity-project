import { getPool } from '../db.js'
import { badRequest, notFound, conflict } from '../middleware/errorHandler.js'

const SORTABLE = {
  name: 'name',
  capacity: 'capacity',
  base_price: 'base_price',
  created_at: 'created_at',
}

const toISO = (v) => (v instanceof Date ? v.toISOString() : v)

function hallJson(row, amenities = []) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    location: row.location ?? null,
    capacity: row.capacity,
    base_price: row.base_price,
    status: row.status,
    cover_image_url: row.cover_image_url ?? null,
    amenities,
    created_at: toISO(row.created_at),
  }
}

async function amenitiesFor(conn, hallIds) {
  if (hallIds.length === 0) return new Map()
  const [rows] = await conn.query(
    `SELECT ha.hall_id, a.name
     FROM hall_amenities ha JOIN amenities a ON a.id = ha.amenity_id
     WHERE ha.hall_id IN (?) ORDER BY a.name`,
    [hallIds],
  )
  const map = new Map()
  for (const r of rows) {
    if (!map.has(r.hall_id)) map.set(r.hall_id, [])
    map.get(r.hall_id).push(r.name)
  }
  return map
}

async function imagesFor(conn, hallId) {
  const [rows] = await conn.query(
    'SELECT id, image_url, sort_order FROM hall_images WHERE hall_id = ? ORDER BY sort_order, id',
    [hallId],
  )
  return rows
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
}

async function uniqueSlug(conn, name, excludeId = null) {
  const base = slugify(name) || 'hall'
  let slug = base
  for (let i = 2; ; i++) {
    const [rows] = await conn.query(
      'SELECT id FROM halls WHERE slug = ? AND id <> ?',
      [slug, excludeId ?? 0],
    )
    if (rows.length === 0) return slug
    slug = `${base}-${i}`.slice(0, 180)
  }
}

// Resolves a hall by numeric id or slug. activeOnly=true restricts to active halls.
export async function findHall(ref, { activeOnly = false } = {}) {
  const pool = getPool()
  const isId = /^\d+$/.test(String(ref))
  const where = activeOnly ? ' AND status = \'active\'' : ''
  const [rows] = isId
    ? await pool.query(`SELECT * FROM halls WHERE (id = ? OR slug = ?)${where} LIMIT 1`, [
        Number(ref),
        String(ref),
      ])
    : await pool.query(`SELECT * FROM halls WHERE slug = ?${where} LIMIT 1`, [String(ref)])
  return rows[0] ?? null
}

export async function listHalls({ page, pageSize, search, location, minCapacity, maxCapacity, sort }) {
  const pool = getPool()
  const where = ["status = 'active'"]
  const params = []
  if (search) {
    where.push('(name LIKE ? OR location LIKE ? OR description LIKE ?)')
    const like = `%${search}%`
    params.push(like, like, like)
  }
  if (location) {
    where.push('location LIKE ?')
    params.push(`%${location}%`)
  }
  if (minCapacity !== undefined) {
    where.push('capacity >= ?')
    params.push(minCapacity)
  }
  if (maxCapacity !== undefined) {
    where.push('capacity <= ?')
    params.push(maxCapacity)
  }
  const whereSql = `WHERE ${where.join(' AND ')}`

  const [countRows] = await pool.query(`SELECT COUNT(*) AS n FROM halls ${whereSql}`, params)
  const total = countRows[0].n

  const dir = sort.startsWith('-') ? 'DESC' : 'ASC'
  const col = SORTABLE[sort.replace(/^-/, '')] ?? 'name'
  const [rows] = await pool.query(
    `SELECT * FROM halls ${whereSql} ORDER BY ${col} ${dir}, id ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  )

  const amenityMap = await amenitiesFor(pool, rows.map((r) => r.id))
  return {
    data: rows.map((r) => hallJson(r, amenityMap.get(r.id) ?? [])),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

export async function getHallDetail(ref) {
  const pool = getPool()
  const hall = await findHall(ref, { activeOnly: true })
  if (!hall) throw notFound('Hall not found')
  const amenityMap = await amenitiesFor(pool, [hall.id])
  const images = await imagesFor(pool, hall.id)
  return {
    ...hallJson(hall, amenityMap.get(hall.id) ?? []),
    images,
    updated_at: toISO(hall.updated_at),
  }
}

async function replaceAmenities(conn, hallId, names) {
  await conn.query('DELETE FROM hall_amenities WHERE hall_id = ?', [hallId])
  for (const name of names) {
    const [res] = await conn.query(
      'INSERT INTO amenities (name) VALUES (?) ON DUPLICATE KEY UPDATE name = name',
      [name],
    )
    let [a] = await conn.query('SELECT id FROM amenities WHERE name = ?', [name])
    const amenityId = a[0]?.id ?? res.insertId
    await conn.query(
      'INSERT IGNORE INTO hall_amenities (hall_id, amenity_id) VALUES (?, ?)',
      [hallId, amenityId],
    )
  }
}

const HALL_WRITABLE = ['name', 'description', 'location', 'capacity', 'base_price', 'status', 'cover_image_url']

function validateHallFields(input, { partial = false } = {}) {
  const errors = []
  const out = {}
  const need = (f) => !partial || input[f] !== undefined
  if (need('name')) {
    if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.length > 160) {
      errors.push({ field: 'name', message: 'name must be 2-160 characters' })
    } else out.name = input.name.trim()
  }
  if (need('capacity')) {
    const n = Number(input.capacity)
    if (!Number.isInteger(n) || n < 1) errors.push({ field: 'capacity', message: 'capacity must be an integer >= 1' })
    else out.capacity = n
  }
  if (need('base_price')) {
    const n = Number(input.base_price)
    if (!Number.isFinite(n) || n < 0) errors.push({ field: 'base_price', message: 'base_price must be a number >= 0' })
    else out.base_price = n
  }
  if (need('status') && input.status !== undefined) {
    if (!['active', 'inactive', 'maintenance'].includes(input.status)) {
      errors.push({ field: 'status', message: 'status must be active, inactive, or maintenance' })
    } else out.status = input.status
  }
  for (const f of ['description', 'location', 'cover_image_url']) {
    if (need(f) && input[f] !== undefined) {
      if (input[f] !== null && typeof input[f] !== 'string') {
        errors.push({ field: f, message: `${f} must be a string or null` })
      } else out[f] = input[f]
    }
  }
  if (input.amenities !== undefined) {
    if (!Array.isArray(input.amenities) || input.amenities.some((a) => typeof a !== 'string' || a.length > 80)) {
      errors.push({ field: 'amenities', message: 'amenities must be an array of strings (<=80 chars)' })
    } else out.amenities = input.amenities.map((a) => a.trim()).filter(Boolean)
  }
  if (errors.length) throw badRequest('Request validation failed', errors)
  return out
}

export async function createHall(input) {
  const fields = validateHallFields(input)
  for (const f of ['name', 'capacity', 'base_price']) {
    if (fields[f] === undefined) throw badRequest('Request validation failed', [{ field: f, message: `${f} is required` }])
  }
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const slug = await uniqueSlug(conn, fields.name)
    const cols = ['name', 'slug', ...HALL_WRITABLE.filter((f) => f !== 'name' && fields[f] !== undefined)]
    const vals = [fields.name, slug, ...cols.slice(2).map((f) => fields[f])]
    const [res] = await conn.query(
      `INSERT INTO halls (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      vals,
    )
    const hallId = res.insertId
    if (fields.amenities) await replaceAmenities(conn, hallId, fields.amenities)
    await conn.commit()
    return getHallDetail(hallId)
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function updateHall(id, input) {
  const fields = validateHallFields(input, { partial: true })
  const { amenities, ...cols } = fields
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [existing] = await conn.query('SELECT * FROM halls WHERE id = ?', [id])
    if (!existing[0]) throw notFound('Hall not found')
    if (Object.keys(cols).length > 0) {
      const setSql = Object.keys(cols).map((f) => `${f} = ?`).join(', ')
      await conn.query(`UPDATE halls SET ${setSql} WHERE id = ?`, [...Object.values(cols), id])
    }
    if (amenities !== undefined) await replaceAmenities(conn, id, amenities)
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
  return getHallDetail(id)
}

export async function deactivateHall(id) {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    // Lock the hall row (same lock booking approval takes) so a concurrent
    // approval cannot slip between the conflict check and the update.
    const [existing] = await conn.query('SELECT id, status FROM halls WHERE id = ? FOR UPDATE', [id])
    if (!existing[0]) throw notFound('Hall not found')
    const [future] = await conn.query(
      `SELECT COUNT(*) AS n FROM bookings
       WHERE hall_id = ? AND status = 'approved' AND end_at > UTC_TIMESTAMP(3)`,
      [id],
    )
    if (future[0].n > 0) {
      throw conflict('Hall has future approved bookings and cannot be deactivated')
    }
    await conn.query("UPDATE halls SET status = 'inactive' WHERE id = ?", [id])
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function getAvailability(ref, from, to) {
  const pool = getPool()
  const hall = await findHall(ref) // any status — hall_status is reported
  if (!hall) throw notFound('Hall not found')

  const [bookings] = await pool.query(
    `SELECT start_at, end_at, id FROM bookings
     WHERE hall_id = ? AND status = 'approved' AND start_at < ? AND end_at > ?`,
    [hall.id, to, from],
  )
  const [maintenance] = await pool.query(
    `SELECT start_at, end_at, id FROM maintenance_windows
     WHERE hall_id = ? AND status IN ('scheduled','in_progress') AND start_at < ? AND end_at > ?`,
    [hall.id, to, from],
  )

  const busy = [
    ...bookings.map((b) => ({
      start: toISO(b.start_at),
      end: toISO(b.end_at),
      type: 'booking',
      booking_id: b.id,
    })),
    ...maintenance.map((m) => ({
      start: toISO(m.start_at),
      end: toISO(m.end_at),
      type: 'maintenance',
      maintenance_id: m.id,
    })),
  ].sort((a, b) => a.start.localeCompare(b.start))

  return { hall_id: hall.id, hall_status: hall.status, busy_ranges: busy }
}
