import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPool } from './db.js'

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
const command = process.argv[2] ?? 'up'

async function migrationFiles(suffix) {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(suffix)).sort()
  return files.map((f) => ({
    version: f.split('_')[0],
    file: f,
    downFile: f.replace('.up.sql', '.down.sql'),
    sql: () => readFile(path.join(MIGRATIONS_DIR, f), 'utf8'),
  }))
}

function assertUniqueVersions(migrations) {
  const seen = new Map()
  for (const m of migrations) {
    if (seen.has(m.version)) {
      throw new Error(
        `duplicate migration version "${m.version}": ${seen.get(m.version)} and ${m.file}`,
      )
    }
    seen.set(m.version, m.file)
  }
}

async function ensureMigrationsTable(conn) {
  await conn.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    VARCHAR(255) NOT NULL,
       applied_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
       PRIMARY KEY (version)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  )
}

async function migrationsTableExists(conn) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_migrations'`,
  )
  return rows[0].n > 0
}

async function appliedVersions(conn) {
  const [rows] = await conn.query('SELECT version FROM schema_migrations ORDER BY version')
  return new Set(rows.map((r) => r.version))
}

function recoveryHint(m) {
  console.error(`Recovery: ${m.file} may be partially applied — MySQL DDL auto-commits.`)
  console.error(
    `Run "${m.downFile}" manually against the database (e.g. mysql -u <user> -p <db> < migrations/${m.downFile}), then retry.`,
  )
}

async function up(pool) {
  const all = await migrationFiles('.up.sql')
  assertUniqueVersions(all)
  const conn = await pool.getConnection()
  try {
    await ensureMigrationsTable(conn)
    const done = await appliedVersions(conn)
    let count = 0
    for (const m of all) {
      if (done.has(m.version)) continue
      try {
        // Migration-only connection has multipleStatements enabled (see below).
        // Each file is applied as a unit of statements; a mid-file failure leaves
        // earlier statements applied — the matching .down.sql is the recovery path.
        // The version row is recorded only on success.
        await conn.query(await m.sql())
      } catch (err) {
        console.error(`migration ${m.file} failed: ${err.message}`)
        recoveryHint(m)
        throw err
      }
      await conn.query('INSERT INTO schema_migrations (version) VALUES (?)', [m.version])
      console.log(`applied ${m.file}`)
      count += 1
    }
    console.log(count === 0 ? 'already up to date' : `applied ${count} migration(s)`)
  } finally {
    conn.release()
  }
}

async function down(pool) {
  const downs = await migrationFiles('.down.sql')
  assertUniqueVersions(downs)
  const conn = await pool.getConnection()
  try {
    await ensureMigrationsTable(conn)
    const done = await appliedVersions(conn)
    const last = downs.filter((m) => done.has(m.version)).pop()
    if (!last) {
      console.log('no migrations to roll back')
      return
    }
    try {
      await conn.query(await last.sql())
    } catch (err) {
      console.error(`rollback ${last.file} failed: ${err.message}`)
      console.error('The database may be in a partially rolled-back state — inspect manually.')
      throw err
    }
    await conn.query('DELETE FROM schema_migrations WHERE version = ?', [last.version])
    console.log(`rolled back ${last.file}`)
  } finally {
    conn.release()
  }
}

async function status(pool) {
  const ups = await migrationFiles('.up.sql')
  assertUniqueVersions(ups)
  const conn = await pool.getConnection()
  try {
    // Read-only: never create or modify schema_migrations.
    if (!(await migrationsTableExists(conn))) {
      console.log('migration tracking not initialized — run "npm run migrate" first')
      for (const m of ups) console.log(`[ ] ${m.file}`)
      return
    }
    const done = await appliedVersions(conn)
    for (const m of ups) {
      console.log(`${done.has(m.version) ? '[x]' : '[ ]'} ${m.file}`)
    }
  } finally {
    conn.release()
  }
}

// Migration-only pool: multipleStatements enabled so each .up.sql/.down.sql file
// (which contains several DDL statements) executes as written. The shared
// application pool in db.js keeps the safe default (disabled).
let pool
try {
  pool = createPool({ multipleStatements: true })
  if (command === 'up') await up(pool)
  else if (command === 'down') await down(pool)
  else if (command === 'status') await status(pool)
  else {
    console.error(`unknown command "${command}" — use: up | down | status`)
    process.exitCode = 1
  }
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
} finally {
  await pool?.end()
}
