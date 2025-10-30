import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePiPClip } from './usePiPClip'
import { TimelineClip } from '../types/timeline'

describe('usePiPClip', () => {
  const mockTrack0Clips: TimelineClip[] = [
    {
      id: 'main1',
      sourceType: 'imported',
      sourcePath: '/video1.mp4',
      sourceStartTime: 0,
      sourceDuration: 30,
      timelineDuration: 10,
      trackIndex: 0,
      metadata: { filename: 'video1.mp4', resolution: '1920x1080', codec: 'h264' }
    },
    {
      id: 'main2',
      sourceType: 'screen',
      sourcePath: '/screen.webm',
      sourceStartTime: 0,
      sourceDuration: 15,
      timelineDuration: 8,
      trackIndex: 0,
      metadata: { filename: 'screen.webm', resolution: '1920x1080', codec: 'vp8' }
    }
  ]

  const mockTrack1Clips: TimelineClip[] = [
    {
      id: 'pip1',
      sourceType: 'webcam',
      sourcePath: '/webcam1.webm',
      sourceStartTime: 0,
      sourceDuration: 20,
      timelineDuration: 10,
      trackIndex: 1,
      metadata: { filename: 'webcam1.webm', resolution: '640x480', codec: 'vp8' }
    },
    {
      id: 'pip2',
      sourceType: 'webcam',
      sourcePath: '/webcam2.webm',
      sourceStartTime: 0,
      sourceDuration: 12,
      timelineDuration: 6,
      trackIndex: 1,
      metadata: { filename: 'webcam2.webm', resolution: '640x480', codec: 'vp8' }
    }
  ]

  const mixedClips = [...mockTrack0Clips, ...mockTrack1Clips]

  describe('returns null when no Track 1 clips', () => {
    it('returns null for Track 0 only clips', () => {
      const { result } = renderHook(() => usePiPClip(mockTrack0Clips, 5))

      expect(result.current).toBeNull()
    })

    it('returns null for empty clips array', () => {
      const { result } = renderHook(() => usePiPClip([], 5))

      expect(result.current).toBeNull()
    })
  })

  describe('returns Track 1 clip at playhead position', () => {
    it('returns first PiP clip when playhead at start', () => {
      const { result } = renderHook(() => usePiPClip(mixedClips, 0))

      expect(result.current).not.toBeNull()
      expect(result.current?.id).toBe('pip1')
      expect(result.current?.trackIndex).toBe(1)
    })

    it('returns first PiP clip when playhead within first clip', () => {
      const { result } = renderHook(() => usePiPClip(mixedClips, 5))

      expect(result.current?.id).toBe('pip1')
    })

    it('returns second PiP clip when playhead in second clip', () => {
      // pip1 ends at 10, pip2 starts at 10
      const { result } = renderHook(() => usePiPClip(mixedClips, 12))

      expect(result.current?.id).toBe('pip2')
    })

    it('returns last PiP clip when playhead at end', () => {
      const { result } = renderHook(() => usePiPClip(mixedClips, 15))

      expect(result.current?.id).toBe('pip2')
    })

    it('returns last PiP clip when playhead beyond timeline', () => {
      const { result } = renderHook(() => usePiPClip(mixedClips, 100))

      expect(result.current?.id).toBe('pip2')
    })
  })

  describe('returns null when playhead outside Track 1 clips', () => {
    it('returns null before first Track 1 clip if Track 1 has gap', () => {
      // Empty Track 1 at playhead 0
      const { result } = renderHook(() => usePiPClip(mockTrack0Clips, 0))
      expect(result.current).toBeNull()
    })
  })

  describe('ignores Track 0 clips', () => {
    it('only considers Track 1 clips', () => {
      const { result } = renderHook(() => usePiPClip(mixedClips, 0))

      // Should return pip1 (Track 1), not main1 (Track 0)
      expect(result.current?.trackIndex).toBe(1)
      expect(result.current?.id).toBe('pip1')
    })

    it('does not return Track 0 clip even if at playhead', () => {
      const { result } = renderHook(() => usePiPClip(mixedClips, 5))

      // At playhead 5, both main1 and pip1 are present
      // Should return pip1, not main1
      expect(result.current?.trackIndex).toBe(1)
    })
  })

  describe('handles multiple Track 1 clips', () => {
    it('correctly transitions between multiple PiP clips', () => {
      // Playhead at 5 → pip1
      const { result: result1 } = renderHook(() => usePiPClip(mixedClips, 5))
      expect(result1.current?.id).toBe('pip1')

      // Playhead at 12 → pip2
      const { result: result2 } = renderHook(() => usePiPClip(mixedClips, 12))
      expect(result2.current?.id).toBe('pip2')
    })

    it('handles clip boundary correctly', () => {
      // Exactly at pip2 start (10)
      const { result } = renderHook(() => usePiPClip(mixedClips, 10))

      expect(result.current?.id).toBe('pip2')
    })
  })

  describe('reactivity', () => {
    it('updates when playhead position changes', () => {
      const { result, rerender } = renderHook(
        ({ clips, playhead }) => usePiPClip(clips, playhead),
        { initialProps: { clips: mixedClips, playhead: 5 } }
      )

      expect(result.current?.id).toBe('pip1')

      // Update playhead
      rerender({ clips: mixedClips, playhead: 12 })

      expect(result.current?.id).toBe('pip2')
    })

    it('updates when clips array changes', () => {
      const { result, rerender } = renderHook(
        ({ clips, playhead }) => usePiPClip(clips, playhead),
        { initialProps: { clips: mockTrack0Clips, playhead: 5 } }
      )

      expect(result.current).toBeNull()

      // Add Track 1 clips
      rerender({ clips: mixedClips, playhead: 5 })

      expect(result.current?.id).toBe('pip1')
    })
  })
})
