import { DEFAULT_SETTINGS } from '@shared/types'
import type { AppLog, AppSettings, EmailSettingsInput, Group, GroupInput, HistoryRange, LogQuery, SettingsUpdateInput, Target, TargetInput, UiLocale } from '@shared/types'
import { attachMonitorState, getTargetHistory as readTargetHistory } from './checks'
import { getDatabase } from './connection'
import {
  createGroup as insertGroup,
  deleteGroup as removeGroup,
  listGroups as readGroups,
  updateGroup as saveGroup
} from './groups'
import { getAppSettings as readAppSettings, updateAppSettings as saveAppSettings, updateEmailSettings as saveEmailSettings, updateUiLocale as saveUiLocale } from './settings'
import {
  createTarget as insertTarget,
  deleteTarget as removeTarget,
  listTargets as readTargets,
  updateTarget as saveTarget
} from './targets'
import { clearAppLogs as removeAppLogs, listAppLogs as readAppLogs } from './logs'

export { closeDatabase, getDatabase, getDatabaseInfo, initDatabase } from './connection'

function withMonitorState(target: Target): Target {
  return attachMonitorState(getDatabase(), [target])[0]
}

export function getAppSettings(): AppSettings {
  try {
    return readAppSettings(getDatabase())
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      last_opened_at: null
    }
  }
}

export function updateAppSettings(input: SettingsUpdateInput): AppSettings {
  return saveAppSettings(getDatabase(), input)
}

export function setUiLocale(locale: UiLocale): AppSettings {
  return saveUiLocale(getDatabase(), locale)
}

export function updateEmailSettings(input: EmailSettingsInput): AppSettings {
  return saveEmailSettings(getDatabase(), input)
}

export function listTargets(): Target[] {
  return attachMonitorState(getDatabase(), readTargets(getDatabase()))
}

export function createTarget(input: TargetInput): Target {
  return withMonitorState(insertTarget(getDatabase(), input))
}

export function updateTarget(id: string, input: TargetInput): Target {
  return withMonitorState(saveTarget(getDatabase(), id, input))
}

export function deleteTarget(id: string): void {
  removeTarget(getDatabase(), id)
}

export function listGroups(): Group[] {
  return readGroups(getDatabase())
}

export function createGroup(input: GroupInput): Group {
  return insertGroup(getDatabase(), input)
}

export function updateGroup(id: string, input: GroupInput): Group {
  return saveGroup(getDatabase(), id, input)
}

export function deleteGroup(id: string): void {
  removeGroup(getDatabase(), id)
}

export function getTargetHistory(targetId: string, range: HistoryRange) {
  return readTargetHistory(getDatabase(), targetId, range)
}

export function listLogs(query?: LogQuery): AppLog[] {
  return readAppLogs(getDatabase(), query)
}

export function clearLogs(): void {
  removeAppLogs(getDatabase())
}
