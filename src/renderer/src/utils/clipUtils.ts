import { TimelineClip } from '../types/timeline'

/**
 * Generate a unique clip ID
 */
export const generateClipId = (): string => {
  return `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Calculate clip positions on timeline (start/end times)
 */
export const calculateClipPositions = (
  clips: TimelineClip[]
): Map<string, { start: number; end: number }> => {
  const positions = new Map<string, { start: number; end: number }>()
  let pos = 0
  for (const clip of clips) {
    positions.set(clip.id, { start: pos, end: pos + clip.timelineDuration })
    pos += clip.timelineDuration
  }
  return positions
}

/**
 * Check if a file path is a temporary recording
 */
export const isTempFile = async (sourcePath: string): Promise<boolean> => {
  return await window.api.isTempFile(sourcePath)
}

/**
 * Get the clip that contains the playhead position
 */
export const getCurrentClip = (
  clips: TimelineClip[],
  clipPositions: Map<string, { start: number; end: number }>,
  playheadPosition: number
): TimelineClip | undefined => {
  for (const clip of clips) {
    const position = clipPositions.get(clip.id)
    if (position && playheadPosition >= position.start && playheadPosition < position.end) {
      return clip
    }
  }
  // If playhead is at the very end or beyond, return last clip
  return clips[clips.length - 1]
}

/**
 * Get playhead position relative to current clip
 */
export const getRelativePlayheadPosition = (
  currentClip: TimelineClip | undefined,
  clipPositions: Map<string, { start: number; end: number }>,
  playheadPosition: number
): number => {
  if (!currentClip) return 0
  const position = clipPositions.get(currentClip.id)
  if (!position) return 0
  return playheadPosition - position.start
}

/**
 * Calculate total duration of all clips
 */
export const getTotalDuration = (clips: TimelineClip[]): number => {
  return clips.reduce((sum, clip) => sum + clip.timelineDuration, 0)
}

/**
 * Create a timeline clip from metadata
 */
export const createClipFromMetadata = (
  sourceType: 'imported' | 'screen' | 'webcam',
  sourcePath: string,
  metadata: {
    duration: number
    width: number
    height: number
    codec: string
    filename: string
  },
  durationOverride?: number
): TimelineClip => {
  const duration = durationOverride ?? metadata.duration

  // Auto-assign track: webcam → Track 1 (PiP), everything else → Track 0 (main)
  const trackIndex: 0 | 1 = sourceType === 'webcam' ? 1 : 0

  return {
    id: generateClipId(),
    sourceType,
    sourcePath,
    sourceStartTime: 0,
    sourceDuration: metadata.duration,
    timelineDuration: duration,
    trackIndex, // NEW
    metadata: {
      filename: metadata.filename,
      resolution: `${metadata.width}x${metadata.height}`,
      codec: metadata.codec
    }
  }
}
