import type { DatabaseSync } from 'node:sqlite'
import { INITIAL_SCHEMA, SCHEMA_VERSION } from './schema'

interface Migration {
  version: number
  sql: string
}

const migrations: Migration[] = [
  {
    version: 1,
    sql: INITIAL_SCHEMA
  }
]

export function migrate(database: DatabaseSync): number {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const appliedRows = database.prepare('SELECT version FROM schema_migrations').all() as Array<{
    version: number
  }>
  const applied = new Set(appliedRows.map((row) => row.version))

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue
    }

    database.exec('BEGIN')
    try {
      database.exec(migration.sql)
      database
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(migration.version, new Date().toISOString())
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }

  const latest = database
    .prepare('SELECT MAX(version) AS version FROM schema_migrations')
    .get() as { version: number | null } | undefined

  return latest?.version ?? SCHEMA_VERSION
}
