import { useState, useMemo, useCallback } from 'react'
import { TimelineClip } from '../types/timeline'
import {
  calculateClipPositions,
  getCurrentClip,
  getRelativePlayheadPosition,
  getTotalDuration
} from '../utils/clipUtils'

interface UseMultiClipPlaybackReturn {
  playheadPosition: number
  isPlaying: boolean
  currentClip: TimelineClip | undefined
  relativePlayheadPosition: number
  totalDuration: number
  clipPositions: Map<string, { start: number; end: number }>
  setPlayheadPosition: React.Dispatch<React.SetStateAction<number>>
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>
  handleTimeUpdate: (time: number) => void
  handlePlayheadChange: (position: number) => void
  play: () => void
  pause: () => void
  togglePlayPause: () => void
}

export const useMultiClipPlayback = (clips: TimelineClip[]): UseMultiClipPlaybackReturn => {
  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const totalDuration = getTotalDuration(clips)

  const clipPositions = useMemo(() => calculateClipPositions(clips), [clips])

  const currentClip = useMemo(
    () => getCurrentClip(clips, clipPositions, playheadPosition),
    [clips, clipPositions, playheadPosition]
  )

  const relativePlayheadPosition = useMemo(
    () => getRelativePlayheadPosition(currentClip, clipPositions, playheadPosition),
    [currentClip, clipPositions, playheadPosition]
  )

  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (!currentClip) return

      const position = clipPositions.get(currentClip.id)
      if (!position) return

      const newPlayheadPosition = position.start + time

      // Check if we've reached the end of current clip
      if (newPlayheadPosition >= position.end) {
        // Find next clip
        const currentIndex = clips.findIndex((c) => c.id === currentClip.id)
        if (currentIndex < clips.length - 1) {
          // Auto-advance to next clip
          const nextClip = clips[currentIndex + 1]
          const nextPosition = clipPositions.get(nextClip.id)
          if (nextPosition) {
            setPlayheadPosition(nextPosition.start)
          }
        } else {
          // Reached end of timeline
          setPlayheadPosition(totalDuration)
          setIsPlaying(false)
        }
      } else {
        setPlayheadPosition(newPlayheadPosition)
      }
    },
    [currentClip, clipPositions, clips, totalDuration]
  )

  const handlePlayheadChange = useCallback((position: number) => {
    setPlayheadPosition(position)
    // Don't pause here - let the Timeline component handle pause/resume logic
  }, [])

  const play = useCallback(() => {
    // If at the end of timeline, restart from beginning
    if (playheadPosition >= totalDuration) {
      setPlayheadPosition(0)
    }
    setIsPlaying(true)
  }, [playheadPosition, totalDuration])

  const pause = useCallback(() => setIsPlaying(false), [])

  const togglePlayPause = useCallback(() => {
    if (!isPlaying) {
      // If at the end of timeline, restart from beginning
      if (playheadPosition >= totalDuration) {
        setPlayheadPosition(0)
      }
    }
    setIsPlaying((prev) => !prev)
  }, [isPlaying, playheadPosition, totalDuration])

  return {
    playheadPosition,
    isPlaying,
    currentClip,
    relativePlayheadPosition,
    totalDuration,
    clipPositions,
    setPlayheadPosition,
    setIsPlaying,
    handleTimeUpdate,
    handlePlayheadChange,
    play,
    pause,
    togglePlayPause
  }
}
