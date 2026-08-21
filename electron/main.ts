import { app, BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { closeDatabase, getAppSettings, initDatabase } from './db'
import { initMainI18n } from './i18n'
import { registerIpcHandlers } from './ipc/register'
import { startMonitoring, stopMonitoring } from './monitor/engine'
import { writeAppLog } from './appLog'

let mainWindow: BrowserWindow | null = null

function resolveWindowIcon(): string | undefined {
  const packaged = path.join(process.resourcesPath, 'icon.ico')
  const development = path.join(__dirname, '../../build/icon.ico')

  if (existsSync(packaged)) {
    return packaged
  }

  if (existsSync(development)) {
    return development
  }

  return undefined
}

function createWindow(): void {
  const icon = resolveWindowIcon()
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'Ping Alert V2',
    backgroundColor: '#020617',
    show: false,
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function focusMainWindow(): void {
  if (!mainWindow) {
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    focusMainWindow()
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.pingalert.v2')
    initDatabase(app.getPath('userData'), app.getLocale())
    await initMainI18n(getAppSettings().ui_locale)
    registerIpcHandlers()
    startMonitoring()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('before-quit', () => {
  writeAppLog('info', 'app', 'log.app.stopping')
  stopMonitoring()
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
