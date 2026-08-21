import { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { TargetStatusUpdate } from '@shared/types'

export function broadcastTargetStatus(update: TargetStatusUpdate): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IpcChannels.monitorUpdate, update)
  }
}
