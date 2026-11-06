// Booking APIs integration tests — live MySQL from .env.
// Creates test halls/customers/bookings and removes them in after().
// Requires SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env.

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
let otherToken
let otherId
const hallIds = []
const bookingIds = []

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
  assert.equal(res.status, 200, `login failed: ${JSON.stringify(res.json)}`)
  return res.json.data.access_token
}

async function registerCustomer(tag) {
  const email = `booktest-${tag}-${uniq()}@example.com`
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: `Book Test ${tag}`, email, password: 'Password123' },
  })
  assert.equal(res.status, 201, JSON.stringify(res.json))
  return { token: res.json.data.access_token, id: res.json.data.user.id, email }
}

async function createHall(capacity = 100) {
  const res = await api('/api/admin/halls', {
    method: 'POST',
    token: adminToken,
    body: { name: `Test Book Hall ${uniq()}`, capacity, base_price: 250 },
  })
  assert.equal(res.status, 201, JSON.stringify(res.json))
  hallIds.push(res.json.data.id)
  return res.json.data
}

function bookingBody(hallId, overrides = {}) {
  return {
    hall_id: hallId,
    event_name: 'Test Event',
    event_type: 'wedding',
    start_at: '2027-03-01T10:00:00.000Z',
    end_at: '2027-03-01T18:00:00.000Z',
    guest_count: 50,
    ...overrides,
  }
}

async function createBooking(token, body) {
  const res = await api('/api/bookings', { method: 'POST', token, body })
  if (res.status === 201) bookingIds.push(res.json.data.id)
  return res
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

  const c = await registerCustomer('A')
  customerToken = c.token
  customerId = c.id
  const o = await registerCustomer('B')
  otherToken = o.token
  otherId = o.id
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
    if (hallIds.length) {
      // catch bookings created directly via SQL fixtures on test halls
      const ph = hallIds.map(() => '?').join(',')
      await pool.query(
        `DELETE be FROM booking_events be JOIN bookings b ON b.id = be.booking_id WHERE b.hall_id IN (${ph})`,
        hallIds,
      )
      await pool.query(`DELETE FROM bookings WHERE hall_id IN (${ph})`, hallIds)
      await pool.query(`DELETE FROM maintenance_windows WHERE hall_id IN (${ph})`, hallIds)
      await pool.query(`DELETE FROM halls WHERE id IN (${ph})`, hallIds)
    }
    await pool.query(
      `DELETE be FROM booking_events be JOIN bookings b ON b.id = be.booking_id
       JOIN users u ON u.id = b.user_id WHERE u.email LIKE '%@example.com'`,
    )
    await pool.query(
      `DELETE FROM booking_events WHERE actor_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')`,
    )
    await pool.query(
      `DELETE FROM refresh_tokens
       WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')
       ORDER BY id DESC`,
    )
    await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'")
  } finally {
    await pool.end()
  }
})

test('customer creates a valid booking; starts pending with CH- ref', async () => {
  const hall = await createHall()
  const res = await createBooking(customerToken, bookingBody(hall.id))
  assert.equal(res.status, 201, JSON.stringify(res.json))
  const b = res.json.data
  assert.equal(b.status, 'pending')
  assert.match(b.booking_ref, /^CH-\d{4}-\d{5}$/)
  assert.equal(b.customer_name, 'Book Test A')

  const detail = await api(`/api/bookings/${b.id}`, { token: customerToken })
  assert.equal(detail.status, 200)
  assert.equal(detail.json.data.id, b.id)
  assert.ok(detail.json.data.events.length >= 1)
  assert.equal(detail.json.data.events[0].to_status, 'pending')
})

test('booking validation: auth, required fields, capacity, dates', async () => {
  const hall = await createHall(30)

  const noAuth = await api('/api/bookings', { method: 'POST', body: bookingBody(hall.id) })
  assert.equal(noAuth.status, 401)

  const missing = await api('/api/bookings', { method: 'POST', token: customerToken, body: { hall_id: hall.id } })
  assert.equal(missing.status, 400)
  assert.equal(missing.json.error.code, 'VALIDATION_ERROR')

  const overCapacity = await createBooking(customerToken, bookingBody(hall.id, { guest_count: 31 }))
  assert.equal(overCapacity.status, 400)

  const badDates = await createBooking(customerToken, bookingBody(hall.id, {
    start_at: '2027-03-01T18:00:00.000Z', end_at: '2027-03-01T10:00:00.000Z',
  }))
  assert.equal(badDates.status, 400)

  const noHall = await createBooking(customerToken, bookingBody(999999))
  assert.equal(noHall.status, 404)
})

test('customer can only see and manage own bookings', async () => {
  const hall = await createHall()
  const mine = await createBooking(customerToken, bookingBody(hall.id, {
    start_at: '2027-04-01T10:00:00.000Z', end_at: '2027-04-01T12:00:00.000Z',
  }))
  assert.equal(mine.status, 201)
  const id = mine.json.data.id

  // other customer: 403 on detail and cancel
  const foreign = await api(`/api/bookings/${id}`, { token: otherToken })
  assert.equal(foreign.status, 403)
  const foreignCancel = await api(`/api/bookings/${id}/cancel`, { method: 'PATCH', token: otherToken, body: {} })
  assert.equal(foreignCancel.status, 403)

  // list only returns own bookings
  const list = await api('/api/bookings', { token: otherToken })
  assert.equal(list.status, 200)
  assert.ok(list.json.data.every((b) => b.id !== id))
  const myList = await api('/api/bookings?status=pending', { token: customerToken })
  assert.ok(myList.json.data.some((b) => b.id === id))
})

test('cancel: pending and approved allowed; rejected/cancelled blocked', async () => {
  const hall = await createHall()
  const b1 = await createBooking(customerToken, bookingBody(hall.id, {
    start_at: '2027-05-01T10:00:00.000Z', end_at: '2027-05-01T12:00:00.000Z',
  }))
  const cancel1 = await api(`/api/bookings/${b1.json.data.id}/cancel`, {
    method: 'PATCH', token: customerToken, body: { reason: 'Changed plans' },
  })
  assert.equal(cancel1.status, 200)
  assert.equal(cancel1.json.data.status, 'cancelled')

  const again = await api(`/api/bookings/${b1.json.data.id}/cancel`, {
    method: 'PATCH', token: customerToken, body: {},
  })
  assert.equal(again.status, 409)

  // approved booking can also be cancelled by customer
  const b2 = await createBooking(customerToken, bookingBody(hall.id, {
    start_at: '2027-05-10T10:00:00.000Z', end_at: '2027-05-10T12:00:00.000Z',
  }))
  const approve = await api(`/api/admin/bookings/${b2.json.data.id}/approve`, {
    method: 'PATCH', token: adminToken, body: {},
  })
  assert.equal(approve.status, 200)
  const cancel2 = await api(`/api/bookings/${b2.json.data.id}/cancel`, {
    method: 'PATCH', token: customerToken, body: {},
  })
  assert.equal(cancel2.status, 200)
  assert.equal(cancel2.json.data.status, 'cancelled')

  // rejected booking cannot be cancelled
  const b3 = await createBooking(customerToken, bookingBody(hall.id, {
    start_at: '2027-05-20T10:00:00.000Z', end_at: '2027-05-20T12:00:00.000Z',
  }))
  await api(`/api/admin/bookings/${b3.json.data.id}/reject`, {
    method: 'PATCH', token: adminToken, body: { admin_notes: 'No' },
  })
  const cancel3 = await api(`/api/bookings/${b3.json.data.id}/cancel`, {
    method: 'PATCH', token: customerToken, body: {},
  })
  assert.equal(cancel3.status, 409)
})

test('admin booking list auth, filters, approve and reject', async () => {
  const noAuth = await api('/api/admin/bookings')
  assert.equal(noAuth.status, 401)
  const asCustomer = await api('/api/admin/bookings', { token: customerToken })
  assert.equal(asCustomer.status, 403)

  const hall = await createHall()
  const b = await createBooking(otherToken, bookingBody(hall.id, {
    start_at: '2027-06-01T10:00:00.000Z', end_at: '2027-06-01T12:00:00.000Z',
    event_name: 'AdminListEvent',
  }))
  assert.equal(b.status, 201)

  const list = await api('/api/admin/bookings?status=pending&search=AdminListEvent', { token: adminToken })
  assert.equal(list.status, 200)
  assert.ok(list.json.data.some((x) => x.id === b.json.data.id))
  assert.ok(list.json.counts && typeof list.json.counts.pending === 'number')

  // approve
  const approve = await api(`/api/admin/bookings/${b.json.data.id}/approve`, {
    method: 'PATCH', token: adminToken, body: { admin_notes: 'Looks good' },
  })
  assert.equal(approve.status, 200, JSON.stringify(approve.json))
  assert.equal(approve.json.data.status, 'approved')

  // approving again → 409
  const again = await api(`/api/admin/bookings/${b.json.data.id}/approve`, {
    method: 'PATCH', token: adminToken, body: {},
  })
  assert.equal(again.status, 409)

  // reject a pending booking
  const b2 = await createBooking(otherToken, bookingBody(hall.id, {
    start_at: '2027-06-05T10:00:00.000Z', end_at: '2027-06-05T12:00:00.000Z',
  }))
  const rejectNoNotes = await api(`/api/admin/bookings/${b2.json.data.id}/reject`, {
    method: 'PATCH', token: adminToken, body: {},
  })
  assert.equal(rejectNoNotes.status, 400)
  const reject = await api(`/api/admin/bookings/${b2.json.data.id}/reject`, {
    method: 'PATCH', token: adminToken, body: { admin_notes: 'Dates unavailable' },
  })
  assert.equal(reject.status, 200)
  assert.equal(reject.json.data.status, 'rejected')
})

test('approve rejects overlap with approved booking and maintenance', async () => {
  const hall = await createHall()
  // two pending bookings overlapping each other
  const b1 = await createBooking(customerToken, bookingBody(hall.id, {
    start_at: '2027-07-01T10:00:00.000Z', end_at: '2027-07-01T18:00:00.000Z',
  }))
  const b2 = await createBooking(otherToken, bookingBody(hall.id, {
    start_at: '2027-07-01T14:00:00.000Z', end_at: '2027-07-01T20:00:00.000Z',
  }))
  assert.equal(b1.status, 201)
  assert.equal(b2.status, 201) // pending does not block creation

  const ok = await api(`/api/admin/bookings/${b1.json.data.id}/approve`, {
    method: 'PATCH', token: adminToken, body: {},
  })
  assert.equal(ok.status, 200)

  const conflictRes = await api(`/api/admin/bookings/${b2.json.data.id}/approve`, {
    method: 'PATCH', token: adminToken, body: {},
  })
  assert.equal(conflictRes.status, 409)
  assert.equal(conflictRes.json.error.code, 'BOOKING_CONFLICT')
  assert.ok(Array.isArray(conflictRes.json.error.details))

  // approved booking now blocks new overlapping creation too
  const blocked = await createBooking(customerToken, bookingBody(hall.id, {
    start_at: '2027-07-01T12:00:00.000Z', end_at: '2027-07-01T16:00:00.000Z',
  }))
  assert.equal(blocked.status, 409)
  assert.equal(blocked.json.error.code, 'BOOKING_CONFLICT')

  // maintenance window blocks approval
  const pool = getPool()
  const b3 = await createBooking(customerToken, bookingBody(hall.id, {
    start_at: '2027-07-10T10:00:00.000Z', end_at: '2027-07-10T12:00:00.000Z',
  }))
  await pool.query(
    `INSERT INTO maintenance_windows (hall_id, title, start_at, end_at, status, created_by)
     VALUES (?, 'Maint', ?, ?, 'scheduled', ?)`,
    [hall.id, '2027-07-10 09:00:00', '2027-07-10 11:00:00', adminId],
  )
  const maintConflict = await api(`/api/admin/bookings/${b3.json.data.id}/approve`, {
    method: 'PATCH', token: adminToken, body: {},
  })
  assert.equal(maintConflict.status, 409)
  assert.equal(maintConflict.json.error.code, 'BOOKING_CONFLICT')
})

test('concurrent approvals cannot create overlapping approved bookings', async () => {
  const hall = await createHall()
  const b1 = await createBooking(customerToken, bookingBody(hall.id, {
    start_at: '2027-08-01T10:00:00.000Z', end_at: '2027-08-01T18:00:00.000Z',
  }))
  const b2 = await createBooking(otherToken, bookingBody(hall.id, {
    start_at: '2027-08-01T12:00:00.000Z', end_at: '2027-08-01T20:00:00.000Z',
  }))

  const [r1, r2] = await Promise.all([
    api(`/api/admin/bookings/${b1.json.data.id}/approve`, { method: 'PATCH', token: adminToken, body: {} }),
    api(`/api/admin/bookings/${b2.json.data.id}/approve`, { method: 'PATCH', token: adminToken, body: {} }),
  ])
  const statuses = [r1.status, r2.status].sort()
  assert.deepEqual(statuses, [200, 409], `expected one success one conflict, got ${r1.status}/${r2.status}`)

  // exactly one approved booking remains for that hall in that window
  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM bookings WHERE hall_id = ? AND status = 'approved'
       AND start_at < '2027-08-01 21:00:00' AND end_at > '2027-08-01 09:00:00'`,
    [hall.id],
  )
  assert.equal(rows[0].n, 1)
})
