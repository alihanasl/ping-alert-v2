import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type {
  AppLog,
  EmailSettingsInput,
  GroupInput,
  HistoryRange,
  HostsCreateInput,
  IpRangeInput,
  LogQuery,
  PingAlertApi,
  ScanProgress,
  SettingsUpdateInput,
  TargetInput,
  TargetStatusUpdate,
  UiLocale
} from '@shared/types'

const api: PingAlertApi = {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  getDatabaseInfo: () => ipcRenderer.invoke(IpcChannels.dbInfo),
  getSettings: () => ipcRenderer.invoke(IpcChannels.settingsGetAll),
  updateSettings: (input: SettingsUpdateInput) =>
    ipcRenderer.invoke(IpcChannels.settingsUpdate, input),
  setLocale: (locale: UiLocale) => ipcRenderer.invoke(IpcChannels.settingsSetLocale, locale),
  updateEmailSettings: (input: EmailSettingsInput) =>
    ipcRenderer.invoke(IpcChannels.emailUpdate, input),
  testEmail: () => ipcRenderer.invoke(IpcChannels.emailTest),
  listTargets: () => ipcRenderer.invoke(IpcChannels.targetsList),
  createTarget: (input: TargetInput) => ipcRenderer.invoke(IpcChannels.targetsCreate, input),
  updateTarget: (id: string, input: TargetInput) =>
    ipcRenderer.invoke(IpcChannels.targetsUpdate, id, input),
  deleteTarget: (id: string) => ipcRenderer.invoke(IpcChannels.targetsDelete, id),
  listGroups: () => ipcRenderer.invoke(IpcChannels.groupsList),
  createGroup: (input: GroupInput) => ipcRenderer.invoke(IpcChannels.groupsCreate, input),
  updateGroup: (id: string, input: GroupInput) =>
    ipcRenderer.invoke(IpcChannels.groupsUpdate, id, input),
  deleteGroup: (id: string) => ipcRenderer.invoke(IpcChannels.groupsDelete, id),
  getTargetHistory: (targetId: string, range: HistoryRange) =>
    ipcRenderer.invoke(IpcChannels.checksHistory, targetId, range),
  listLogs: (query?: LogQuery) => ipcRenderer.invoke(IpcChannels.logsList, query),
  clearLogs: () => ipcRenderer.invoke(IpcChannels.logsClear),
  startIpScan: (input: IpRangeInput) => ipcRenderer.invoke(IpcChannels.scanStart, input),
  cancelIpScan: (scanId: string) => ipcRenderer.invoke(IpcChannels.scanCancel, scanId),
  createTargetsFromHosts: (input: HostsCreateInput) =>
    ipcRenderer.invoke(IpcChannels.targetsCreateHosts, input),
  onTargetStatus: (callback: (update: TargetStatusUpdate) => void) => {
    const listener = (_event: unknown, update: TargetStatusUpdate): void => {
      callback(update)
    }

    ipcRenderer.on(IpcChannels.monitorUpdate, listener)

    return () => {
      ipcRenderer.removeListener(IpcChannels.monitorUpdate, listener)
    }
  },
  onAppLog: (callback: (log: AppLog) => void) => {
    const listener = (_event: unknown, log: AppLog): void => {
      callback(log)
    }

    ipcRenderer.on(IpcChannels.logsAppend, listener)

    return () => {
      ipcRenderer.removeListener(IpcChannels.logsAppend, listener)
    }
  },
  onScanProgress: (callback: (update: ScanProgress) => void) => {
    const listener = (_event: unknown, update: ScanProgress): void => {
      callback(update)
    }

    ipcRenderer.on(IpcChannels.scanProgress, listener)

    return () => {
      ipcRenderer.removeListener(IpcChannels.scanProgress, listener)
    }
  }
}

contextBridge.exposeInMainWorld('pingAlert', api)
