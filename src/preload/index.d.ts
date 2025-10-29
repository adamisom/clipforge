import { ElectronAPI } from '@electron-toolkit/preload'
import { IpcRendererEvent } from 'electron'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // Invoke methods (request-response)
      selectVideoFile: () => Promise<string | null>
      resizeWindow: (width: number, height: number) => Promise<void>
      getVideoMetadata: (path: string) => Promise<{
        duration: number
        width: number
        height: number
        codec: string
        filename: string
      }>
      exportVideo: (
        src: string,
        dest: string,
        start: number,
        dur: number
      ) => Promise<{ success: boolean }>
      exportMultiClip: (
        clips: Array<{
          id: string
          sourcePath: string
          sourceStartTime: number
          timelineDuration: number
        }>,
        outputPath: string
      ) => Promise<{ success: boolean }>
      selectSavePath: () => Promise<string | null>
      saveRecordingBlob: (arrayBuffer: ArrayBuffer) => Promise<string>
      saveRecordingPermanent: (tempPath: string) => Promise<{ saved: boolean; path: string }>
      getScreenSources: () => Promise<Array<{ id: string; name: string; thumbnail: string }>>
      startRecording: () => Promise<void>
      startRecordingNoMinimize: () => Promise<void>
      stopRecording: () => Promise<void>
      onStopRecording: (callback: () => void) => void

      // Event listeners (one-way events)
      onExportProgress: (
        callback: (event: IpcRendererEvent, progress: { percent: number }) => void
      ) => void
      onExportComplete: (callback: (event: IpcRendererEvent) => void) => void
      onExportError: (
        callback: (event: IpcRendererEvent, error: { message: string }) => void
      ) => void
      onMenuImport: (callback: (event: IpcRendererEvent) => void) => void
      onMenuExport: (callback: (event: IpcRendererEvent) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}
