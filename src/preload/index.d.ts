import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // Invoke methods (request-response)
      selectVideoFile: () => Promise<string | null>
      getVideoMetadata: (path: string) => Promise<{
        duration: number
        width: number
        height: number
        codec: string
        filename: string
      }>
      exportVideo: (src: string, dest: string, start: number, dur: number) => Promise<{ success: boolean }>
      selectSavePath: () => Promise<string | null>
      
      // Event listeners (one-way events)
      onExportProgress: (callback: (event: any, progress: any) => void) => void
      onExportComplete: (callback: (event: any) => void) => void
      onExportError: (callback: (event: any, error: { message: string }) => void) => void
      onMenuImport: (callback: (event: any) => void) => void
      onMenuExport: (callback: (event: any) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}
