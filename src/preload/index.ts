import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Invoke methods (request-response)
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  resizeWindow: (width: number, height: number) =>
    ipcRenderer.invoke('resize-window', width, height),
  getVideoMetadata: (path: string) => ipcRenderer.invoke('get-video-metadata', path),
  exportVideo: (sourcePath: string, outputPath: string, trimStart: number, duration: number) =>
    ipcRenderer.invoke('export-video', { sourcePath, outputPath, trimStart, duration }),
  exportMultiClip: (clips: unknown[], outputPath: string) =>
    ipcRenderer.invoke('export-multi-clip', clips, outputPath),
  exportMultiTrack: (
    track0Clips: unknown[],
    track1Clips: unknown[],
    pipConfig: unknown,
    outputPath: string
  ) => ipcRenderer.invoke('export-multi-track', track0Clips, track1Clips, pipConfig, outputPath),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  saveRecordingBlob: (arrayBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('save-recording-blob', arrayBuffer),
  saveRecordingPermanent: (tempPath: string) =>
    ipcRenderer.invoke('save-recording-permanent', tempPath),
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  startRecording: () => ipcRenderer.invoke('start-recording'),
  startRecordingNoMinimize: () => ipcRenderer.invoke('start-recording-no-minimize'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback),
  isTempFile: (filePath: string) => ipcRenderer.invoke('is-temp-file', filePath),

  // Event listeners (one-way events)
  onExportProgress: (callback: (event: IpcRendererEvent, progress: { percent: number }) => void) =>
    ipcRenderer.on('export-progress', callback),
  onExportComplete: (callback: (event: IpcRendererEvent) => void) =>
    ipcRenderer.on('export-complete', callback),
  onExportError: (callback: (event: IpcRendererEvent, error: { message: string }) => void) =>
    ipcRenderer.on('export-error', callback),
  onMenuImport: (callback: (event: IpcRendererEvent) => void) =>
    ipcRenderer.on('menu-import', callback),
  onMenuExport: (callback: (event: IpcRendererEvent) => void) =>
    ipcRenderer.on('menu-export', callback),
  onMenuRecordWebcam: (callback: (event: IpcRendererEvent) => void) =>
    ipcRenderer.on('menu-record-webcam', callback),
  onMenuRecordScreen: (callback: (event: IpcRendererEvent) => void) =>
    ipcRenderer.on('menu-record-screen', callback),
  onMenuRecordSimultaneous: (callback: (event: IpcRendererEvent) => void) =>
    ipcRenderer.on('menu-record-simultaneous', callback),
  onCheckUnsavedRecordings: (callback: () => void) =>
    ipcRenderer.on('check-unsaved-recordings', callback),
  respondUnsavedRecordings: (hasTempFiles: boolean) =>
    ipcRenderer.send('unsaved-recordings-response', { hasTempFiles }),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
