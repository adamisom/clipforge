import { describe, it, expect } from 'vitest'
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
      sourceType: 'imported',
      sourcePath: '/video2.mp4',
      sourceStartTime: 5,
      sourceDuration: 20,
      timelineDuration: 8,
      trackIndex: 0,
      metadata: { filename: 'video2.mp4', resolution: '1920x1080', codec: 'h264' }
    }
  ]

  describe('initialization', () => {
    it('starts with playhead at 0', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      expect(result.current.playheadPosition).toBe(0)
      expect(result.current.isPlaying).toBe(false)
    })

    it('calculates total duration', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      expect(result.current.totalDuration).toBe(18) // 10 + 8
    })

    it('sets currentClip to first clip', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      expect(result.current.currentClip).toBe(mockClips[0])
      expect(result.current.currentClip?.id).toBe('clip1')
    })

    it('handles empty clips array', () => {
      const { result } = renderHook(() => useMultiClipPlayback([]))

      expect(result.current.totalDuration).toBe(0)
      expect(result.current.currentClip).toBeUndefined()
    })

    it('calculates relativePlayheadPosition at start', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      expect(result.current.relativePlayheadPosition).toBe(0)
    })

    it('generates clipPositions map', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      expect(result.current.clipPositions.size).toBe(2)
      expect(result.current.clipPositions.get('clip1')).toEqual({ start: 0, end: 10 })
      expect(result.current.clipPositions.get('clip2')).toEqual({ start: 10, end: 18 })
    })
  })

  describe('clip navigation', () => {
    it('updates currentClip when playhead moves to next clip', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      // Start in clip1
      expect(result.current.currentClip?.id).toBe('clip1')

      // Move playhead to clip2 (position 12 = 2 seconds into clip2)
      act(() => {
        result.current.setPlayheadPosition(12)
      })

      expect(result.current.currentClip?.id).toBe('clip2')
    })

    it('calculates relativePlayheadPosition correctly', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      // 5 seconds into clip1
      act(() => {
        result.current.setPlayheadPosition(5)
      })
      expect(result.current.relativePlayheadPosition).toBe(5)

      // 2 seconds into clip2 (timeline position 12)
      act(() => {
        result.current.setPlayheadPosition(12)
      })
      expect(result.current.relativePlayheadPosition).toBe(2)
    })

    it('handles playhead at exact clip boundary', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setPlayheadPosition(10) // exactly at clip2 start
      })

      expect(result.current.currentClip?.id).toBe('clip2')
      expect(result.current.relativePlayheadPosition).toBe(0)
    })
  })

  describe('handleTimeUpdate - auto-advance', () => {
    it('advances to next clip when current clip ends', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setPlayheadPosition(5) // in clip1
        result.current.setIsPlaying(true)
      })

      // Simulate video reaching end of clip1 (relative time = 10)
      act(() => {
        result.current.handleTimeUpdate(10)
      })

      // Should have advanced to clip2
      expect(result.current.playheadPosition).toBe(10) // start of clip2
      expect(result.current.currentClip?.id).toBe('clip2')
      expect(result.current.isPlaying).toBe(true) // still playing
    })

    it('stops playing at end of timeline', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setIsPlaying(true)
        result.current.setPlayheadPosition(17) // near end of clip2
      })

      // Simulate reaching end of clip2 (relative time = 8)
      act(() => {
        result.current.handleTimeUpdate(8)
      })

      expect(result.current.isPlaying).toBe(false)
      expect(result.current.playheadPosition).toBe(18) // end of timeline
    })

    it('updates playhead position during playback', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setPlayheadPosition(0)
        result.current.setIsPlaying(true)
      })

      // Simulate time update to 5 seconds
      act(() => {
        result.current.handleTimeUpdate(5)
      })

      expect(result.current.playheadPosition).toBe(5)
      expect(result.current.currentClip?.id).toBe('clip1')
    })

    it('handles reaching exact end of clip', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setPlayheadPosition(0)
        result.current.setIsPlaying(true)
        result.current.handleTimeUpdate(10) // exactly at clip1 end
      })

      // Should advance to clip2
      expect(result.current.currentClip?.id).toBe('clip2')
      expect(result.current.playheadPosition).toBe(10)
    })
  })

  describe('playback controls', () => {
    it('toggles play/pause', () => {
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

    it('play sets isPlaying to true', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.play()
      })
      expect(result.current.isPlaying).toBe(true)
    })

    it('pause sets isPlaying to false', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setIsPlaying(true)
        result.current.pause()
      })
      expect(result.current.isPlaying).toBe(false)
    })

    it('multiple play calls keep isPlaying true', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.play()
        result.current.play()
        result.current.play()
      })
      expect(result.current.isPlaying).toBe(true)
    })

    it('multiple pause calls keep isPlaying false', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setIsPlaying(true)
        result.current.pause()
        result.current.pause()
        result.current.pause()
      })
      expect(result.current.isPlaying).toBe(false)
    })
  })

  describe('handlePlayheadChange', () => {
    it('updates playhead position', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.handlePlayheadChange(5)
      })

      expect(result.current.playheadPosition).toBe(5)
    })

    it('stops playback when seeking', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setIsPlaying(true)
        result.current.handlePlayheadChange(12)
      })

      expect(result.current.isPlaying).toBe(false)
      expect(result.current.playheadPosition).toBe(12)
    })

    it('updates currentClip when seeking to different clip', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.handlePlayheadChange(12) // seek to clip2
      })

      expect(result.current.currentClip?.id).toBe('clip2')
    })
  })

  describe('edge cases', () => {
    it('handles seeking to exact clip boundary', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.handlePlayheadChange(10) // exact start of clip2
      })

      expect(result.current.currentClip?.id).toBe('clip2')
      expect(result.current.relativePlayheadPosition).toBe(0)
    })

    it('handles single clip', () => {
      const { result } = renderHook(() => useMultiClipPlayback([mockClips[0]]))

      expect(result.current.totalDuration).toBe(10)
      expect(result.current.currentClip).toBe(mockClips[0])

      act(() => {
        result.current.setIsPlaying(true)
        result.current.handleTimeUpdate(10) // reach end
      })

      expect(result.current.isPlaying).toBe(false)
    })

    it('handles seeking beyond timeline end', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.handlePlayheadChange(100)
      })

      // Should clamp to last clip
      expect(result.current.currentClip?.id).toBe('clip2')
    })

    it('handles seeking to 0', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.handlePlayheadChange(12)
        result.current.handlePlayheadChange(0)
      })

      expect(result.current.playheadPosition).toBe(0)
      expect(result.current.currentClip?.id).toBe('clip1')
      expect(result.current.relativePlayheadPosition).toBe(0)
    })

    it('recalculates when clips change', () => {
      const { result, rerender } = renderHook(({ clips }) => useMultiClipPlayback(clips), {
        initialProps: { clips: mockClips }
      })

      expect(result.current.totalDuration).toBe(18)

      // Update with only first clip
      rerender({ clips: [mockClips[0]] })

      expect(result.current.totalDuration).toBe(10)
      expect(result.current.clipPositions.size).toBe(1)
    })

    it('handles very short clip durations', () => {
      const shortClips: TimelineClip[] = [
        { ...mockClips[0], timelineDuration: 0.5 },
        { ...mockClips[1], timelineDuration: 0.3 }
      ]

      const { result } = renderHook(() => useMultiClipPlayback(shortClips))

      expect(result.current.totalDuration).toBe(0.8)
      expect(result.current.clipPositions.get('clip1')).toEqual({ start: 0, end: 0.5 })
      expect(result.current.clipPositions.get('clip2')).toEqual({ start: 0.5, end: 0.8 })
    })

    it('maintains currentClip during playback in same clip', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setPlayheadPosition(0)
        result.current.setIsPlaying(true)
      })

      const initialClip = result.current.currentClip

      act(() => {
        result.current.handleTimeUpdate(5) // still in clip1
      })

      expect(result.current.currentClip).toBe(initialClip)
      expect(result.current.currentClip?.id).toBe('clip1')
    })
  })

  describe('boundary conditions', () => {
    it('handles transitioning between clips smoothly', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setPlayheadPosition(9) // 1 second before clip1 ends
        result.current.setIsPlaying(true)
      })

      expect(result.current.currentClip?.id).toBe('clip1')

      // Advance just past boundary
      act(() => {
        result.current.handleTimeUpdate(10) // exactly at boundary
      })

      expect(result.current.currentClip?.id).toBe('clip2')
      expect(result.current.playheadPosition).toBe(10)
    })

    it('handles last clip reaching end', () => {
      const { result } = renderHook(() => useMultiClipPlayback(mockClips))

      act(() => {
        result.current.setPlayheadPosition(17) // near end of clip2
        result.current.setIsPlaying(true)
      })

      expect(result.current.playheadPosition).toBe(17)
      expect(result.current.isPlaying).toBe(true)

      // handleTimeUpdate takes RELATIVE time within current clip (clip2 is 8 seconds long)
      // At position 17, we're 7 seconds into clip2, so updating to 8 should reach the end
      act(() => {
        result.current.handleTimeUpdate(8) // 8 seconds into clip2 (end)
      })

      expect(result.current.playheadPosition).toBe(18)
      expect(result.current.isPlaying).toBe(false)
      expect(result.current.currentClip?.id).toBe('clip2') // still on last clip
    })
  })
})
