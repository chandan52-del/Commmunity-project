import mysql from 'mysql2/promise'
import 'dotenv/config'

const REQUIRED_ENV = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']

// Returns validated connection config. Throws if any required variable is
// missing — never silently falls back to defaults.
export function dbConfig() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required database env vars: ${missing.join(', ')}`)
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    // All DATETIME values are UTC — pin the session timezone so NOW()/defaults agree.
    timezone: '+00:00',
  }
}

// Shared application pool — multipleStatements stays disabled (default).
// The migration runner builds its own pool with that option enabled.
export function createPool(overrides = {}) {
  return mysql.createPool({ ...dbConfig(), ...overrides })
}

let sharedPool = null
export function getPool() {
  if (!sharedPool) sharedPool = createPool()
  return sharedPool
}
