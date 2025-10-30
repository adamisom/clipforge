// Types for video metadata
export interface VideoMetadata {
  duration: number
  width: number
  height: number
  codec: string
  filename: string
}

// Types for clip positions on timeline
export interface ClipPosition {
  start: number
  end: number
}

export type ClipPositions = Map<string, ClipPosition>

// Types for recording
export type RecordingType = 'webcam' | 'screen'

export interface ScreenSource {
  id: string
  name: string
  thumbnail: string
}

// Types for export
export interface ExportOptions {
  sourcePath: string
  outputPath: string
  trimStart: number
  duration: number
}

export interface MultiClipExportOptions {
  clips: Array<{
    id: string
    sourcePath: string
    sourceStartTime: number
    timelineDuration: number
  }>
  outputPath: string
}
