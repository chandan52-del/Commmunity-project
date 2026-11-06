// Maintenance APIs integration tests — live MySQL from .env.
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
const hallIds = []
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
    body: { name: `Test Maint Hall ${uniq()}`, capacity: 60, base_price: 100 },
  })
  assert.equal(res.status, 201, JSON.stringify(res.json))
  hallIds.push(res.json.data.id)
  return res.json.data
}

function maintBody(hallId, overrides = {}) {
  return {
    hall_id: hallId,
    title: 'HVAC servicing',
    reason: 'Quarterly maintenance',
    start_at: '2027-09-01T08:00:00.000Z',
    end_at: '2027-09-01T12:00:00.000Z',
    ...overrides,
  }
}

async function createMaint(body) {
  const res = await api('/api/admin/maintenance', { method: 'POST', token: adminToken, body })
  if (res.status === 201) maintIds.push(res.json.data.id)
  return res
}

before(async () => {
  const app = createApp()
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve) })
  base = `http://127.0.0.1:${server.address().port}`
  adminToken = await login(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD)
  const [rows] = await getPool().query('SELECT id FROM users WHERE email = ?', [process.env.SEED_ADMIN_EMAIL])
  adminId = rows[0].id
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: 'Maint Test', email: `mainttest-${uniq()}@example.com`, password: 'Password123' },
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

test('admin authorization required for all maintenance endpoints', async () => {
  assert.equal((await api('/api/admin/maintenance')).status, 401)
  assert.equal((await api('/api/admin/maintenance', { method: 'POST', body: {} })).status, 401)
  assert.equal((await api('/api/admin/maintenance', { token: customerToken })).status, 403)
  assert.equal((await api('/api/admin/maintenance/1', { method: 'PATCH', token: customerToken, body: {} })).status, 403)
  assert.equal((await api('/api/admin/maintenance/1', { method: 'DELETE', token: customerToken })).status, 403)
})

test('create, list, partial update and soft-cancel', async () => {
  const hall = await createHall()

  const badDates = await createMaint(maintBody(hall.id, { end_at: '2027-09-01T07:00:00.000Z' }))
  assert.equal(badDates.status, 400)
  const noHall = await createMaint(maintBody(999999))
  assert.equal(noHall.status, 404)
  const badStatus = await createMaint(maintBody(hall.id, { status: 'bogus' }))
  assert.equal(badStatus.status, 400)

  const created = await createMaint(maintBody(hall.id))
  assert.equal(created.status, 201, JSON.stringify(created.json))
  const mw = created.json.data
  assert.equal(mw.status, 'scheduled')
  assert.equal(mw.hall_name.length > 0, true)

  const list = await api(`/api/admin/maintenance?hall_id=${hall.id}&status=scheduled`, { token: adminToken })
  assert.equal(list.status, 200)
  assert.ok(list.json.data.some((m) => m.id === mw.id))
  assert.ok(list.json.pagination.total >= 1)

  const patch = await api(`/api/admin/maintenance/${mw.id}`, {
    method: 'PATCH', token: adminToken,
    body: { title: 'HVAC servicing v2', reason: null },
  })
  assert.equal(patch.status, 200)
  assert.equal(patch.json.data.title, 'HVAC servicing v2')
  assert.equal(patch.json.data.reason, null)

  const empty = await api(`/api/admin/maintenance/${mw.id}`, { method: 'PATCH', token: adminToken, body: {} })
  assert.equal(empty.status, 400)

  const del = await api(`/api/admin/maintenance/${mw.id}`, { method: 'DELETE', token: adminToken })
  assert.equal(del.status, 204)
  const gone = await api(`/api/admin/maintenance/${mw.id}`, { method: 'PATCH', token: adminToken, body: { title: 'Xy' } })
  // cancelled → cannot transition to anything except nothing; title-only patch on cancelled stays cancelled
  assert.equal(gone.status, 200)
  const delAgain = await api(`/api/admin/maintenance/${mw.id}`, { method: 'DELETE', token: adminToken })
  assert.equal(delAgain.status, 409)
})

test('status transitions enforced; approved booking conflict rejected', async () => {
  const hall = await createHall()

  // approved booking 2027-10-01 10:00-14:00
  const b = await api('/api/bookings', {
    method: 'POST', token: customerToken,
    body: {
      hall_id: hall.id, event_name: 'Overlap Ev', event_type: 'party',
      start_at: '2027-10-01T10:00:00.000Z', end_at: '2027-10-01T14:00:00.000Z', guest_count: 10,
    },
  })
  assert.equal(b.status, 201)
  const bid = b.json.data.id
  await api(`/api/admin/bookings/${bid}/approve`, { method: 'PATCH', token: adminToken, body: {} })

  // overlapping scheduled maintenance → 409 BOOKING_CONFLICT
  const conflictRes = await createMaint(maintBody(hall.id, {
    start_at: '2027-10-01T12:00:00.000Z', end_at: '2027-10-01T16:00:00.000Z',
  }))
  assert.equal(conflictRes.status, 409)
  assert.equal(conflictRes.json.error.code, 'BOOKING_CONFLICT')
  assert.ok(conflictRes.json.error.details.some((d) => d.type === 'booking'))

  // non-overlapping works; touching the window into overlap via PATCH → 409
  const mw = await createMaint(maintBody(hall.id, {
    start_at: '2027-10-02T08:00:00.000Z', end_at: '2027-10-02T10:00:00.000Z',
  }))
  assert.equal(mw.status, 201)
  const mid = mw.json.data.id
  const badPatch = await api(`/api/admin/maintenance/${mid}`, {
    method: 'PATCH', token: adminToken,
    body: { start_at: '2027-10-01T13:00:00.000Z', end_at: '2027-10-02T09:00:00.000Z' },
  })
  assert.equal(badPatch.status, 409)
  assert.equal(badPatch.json.error.code, 'BOOKING_CONFLICT')

  // status transitions: scheduled → completed invalid; scheduled → in_progress ok
  const badTransition = await api(`/api/admin/maintenance/${mid}`, {
    method: 'PATCH', token: adminToken, body: { status: 'completed' },
  })
  assert.equal(badTransition.status, 409)
  const toProgress = await api(`/api/admin/maintenance/${mid}`, {
    method: 'PATCH', token: adminToken, body: { status: 'in_progress' },
  })
  assert.equal(toProgress.status, 200)
  assert.equal(toProgress.json.data.status, 'in_progress')
  const toCompleted = await api(`/api/admin/maintenance/${mid}`, {
    method: 'PATCH', token: adminToken, body: { status: 'completed' },
  })
  assert.equal(toCompleted.status, 200)
  // completed is terminal
  const reopen = await api(`/api/admin/maintenance/${mid}`, {
    method: 'PATCH', token: adminToken, body: { status: 'scheduled' },
  })
  assert.equal(reopen.status, 409)

  // completed/cancelled windows may overlap bookings freely
  const free = await createMaint(maintBody(hall.id, {
    status: 'completed',
    start_at: '2027-10-01T11:00:00.000Z', end_at: '2027-10-01T13:00:00.000Z',
  }))
  assert.equal(free.status, 201)
})

test('pending bookings do not block maintenance', async () => {
  const hall = await createHall()
  const b = await api('/api/bookings', {
    method: 'POST', token: customerToken,
    body: {
      hall_id: hall.id, event_name: 'Pending Ev', event_type: 'party',
      start_at: '2027-11-01T10:00:00.000Z', end_at: '2027-11-01T14:00:00.000Z', guest_count: 10,
    },
  })
  assert.equal(b.status, 201) // pending booking exists over same range
  const mw = await createMaint(maintBody(hall.id, {
    start_at: '2027-11-01T09:00:00.000Z', end_at: '2027-11-01T15:00:00.000Z',
  }))
  assert.equal(mw.status, 201, JSON.stringify(mw.json))
})

test('moving a maintenance window to another hall locks both halls', async () => {
  const hallA = await createHall()
  const hallB = await createHall()
  const mw = await createMaint(maintBody(hallA.id, {
    start_at: '2027-12-01T08:00:00.000Z', end_at: '2027-12-01T10:00:00.000Z',
  }))
  assert.equal(mw.status, 201)
  const mid = mw.json.data.id

  // hallB has an approved booking in the same window → conflict on move
  const b = await api('/api/bookings', {
    method: 'POST', token: customerToken,
    body: {
      hall_id: hallB.id, event_name: 'Blocker', event_type: 'party',
      start_at: '2027-12-01T09:00:00.000Z', end_at: '2027-12-01T11:00:00.000Z', guest_count: 5,
    },
  })
  assert.equal(b.status, 201)
  await api(`/api/admin/bookings/${b.json.data.id}/approve`, { method: 'PATCH', token: adminToken, body: {} })

  const moveConflict = await api(`/api/admin/maintenance/${mid}`, {
    method: 'PATCH', token: adminToken, body: { hall_id: hallB.id },
  })
  assert.equal(moveConflict.status, 409)
  assert.equal(moveConflict.json.error.code, 'BOOKING_CONFLICT')

  // move to a free hall succeeds; window now listed under new hall
  const hallC = await createHall()
  const move = await api(`/api/admin/maintenance/${mid}`, {
    method: 'PATCH', token: adminToken, body: { hall_id: hallC.id },
  })
  assert.equal(move.status, 200)
  assert.equal(move.json.data.hall_id, hallC.id)
})
