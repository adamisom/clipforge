export interface TimelineClip {
  id: string
  sourceType: 'imported' | 'screen' | 'webcam'
  sourcePath: string
  sourceStartTime: number
  sourceDuration: number
  timelineDuration: number
  metadata: {
    filename: string
    resolution: string
    codec: string
  }
}
