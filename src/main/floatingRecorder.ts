import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let floatingWindow: BrowserWindow | null = null

export function createFloatingRecorder(): void {
  if (floatingWindow) return

  floatingWindow = new BrowserWindow({
    width: 320,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    floatingWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/floating-recorder.html`)
  } else {
    floatingWindow.loadFile(join(__dirname, '../renderer/floating-recorder.html'))
  }

  floatingWindow.on('closed', () => {
    floatingWindow = null
  })
}

export function closeFloatingRecorder(): void {
  if (floatingWindow) {
    floatingWindow.close()
    floatingWindow = null
  }
}

export function getFloatingWindow(): BrowserWindow | null {
  return floatingWindow
}
