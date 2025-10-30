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
