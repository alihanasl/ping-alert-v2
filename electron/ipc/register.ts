import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { EmailSettingsInput, GroupInput, HistoryRange, LogQuery, SettingsUpdateInput, TargetInput, UiLocale } from '@shared/types'
import { isHistoryRange } from '@shared/types'
import { i18nError } from '@shared/i18nMessage'
import { isUiLocale } from '@shared/locales'
import { writeAppLog } from '../appLog'
import {
  clearLogs,
  createGroup,
  createTarget,
  deleteGroup,
  deleteTarget,
  getAppSettings,
  getDatabaseInfo,
  getTargetHistory,
  listGroups,
  listLogs,
  listTargets,
  setUiLocale,
  updateAppSettings,
  updateEmailSettings,
  updateGroup,
  updateTarget
} from '../db'
import { setMainLocale } from '../i18n'
import { reloadMonitoring } from '../monitor/engine'
import { sendTestEmail } from '../notify/email'

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.dbInfo, () => getDatabaseInfo())
  ipcMain.handle(IpcChannels.settingsGetAll, () => getAppSettings())
  ipcMain.handle(IpcChannels.settingsUpdate, (_event, input: SettingsUpdateInput) => {
    const settings = updateAppSettings(input)
    writeAppLog(
      'info',
      'settings',
      input.applyToExistingTargets ? 'log.settings.updatedApplied' : 'log.settings.updated',
      {
        interval: settings.monitoring_interval_seconds,
        threshold: settings.failure_threshold
      }
    )
    if (input.applyToExistingTargets) {
      reloadMonitoring()
    }
    return settings
  })
  ipcMain.handle(IpcChannels.targetsList, () => listTargets())
  ipcMain.handle(IpcChannels.targetsCreate, (_event, input: TargetInput) => {
    const created = createTarget(input)
    reloadMonitoring()
    writeAppLog('info', 'targets', 'log.device.added', { name: created.name })
    return created
  })
  ipcMain.handle(IpcChannels.targetsUpdate, (_event, id: string, input: TargetInput) => {
    const updated = updateTarget(id, input)
    reloadMonitoring()
    writeAppLog('info', 'targets', 'log.device.updated', { name: updated.name })
    return updated
  })
  ipcMain.handle(IpcChannels.targetsDelete, (_event, id: string) => {
    const existing = listTargets().find((target) => target.id === id)
    deleteTarget(id)
    reloadMonitoring()
    writeAppLog('info', 'targets', 'log.device.deleted', { name: existing?.name ?? id })
  })
  ipcMain.handle(IpcChannels.groupsList, () => listGroups())
  ipcMain.handle(IpcChannels.groupsCreate, (_event, input: GroupInput) => {
    const created = createGroup(input)
    writeAppLog('info', 'groups', 'log.group.added', { name: created.name })
    return created
  })
  ipcMain.handle(IpcChannels.groupsUpdate, (_event, id: string, input: GroupInput) => {
    const updated = updateGroup(id, input)
    writeAppLog('info', 'groups', 'log.group.updated', { name: updated.name })
    return updated
  })
  ipcMain.handle(IpcChannels.groupsDelete, (_event, id: string) => {
    const existing = listGroups().find((group) => group.id === id)
    deleteGroup(id)
    writeAppLog('info', 'groups', 'log.group.deleted', { name: existing?.name ?? id })
  })
  ipcMain.handle(IpcChannels.checksHistory, (_event, targetId: string, range: HistoryRange) => {
    if (!isHistoryRange(range)) {
      throw i18nError('errors.history.invalidRange')
    }

    return getTargetHistory(targetId, range)
  })
  ipcMain.handle(IpcChannels.logsList, (_event, query?: LogQuery) => listLogs(query))
  ipcMain.handle(IpcChannels.logsClear, () => {
    clearLogs()
    writeAppLog('info', 'app', 'log.app.cleared')
  })
  ipcMain.handle(IpcChannels.settingsSetLocale, (_event, locale: UiLocale) => {
    if (!isUiLocale(locale)) {
      throw i18nError('errors.settings.invalidLocale')
    }

    const settings = setUiLocale(locale)
    setMainLocale(locale)
    return settings
  })
  ipcMain.handle(IpcChannels.emailUpdate, (_event, input: EmailSettingsInput) => {
    const settings = updateEmailSettings(input)
    writeAppLog('info', 'email', 'log.email.updated')
    return settings
  })
  ipcMain.handle(IpcChannels.emailTest, () => sendTestEmail())
}
