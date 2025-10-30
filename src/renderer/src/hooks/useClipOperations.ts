import { useCallback } from 'react'
import { TimelineClip } from '../types/timeline'
import { generateClipId } from '../utils/clipUtils'

interface UseClipOperationsProps {
  clips: TimelineClip[]
  setClips: React.Dispatch<React.SetStateAction<TimelineClip[]>>
  selectedClipId: string | null
  setSelectedClipId: React.Dispatch<React.SetStateAction<string | null>>
  currentClip: TimelineClip | undefined
  playheadPosition: number
  isPlaying: boolean
  pause: () => void
  handlePlayheadChange: (position: number) => void
}

interface UseClipOperationsReturn {
  handleMoveToTrack: (clipId: string, trackIndex: 0 | 1) => void
  handleTrimChange: (clipId: string, newTrimStart: number, newTrimEnd: number) => void
  handleSplitAtPlayhead: () => void
  handleDeleteClip: () => void
  handleSavePermanently: () => Promise<void>
}

export const useClipOperations = ({
  clips,
  setClips,
  selectedClipId,
  setSelectedClipId,
  currentClip,
  playheadPosition,
  isPlaying,
  pause,
  handlePlayheadChange
}: UseClipOperationsProps): UseClipOperationsReturn => {
  const handleMoveToTrack = useCallback(
    (clipId: string, trackIndex: 0 | 1) => {
      setClips((prevClips) =>
        prevClips.map((clip) => (clip.id === clipId ? { ...clip, trackIndex } : clip))
      )
    },
    [setClips]
  )

  const handleTrimChange = useCallback(
    (clipId: string, newTrimStart: number, newTrimEnd: number) => {
      setClips((prevClips) =>
        prevClips.map((clip) =>
          clip.id === clipId
            ? {
                ...clip,
                sourceStartTime: newTrimStart,
                timelineDuration: newTrimEnd - newTrimStart
              }
            : clip
        )
      )
    },
    [setClips]
  )

  const handleSplitAtPlayhead = useCallback((): void => {
    if (!currentClip) return

    const clipPositions = new Map<string, { start: number; end: number }>()
    let pos = 0
    for (const clip of clips) {
      clipPositions.set(clip.id, { start: pos, end: pos + clip.timelineDuration })
      pos += clip.timelineDuration
    }

    const position = clipPositions.get(currentClip.id)
    if (!position) return

    const relativePos = playheadPosition - position.start

    // Calculate split point relative to the clip's source video
    const splitPoint = relativePos + currentClip.sourceStartTime

    // Don't split if we're at the very beginning or end of the clip
    if (relativePos < 0.1 || relativePos > currentClip.timelineDuration - 0.1) {
      return
    }

    // Create two new clips from the split
    const firstClip: TimelineClip = {
      ...currentClip,
      id: generateClipId(),
      timelineDuration: relativePos
    }

    const secondClip: TimelineClip = {
      ...currentClip,
      id: generateClipId(),
      sourceStartTime: splitPoint,
      timelineDuration: currentClip.timelineDuration - relativePos
    }

    // Replace the original clip with the two new clips
    setClips((prevClips) => {
      const index = prevClips.findIndex((c) => c.id === currentClip.id)
      if (index === -1) return prevClips
      const newClips = [...prevClips]
      newClips.splice(index, 1, firstClip, secondClip)
      return newClips
    })
  }, [currentClip, clips, playheadPosition, setClips])

  const handleDeleteClip = useCallback((): void => {
    if (!selectedClipId) return

    // Confirm deletion
    const clipToDelete = clips.find((c) => c.id === selectedClipId)
    if (!clipToDelete) return

    const confirmed = window.confirm(
      `Delete "${clipToDelete.metadata.filename}"?\n\nThis cannot be undone.`
    )
    if (!confirmed) return

    // Pause playback if playing
    if (isPlaying) {
      pause()
    }

    // Find adjacent clip to select
    const index = clips.findIndex((c) => c.id === selectedClipId)
    const nextClip = clips[index + 1] || clips[index - 1] || null

    // Delete clip
    setClips((prevClips) => prevClips.filter((c) => c.id !== selectedClipId))

    // Update selection
    setSelectedClipId(nextClip?.id || null)

    // Reset playhead to start if needed
    const newTotalDuration = clips
      .filter((c) => c.id !== selectedClipId)
      .reduce((sum, c) => sum + c.timelineDuration, 0)

    if (playheadPosition > newTotalDuration) {
      handlePlayheadChange(0)
    }
  }, [
    selectedClipId,
    clips,
    isPlaying,
    pause,
    setClips,
    setSelectedClipId,
    playheadPosition,
    handlePlayheadChange
  ])

  const handleSavePermanently = useCallback(async (): Promise<void> => {
    if (!selectedClipId) return

    const clip = clips.find((c) => c.id === selectedClipId)
    if (!clip) return

    const isTemp = await window.api.isTempFile(clip.sourcePath)
    if (!isTemp) return

    try {
      const result = await window.api.saveRecordingPermanent(clip.sourcePath)
      const newPath = result.path

      // Update clip with new permanent path
      setClips((prevClips) =>
        prevClips.map((c) => (c.id === selectedClipId ? { ...c, sourcePath: newPath } : c))
      )
    } catch (error) {
      console.error('Failed to save permanently:', error)
      alert(`Failed to save: ${error}`)
    }
  }, [selectedClipId, clips, setClips])

  return {
    handleMoveToTrack,
    handleTrimChange,
    handleSplitAtPlayhead,
    handleDeleteClip,
    handleSavePermanently
  }
}
