import { BrowserWindow } from 'electron'
import { encodeI18nMessage, type I18nParams } from '@shared/i18nMessage'
import { IpcChannels } from '@shared/ipc'
import type { AppLog, LogLevel, LogSource } from '@shared/types'
import { getDatabase, getDatabaseInfo } from './db/connection'
import { insertAppLog } from './db/logs'

export function writeAppLog(
  level: LogLevel,
  source: LogSource,
  key: string,
  params?: I18nParams
): AppLog | null {
  if (!getDatabaseInfo().ready) {
    return null
  }

  const log = insertAppLog(getDatabase(), level, source, encodeI18nMessage(key, params))
  if (log) {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannels.logsAppend, log)
    }
  }

  return log
}
