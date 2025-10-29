import { useRef, useEffect } from 'react'

interface VideoPreviewProps {
  sourcePath: string | null
  trimStart: number
  trimEnd: number
  playheadPosition: number
  isPlaying: boolean
  onPlayPause: () => void
  onTimeUpdate: (time: number) => void
}

function VideoPreview({
  sourcePath,
  trimStart,
  trimEnd,
  playheadPosition,
  isPlaying,
  onPlayPause,
  onTimeUpdate
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Sync video playback state
  useEffect(() => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.play()
    } else {
      videoRef.current.pause()
    }
  }, [isPlaying])

  // Sync video current time when playhead changes (when not playing)
  useEffect(() => {
    if (!videoRef.current || isPlaying) return
    videoRef.current.currentTime = trimStart + playheadPosition
  }, [playheadPosition, trimStart, isPlaying])

  // Initialize video position on load
  useEffect(() => {
    if (videoRef.current && sourcePath) {
      videoRef.current.currentTime = trimStart
    }
  }, [sourcePath, trimStart])

  // Handle time updates during playback
  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    
    const currentTime = videoRef.current.currentTime
    
    // Check if we've reached the trim end
    if (currentTime >= trimEnd) {
      videoRef.current.pause()
      videoRef.current.currentTime = trimStart
      onTimeUpdate(0)
      onPlayPause() // Stop playback
    } else {
      // Update playhead position (relative to trim start)
      onTimeUpdate(currentTime - trimStart)
    }
  }

  return (
    <div className="video-preview-container">
      {sourcePath ? (
        <>
          <video
            ref={videoRef}
            src={`file://${sourcePath}`}
            onTimeUpdate={handleTimeUpdate}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
          />
          <div className="video-controls">
            <button onClick={onPlayPause}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </>
      ) : (
        <div className="preview-placeholder">No video loaded</div>
      )}
    </div>
  )
}

export default VideoPreview

