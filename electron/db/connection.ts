import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { i18nError } from '@shared/i18nMessage'
import type { DatabaseInfo } from '@shared/types'
import { migrate } from './migrate'
import { ensureDefaultSettings, markAppOpened } from './settings'

const DATABASE_FILE_NAME = 'ping-alert-v2.db'

let database: DatabaseSync | null = null
let databasePath = ''
let schemaVersion = 0
let initError: string | null = null

export function initDatabase(userDataPath: string, osLocale?: string): DatabaseInfo {
  databasePath = path.join(userDataPath, DATABASE_FILE_NAME)
  initError = null

  try {
    database = new DatabaseSync(databasePath, {
      enableForeignKeyConstraints: true,
      timeout: 5000
    })
    database.exec('PRAGMA journal_mode = WAL')
    schemaVersion = migrate(database)
    ensureDefaultSettings(database, osLocale)
    markAppOpened(database)
  } catch (error) {
    database = null
    schemaVersion = 0
    initError = error instanceof Error ? error.message : String(error)
  }

  return getDatabaseInfo()
}

export function getDatabase(): DatabaseSync {
  if (!database) {
    throw i18nError('errors.db.notReady')
  }

  return database
}

export function getDatabaseInfo(): DatabaseInfo {
  return {
    path: databasePath,
    ready: database !== null && initError === null,
    schemaVersion,
    error: initError
  }
}

export function closeDatabase(): void {
  if (!database) {
    return
  }

  database.close()
  database = null
}
