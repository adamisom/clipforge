import { describe, it, expect } from 'vitest'
import {
  generateClipId,
  calculateClipPositions,
  getCurrentClip,
  getRelativePlayheadPosition,
  getTotalDuration,
  createClipFromMetadata,
  getTrackClips,
  getTrack0Clips,
  getTrack1Clips
} from './clipUtils'
import { TimelineClip } from '../types/timeline'

describe('clipUtils', () => {
  const mockClips: TimelineClip[] = [
    {
      id: 'clip1',
      sourceType: 'imported',
      sourcePath: '/path/to/video1.mp4',
      sourceStartTime: 0,
      sourceDuration: 30,
      timelineDuration: 10,
      trackIndex: 0,
      metadata: { filename: 'video1.mp4', resolution: '1920x1080', codec: 'h264' }
    },
    {
      id: 'clip2',
      sourceType: 'screen',
      sourcePath: '/tmp/clipforge-recording-2025-10-29.webm',
      sourceStartTime: 5,
      sourceDuration: 20,
      timelineDuration: 8,
      trackIndex: 0,
      metadata: { filename: 'recording.webm', resolution: '1280x720', codec: 'vp8' }
    },
    {
      id: 'clip3',
      sourceType: 'webcam',
      sourcePath: '/path/to/video3.mp4',
      sourceStartTime: 0,
      sourceDuration: 15,
      timelineDuration: 15,
      trackIndex: 0,
      metadata: { filename: 'video3.mp4', resolution: '640x480', codec: 'h264' }
    }
  ]

  describe('generateClipId', () => {
    it('generates unique IDs', () => {
      const id1 = generateClipId()
      const id2 = generateClipId()

      expect(id1).toMatch(/^clip-\d+-[a-z0-9]+$/)
      expect(id2).toMatch(/^clip-\d+-[a-z0-9]+$/)
      expect(id1).not.toBe(id2)
    })

    it('includes timestamp', () => {
      const id = generateClipId()
      const timestamp = parseInt(id.split('-')[1])

      expect(timestamp).toBeGreaterThan(Date.now() - 1000)
      expect(timestamp).toBeLessThanOrEqual(Date.now())
    })

    it('includes random component', () => {
      const id = generateClipId()
      const parts = id.split('-')

      expect(parts).toHaveLength(3)
      expect(parts[0]).toBe('clip')
      expect(parts[2]).toMatch(/^[a-z0-9]+$/)
      expect(parts[2].length).toBeGreaterThan(0)
    })
  })

  describe('calculateClipPositions', () => {
    it('calculates positions for multiple clips', () => {
      const positions = calculateClipPositions(mockClips)

      expect(positions.get('clip1')).toEqual({ start: 0, end: 10 })
      expect(positions.get('clip2')).toEqual({ start: 10, end: 18 })
      expect(positions.get('clip3')).toEqual({ start: 18, end: 33 })
    })

    it('handles single clip', () => {
      const positions = calculateClipPositions([mockClips[0]])

      expect(positions.get('clip1')).toEqual({ start: 0, end: 10 })
      expect(positions.size).toBe(1)
    })

    it('handles empty array', () => {
      const positions = calculateClipPositions([])

      expect(positions.size).toBe(0)
    })

    it('positions are cumulative (no gaps)', () => {
      const positions = calculateClipPositions(mockClips)

      // clip1 ends at 10
      // clip2 starts at 10, ends at 18
      // clip3 starts at 18, ends at 33
      expect(positions.get('clip1')!.end).toBe(positions.get('clip2')!.start)
      expect(positions.get('clip2')!.end).toBe(positions.get('clip3')!.start)
    })

    it('handles clips with different durations', () => {
      const clips: TimelineClip[] = [
        { ...mockClips[0], timelineDuration: 5 },
        { ...mockClips[1], timelineDuration: 3 },
        { ...mockClips[2], timelineDuration: 12 }
      ]

      const positions = calculateClipPositions(clips)

      expect(positions.get('clip1')).toEqual({ start: 0, end: 5 })
      expect(positions.get('clip2')).toEqual({ start: 5, end: 8 })
      expect(positions.get('clip3')).toEqual({ start: 8, end: 20 })
    })

    it('handles very short clips', () => {
      const clips: TimelineClip[] = [
        { ...mockClips[0], timelineDuration: 0.5 },
        { ...mockClips[1], timelineDuration: 0.3 }
      ]

      const positions = calculateClipPositions(clips)

      expect(positions.get('clip1')).toEqual({ start: 0, end: 0.5 })
      expect(positions.get('clip2')).toEqual({ start: 0.5, end: 0.8 })
    })
  })

  describe.skip('isTempFile', () => {
    // Note: isTempFile now requires IPC communication with main process
    // These tests are skipped as they require a full Electron environment
    it('detects temp recording files', () => {
      // Skipped - requires IPC
    })

    it('returns false for non-temp files', () => {
      // Skipped - requires IPC
    })

    it('is case-sensitive', () => {
      // Skipped - requires IPC
    })
  })

  describe('getCurrentClip', () => {
    const positions = calculateClipPositions(mockClips)

    it('returns clip at playhead position', () => {
      expect(getCurrentClip(mockClips, positions, 5)).toBe(mockClips[0]) // in clip1
      expect(getCurrentClip(mockClips, positions, 12)).toBe(mockClips[1]) // in clip2
      expect(getCurrentClip(mockClips, positions, 20)).toBe(mockClips[2]) // in clip3
    })

    it('returns first clip at playhead 0', () => {
      expect(getCurrentClip(mockClips, positions, 0)).toBe(mockClips[0])
    })

    it('returns last clip at end of timeline', () => {
      expect(getCurrentClip(mockClips, positions, 33)).toBe(mockClips[2])
      expect(getCurrentClip(mockClips, positions, 100)).toBe(mockClips[2])
      expect(getCurrentClip(mockClips, positions, 1000)).toBe(mockClips[2])
    })

    it('handles playhead at clip boundaries', () => {
      expect(getCurrentClip(mockClips, positions, 10)).toBe(mockClips[1]) // exactly at clip2 start
      expect(getCurrentClip(mockClips, positions, 18)).toBe(mockClips[2]) // exactly at clip3 start
    })

    it('returns last clip for playhead just before boundary', () => {
      expect(getCurrentClip(mockClips, positions, 9.99)).toBe(mockClips[0])
      expect(getCurrentClip(mockClips, positions, 17.99)).toBe(mockClips[1])
    })

    it('returns undefined for empty clips', () => {
      expect(getCurrentClip([], new Map(), 5)).toBeUndefined()
    })

    it('handles single clip', () => {
      const singleClipPositions = calculateClipPositions([mockClips[0]])
      expect(getCurrentClip([mockClips[0]], singleClipPositions, 0)).toBe(mockClips[0])
      expect(getCurrentClip([mockClips[0]], singleClipPositions, 5)).toBe(mockClips[0])
      expect(getCurrentClip([mockClips[0]], singleClipPositions, 100)).toBe(mockClips[0])
    })

    it('handles negative playhead position', () => {
      // Negative playhead returns last clip (as per getCurrentClip implementation)
      expect(getCurrentClip(mockClips, positions, -5)).toBe(mockClips[2])
    })
  })

  describe('getRelativePlayheadPosition', () => {
    const positions = calculateClipPositions(mockClips)

    it('calculates relative position within clip', () => {
      expect(getRelativePlayheadPosition(mockClips[0], positions, 5)).toBe(5) // 5 seconds into clip1
      expect(getRelativePlayheadPosition(mockClips[1], positions, 12)).toBe(2) // 2 seconds into clip2 (starts at 10)
      expect(getRelativePlayheadPosition(mockClips[2], positions, 20)).toBe(2) // 2 seconds into clip3 (starts at 18)
    })

    it('returns 0 at clip start', () => {
      expect(getRelativePlayheadPosition(mockClips[0], positions, 0)).toBe(0)
      expect(getRelativePlayheadPosition(mockClips[1], positions, 10)).toBe(0)
      expect(getRelativePlayheadPosition(mockClips[2], positions, 18)).toBe(0)
    })

    it('handles playhead at clip end', () => {
      expect(getRelativePlayheadPosition(mockClips[0], positions, 10)).toBe(10)
      expect(getRelativePlayheadPosition(mockClips[1], positions, 18)).toBe(8)
      expect(getRelativePlayheadPosition(mockClips[2], positions, 33)).toBe(15)
    })

    it('returns 0 for undefined clip', () => {
      expect(getRelativePlayheadPosition(undefined, positions, 5)).toBe(0)
    })

    it('returns 0 for clip not in positions', () => {
      const orphanClip = { ...mockClips[0], id: 'orphan' }
      expect(getRelativePlayheadPosition(orphanClip, positions, 5)).toBe(0)
    })

    it('handles decimal positions', () => {
      expect(getRelativePlayheadPosition(mockClips[0], positions, 5.5)).toBe(5.5)
      expect(getRelativePlayheadPosition(mockClips[1], positions, 12.75)).toBe(2.75)
    })
  })

  describe('getTotalDuration', () => {
    it('sums timeline durations', () => {
      expect(getTotalDuration(mockClips)).toBe(33) // 10 + 8 + 15
    })

    it('returns 0 for empty array', () => {
      expect(getTotalDuration([])).toBe(0)
    })

    it('handles single clip', () => {
      expect(getTotalDuration([mockClips[0]])).toBe(10)
    })

    it('handles clips with decimal durations', () => {
      const clips: TimelineClip[] = [
        { ...mockClips[0], timelineDuration: 5.5 },
        { ...mockClips[1], timelineDuration: 3.7 },
        { ...mockClips[2], timelineDuration: 0.8 }
      ]

      expect(getTotalDuration(clips)).toBe(10)
    })

    it('handles very long timeline', () => {
      const clips: TimelineClip[] = [
        { ...mockClips[0], timelineDuration: 3600 }, // 1 hour
        { ...mockClips[1], timelineDuration: 1800 }, // 30 minutes
        { ...mockClips[2], timelineDuration: 900 } // 15 minutes
      ]

      expect(getTotalDuration(clips)).toBe(6300) // 1h 45m
    })
  })

  describe('createClipFromMetadata', () => {
    const metadata = {
      duration: 60,
      width: 1920,
      height: 1080,
      codec: 'h264',
      filename: 'test-video.mp4'
    }

    it('creates imported clip', () => {
      const clip = createClipFromMetadata('imported', '/path/to/test-video.mp4', metadata)

      expect(clip.sourceType).toBe('imported')
      expect(clip.sourcePath).toBe('/path/to/test-video.mp4')
      expect(clip.sourceStartTime).toBe(0)
      expect(clip.sourceDuration).toBe(60)
      expect(clip.timelineDuration).toBe(60)
      expect(clip.metadata.filename).toBe('test-video.mp4')
      expect(clip.metadata.resolution).toBe('1920x1080')
      expect(clip.metadata.codec).toBe('h264')
      expect(clip.id).toMatch(/^clip-/)
    })

    it('assigns imported clips to Track 0', () => {
      const clip = createClipFromMetadata('imported', '/path/to/video.mp4', metadata)
      expect(clip.trackIndex).toBe(0)
    })

    it('assigns screen clips to Track 0', () => {
      const clip = createClipFromMetadata('screen', '/tmp/screen.webm', metadata)
      expect(clip.trackIndex).toBe(0)
    })

    it('assigns webcam clips to Track 1', () => {
      const clip = createClipFromMetadata('webcam', '/tmp/webcam.webm', metadata)
      expect(clip.trackIndex).toBe(1)
    })

    it('uses duration override for recordings', () => {
      const clip = createClipFromMetadata('webcam', '/path/to/recording.webm', metadata, 45)

      expect(clip.sourceDuration).toBe(60) // original from metadata
      expect(clip.timelineDuration).toBe(45) // overridden
    })

    it('creates screen recording clip', () => {
      const clip = createClipFromMetadata('screen', '/tmp/screen.webm', metadata)

      expect(clip.sourceType).toBe('screen')
      expect(clip.sourcePath).toBe('/tmp/screen.webm')
    })

    it('creates webcam recording clip', () => {
      const clip = createClipFromMetadata('webcam', '/tmp/webcam.webm', metadata)

      expect(clip.sourceType).toBe('webcam')
      expect(clip.sourcePath).toBe('/tmp/webcam.webm')
    })

    it('generates unique IDs for each clip', () => {
      const clip1 = createClipFromMetadata('imported', '/video1.mp4', metadata)
      const clip2 = createClipFromMetadata('imported', '/video2.mp4', metadata)

      expect(clip1.id).not.toBe(clip2.id)
    })

    it('handles different resolutions', () => {
      const hdMetadata = { ...metadata, width: 1280, height: 720 }
      const clip = createClipFromMetadata('imported', '/video.mp4', hdMetadata)

      expect(clip.metadata.resolution).toBe('1280x720')
    })

    it('handles different codecs', () => {
      const vp9Metadata = { ...metadata, codec: 'vp9' }
      const clip = createClipFromMetadata('screen', '/video.webm', vp9Metadata)

      expect(clip.metadata.codec).toBe('vp9')
    })

    it('initializes sourceStartTime to 0', () => {
      const clip = createClipFromMetadata('imported', '/video.mp4', metadata)

      expect(clip.sourceStartTime).toBe(0)
    })
  })

  describe('Track filtering utilities', () => {
    const mixedTrackClips: TimelineClip[] = [
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
        id: 'main2',
        sourceType: 'screen',
        sourcePath: '/screen.webm',
        sourceStartTime: 0,
        sourceDuration: 15,
        timelineDuration: 8,
        trackIndex: 0,
        metadata: { filename: 'screen.webm', resolution: '1920x1080', codec: 'vp8' }
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

    describe('getTrackClips', () => {
      it('returns only Track 0 clips', () => {
        const track0 = getTrackClips(mixedTrackClips, 0)

        expect(track0).toHaveLength(2)
        expect(track0[0].id).toBe('main1')
        expect(track0[1].id).toBe('main2')
        expect(track0.every((c) => c.trackIndex === 0)).toBe(true)
      })

      it('returns only Track 1 clips', () => {
        const track1 = getTrackClips(mixedTrackClips, 1)

        expect(track1).toHaveLength(2)
        expect(track1[0].id).toBe('pip1')
        expect(track1[1].id).toBe('pip2')
        expect(track1.every((c) => c.trackIndex === 1)).toBe(true)
      })

      it('handles empty array', () => {
        expect(getTrackClips([], 0)).toEqual([])
        expect(getTrackClips([], 1)).toEqual([])
      })

      it('returns empty when no clips on track', () => {
        const track0Only = mixedTrackClips.filter((c) => c.trackIndex === 0)

        expect(getTrackClips(track0Only, 1)).toEqual([])
      })

      it('handles all clips on same track', () => {
        const allTrack0 = mixedTrackClips.map((c) => ({ ...c, trackIndex: 0 as 0 | 1 }))

        expect(getTrackClips(allTrack0, 0)).toHaveLength(4)
        expect(getTrackClips(allTrack0, 1)).toEqual([])
      })
    })

    describe('getTrack0Clips', () => {
      it('returns only main track clips', () => {
        const track0 = getTrack0Clips(mixedTrackClips)

        expect(track0).toHaveLength(2)
        expect(track0.every((c) => c.trackIndex === 0)).toBe(true)
      })

      it('handles empty array', () => {
        expect(getTrack0Clips([])).toEqual([])
      })

      it('preserves order', () => {
        const track0 = getTrack0Clips(mixedTrackClips)

        expect(track0[0].id).toBe('main1')
        expect(track0[1].id).toBe('main2')
      })
    })

    describe('getTrack1Clips', () => {
      it('returns only PiP track clips', () => {
        const track1 = getTrack1Clips(mixedTrackClips)

        expect(track1).toHaveLength(2)
        expect(track1.every((c) => c.trackIndex === 1)).toBe(true)
      })

      it('handles empty array', () => {
        expect(getTrack1Clips([])).toEqual([])
      })

      it('preserves order', () => {
        const track1 = getTrack1Clips(mixedTrackClips)

        expect(track1[0].id).toBe('pip1')
        expect(track1[1].id).toBe('pip2')
      })

      it('returns empty for Track 0 only clips', () => {
        const track0Only = mixedTrackClips.filter((c) => c.trackIndex === 0)

        expect(getTrack1Clips(track0Only)).toEqual([])
      })
    })
  })
})
