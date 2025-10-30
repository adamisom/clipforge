import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMultiClipPlayback } from './useMultiClipPlayback'
import { TimelineClip } from '../types/timeline'

describe('useMultiClipPlayback', () => {
  const mockClips: TimelineClip[] = [
    {
      id: 'clip1',
      sourceType: 'imported',
      sourcePath: '/video1.mp4',
      sourceStartTime: 0,
      sourceDuration: 30,
      timelineDuration: 10,
      trackIndex: 0,
      metadata: { filename: 'video1.mp4', resolution: '1920x1080', codec: 'h264' }
    },
    {
      id: 'clip2',
      sourceType: 'screen',
      sourcePath: '/screen.webm',
      sourceStartTime: 5,
      sourceDuration: 20,
      timelineDuration: 8,
      trackIndex: 0,
      metadata: { filename: 'screen.webm', resolution: '1920x1080', codec: 'vp8' }
    },
    {
      id: 'clip3',
      sourceType: 'webcam',
      sourcePath: '/webcam.webm',
      sourceStartTime: 0,
      sourceDuration: 15,
      timelineDuration: 5,
      trackIndex: 0,
      metadata: { filename: 'webcam.webm', resolution: '640x480', codec: 'vp8' }
    }
  ]

  const mixedTrackClips: TimelineClip[] = [
    ...mockClips,
    {
      id: 'pip1',
      sourceType: 'webcam',
      sourcePath: '/pip.webm',
      sourceStartTime: 0,
      sourceDuration: 10,
      timelineDuration: 10,
      trackIndex: 1,
      metadata: { filename: 'pip.webm', resolution: '640x480', codec: 'vp8' }
    }
  ]

  describe('initialization', () => {
    it('initializes with playhead at 0', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      expect(result.current.playheadPosition).toBe(0)
    })

    it('initializes with isPlaying false', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      expect(result.current.isPlaying).toBe(false)
    })

    it('calculates total duration correctly', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      expect(result.current.totalDuration).toBe(23) // 10 + 8 + 5
    })

    it('sets currentClip to first clip', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      expect(result.current.currentClip).toBe(mockClips[0])
    })

    it('handles empty clips array', () => {
      const { result } = renderHook(() => useMultiClipPlayback([]))

      expect(result.current.totalDuration).toBe(0)
      expect(result.current.currentClip).toBeUndefined()
      expect(result.current.playheadPosition).toBe(0)
    })
  })

  describe('Track 0 filtering', () => {
    it('only uses Track 0 clips for playback', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mixedTrackClips))

      // Total duration should only count Track 0 clips (10 + 8 + 5 = 23)
      // Not Track 1 clip (pip1 = 10)
      expect(result.current.totalDuration).toBe(23)
    })

    it('ignores Track 1 clips in currentClip calculation', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mixedTrackClips))

      // Even with Track 1 clips, playhead at 0 should return first Track 0 clip
      expect(result.current.currentClip?.trackIndex).toBe(0)
      expect(result.current.currentClip?.id).toBe('clip1')
    })

    it('only includes Track 0 clips in clipPositions', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mixedTrackClips))

      // Should have 3 Track 0 clips
      expect(result.current.clipPositions.size).toBe(3)
      expect(result.current.clipPositions.has('clip1')).toBe(true)
      expect(result.current.clipPositions.has('clip2')).toBe(true)
      expect(result.current.clipPositions.has('clip3')).toBe(true)
      expect(result.current.clipPositions.has('pip1')).toBe(false)
    })
  })

  describe('getCurrentClip', () => {
    it('returns correct clip at various playhead positions', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      // Playhead at 0 → clip1
      expect(result.current.currentClip).toBe(mockClips[0])

      // Playhead at 12 → clip2 (starts at 10)
      act(() => {
        result.current.setPlayheadPosition(12)
      })
      expect(result.current.currentClip).toBe(mockClips[1])

      // Playhead at 20 → clip3 (starts at 18)
      act(() => {
        result.current.setPlayheadPosition(20)
      })
      expect(result.current.currentClip).toBe(mockClips[2])
    })

    it('returns last clip when playhead beyond timeline', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setPlayheadPosition(100)
      })

      expect(result.current.currentClip).toBe(mockClips[2])
    })
  })

  describe('play/pause controls', () => {
    it('play() sets isPlaying to true', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.play()
      })

      expect(result.current.isPlaying).toBe(true)
    })

    it('pause() sets isPlaying to false', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.play()
      })
      act(() => {
        result.current.pause()
      })

      expect(result.current.isPlaying).toBe(false)
    })

    it('togglePlayPause() toggles isPlaying', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      expect(result.current.isPlaying).toBe(false)

      act(() => {
        result.current.togglePlayPause()
      })
      expect(result.current.isPlaying).toBe(true)

      act(() => {
        result.current.togglePlayPause()
      })
      expect(result.current.isPlaying).toBe(false)
    })

    it('play() at end of timeline resets to beginning', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setPlayheadPosition(23) // At end
      })

      act(() => {
        result.current.play()
      })

      expect(result.current.playheadPosition).toBe(0)
      expect(result.current.isPlaying).toBe(true)
    })

    it('togglePlayPause() at end resets to beginning', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setPlayheadPosition(23) // At end
      })

      act(() => {
        result.current.togglePlayPause()
      })

      expect(result.current.playheadPosition).toBe(0)
      expect(result.current.isPlaying).toBe(true)
    })
  })

  describe('handleTimeUpdate - auto-advance', () => {
    it('advances playhead within same clip', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.handleTimeUpdate(5) // 5 seconds into clip1
      })

      expect(result.current.playheadPosition).toBe(5)
      expect(result.current.currentClip).toBe(mockClips[0])
    })

    it('auto-advances to next clip when reaching end', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      // Simulate reaching end of clip1 (10 seconds)
      act(() => {
        result.current.handleTimeUpdate(10)
      })

      // Should advance to clip2 start (position 10)
      expect(result.current.playheadPosition).toBe(10)
      expect(result.current.currentClip).toBe(mockClips[1])
    })

    it('auto-advances through multiple clips', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      // Advance to clip2
      act(() => {
        result.current.setPlayheadPosition(10)
      })
      expect(result.current.currentClip).toBe(mockClips[1])

      // Reach end of clip2 (8 seconds)
      act(() => {
        result.current.handleTimeUpdate(8)
      })

      // Should advance to clip3 (position 18)
      expect(result.current.playheadPosition).toBe(18)
      expect(result.current.currentClip).toBe(mockClips[2])
    })

    it('stops at end of last clip', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      // Move to clip3
      act(() => {
        result.current.setPlayheadPosition(18)
        result.current.setIsPlaying(true)
      })

      // Reach end of clip3 (5 seconds)
      act(() => {
        result.current.handleTimeUpdate(5)
      })

      // Should stop at total duration
      expect(result.current.playheadPosition).toBe(23)
      expect(result.current.isPlaying).toBe(false)
    })

    it('does nothing when currentClip is undefined', () => {
      const { result } = renderHook(() => useMultiClipPlayback([]))

      act(() => {
        result.current.handleTimeUpdate(5)
      })

      expect(result.current.playheadPosition).toBe(0)
    })
  })

  describe('handlePlayheadChange', () => {
    it('updates playhead position', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.handlePlayheadChange(15)
      })

      expect(result.current.playheadPosition).toBe(15)
    })

    it('does not affect isPlaying state', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.play()
      })

      const wasPlaying = result.current.isPlaying

      act(() => {
        result.current.handlePlayheadChange(15)
      })

      expect(result.current.isPlaying).toBe(wasPlaying)
    })
  })

  describe('relativePlayheadPosition', () => {
    it('calculates relative position within current clip', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      // Playhead at 5 → 5 seconds into clip1
      act(() => {
        result.current.setPlayheadPosition(5)
      })
      expect(result.current.relativePlayheadPosition).toBe(5)

      // Playhead at 12 → 2 seconds into clip2 (starts at 10)
      act(() => {
        result.current.setPlayheadPosition(12)
      })
      expect(result.current.relativePlayheadPosition).toBe(2)

      // Playhead at 20 → 2 seconds into clip3 (starts at 18)
      act(() => {
        result.current.setPlayheadPosition(20)
      })
      expect(result.current.relativePlayheadPosition).toBe(2)
    })
  })

  describe('single clip', () => {
    it('handles single clip timeline', () => {
      const singleClip = [mockClips[0]]
      const { result } = renderHook(() => useMultiClipPlayback(singleClip))

      expect(result.current.totalDuration).toBe(10)
      expect(result.current.currentClip).toBe(singleClip[0])

      act(() => {
        result.current.setIsPlaying(true)
        result.current.handleTimeUpdate(10)
      })

      expect(result.current.playheadPosition).toBe(10)
      expect(result.current.isPlaying).toBe(false)
    })
  })
})
