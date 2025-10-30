import { useRef, useEffect } from 'react'
import { TimelineClip, PiPConfig } from '../types/timeline'

interface VideoPreviewProps {
  sourcePath: string | null
  trimStart: number
  trimEnd: number
  playheadPosition: number
  isPlaying: boolean
  pipClip: TimelineClip | null // NEW: PiP overlay clip
  pipConfig: PiPConfig // NEW: PiP position/size
  onPlayPause: () => void
  onTimeUpdate: (time: number) => void
}

function VideoPreview({
  sourcePath,
  trimStart,
  trimEnd,
  playheadPosition,
  isPlaying,
  pipClip,
  pipConfig,
  onPlayPause,
  onTimeUpdate
}: VideoPreviewProps): React.JSX.Element {
  const mainVideoRef = useRef<HTMLVideoElement>(null) // Renamed from videoRef
  const pipVideoRef = useRef<HTMLVideoElement>(null) // NEW: PiP video element

  // Sync MAIN video playback state
  useEffect(() => {
    if (!mainVideoRef.current) return

    if (isPlaying) {
      mainVideoRef.current.play()
    } else {
      mainVideoRef.current.pause()
    }
  }, [isPlaying])

  // Sync PiP video playback state
  useEffect(() => {
    if (!pipVideoRef.current || !pipClip) return

    if (isPlaying) {
      pipVideoRef.current.play().catch(console.error)
    } else {
      pipVideoRef.current.pause()
    }
  }, [isPlaying, pipClip])

  // Sync MAIN video current time when playhead changes (when not playing)
  useEffect(() => {
    if (!mainVideoRef.current || isPlaying) return
    mainVideoRef.current.currentTime = trimStart + playheadPosition
  }, [playheadPosition, trimStart, isPlaying])

  // Sync PiP video current time when playhead changes (when not playing)
  useEffect(() => {
    if (!pipVideoRef.current || !pipClip || isPlaying) return
    // PiP clip might have different trim points, calculate its source time
    const pipRelativeTime = playheadPosition // Assuming clips start at same timeline position
    const pipSourceTime = pipClip.sourceStartTime + pipRelativeTime
    // Only seek if within trim range
    if (
      pipSourceTime >= pipClip.sourceStartTime &&
      pipSourceTime <= pipClip.sourceStartTime + pipClip.timelineDuration
    ) {
      pipVideoRef.current.currentTime = pipSourceTime
    }
  }, [playheadPosition, pipClip, isPlaying])

  // Initialize MAIN video position on load
  useEffect(() => {
    if (mainVideoRef.current && sourcePath) {
      mainVideoRef.current.currentTime = trimStart
    }
  }, [sourcePath, trimStart])

  // Initialize PiP video position on load
  useEffect(() => {
    if (pipVideoRef.current && pipClip) {
      pipVideoRef.current.currentTime = pipClip.sourceStartTime
    }
  }, [pipClip])

  // Handle auto-play when MAIN clip changes (separate from initialization)
  useEffect(() => {
    if (!mainVideoRef.current || !sourcePath) return

    // Only auto-play when we change clips while already playing
    if (isPlaying) {
      mainVideoRef.current.play().catch((err) => {
        console.error('Failed to auto-play after clip change:', err)
      })
    }
  }, [sourcePath, isPlaying])

  // Handle time updates during playback
  const handleTimeUpdate = (): void => {
    if (!mainVideoRef.current) return

    const currentTime = mainVideoRef.current.currentTime

    // Check if we've reached the trim end
    if (currentTime >= trimEnd) {
      // Don't pause here - let parent hook handle clip advancement
      // Just report that we've reached the end
      onTimeUpdate(trimEnd - trimStart)
    } else {
      // Update playhead position (relative to trim start)
      onTimeUpdate(currentTime - trimStart)
    }
  }

  // Calculate PiP positioning styles
  const getPipStyle = (): React.CSSProperties => {
    const sizeMap = { small: '15%', medium: '25%', large: '40%' }
    const positionMap = {
      'bottom-right': { bottom: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'top-right': { top: '20px', right: '20px' },
      'top-left': { top: '20px', left: '20px' }
    }
    return {
      position: 'absolute',
      width: sizeMap[pipConfig.size],
      ...positionMap[pipConfig.position],
      border: '2px solid white',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
      zIndex: 10,
      objectFit: 'cover' as const
    }
  }

  return (
    <div className="video-preview-container" style={{ position: 'relative' }}>
      {sourcePath ? (
        <>
          {/* Main video */}
          <video
            ref={mainVideoRef}
            src={`file://${sourcePath}`}
            onTimeUpdate={handleTimeUpdate}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
          />

          {/* PiP overlay video */}
          {pipClip && (
            <video
              ref={pipVideoRef}
              src={`file://${pipClip.sourcePath}`}
              muted
              style={getPipStyle()}
            />
          )}

          <div className="video-controls">
            <button onClick={onPlayPause}>{isPlaying ? '⏸' : '▶'}</button>
          </div>
        </>
      ) : (
        <div className="preview-placeholder">No video loaded</div>
      )}
    </div>
  )
}

export default VideoPreview
