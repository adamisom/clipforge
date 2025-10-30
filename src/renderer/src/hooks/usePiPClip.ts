import { useMemo } from 'react'
import { TimelineClip } from '../types/timeline'
import { getTrack1Clips, calculateClipPositions, getCurrentClip } from '../utils/clipUtils'

/**
 * Hook to calculate the current PiP clip (Track 1) at the playhead position
 * Returns null if no Track 1 clips exist or if playhead is not over a Track 1 clip
 */
export const usePiPClip = (
  clips: TimelineClip[],
  playheadPosition: number
): TimelineClip | null => {
  return useMemo(() => {
    const track1Clips = getTrack1Clips(clips)
    if (track1Clips.length === 0) return null

    const track1Positions = calculateClipPositions(track1Clips)
    return getCurrentClip(track1Clips, track1Positions, playheadPosition) || null
  }, [clips, playheadPosition])
}
