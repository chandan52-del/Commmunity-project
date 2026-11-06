// Dashboard + reports integration tests — live MySQL from .env.
// Requires SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env.

process.env.JWT_SECRET ??= 'test-secret-not-for-production'

const { test, before, after } = await import('node:test')
const assert = (await import('node:assert/strict')).default
const { createApp } = await import('../src/app.js')
const { getPool } = await import('../src/db.js')

let server
let base
let adminToken
let customerToken
let customerId
const hallIds = []
const bookingIds = []
const maintIds = []

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(`${base}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function login(email, password) {
  const res = await api('/api/auth/login', { method: 'POST', body: { email, password } })
  assert.equal(res.status, 200)
  return res.json.data.access_token
}

async function createHall() {
  const res = await api('/api/admin/halls', {
    method: 'POST', token: adminToken,
    body: { name: `Test Report Hall ${uniq()}`, capacity: 50, base_price: 300 },
  })
  assert.equal(res.status, 201)
  hallIds.push(res.json.data.id)
  return res.json.data
}

async function createBooking(hallId, start, end, guestCount = 10) {
  const res = await api('/api/bookings', {
    method: 'POST', token: customerToken,
    body: {
      hall_id: hallId, event_name: 'Report Ev', event_type: 'party',
      start_at: start, end_at: end, guest_count: guestCount,
    },
  })
  assert.equal(res.status, 201, JSON.stringify(res.json))
  bookingIds.push(res.json.data.id)
  return res.json.data
}

before(async () => {
  const app = createApp()
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve) })
  base = `http://127.0.0.1:${server.address().port}`
  adminToken = await login(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD)
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: 'Report Test', email: `reporttest-${uniq()}@example.com`, password: 'Password123' },
  })
  assert.equal(reg.status, 201)
  customerToken = reg.json.data.access_token
  customerId = reg.json.data.user.id
})

after(async () => {
  const pool = getPool()
  try {
    server?.closeAllConnections?.()
    server?.close()
    if (bookingIds.length) {
      const ph = bookingIds.map(() => '?').join(',')
      await pool.query(`DELETE FROM booking_events WHERE booking_id IN (${ph})`, bookingIds)
      await pool.query(`DELETE FROM bookings WHERE id IN (${ph})`, bookingIds)
    }
    if (maintIds.length) {
      const ph = maintIds.map(() => '?').join(',')
      await pool.query(`DELETE FROM maintenance_windows WHERE id IN (${ph})`, maintIds)
    }
    if (hallIds.length) {
      const ph = hallIds.map(() => '?').join(',')
      await pool.query(
        `DELETE be FROM booking_events be JOIN bookings b ON b.id = be.booking_id WHERE b.hall_id IN (${ph})`, hallIds)
      await pool.query(`DELETE FROM bookings WHERE hall_id IN (${ph})`, hallIds)
      await pool.query(`DELETE FROM maintenance_windows WHERE hall_id IN (${ph})`, hallIds)
      await pool.query(`DELETE FROM halls WHERE id IN (${ph})`, hallIds)
    }
    await pool.query(
      `DELETE be FROM booking_events be JOIN bookings b ON b.id = be.booking_id
       JOIN users u ON u.id = b.user_id WHERE u.email LIKE '%@example.com'`)
    await pool.query(
      `DELETE FROM booking_events WHERE actor_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')`)
    await pool.query(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com') ORDER BY id DESC`)
    await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'")
  } finally {
    await pool.end()
  }
})

test('dashboard and reports require admin', async () => {
  assert.equal((await api('/api/admin/dashboard')).status, 401)
  assert.equal((await api('/api/admin/reports?from=2027-01-01&to=2027-02-01')).status, 401)
  assert.equal((await api('/api/admin/dashboard', { token: customerToken })).status, 403)
  assert.equal((await api('/api/admin/reports?from=2027-01-01&to=2027-02-01', { token: customerToken })).status, 403)
})

test('dashboard returns real aggregate counts', async () => {
  const hall = await createHall()
  const b1 = await createBooking(hall.id, '2027-01-10T10:00:00.000Z', '2027-01-10T12:00:00.000Z')
  await createBooking(hall.id, '2027-01-11T10:00:00.000Z', '2027-01-11T12:00:00.000Z')
  // approve b1 via admin
  const ap = await api(`/api/admin/bookings/${b1.id}/approve`, { method: 'PATCH', token: adminToken, body: {} })
  assert.equal(ap.status, 200)

  const res = await api('/api/admin/dashboard', { token: adminToken })
  assert.equal(res.status, 200, JSON.stringify(res.json))
  const d = res.json.data
  assert.ok(d.halls.total >= 1 && d.halls.active >= 1)
  assert.ok(d.users.total >= 2 && d.users.customers >= 1 && d.users.admins >= 1)
  assert.ok(d.bookings.pending >= 1)
  assert.ok(d.bookings.approved >= 1)
  assert.equal(d.pending_requests, d.bookings.pending)
  assert.ok(typeof d.active_maintenance_windows === 'number')
  assert.match(d.estimated_revenue, /^\d+\.\d{2}$/)
  // no sensitive fields anywhere
  assert.ok(!JSON.stringify(d).includes('password'))
})

test('reports: validation, status breakdown, filters and ranges', async () => {
  // missing params
  assert.equal((await api('/api/admin/reports', { token: adminToken })).status, 400)
  // bad range order
  assert.equal((await api('/api/admin/reports?from=2027-02-01&to=2027-01-01', { token: adminToken })).status, 400)
  // range too large
  assert.equal((await api('/api/admin/reports?from=2026-01-01&to=2028-01-01', { token: adminToken })).status, 400)
  // bad group_by
  assert.equal((await api('/api/admin/reports?from=2027-01-01&to=2027-02-01&group_by=evil', { token: adminToken })).status, 400)

  const hall = await createHall()
  // one approved (300.00) + one pending in Jan 2027, one in Feb 2027
  const jan1 = await createBooking(hall.id, '2027-01-05T10:00:00.000Z', '2027-01-05T12:00:00.000Z')
  await api(`/api/admin/bookings/${jan1.id}/approve`, { method: 'PATCH', token: adminToken, body: {} })
  await createBooking(hall.id, '2027-01-20T10:00:00.000Z', '2027-01-20T12:00:00.000Z')
  await createBooking(hall.id, '2027-02-05T10:00:00.000Z', '2027-02-05T12:00:00.000Z')

  const jan = await api(
    `/api/admin/reports?from=2027-01-01T00:00:00.000Z&to=2027-02-01T00:00:00.000Z&hall_id=${hall.id}&group_by=status`,
    { token: adminToken })
  assert.equal(jan.status, 200, JSON.stringify(jan.json))
  const r = jan.json.data
  assert.equal(r.range.from, '2027-01-01T00:00:00.000Z')
  assert.equal(r.totals.bookings, 2)
  assert.equal(r.totals.approved, 1)
  assert.equal(r.totals.pending, 1)
  assert.equal(r.totals.quoted_amount_total, '600.00')
  const approvedRow = r.breakdown.find((x) => x.key === 'approved')
  assert.equal(approvedRow.count, 1)
  assert.equal(approvedRow.quoted_amount, '300.00')
  assert.equal(approvedRow.label, 'Approved')

  // month grouping
  const byMonth = await api(
    `/api/admin/reports?from=2027-01-01T00:00:00.000Z&to=2027-03-01T00:00:00.000Z&hall_id=${hall.id}&group_by=month`,
    { token: adminToken })
  assert.equal(byMonth.status, 200)
  const keys = byMonth.json.data.breakdown.map((x) => x.key)
  assert.ok(keys.includes('2027-01') && keys.includes('2027-02'))

  // hall grouping
  const byHall = await api(
    `/api/admin/reports?from=2027-01-01T00:00:00.000Z&to=2027-03-01T00:00:00.000Z&group_by=hall`,
    { token: adminToken })
  assert.equal(byHall.status, 200)
  assert.ok(byHall.json.data.breakdown.some((x) => x.key === String(hall.id)))

  // empty range → zeros, empty breakdown
  const empty = await api(
    '/api/admin/reports?from=2030-01-01T00:00:00.000Z&to=2030-02-01T00:00:00.000Z',
    { token: adminToken })
  assert.equal(empty.status, 200)
  assert.equal(empty.json.data.totals.bookings, 0)
  assert.deepEqual(empty.json.data.breakdown, [])
})
