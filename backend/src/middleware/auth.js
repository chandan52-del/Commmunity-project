import jwt from 'jsonwebtoken'
import { getPool } from '../db.js'
import { unauthorized, forbidden } from './errorHandler.js'

const JWT_SECRET = process.env.JWT_SECRET
const ACCESS_TTL_SECONDS = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 1800)

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET env var is required')
}

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: ACCESS_TTL_SECONDS,
  })
}

export function tokenPayload(user) {
  return {
    user: publicUser(user),
    access_token: signAccessToken(user),
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_SECONDS,
  }
}

export function publicUser(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone ?? null,
    role: row.role,
    status: row.status,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }
}

// Verifies Bearer JWT and loads the user fresh from the DB.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) throw unauthorized()
    const payload = jwt.verify(header.slice(7), JWT_SECRET)
    const [rows] = await getPool().query(
      'SELECT id, full_name, email, phone, role, status, created_at FROM users WHERE id = ?',
      [payload.sub],
    )
    const user = rows[0]
    if (!user || user.status !== 'active') throw unauthorized()
    req.user = user
    next()
  } catch (err) {
    next(err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError ? unauthorized() : err)
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(forbidden(`Requires role: ${roles.join(' or ')}`))
    }
    next()
  }
}
