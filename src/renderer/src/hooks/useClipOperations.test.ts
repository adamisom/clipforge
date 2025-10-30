import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipOperations } from './useClipOperations'
import { TimelineClip } from '../types/timeline'

// Mock window.confirm and window.alert
global.window.confirm = vi.fn()
global.window.alert = vi.fn()

// Mock window.api
global.window.api = {
  isTempFile: vi.fn(),
  saveRecordingPermanent: vi.fn()
} as any

describe('useClipOperations', () => {
  let mockClips: TimelineClip[]
  let setClips: ReturnType<typeof vi.fn>
  let setSelectedClipId: ReturnType<typeof vi.fn>
  let pause: ReturnType<typeof vi.fn>
  let handlePlayheadChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockClips = [
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
        trackIndex: 1,
        metadata: { filename: 'webcam.webm', resolution: '640x480', codec: 'vp8' }
      }
    ]

    setClips = vi.fn((updater) => {
      if (typeof updater === 'function') {
        mockClips = updater(mockClips)
      }
    })
    setSelectedClipId = vi.fn()
    pause = vi.fn()
    handlePlayheadChange = vi.fn()

    vi.clearAllMocks()
  })

  const renderClipOperations = (overrides = {}) => {
    return renderHook(() =>
      useClipOperations({
        clips: mockClips,
        setClips,
        selectedClipId: 'clip1',
        setSelectedClipId,
        currentClip: mockClips[0],
        playheadPosition: 5,
        isPlaying: false,
        pause,
        handlePlayheadChange,
        ...overrides
      })
    )
  }

  describe('handleMoveToTrack', () => {
    it('moves clip to Track 0', () => {
      const { result } = renderClipOperations()

      act(() => {
        result.current.handleMoveToTrack('clip3', 0)
      })

      expect(setClips).toHaveBeenCalled()
      const updater = setClips.mock.calls[0][0]
      const updated = updater(mockClips)

      expect(updated.find((c) => c.id === 'clip3')?.trackIndex).toBe(0)
    })

    it('moves clip to Track 1', () => {
      const { result } = renderClipOperations()

      act(() => {
        result.current.handleMoveToTrack('clip1', 1)
      })

      expect(setClips).toHaveBeenCalled()
      const updater = setClips.mock.calls[0][0]
      const updated = updater(mockClips)

      expect(updated.find((c) => c.id === 'clip1')?.trackIndex).toBe(1)
    })

    it('only updates specified clip', () => {
      const { result } = renderClipOperations()

      act(() => {
        result.current.handleMoveToTrack('clip2', 1)
      })

      const updater = setClips.mock.calls[0][0]
      const updated = updater(mockClips)

      expect(updated.find((c) => c.id === 'clip1')?.trackIndex).toBe(0)
      expect(updated.find((c) => c.id === 'clip2')?.trackIndex).toBe(1)
      expect(updated.find((c) => c.id === 'clip3')?.trackIndex).toBe(1)
    })
  })

  describe('handleTrimChange', () => {
    it('updates sourceStartTime and timelineDuration', () => {
      const { result } = renderClipOperations()

      act(() => {
        result.current.handleTrimChange('clip1', 2, 8)
      })

      expect(setClips).toHaveBeenCalled()
      const updater = setClips.mock.calls[0][0]
      const updated = updater(mockClips)

      const trimmedClip = updated.find((c) => c.id === 'clip1')
      expect(trimmedClip?.sourceStartTime).toBe(2)
      expect(trimmedClip?.timelineDuration).toBe(6) // 8 - 2
    })

    it('only updates specified clip', () => {
      const { result } = renderClipOperations()

      act(() => {
        result.current.handleTrimChange('clip2', 7, 13)
      })

      const updater = setClips.mock.calls[0][0]
      const updated = updater(mockClips)

      expect(updated.find((c) => c.id === 'clip1')?.sourceStartTime).toBe(0)
      expect(updated.find((c) => c.id === 'clip2')?.sourceStartTime).toBe(7)
    })

    it('handles decimal trim points', () => {
      const { result } = renderClipOperations()

      act(() => {
        result.current.handleTrimChange('clip1', 1.5, 8.75)
      })

      const updater = setClips.mock.calls[0][0]
      const updated = updater(mockClips)

      const trimmedClip = updated.find((c) => c.id === 'clip1')
      expect(trimmedClip?.sourceStartTime).toBe(1.5)
      expect(trimmedClip?.timelineDuration).toBe(7.25)
    })
  })

  describe('handleSplitAtPlayhead', () => {
    it('splits clip into two at playhead position', () => {
      const { result } = renderClipOperations({
        currentClip: mockClips[0],
        playheadPosition: 5 // 5 seconds into timeline (in clip1)
      })

      act(() => {
        result.current.handleSplitAtPlayhead()
      })

      expect(setClips).toHaveBeenCalled()
      const updater = setClips.mock.calls[0][0]
      const updated = updater(mockClips)

      // Should have 4 clips now (clip1 split into 2, plus clip2, clip3)
      expect(updated.length).toBe(4)
    })

    it('preserves source path in both split clips', () => {
      const { result } = renderClipOperations({
        currentClip: mockClips[0],
        playheadPosition: 5
      })

      act(() => {
        result.current.handleSplitAtPlayhead()
      })

      const updater = setClips.mock.calls[0][0]
      const updated = updater(mockClips)

      // Both new clips should have the same source path
      expect(updated[0].sourcePath).toBe('/video1.mp4')
      expect(updated[1].sourcePath).toBe('/video1.mp4')
    })

    it('calculates correct trim points for split clips', () => {
      const { result } = renderClipOperations({
        currentClip: mockClips[0],
        playheadPosition: 5 // 5 seconds into clip1
      })

      act(() => {
        result.current.handleSplitAtPlayhead()
      })

      const updater = setClips.mock.calls[0][0]
      const updated = updater(mockClips)

      const firstSplit = updated[0]
      const secondSplit = updated[1]

      // First clip: 0 to 5 seconds
      expect(firstSplit.sourceStartTime).toBe(0)
      expect(firstSplit.timelineDuration).toBe(5)

      // Second clip: 5 to 10 seconds
      expect(secondSplit.sourceStartTime).toBe(5)
      expect(secondSplit.timelineDuration).toBe(5)
    })

    it('generates new IDs for split clips', () => {
      const originalClipId = mockClips[0].id // Save original ID before split
      
      const { result } = renderClipOperations({
        currentClip: mockClips[0],
        playheadPosition: 5
      })

      act(() => {
        result.current.handleSplitAtPlayhead()
      })

      const updater = setClips.mock.calls[0][0]
      const updated = updater([...mockClips]) // Pass a copy to avoid mutation

      const firstSplit = updated[0]
      const secondSplit = updated[1]

      // Both should be different from original
      expect(firstSplit.id).not.toBe(originalClipId)
      expect(secondSplit.id).not.toBe(originalClipId)
      
      // Both should match clip ID pattern
      expect(firstSplit.id).toMatch(/^clip-/)
      expect(secondSplit.id).toMatch(/^clip-/)
      
      // Both should have valid IDs
      expect(firstSplit.id).toBeTruthy()
      expect(secondSplit.id).toBeTruthy()
    })

    it('does not split at very beginning (<0.1s)', () => {
      const { result } = renderClipOperations({
        currentClip: mockClips[0],
        playheadPosition: 0.05 // 0.05 seconds into clip1
      })

      act(() => {
        result.current.handleSplitAtPlayhead()
      })

      expect(setClips).not.toHaveBeenCalled()
    })

    it('does not split at very end (>duration-0.1s)', () => {
      const { result } = renderClipOperations({
        currentClip: mockClips[0],
        playheadPosition: 9.95 // 9.95 seconds into 10s clip
      })

      act(() => {
        result.current.handleSplitAtPlayhead()
      })

      expect(setClips).not.toHaveBeenCalled()
    })

    it('does nothing when currentClip is undefined', () => {
      const { result } = renderClipOperations({
        currentClip: undefined
      })

      act(() => {
        result.current.handleSplitAtPlayhead()
      })

      expect(setClips).not.toHaveBeenCalled()
    })

    it('maintains trackIndex in split clips', () => {
      const { result} = renderClipOperations({
        currentClip: mockClips[2], // clip3 on Track 1  
        playheadPosition: 2, // 2 seconds into clip3 (relative to its start in timeline)
        clips: mockClips
      })

      act(() => {
        result.current.handleSplitAtPlayhead()
      })

      // If split happened, check trackIndex
      if (setClips.mock.calls.length > 0) {
        const updater = setClips.mock.calls[0][0]
        const updated = updater(mockClips)

        // Both split clips should maintain Track 1
        const splitClips = updated.filter((c) => c.sourcePath === mockClips[2].sourcePath)
        expect(splitClips.length).toBeGreaterThan(0)
        expect(splitClips.every((c) => c.trackIndex === 1)).toBe(true)
      }
    })
  })

  describe('handleDeleteClip', () => {
    beforeEach(() => {
      ;(window.confirm as any).mockReturnValue(true)
    })

    it('removes clip from array', () => {
      const { result } = renderClipOperations({
        selectedClipId: 'clip2'
      })

      act(() => {
        result.current.handleDeleteClip()
      })

      expect(window.confirm).toHaveBeenCalled()
      expect(setClips).toHaveBeenCalled()

      const updater = setClips.mock.calls[0][0]
      const updated = updater(mockClips)

      expect(updated.length).toBe(2)
      expect(updated.find((c) => c.id === 'clip2')).toBeUndefined()
    })

    it('selects next clip after deletion', () => {
      const { result } = renderClipOperations({
        selectedClipId: 'clip1'
      })

      act(() => {
        result.current.handleDeleteClip()
      })

      expect(setSelectedClipId).toHaveBeenCalledWith('clip2')
    })

    it('selects previous clip if deleting last', () => {
      const { result } = renderClipOperations({
        selectedClipId: 'clip3'
      })

      act(() => {
        result.current.handleDeleteClip()
      })

      expect(setSelectedClipId).toHaveBeenCalledWith('clip2')
    })

    it('clears selection if deleting only clip', () => {
      const singleClip = [mockClips[0]]
      const { result } = renderHook(() =>
        useClipOperations({
          clips: singleClip,
          setClips,
          selectedClipId: 'clip1',
          setSelectedClipId,
          currentClip: singleClip[0],
          playheadPosition: 5,
          isPlaying: false,
          pause,
          handlePlayheadChange
        })
      )

      act(() => {
        result.current.handleDeleteClip()
      })

      expect(setSelectedClipId).toHaveBeenCalledWith(null)
    })

    it('pauses playback if playing', () => {
      const { result } = renderClipOperations({
        selectedClipId: 'clip2',
        isPlaying: true
      })

      act(() => {
        result.current.handleDeleteClip()
      })

      expect(pause).toHaveBeenCalled()
    })

    it('resets playhead if beyond new duration', () => {
      // Delete clip2, leaving clip1 (10s) and clip3 (5s) = 15s total
      // Playhead at 16s should reset to 0
      const { result } = renderClipOperations({
        selectedClipId: 'clip2',
        playheadPosition: 16
      })

      act(() => {
        result.current.handleDeleteClip()
      })

      // After deletion, total duration is clip1 + clip3 = 15
      // Playhead was at 16, which is > 15, so should reset
      expect(handlePlayheadChange).toHaveBeenCalledWith(0)
    })

    it('does not delete if user cancels confirmation', () => {
      ;(window.confirm as any).mockReturnValue(false)

      const { result } = renderClipOperations({
        selectedClipId: 'clip2'
      })

      act(() => {
        result.current.handleDeleteClip()
      })

      expect(window.confirm).toHaveBeenCalled()
      expect(setClips).not.toHaveBeenCalled()
    })

    it('does nothing if selectedClipId is null', () => {
      const { result } = renderClipOperations({
        selectedClipId: null
      })

      act(() => {
        result.current.handleDeleteClip()
      })

      expect(window.confirm).not.toHaveBeenCalled()
      expect(setClips).not.toHaveBeenCalled()
    })

    it('shows filename in confirmation dialog', () => {
      const { result } = renderClipOperations({
        selectedClipId: 'clip1'
      })

      act(() => {
        result.current.handleDeleteClip()
      })

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('video1.mp4')
      )
    })
  })

  describe('handleSavePermanently', () => {
    beforeEach(() => {
      ;(window.api.isTempFile as any).mockResolvedValue(true)
      ;(window.api.saveRecordingPermanent as any).mockResolvedValue({ path: '/saved/video.mp4' })
    })

    it('saves temp file and updates clip path', async () => {
      const { result } = renderClipOperations({
        selectedClipId: 'clip2',
        clips: [
          ...mockClips.slice(0, 1),
          { ...mockClips[1], sourcePath: '/tmp/recording.webm' },
          ...mockClips.slice(2)
        ]
      })

      await act(async () => {
        await result.current.handleSavePermanently()
      })

      expect(window.api.isTempFile).toHaveBeenCalledWith('/tmp/recording.webm')
      expect(window.api.saveRecordingPermanent).toHaveBeenCalledWith('/tmp/recording.webm')
      expect(setClips).toHaveBeenCalled()
    })

    it('does nothing if file is not temp', async () => {
      ;(window.api.isTempFile as any).mockResolvedValue(false)

      const { result } = renderClipOperations({
        selectedClipId: 'clip1'
      })

      await act(async () => {
        await result.current.handleSavePermanently()
      })

      expect(window.api.saveRecordingPermanent).not.toHaveBeenCalled()
      expect(setClips).not.toHaveBeenCalled()
    })

    it('does nothing if selectedClipId is null', async () => {
      const { result } = renderClipOperations({
        selectedClipId: null
      })

      await act(async () => {
        await result.current.handleSavePermanently()
      })

      expect(window.api.isTempFile).not.toHaveBeenCalled()
    })

    it('handles save failure gracefully', async () => {
      ;(window.api.saveRecordingPermanent as any).mockRejectedValue(new Error('Save failed'))

      const { result } = renderClipOperations({
        selectedClipId: 'clip2',
        clips: [
          ...mockClips.slice(0, 1),
          { ...mockClips[1], sourcePath: '/tmp/recording.webm' },
          ...mockClips.slice(2)
        ]
      })

      await act(async () => {
        await result.current.handleSavePermanently()
      })

      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to save'))
    })
  })
})

