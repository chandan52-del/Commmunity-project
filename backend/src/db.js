
import mysql from 'mysql2/promise'
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const REQUIRED_ENV = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']

export function dbConfig() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required database env vars: ${missing.join(', ')}`
    )
  }

  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    timezone: '+00:00',
  }

  // Enable verified SSL only when explicitly requested.
  if (process.env.DB_SSL === 'true') {
    const caPath = fileURLToPath(
      new URL('../certs/ca.pem', import.meta.url)
    )

    config.ssl = {
      ca: readFileSync(caPath),
      rejectUnauthorized: true,
    }
  }

  return config
}

export function createPool(overrides = {}) {
  return mysql.createPool({ ...dbConfig(), ...overrides })
}

let sharedPool = null

export function getPool() {
  if (!sharedPool) sharedPool = createPool()
  return sharedPool
}
