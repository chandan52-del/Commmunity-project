import { getPool } from '../db.js'
import { badRequest } from '../middleware/errorHandler.js'

const BOOKING_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'completed']
const GROUP_BYS = ['status', 'hall', 'month']

const dec = (v) => (v === null || v === undefined ? '0.00' : Number(v).toFixed(2))

function parseDT(value, field) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    throw badRequest('Request validation failed', [{ field, message: `${field} must be an ISO 8601 datetime` }])
  }
  return d
}

export async function getDashboard() {
  const pool = getPool()

  const [hallRows] = await pool.query('SELECT status, COUNT(*) AS n FROM halls GROUP BY status')
  const halls = { total: 0, active: 0, inactive: 0, maintenance: 0 }
  for (const r of hallRows) {
    halls.total += r.n
    if (r.status in halls) halls[r.status] += r.n
  }

  const [userRows] = await pool.query('SELECT role, COUNT(*) AS n FROM users GROUP BY role')
  const users = { total: 0, customers: 0, admins: 0 }
  for (const r of userRows) {
    users.total += r.n
    if (r.role === 'customer') users.customers += r.n
    if (r.role === 'admin') users.admins += r.n
  }

  const [bookingRows] = await pool.query('SELECT status, COUNT(*) AS n FROM bookings GROUP BY status')
  const bookings = { pending: 0, approved: 0, rejected: 0, cancelled: 0, completed: 0 }
  for (const r of bookingRows) if (r.status in bookings) bookings[r.status] += r.n

  const [[upcoming]] = await pool.query(
    `SELECT COUNT(*) AS n, COALESCE(SUM(quoted_amount), 0) AS revenue
     FROM bookings WHERE status = 'approved' AND start_at > UTC_TIMESTAMP(3)`,
  )
  const [[maint]] = await pool.query(
    `SELECT COUNT(*) AS n FROM maintenance_windows
     WHERE status IN ('scheduled','in_progress')
       AND start_at <= UTC_TIMESTAMP(3) AND end_at > UTC_TIMESTAMP(3)`,
  )

  return {
    halls,
    users,
    bookings,
    upcoming_approved_bookings: upcoming.n,
    pending_requests: bookings.pending,
    active_maintenance_windows: maint.n,
    estimated_revenue: dec(upcoming.revenue),
  }
}

export async function getReports(query) {
  if (!query.from || !query.to) {
    throw badRequest('Request validation failed', [
      { field: 'from', message: 'from is required' },
      { field: 'to', message: 'to is required' },
    ])
  }
  const from = parseDT(query.from, 'from')
  const to = parseDT(query.to, 'to')
  if (!(to > from)) {
    throw badRequest('Request validation failed', [{ field: 'to', message: 'to must be after from' }])
  }
  if (to - from > 366 * 24 * 60 * 60 * 1000) {
    throw badRequest('Request validation failed', [{ field: 'to', message: 'date range must not exceed 366 days' }])
  }
  const groupBy = query.group_by ?? 'status'
  if (!GROUP_BYS.includes(groupBy)) {
    throw badRequest('Request validation failed', [{ field: 'group_by', message: `group_by must be one of: ${GROUP_BYS.join(', ')}` }])
  }
  let hallId = null
  if (query.hall_id !== undefined && query.hall_id !== '') {
    hallId = Number(query.hall_id)
    if (!Number.isInteger(hallId) || hallId < 1) {
      throw badRequest('Request validation failed', [{ field: 'hall_id', message: 'hall_id must be a positive integer' }])
    }
  }

  const pool = getPool()
  const where = ['b.start_at >= ?', 'b.start_at < ?']
  const params = [from, to]
  if (hallId) { where.push('b.hall_id = ?'); params.push(hallId) }
  const whereSql = `WHERE ${where.join(' AND ')}`

  const [totalRows] = await pool.query(
    `SELECT COUNT(*) AS bookings,
            COALESCE(SUM(quoted_amount), 0) AS quoted_amount_total,
            SUM(status = 'approved') AS approved,
            SUM(status = 'pending') AS pending,
            SUM(status = 'rejected') AS rejected,
            SUM(status = 'cancelled') AS cancelled,
            SUM(status = 'completed') AS completed
     FROM bookings b ${whereSql}`,
    params,
  )
  const t = totalRows[0]
  const totals = {
    bookings: t.bookings,
    approved: Number(t.approved) || 0,
    pending: Number(t.pending) || 0,
    rejected: Number(t.rejected) || 0,
    cancelled: Number(t.cancelled) || 0,
    completed: Number(t.completed) || 0,
    quoted_amount_total: dec(t.quoted_amount_total),
  }

  let breakdown = []
  if (groupBy === 'status') {
    const [rows] = await pool.query(
      `SELECT b.status AS grp, COUNT(*) AS count, COALESCE(SUM(b.quoted_amount), 0) AS quoted_amount
       FROM bookings b ${whereSql} GROUP BY b.status ORDER BY b.status`,
      params,
    )
    const labels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled', completed: 'Completed' }
    breakdown = rows.map((r) => ({ key: r.grp, label: labels[r.grp] ?? r.grp, count: r.count, quoted_amount: dec(r.quoted_amount) }))
  } else if (groupBy === 'hall') {
    const [rows] = await pool.query(
      `SELECT b.hall_id AS grp, h.name AS label, COUNT(*) AS count, COALESCE(SUM(b.quoted_amount), 0) AS quoted_amount
       FROM bookings b JOIN halls h ON h.id = b.hall_id ${whereSql}
       GROUP BY b.hall_id, h.name ORDER BY count DESC`,
      params,
    )
    breakdown = rows.map((r) => ({ key: String(r.grp), label: r.label, count: r.count, quoted_amount: dec(r.quoted_amount) }))
  } else {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(b.start_at, '%Y-%m') AS grp,
              DATE_FORMAT(b.start_at, '%Y-%m') AS label,
              COUNT(*) AS count, COALESCE(SUM(b.quoted_amount), 0) AS quoted_amount
       FROM bookings b ${whereSql}
       GROUP BY grp ORDER BY grp`,
      params,
    )
    breakdown = rows.map((r) => ({ key: r.grp, label: r.label, count: r.count, quoted_amount: dec(r.quoted_amount) }))
  }

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    totals,
    breakdown,
  }
}
