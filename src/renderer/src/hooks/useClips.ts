import { useState, useCallback } from 'react'
import { TimelineClip } from '../types/timeline'

interface UseClipsReturn {
  clips: TimelineClip[]
  selectedClipId: string | null
  setClips: React.Dispatch<React.SetStateAction<TimelineClip[]>>
  setSelectedClipId: React.Dispatch<React.SetStateAction<string | null>>
  addClip: (clip: TimelineClip) => void
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void
  removeClip: (clipId: string) => void
  splitClip: (
    clipId: string,
    splitPoint: number,
    createFirstClip: (original: TimelineClip) => TimelineClip,
    createSecondClip: (original: TimelineClip) => TimelineClip
  ) => void
  updateTrim: (clipId: string, trimStart: number, trimEnd: number) => void
}

export const useClips = (): UseClipsReturn => {
  const [clips, setClips] = useState<TimelineClip[]>([])
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)

  const addClip = useCallback((clip: TimelineClip) => {
    setClips((prev) => [...prev, clip])
    setSelectedClipId(clip.id)
  }, [])

  const updateClip = useCallback((clipId: string, updates: Partial<TimelineClip>) => {
    setClips((prev) => prev.map((clip) => (clip.id === clipId ? { ...clip, ...updates } : clip)))
  }, [])

  const removeClip = useCallback((clipId: string) => {
    setClips((prev) => prev.filter((clip) => clip.id !== clipId))
  }, [])

  const splitClip = useCallback(
    (
      clipId: string,
      _splitPoint: number,
      createFirstClip: (original: TimelineClip) => TimelineClip,
      createSecondClip: (original: TimelineClip) => TimelineClip
    ) => {
      setClips((prev) => {
        const index = prev.findIndex((c) => c.id === clipId)
        if (index === -1) return prev

        const originalClip = prev[index]
        const firstClip = createFirstClip(originalClip)
        const secondClip = createSecondClip(originalClip)

        const newClips = [...prev]
        newClips.splice(index, 1, firstClip, secondClip)
        return newClips
      })
    },
    []
  )

  const updateTrim = useCallback((clipId: string, trimStart: number, trimEnd: number) => {
    setClips((prev) =>
      prev.map((clip) =>
        clip.id === clipId
          ? {
              ...clip,
              sourceStartTime: trimStart,
              timelineDuration: trimEnd - trimStart
            }
          : clip
      )
    )
  }, [])

  return {
    clips,
    selectedClipId,
    setClips,
    setSelectedClipId,
    addClip,
    updateClip,
    removeClip,
    splitClip,
    updateTrim
  }
}
