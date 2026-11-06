import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getPool } from '../db.js'
import { conflict, unauthorized, notFound } from '../middleware/errorHandler.js'
import { publicUser, tokenPayload } from '../middleware/auth.js'

const REFRESH_COOKIE = 'refresh_token'
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30)
const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000

export const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: REFRESH_TTL_MS,
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const newRefreshToken = () => crypto.randomBytes(48).toString('base64url')

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions)
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions, maxAge: 0 })
}

// Creates a new session family + first refresh token for a user.
// Must be called inside the caller's transaction when one is active.
async function createSession(conn, userId) {
  const raw = newRefreshToken()
  const familyId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)
  await conn.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [userId, familyId, sha256(raw), expiresAt],
  )
  return raw
}

export async function register({ full_name, email, phone, password }) {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length > 0) throw conflict('A user with this email already exists')

    const hash = await bcrypt.hash(password, 12)
    const [result] = await conn.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, status)
       VALUES (?, ?, ?, ?, 'customer', 'active')`,
      [full_name, email, phone ?? null, hash],
    )
    const userId = result.insertId
    const [rows] = await conn.query(
      'SELECT id, full_name, email, phone, role, status, created_at FROM users WHERE id = ?',
      [userId],
    )
    const raw = await createSession(conn, userId)
    await conn.commit()
    return { payload: tokenPayload(rows[0]), refreshToken: raw }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function login({ email, password }) {
  const pool = getPool()
  const [rows] = await pool.query(
    'SELECT id, full_name, email, phone, password_hash, role, status, created_at FROM users WHERE email = ?',
    [email],
  )
  const user = rows[0]
  // Generic failure — do not reveal whether the email exists.
  if (!user || user.status !== 'active') throw unauthorized('Invalid email or password')
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) throw unauthorized('Invalid email or password')

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const raw = await createSession(conn, user.id)
    await conn.commit()
    return { payload: tokenPayload(user), refreshToken: raw }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// Rotates the refresh token. Reuse of an already-rotated/revoked token revokes
// the entire family (theft detection) and fails with 401.
export async function refresh(rawToken) {
  if (!rawToken) throw unauthorized()
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const tokenHash = sha256(rawToken)
    const [rows] = await conn.query(
      `SELECT rt.id, rt.user_id, rt.family_id, rt.expires_at, rt.revoked_at, u.status AS user_status
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = ?
       FOR UPDATE`,
      [tokenHash],
    )
    const token = rows[0]
    if (!token) throw unauthorized()

    if (token.revoked_at !== null || new Date(token.expires_at) < new Date()) {
      // Token was already rotated/revoked, or expired after issue.
      // If it was rotated (revoked but unexpired family member exists), treat
      // presentation of a rotated token as reuse → revoke the whole family.
      if (token.revoked_at !== null) {
        await conn.query(
          'UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE family_id = ? AND revoked_at IS NULL',
          [token.family_id],
        )
      }
      await conn.commit()
      throw unauthorized('Refresh token reuse detected')
    }
    if (token.user_status !== 'active') throw unauthorized()

    // Rotate: revoke this token, insert successor in the same family.
    await conn.query('UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE id = ?', [token.id])
    const newRaw = newRefreshToken()
    await conn.query(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, parent_id, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        token.user_id,
        token.family_id,
        sha256(newRaw),
        token.id,
        new Date(Date.now() + REFRESH_TTL_MS),
      ],
    )
    const [userRows] = await conn.query(
      'SELECT id, full_name, email, phone, role, status, created_at FROM users WHERE id = ?',
      [token.user_id],
    )
    await conn.commit()
    return { payload: tokenPayload(userRows[0]), refreshToken: newRaw }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function logout(rawToken) {
  if (!rawToken) return // idempotent
  const pool = getPool()
  const hash = sha256(rawToken)
  const [rows] = await pool.query(
    'SELECT family_id FROM refresh_tokens WHERE token_hash = ?',
    [hash],
  )
  if (rows[0]) {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE family_id = ? AND revoked_at IS NULL',
      [rows[0].family_id],
    )
  }
}

export async function getMe(userId) {
  const [rows] = await getPool().query(
    'SELECT id, full_name, email, phone, role, status, created_at FROM users WHERE id = ?',
    [userId],
  )
  const user = rows[0]
  if (!user) throw notFound('User not found')
  return publicUser(user)
}
