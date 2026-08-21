import type { DatabaseSync } from 'node:sqlite'
import { encodeI18nMessage, i18nError } from '@shared/i18nMessage'
import type { AppLog, LogLevel, LogQuery } from '@shared/types'
import { isLogLevel } from '@shared/types'

const LOG_RETENTION = 2000
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500
const MAX_MESSAGE = 500

interface LogRow {
  id: number
  level: string
  source: string
  message: string
  created_at: string
}

export function insertAppLog(
  database: DatabaseSync,
  level: LogLevel,
  source: string,
  message: string
): AppLog | null {
  try {
    const safeSource = source.trim().slice(0, 40) || 'app'
    const safeMessage = message.trim().slice(0, MAX_MESSAGE) || encodeI18nMessage('log.empty')

    database
      .prepare(
        `
        INSERT INTO app_logs (level, source, message, created_at)
        VALUES (?, ?, ?, ?)
      `
      )
      .run(level, safeSource, safeMessage, new Date().toISOString())

    const row = database
      .prepare(
        `
        SELECT id, level, source, message, created_at
        FROM app_logs
        ORDER BY id DESC
        LIMIT 1
      `
      )
      .get() as unknown as LogRow | undefined

    pruneAppLogs(database)

    return row ? mapLog(row) : null
  } catch (error) {
    console.error('Failed to write log', error)
    return null
  }
}

export function listAppLogs(database: DatabaseSync, query: LogQuery = {}): AppLog[] {
  const level = query.level && query.level !== 'all' ? query.level : null
  if (level && !isLogLevel(level)) {
    throw i18nError('errors.logs.invalidLevel')
  }

  const limit = clampLimit(query.limit)
  const rows = (
    level
      ? database
          .prepare(
            `
            SELECT id, level, source, message, created_at
            FROM app_logs
            WHERE level = ?
            ORDER BY id DESC
            LIMIT ?
          `
          )
          .all(level, limit)
      : database
          .prepare(
            `
            SELECT id, level, source, message, created_at
            FROM app_logs
            ORDER BY id DESC
            LIMIT ?
          `
          )
          .all(limit)
  ) as unknown as LogRow[]

  return rows.map(mapLog)
}

export function clearAppLogs(database: DatabaseSync): void {
  database.exec('DELETE FROM app_logs')
}

function pruneAppLogs(database: DatabaseSync): void {
  const cutoff = database
    .prepare(
      `
      SELECT id
      FROM app_logs
      ORDER BY id DESC
      LIMIT 1 OFFSET ?
    `
    )
    .get(LOG_RETENTION - 1) as unknown as { id: number } | undefined

  if (!cutoff) {
    return
  }

  database.prepare('DELETE FROM app_logs WHERE id < ?').run(cutoff.id)
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isInteger(limit)) {
    return DEFAULT_LIMIT
  }

  return Math.min(MAX_LIMIT, Math.max(1, limit))
}

function mapLog(row: LogRow): AppLog {
  return {
    id: Number(row.id),
    level: isLogLevel(row.level) ? row.level : 'info',
    source: row.source,
    message: row.message,
    createdAt: row.created_at
  }
}
