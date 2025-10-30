export interface TimelineClip {
  id: string
  sourceType: 'imported' | 'screen' | 'webcam'
  sourcePath: string
  sourceStartTime: number
  sourceDuration: number
  timelineDuration: number
  trackIndex: 0 | 1 // NEW: Track assignment (0 = main, 1 = PiP overlay)
  metadata: {
    filename: string
    resolution: string
    codec: string
  }
}

export interface PiPConfig {
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  size: 'small' | 'medium' | 'large'
}

export const DEFAULT_PIP_CONFIG: PiPConfig = {
  position: 'bottom-right',
  size: 'medium'
}
