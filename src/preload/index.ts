import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Invoke methods (request-response)
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  getVideoMetadata: (path: string) => ipcRenderer.invoke('get-video-metadata', path),
  exportVideo: (sourcePath: string, outputPath: string, trimStart: number, duration: number) =>
    ipcRenderer.invoke('export-video', { sourcePath, outputPath, trimStart, duration }),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  saveRecordingBlob: (arrayBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('save-recording-blob', arrayBuffer),
  saveRecordingPermanent: (tempPath: string) =>
    ipcRenderer.invoke('save-recording-permanent', tempPath),
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback),

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
