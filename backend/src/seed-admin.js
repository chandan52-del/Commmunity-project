import bcrypt from 'bcryptjs'
import { createPool } from './db.js'

// Env-driven admin seed — run once after migrations:
//   SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=... npm run seed:admin
// Password is hashed with bcrypt; plaintext is never stored or logged.

const email = process.env.SEED_ADMIN_EMAIL
const password = process.env.SEED_ADMIN_PASSWORD
const fullName = process.env.SEED_ADMIN_NAME ?? 'Administrator'

if (!email || !password) {
  console.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required')
  process.exit(1)
}
if (password.length < 8) {
  console.error('SEED_ADMIN_PASSWORD must be at least 8 characters')
  process.exit(1)
}

const pool = createPool()
try {
  const conn = await pool.getConnection()
  try {
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length > 0) {
      console.log(`admin ${email} already exists — nothing to do`)
    } else {
      const hash = await bcrypt.hash(password, 12)
      await conn.query(
        `INSERT INTO users (full_name, email, password_hash, role, status)
         VALUES (?, ?, ?, 'admin', 'active')`,
        [fullName, email, hash],
      )
      console.log(`seeded admin user ${email}`)
    }
  } finally {
    conn.release()
  }
} catch (err) {
  console.error('seed failed:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
