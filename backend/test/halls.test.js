// Halls + availability integration tests — uses the DB from .env.
// Creates test halls/bookings/maintenance and removes them in after().
// Admin endpoints require SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env.

process.env.JWT_SECRET ??= 'test-secret-not-for-production'

const { test, before, after } = await import('node:test')
const assert = (await import('node:assert/strict')).default
const { createApp } = await import('../src/app.js')
const { getPool } = await import('../src/db.js')

let server
let base
let adminToken
let adminId
let customerToken
let customerId
const hallIds = []

function cookieOf(res) {
  const setCookie = res.headers.getSetCookie?.() ?? []
  for (const c of setCookie) if (c.startsWith('refresh_token=')) return c.split(';')[0]
  return null
}

async function api(path, { method = 'GET', body, token, cookie } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  if (cookie) headers.cookie = cookie
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json, setCookie: cookieOf(res) }
}

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function login(email, password) {
  const res = await api('/api/auth/login', { method: 'POST', body: { email, password } })
  assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(res.json)}`)
  return res.json.data.access_token
}

before(async () => {
  const app = createApp()
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`

  adminToken = await login(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD)
  const [adminRows] = await getPool().query('SELECT id FROM users WHERE email = ?', [
    process.env.SEED_ADMIN_EMAIL,
  ])
  adminId = adminRows[0].id

  const email = `halltest-${uniq()}@example.com`
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: 'Hall Test Customer', email, password: 'Password123' },
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
    if (hallIds.length) {
      const ph = hallIds.map(() => '?').join(',')
      await pool.query(`DELETE FROM bookings WHERE hall_id IN (${ph})`, hallIds)
      await pool.query(`DELETE FROM maintenance_windows WHERE hall_id IN (${ph})`, hallIds)
      await pool.query(`DELETE FROM halls WHERE id IN (${ph})`, hallIds)
    }
    await pool.query(
      `DELETE FROM refresh_tokens
       WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')
       ORDER BY id DESC`,
    )
    await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'")
    await pool.query("DELETE FROM amenities WHERE name LIKE 'TestAmenity%'")
  } finally {
    await pool.end()
  }
})

test('admin endpoints require auth and admin role', async () => {
  const noAuth = await api('/api/admin/halls', { method: 'POST', body: {} })
  assert.equal(noAuth.status, 401)

  const asCustomer = await api('/api/admin/halls', {
    method: 'POST',
    token: customerToken,
    body: {},
  })
  assert.equal(asCustomer.status, 403)
  assert.equal(asCustomer.json.error.code, 'FORBIDDEN')
})

test('admin creates a hall with amenities; appears in public list and detail', async () => {
  const res = await api('/api/admin/halls', {
    method: 'POST',
    token: adminToken,
    body: {
      name: `Test Hall ${uniq()}`,
      description: 'Test venue',
      location: 'Test District',
      capacity: 120,
      base_price: 500,
      amenities: ['TestAmenity A', 'TestAmenity B'],
    },
  })
  assert.equal(res.status, 201, JSON.stringify(res.json))
  const hall = res.json.data
  hallIds.push(hall.id)
  assert.equal(hall.status, 'active')
  assert.deepEqual([...hall.amenities].sort(), ['TestAmenity A', 'TestAmenity B'])
  assert.ok(hall.slug.length > 0)

  const detail = await api(`/api/halls/${hall.id}`)
  assert.equal(detail.status, 200)
  assert.equal(detail.json.data.id, hall.id)
  assert.ok(Array.isArray(detail.json.data.images))

  // slug lookup also works
  const bySlug = await api(`/api/halls/${hall.slug}`)
  assert.equal(bySlug.status, 200)
})

test('public list: pagination, filters, sorting, active-only', async () => {
  const all = await api('/api/halls?page=1&page_size=100')
  assert.equal(all.status, 200)
  assert.ok(all.json.pagination.total >= 1)
  assert.ok(all.json.data.every((h) => h.status === 'active'))
  assert.ok(all.json.data.every((h) => !('password_hash' in h)))

  const p1 = await api('/api/halls?page=1&page_size=1')
  assert.equal(p1.status, 200)
  assert.equal(p1.json.data.length, 1)
  assert.equal(p1.json.pagination.page_size, 1)
  assert.ok(p1.json.pagination.total >= 1)

  const filtered = await api(`/api/halls?search=${encodeURIComponent('Test District')}&min_capacity=100&sort=-capacity`)
  assert.equal(filtered.status, 200)
  assert.ok(filtered.json.data.length >= 1)

  const bad = await api('/api/halls?sort=evil;DROP')
  assert.equal(bad.status, 400)

  const badPage = await api('/api/halls?page_size=500')
  assert.equal(badPage.status, 400)
})

test('inactive and nonexistent halls return 404 publicly', async () => {
  // create + deactivate a hall
  const create = await api('/api/admin/halls', {
    method: 'POST',
    token: adminToken,
    body: { name: `Test Gone ${uniq()}`, capacity: 10, base_price: 1 },
  })
  hallIds.push(create.json.data.id)
  await api(`/api/admin/halls/${create.json.data.id}`, { method: 'DELETE', token: adminToken })

  const res = await api(`/api/halls/${create.json.data.id}`)
  assert.equal(res.status, 404)
  const missing = await api('/api/halls/999999')
  assert.equal(missing.status, 404)
})

test('admin partial update and deactivation', async () => {
  const create = await api('/api/admin/halls', {
    method: 'POST',
    token: adminToken,
    body: { name: `Test Patch ${uniq()}`, capacity: 50, base_price: 100, location: 'Old' },
  })
  const id = create.json.data.id
  hallIds.push(id)

  const patch = await api(`/api/admin/halls/${id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { location: 'New Location', capacity: 75 },
  })
  assert.equal(patch.status, 200)
  assert.equal(patch.json.data.location, 'New Location')
  assert.equal(patch.json.data.capacity, 75)
  assert.equal(patch.json.data.base_price, '100.00')

  const del = await api(`/api/admin/halls/${id}`, { method: 'DELETE', token: adminToken })
  assert.equal(del.status, 204)
  const gone = await api(`/api/halls/${id}`)
  assert.equal(gone.status, 404)
})

test('availability reflects approved bookings and maintenance only', async () => {
  const create = await api('/api/admin/halls', {
    method: 'POST',
    token: adminToken,
    body: { name: `Test Avail ${uniq()}`, capacity: 80, base_price: 200 },
  })
  const hall = create.json.data
  hallIds.push(hall.id)

  const pool = getPool()
  const from = '2027-01-01T00:00:00.000Z'
  const to = '2027-02-01T00:00:00.000Z'
  // approved booking + pending booking (must NOT appear) + maintenance
  await pool.query(
    `INSERT INTO bookings (booking_ref, user_id, hall_id, event_name, event_type, start_at, end_at, status)
     VALUES (?, ?, ?, 'Approved Ev', 'test', ?, ?, 'approved')`,
    [`CH-TEST-${uniq()}`, customerId, hall.id, '2027-01-10 10:00:00', '2027-01-10 14:00:00'],
  )
  await pool.query(
    `INSERT INTO bookings (booking_ref, user_id, hall_id, event_name, event_type, start_at, end_at, status)
     VALUES (?, ?, ?, 'Pending Ev', 'test', ?, ?, 'pending')`,
    [`CH-TEST-${uniq()}`, customerId, hall.id, '2027-01-15 10:00:00', '2027-01-15 14:00:00'],
  )
  await pool.query(
    `INSERT INTO maintenance_windows (hall_id, title, start_at, end_at, status, created_by)
     VALUES (?, 'Test Maintenance', ?, ?, 'scheduled', ?)`,
    [hall.id, '2027-01-20 08:00:00', '2027-01-20 12:00:00', adminId],
  )

  const res = await api(`/api/halls/${hall.id}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  assert.equal(res.status, 200, JSON.stringify(res.json))
  const ranges = res.json.data.busy_ranges
  assert.equal(ranges.length, 2)
  assert.ok(ranges.some((r) => r.type === 'booking' && r.start.startsWith('2027-01-10')))
  assert.ok(ranges.some((r) => r.type === 'maintenance' && r.start.startsWith('2027-01-20')))
  assert.ok(!ranges.some((r) => r.start.startsWith('2027-01-15')), 'pending booking must not block')
  assert.equal(res.json.data.hall_status, 'active')

  const badRange = await api(`/api/halls/${hall.id}/availability?from=bad&to=2027-01-01`)
  assert.equal(badRange.status, 400)
})
