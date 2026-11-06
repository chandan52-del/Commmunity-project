// Auth integration tests — runs against the DB configured in .env.
// All test users use @example.com addresses and are deleted in after().

process.env.JWT_SECRET ??= 'test-secret-not-for-production'

const { test, before, after } = await import('node:test')
const assert = (await import('node:assert/strict')).default
const { createApp } = await import('../src/app.js')
const { getPool } = await import('../src/db.js')

let server
let base
let cookie // latest refresh_token cookie value

function cookieOf(res) {
  const setCookie = res.headers.getSetCookie?.() ?? []
  for (const c of setCookie) {
    if (c.startsWith('refresh_token=')) {
      return c.split(';')[0]
    }
  }
  return null
}

async function api(path, { method = 'GET', body, token, withCookie = true } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  if (withCookie && cookie) headers.cookie = cookie
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const set = cookieOf(res)
  if (set) cookie = set
  const json = await res.json().catch(() => null)
  return { status: res.status, json, cookieHeader: set }
}

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

before(async () => {
  const app = createApp()
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  const pool = getPool()
  try {
    server?.closeAllConnections?.()
    server?.close()
    // Remove test users (@example.com). refresh_tokens rows must go first,
    // children (higher ids) before parents, because the self-FK is RESTRICT.
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

test('health endpoint', async () => {
  const res = await fetch(`${base}/api/health`)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).data.status, 'ok')
})

test('register creates customer and returns tokens without password_hash', async () => {
  const email = `user-${uniq()}@example.com`
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: 'Test User', email, password: 'Password123' },
  })
  assert.equal(res.status, 201)
  assert.equal(res.json.data.user.email, email)
  assert.equal(res.json.data.user.role, 'customer')
  assert.equal(res.json.data.token_type, 'Bearer')
  assert.ok(res.json.data.access_token)
  assert.equal(res.json.data.user.password_hash, undefined)
  assert.ok(cookie, 'refresh cookie must be set')
  assert.ok(cookie.startsWith('refresh_token='))
})

test('register rejects duplicate email with 409', async () => {
  const email = `dup-${uniq()}@example.com`
  const body = { full_name: 'Dup User', email, password: 'Password123' }
  await api('/api/auth/register', { method: 'POST', body })
  const res = await api('/api/auth/register', { method: 'POST', body })
  assert.equal(res.status, 409)
  assert.equal(res.json.error.code, 'CONFLICT')
})

test('register validates input with 400', async () => {
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: 'X', email: 'not-an-email', password: 'short' },
  })
  assert.equal(res.status, 400)
  assert.equal(res.json.error.code, 'VALIDATION_ERROR')
  assert.ok(res.json.error.details.length >= 3)
})

test('login succeeds with valid credentials', async () => {
  const email = `login-${uniq()}@example.com`
  await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: 'Login User', email, password: 'Password123' },
  })
  cookie = null
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'Password123' },
    withCookie: false,
  })
  assert.equal(res.status, 200)
  assert.ok(res.json.data.access_token)
  assert.ok(cookie)
})

test('login rejects wrong password with 401', async () => {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'nobody@example.com', password: 'whatever123' },
    withCookie: false,
  })
  assert.equal(res.status, 401)
  assert.equal(res.json.error.code, 'UNAUTHORIZED')
})

test('GET /auth/me requires auth and returns current user', async () => {
  const noAuth = await api('/api/auth/me', { withCookie: false })
  assert.equal(noAuth.status, 401)

  const email = `me-${uniq()}@example.com`
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: 'Me User', email, password: 'Password123' },
  })
  const me = await api('/api/auth/me', { token: reg.json.data.access_token, withCookie: false })
  assert.equal(me.status, 200)
  assert.equal(me.json.data.email, email)
  assert.equal(me.json.data.password_hash, undefined)
})

test('refresh rotates token; reuse of old token revokes family', async () => {
  const email = `rot-${uniq()}@example.com`
  await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: 'Rotate User', email, password: 'Password123' },
  })
  const oldCookie = cookie

  // First refresh: rotates successfully
  const r1 = await api('/api/auth/refresh', { method: 'POST', withCookie: true })
  assert.equal(r1.status, 200)
  assert.ok(r1.json.data.access_token)
  assert.ok(r1.cookieHeader, 'new refresh cookie must be set')
  const newCookie = cookie

  // Reuse the OLD token → reuse detection → 401 + family revoked
  cookie = oldCookie
  const reuse = await api('/api/auth/refresh', { method: 'POST', withCookie: true })
  assert.equal(reuse.status, 401)

  // The rotated (new) token's family is now revoked too → also 401
  cookie = newCookie
  const after = await api('/api/auth/refresh', { method: 'POST', withCookie: true })
  assert.equal(after.status, 401)
})

test('logout revokes session; refresh afterwards fails', async () => {
  const email = `out-${uniq()}@example.com`
  await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: 'Logout User', email, password: 'Password123' },
  })
  const res = await api('/api/auth/logout', { method: 'POST' })
  assert.equal(res.status, 204)
  const refreshRes = await api('/api/auth/refresh', { method: 'POST' })
  assert.equal(refreshRes.status, 401)
})

test('unknown route returns 404 envelope', async () => {
  const res = await api('/api/nope', { withCookie: false })
  assert.equal(res.status, 404)
  assert.equal(res.json.error.code, 'NOT_FOUND')
})
