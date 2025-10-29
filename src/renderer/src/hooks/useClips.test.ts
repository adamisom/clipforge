import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClips } from './useClips'
import { TimelineClip } from '../types/timeline'

describe('useClips', () => {
  const mockClip1: TimelineClip = {
    id: 'clip1',
    sourceType: 'imported',
    sourcePath: '/video.mp4',
    sourceStartTime: 0,
    sourceDuration: 30,
    timelineDuration: 30,
    metadata: { filename: 'video.mp4', resolution: '1920x1080', codec: 'h264' }
  }

  const mockClip2: TimelineClip = {
    id: 'clip2',
    sourceType: 'screen',
    sourcePath: '/recording.webm',
    sourceStartTime: 0,
    sourceDuration: 20,
    timelineDuration: 20,
    metadata: { filename: 'recording.webm', resolution: '1280x720', codec: 'vp8' }
  }

  describe('initialization', () => {
    it('starts with empty clips array', () => {
      const { result } = renderHook(() => useClips())

      expect(result.current.clips).toEqual([])
      expect(result.current.selectedClipId).toBeNull()
    })
  })

  describe('addClip', () => {
    it('adds clip to empty array', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
      })

      expect(result.current.clips).toHaveLength(1)
      expect(result.current.clips[0]).toEqual(mockClip1)
    })

    it('sets newly added clip as selected', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
      })

      expect(result.current.selectedClipId).toBe('clip1')
    })

    it('appends clip to existing clips', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.addClip(mockClip2)
      })

      expect(result.current.clips).toHaveLength(2)
      expect(result.current.clips[0]).toEqual(mockClip1)
      expect(result.current.clips[1]).toEqual(mockClip2)
    })

    it('updates selected clip to most recent', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
      })
      expect(result.current.selectedClipId).toBe('clip1')

      act(() => {
        result.current.addClip(mockClip2)
      })
      expect(result.current.selectedClipId).toBe('clip2')
    })
  })

  describe('updateClip', () => {
    it('updates specific clip properties', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.updateClip('clip1', { timelineDuration: 15 })
      })

      expect(result.current.clips[0].timelineDuration).toBe(15)
      expect(result.current.clips[0].sourceDuration).toBe(30) // unchanged
      expect(result.current.clips[0].sourcePath).toBe('/video.mp4') // unchanged
    })

    it('updates only the matching clip', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.addClip(mockClip2)
        result.current.updateClip('clip1', { timelineDuration: 10 })
      })

      expect(result.current.clips[0].timelineDuration).toBe(10)
      expect(result.current.clips[1].timelineDuration).toBe(20) // unchanged
    })

    it('does nothing for non-existent clip', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.updateClip('nonexistent', { timelineDuration: 10 })
      })

      expect(result.current.clips[0].timelineDuration).toBe(30) // unchanged
    })

    it('can update multiple properties at once', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.updateClip('clip1', {
          sourceStartTime: 5,
          timelineDuration: 10
        })
      })

      expect(result.current.clips[0].sourceStartTime).toBe(5)
      expect(result.current.clips[0].timelineDuration).toBe(10)
    })
  })

  describe('removeClip', () => {
    it('removes clip by id', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.removeClip('clip1')
      })

      expect(result.current.clips).toHaveLength(0)
    })

    it('removes correct clip from multiple', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.addClip(mockClip2)
        result.current.removeClip('clip1')
      })

      expect(result.current.clips).toHaveLength(1)
      expect(result.current.clips[0].id).toBe('clip2')
    })

    it('does nothing for non-existent clip', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.removeClip('nonexistent')
      })

      expect(result.current.clips).toHaveLength(1)
      expect(result.current.clips[0]).toEqual(mockClip1)
    })

    it('handles removing from empty array', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.removeClip('clip1')
      })

      expect(result.current.clips).toHaveLength(0)
    })
  })

  describe('updateTrim', () => {
    it('updates sourceStartTime and recalculates timelineDuration', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.updateTrim('clip1', 5, 20)
      })

      expect(result.current.clips[0].sourceStartTime).toBe(5)
      expect(result.current.clips[0].timelineDuration).toBe(15) // 20 - 5
    })

    it('handles full trim (0 to duration)', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.updateTrim('clip1', 0, 30)
      })

      expect(result.current.clips[0].sourceStartTime).toBe(0)
      expect(result.current.clips[0].timelineDuration).toBe(30)
    })

    it('handles very short trim', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.updateTrim('clip1', 10, 10.5)
      })

      expect(result.current.clips[0].sourceStartTime).toBe(10)
      expect(result.current.clips[0].timelineDuration).toBe(0.5)
    })

    it('updates only the matching clip', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.addClip(mockClip2)
        result.current.updateTrim('clip1', 5, 15)
      })

      expect(result.current.clips[0].sourceStartTime).toBe(5)
      expect(result.current.clips[0].timelineDuration).toBe(10)
      expect(result.current.clips[1].sourceStartTime).toBe(0) // unchanged
      expect(result.current.clips[1].timelineDuration).toBe(20) // unchanged
    })

    it('does nothing for non-existent clip', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.updateTrim('nonexistent', 5, 15)
      })

      expect(result.current.clips[0].sourceStartTime).toBe(0) // unchanged
      expect(result.current.clips[0].timelineDuration).toBe(30) // unchanged
    })
  })

  describe('setSelectedClipId', () => {
    it('changes selected clip', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
        result.current.addClip(mockClip2)
      })

      expect(result.current.selectedClipId).toBe('clip2')

      act(() => {
        result.current.setSelectedClipId('clip1')
      })

      expect(result.current.selectedClipId).toBe('clip1')
    })

    it('can deselect by setting to null', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
      })

      expect(result.current.selectedClipId).toBe('clip1')

      act(() => {
        result.current.setSelectedClipId(null)
      })

      expect(result.current.selectedClipId).toBeNull()
    })
  })

  describe('splitClip', () => {
    it('replaces original clip with two new clips', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
      })

      const createFirst = (original: TimelineClip): TimelineClip => ({
        ...original,
        id: 'clip1-first',
        timelineDuration: 15
      })

      const createSecond = (original: TimelineClip): TimelineClip => ({
        ...original,
        id: 'clip1-second',
        sourceStartTime: 15,
        timelineDuration: 15
      })

      act(() => {
        result.current.splitClip('clip1', 15, createFirst, createSecond)
      })

      expect(result.current.clips).toHaveLength(2)
      expect(result.current.clips[0].id).toBe('clip1-first')
      expect(result.current.clips[0].timelineDuration).toBe(15)
      expect(result.current.clips[1].id).toBe('clip1-second')
      expect(result.current.clips[1].sourceStartTime).toBe(15)
      expect(result.current.clips[1].timelineDuration).toBe(15)
    })

    it('maintains clip order when splitting middle clip', () => {
      const { result } = renderHook(() => useClips())
      const mockClip3: TimelineClip = {
        ...mockClip1,
        id: 'clip3'
      }

      act(() => {
        result.current.addClip(mockClip1)
        result.current.addClip(mockClip2)
        result.current.addClip(mockClip3)
      })

      const createFirst = (original: TimelineClip): TimelineClip => ({
        ...original,
        id: 'clip2-first',
        timelineDuration: 10
      })

      const createSecond = (original: TimelineClip): TimelineClip => ({
        ...original,
        id: 'clip2-second',
        sourceStartTime: 10,
        timelineDuration: 10
      })

      act(() => {
        result.current.splitClip('clip2', 10, createFirst, createSecond)
      })

      expect(result.current.clips).toHaveLength(4)
      expect(result.current.clips[0].id).toBe('clip1')
      expect(result.current.clips[1].id).toBe('clip2-first')
      expect(result.current.clips[2].id).toBe('clip2-second')
      expect(result.current.clips[3].id).toBe('clip3')
    })

    it('does nothing for non-existent clip', () => {
      const { result } = renderHook(() => useClips())

      act(() => {
        result.current.addClip(mockClip1)
      })

      const createFirst = (original: TimelineClip): TimelineClip => ({
        ...original,
        id: 'first'
      })

      const createSecond = (original: TimelineClip): TimelineClip => ({
        ...original,
        id: 'second'
      })

      act(() => {
        result.current.splitClip('nonexistent', 15, createFirst, createSecond)
      })

      expect(result.current.clips).toHaveLength(1)
      expect(result.current.clips[0].id).toBe('clip1')
    })
  })
})
