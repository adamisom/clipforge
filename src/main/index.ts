import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  desktopCapturer,
  Notification,
  globalShortcut
} from 'electron'
import { join } from 'path'
import path from 'path'
import os from 'os'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'
import fs from 'fs'
import {
  initializeOnAppStart,
  getTempRecordingPath,
  checkTempDirSize,
  isTempFile
} from './utils/tempFileManager'

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

// Track recording state
let isRecording = false
let recordingNotification: Notification | null = null
let quitting = false

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

  // Enable getDisplayMedia by handling the permission request
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true) // Allow media access for getDisplayMedia
      } else {
        callback(false)
      }
    }
  )

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// App quit handler - warn about unsaved recordings
app.on('before-quit', async (e) => {
  if (quitting) return

  e.preventDefault()

  const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isAlwaysOnTop())
  if (!mainWindow) {
    quitting = true
    app.quit()
    return
  }

  // Check for temp files with timeout
  const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))

  const checkPromise = new Promise<boolean>((resolve) => {
    mainWindow.webContents.send('check-unsaved-recordings')
    ipcMain.once('unsaved-recordings-response', (_event, { hasTempFiles }) => {
      resolve(hasTempFiles)
    })
  })

  const hasTempFiles = await Promise.race([checkPromise, timeoutPromise])

  if (hasTempFiles) {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Quit Anyway', 'Cancel'],
      defaultId: 1,
      title: 'Unsaved Recordings',
      message: 'You have unsaved recordings in temporary storage.',
      detail: 'These recordings will be deleted. Make sure to save or export first.'
    })

    if (response.response === 0) {
      quitting = true
      app.quit()
    }
  } else {
    quitting = true
    app.quit()
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await initializeOnAppStart([])

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

  // Resize window based on content
  ipcMain.handle('resize-window', (_event, width: number, height: number) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setSize(Math.floor(width), Math.floor(height), true) // animate: true
    }
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

  // Multi-clip export with concatenation
  ipcMain.handle(
    'export-multi-clip',
    async (
      _event,
      clips: Array<{
        id: string
        sourcePath: string
        sourceStartTime: number
        timelineDuration: number
      }>,
      outputPath: string
    ) => {
      const mainWindow = BrowserWindow.getAllWindows()[0]

      return new Promise((resolve, reject) => {
        // Create a temporary concat file list
        const tmpDir = os.tmpdir()
        const concatListPath = path.join(tmpDir, `clipforge-concat-${Date.now()}.txt`)

        // Generate FFmpeg concat demuxer format
        // For trimmed clips, we need to use complex filter instead
        const hasTrims = clips.some(
          (clip) => clip.sourceStartTime > 0 || clip.timelineDuration < clip.sourcePath.length
        )

        if (hasTrims) {
          // Use complex filter for trimmed clips
          const command = ffmpeg()

          // Add all inputs
          clips.forEach((clip) => {
            command.input(clip.sourcePath)
          })

          // Build filter complex
          const filterParts: string[] = []
          clips.forEach((clip, i) => {
            // Trim each input
            filterParts.push(
              `[${i}:v]trim=start=${clip.sourceStartTime}:duration=${clip.timelineDuration},setpts=PTS-STARTPTS[v${i}]`
            )
            filterParts.push(
              `[${i}:a]atrim=start=${clip.sourceStartTime}:duration=${clip.timelineDuration},asetpts=PTS-STARTPTS[a${i}]`
            )
          })

          // Concatenate all trimmed streams
          const vInputs = clips.map((_, i) => `[v${i}]`).join('')
          const aInputs = clips.map((_, i) => `[a${i}]`).join('')
          filterParts.push(`${vInputs}concat=n=${clips.length}:v=1:a=0[outv]`)
          filterParts.push(`${aInputs}concat=n=${clips.length}:v=0:a=1[outa]`)

          command
            .complexFilter(filterParts.join(';'))
            .outputOptions(['-map', '[outv]', '-map', '[outa]'])
            .output(outputPath)
            .videoCodec('libx264')
            .audioCodec('aac')
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
        } else {
          // Simple concat demuxer (no trimming needed)
          const concatList = clips.map((clip) => `file '${clip.sourcePath}'`).join('\n')

          fs.promises
            .writeFile(concatListPath, concatList)
            .then(() => {
              ffmpeg()
                .input(concatListPath)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .outputOptions(['-c', 'copy'])
                .output(outputPath)
                .on('progress', (progress) => {
                  mainWindow.webContents.send('export-progress', progress)
                })
                .on('end', () => {
                  // Clean up temp file
                  fs.promises.unlink(concatListPath).catch(() => {})
                  mainWindow.webContents.send('export-complete')
                  resolve({ success: true })
                })
                .on('error', (err) => {
                  // Clean up temp file
                  fs.promises.unlink(concatListPath).catch(() => {})
                  mainWindow.webContents.send('export-error', { message: err.message })
                  reject(err)
                })
                .run()
            })
            .catch((err) => {
              mainWindow.webContents.send('export-error', { message: err.message })
              reject(err)
            })
        }
      })
    }
  )

  // Check if a file path is in the temp directory
  ipcMain.handle('is-temp-file', (_event, filePath: string) => {
    return isTempFile(filePath)
  })

  // Save recording blob to temp
  ipcMain.handle('save-recording-blob', async (_event, arrayBuffer: ArrayBuffer) => {
    try {
      const size = await checkTempDirSize()
      const MAX_SIZE = 5 * 1024 * 1024 * 1024

      if (size + arrayBuffer.byteLength > MAX_SIZE) {
        throw new Error('Temp directory size limit exceeded. Please save existing recordings.')
      }

      const tempPath = getTempRecordingPath()
      const buffer = Buffer.from(arrayBuffer)

      await fs.promises.writeFile(tempPath, buffer)
      console.log('Recording saved to temp:', tempPath)

      return tempPath
    } catch (err) {
      console.error('Error saving recording:', err)
      throw err
    }
  })

  // Save recording to permanent location
  ipcMain.handle('save-recording-permanent', async (_event, tempPath: string) => {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
    const result = await dialog.showSaveDialog({
      defaultPath: `clipforge-recording-${timestamp}.webm`,
      filters: [{ name: 'WebM Video', extensions: ['webm'] }]
    })

    if (result.canceled || !result.filePath) {
      return { saved: false, path: tempPath }
    }

    try {
      await fs.promises.copyFile(tempPath, result.filePath)
      await fs.promises.unlink(tempPath)
      return { saved: true, path: result.filePath }
    } catch (err) {
      console.error('Error moving recording:', err)
      throw err
    }
  })

  // Get screen sources for recording
  ipcMain.handle('get-screen-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 300, height: 200 }
    })

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }))
  })

  // Start recording - minimize window, show notification, register shortcut
  ipcMain.handle('start-recording', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.minimize()
    }

    isRecording = true

    // Unregister any existing shortcut first (in case of quick re-recording)
    globalShortcut.unregister('CommandOrControl+Shift+S')

    // Register global shortcut to stop recording
    const ret = globalShortcut.register('CommandOrControl+Shift+S', () => {
      console.log('Stop recording shortcut pressed')
      if (isRecording && mainWindow) {
        mainWindow.webContents.send('stop-recording')
      }
    })

    if (!ret) {
      console.warn('Shortcut registration returned false (may already be registered elsewhere)')
    }

    // Show notification with action
    recordingNotification = new Notification({
      title: 'Recording in Progress',
      body: 'Press Cmd+Shift+S to stop, or click Stop below',
      silent: true,
      actions: [{ type: 'button', text: 'Stop Recording' }]
    })

    recordingNotification.on('action', () => {
      console.log('Stop recording from notification')
      if (isRecording && mainWindow) {
        mainWindow.webContents.send('stop-recording')
      }
    })

    recordingNotification.on('click', () => {
      console.log('Notification clicked')
      if (isRecording && mainWindow) {
        mainWindow.webContents.send('stop-recording')
      }
    })

    recordingNotification.show()
  })

  // New handler: start recording without minimizing (for recording own app)
  ipcMain.handle('start-recording-no-minimize', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]

    isRecording = true

    // Unregister any existing shortcut first (in case of quick re-recording)
    globalShortcut.unregister('CommandOrControl+Shift+S')

    // Register global shortcut to stop recording
    const ret = globalShortcut.register('CommandOrControl+Shift+S', () => {
      console.log('Stop recording shortcut pressed')
      if (isRecording && mainWindow) {
        mainWindow.webContents.send('stop-recording')
      }
    })

    if (!ret) {
      console.warn('Shortcut registration returned false (may already be registered elsewhere)')
    }

    // Show notification with action
    recordingNotification = new Notification({
      title: 'Recording in Progress',
      body: 'Press Cmd+Shift+S to stop recording',
      silent: true,
      actions: [{ type: 'button', text: 'Stop Recording' }]
    })

    recordingNotification.on('action', () => {
      console.log('Stop recording from notification')
      if (isRecording && mainWindow) {
        mainWindow.webContents.send('stop-recording')
      }
    })

    recordingNotification.on('click', () => {
      console.log('Notification clicked')
      if (isRecording && mainWindow) {
        mainWindow.webContents.send('stop-recording')
      }
    })

    recordingNotification.show()
  })

  // Stop recording - cleanup
  ipcMain.handle('stop-recording', () => {
    isRecording = false

    // Unregister shortcut
    globalShortcut.unregister('CommandOrControl+Shift+S')

    // Close notification
    if (recordingNotification) {
      recordingNotification.close()
      recordingNotification = null
    }

    // Restore window
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.restore()
      mainWindow.focus()
    }
  })

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
      label: 'Record',
      submenu: [
        {
          label: 'Record Webcam',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => {
            mainWindow.webContents.send('menu-record-webcam')
          }
        },
        {
          label: 'Record Screen',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow.webContents.send('menu-record-screen')
          }
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
