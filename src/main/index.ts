import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'
import fs from 'fs'

// Set up FFmpeg and FFprobe binary paths (dev vs production)
const ffmpegPath = app.isPackaged ? join(process.resourcesPath, 'ffmpeg') : ffmpegInstaller.path
const ffprobePath = app.isPackaged ? join(process.resourcesPath, 'ffprobe') : ffprobeInstaller.path

if (!fs.existsSync(ffmpegPath)) {
  console.error('FFmpeg not found at:', ffmpegPath)
} else {
  ffmpeg.setFfmpegPath(ffmpegPath)
  console.log('FFmpeg path set to:', ffmpegPath)
}

if (!fs.existsSync(ffprobePath)) {
  console.error('FFprobe not found at:', ffprobePath)
} else {
  ffmpeg.setFfprobePath(ffprobePath)
  console.log('FFprobe path set to:', ffprobePath)
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, // CRITICAL: Isolates renderer from Electron APIs
      nodeIntegration: false, // CRITICAL: Prevents direct Node.js access in renderer
      sandbox: false,
      webSecurity: false, // Required for file:// URLs in development
      allowRunningInsecureContent: true // Allow mixed content in dev
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC Handlers for video operations

  // File selection handler
  ipcMain.handle('select-video-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Get video metadata handler
  ipcMain.handle('get-video-metadata', async (_event, path) => {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(path, (err, metadata) => {
        if (err) {
          reject(err)
          return
        }

        const videoStream = metadata.streams.find((s) => s.codec_type === 'video')
        if (!videoStream) {
          reject(new Error('No video stream found'))
          return
        }

        resolve({
          duration: metadata.format.duration,
          width: videoStream.width,
          height: videoStream.height,
          codec: videoStream.codec_name,
          filename: path.split(/[/\\]/).pop()
        })
      })
    })
  })

  // Save path selection handler
  ipcMain.handle('select-save-path', async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: 'trimmed-video.mp4',
      filters: [{ name: 'MP4', extensions: ['mp4'] }]
    })
    return result.canceled ? null : result.filePath
  })

  // Export video handler
  ipcMain.handle(
    'export-video',
    async (_event, { sourcePath, outputPath, trimStart, duration }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0]

      return new Promise((resolve, reject) => {
        ffmpeg(sourcePath)
          .setStartTime(trimStart)
          .setDuration(duration)
          .output(outputPath)
          .on('progress', (progress) => {
            mainWindow.webContents.send('export-progress', progress)
          })
          .on('end', () => {
            mainWindow.webContents.send('export-complete')
            resolve({ success: true })
          })
          .on('error', (err) => {
            mainWindow.webContents.send('export-error', { message: err.message })
            reject(err)
          })
          .run()
      })
    }
  )

  // Setup application menu
  const mainWindow = BrowserWindow.getAllWindows()[0]
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Video',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-import')
          }
        },
        {
          label: 'Export Video',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.send('menu-export')
          }
        },
        { type: 'separator' as const },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          role: 'quit' as const
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
