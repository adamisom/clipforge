import { useState, useEffect, useCallback, useMemo } from 'react'
import './assets/main.css'
import Timeline from './components/Timeline'
import VideoPreview from './components/VideoPreview'
import ExportButton from './components/ExportButton'
import WebcamRecorder from './components/WebcamRecorder'
import ScreenRecorder from './components/ScreenRecorder'
import { TimelineClip } from './types/timeline'

// Feature flags
const ENABLE_DRAG_AND_DROP = false

// Helper to generate unique clip IDs
const generateClipId = (): string => {
  return `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Components will be defined inline for now
function WelcomeScreen({
  onImport,
  isDragging
}: {
  onImport: () => void
  isDragging: boolean
}): React.JSX.Element {
  return (
    <div className={`welcome-screen ${isDragging ? 'drag-over' : ''}`}>
      <h1>ClipForge</h1>
      <p>Import a video to get started</p>
      {ENABLE_DRAG_AND_DROP && <p className="drag-hint">or drag and drop a video file here</p>}
      <button onClick={onImport} className="import-button">
        Import Video
      </button>
    </div>
  )
}

function VideoEditor({
  clips,
  setClips,
  selectedClipId,
  playheadPosition,
  setPlayheadPosition,
  isPlaying,
  setIsPlaying
}: {
  clips: TimelineClip[]
  setClips: React.Dispatch<React.SetStateAction<TimelineClip[]>>
  selectedClipId: string | null
  playheadPosition: number
  setPlayheadPosition: (pos: number) => void
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
}): React.JSX.Element {
  // Calculate total duration and clip positions
  const totalDuration = clips.reduce((sum, c) => sum + c.timelineDuration, 0)

  const clipPositions = useMemo(() => {
    const positions = new Map<string, { start: number; end: number }>()
    let pos = 0
    for (const clip of clips) {
      positions.set(clip.id, { start: pos, end: pos + clip.timelineDuration })
      pos += clip.timelineDuration
    }
    return positions
  }, [clips])

  // Determine which clip the playhead is currently in
  const currentClip = useMemo(() => {
    for (const clip of clips) {
      const position = clipPositions.get(clip.id)
      if (position && playheadPosition >= position.start && playheadPosition < position.end) {
        return clip
      }
    }
    // If playhead is at the very end or beyond, return last clip
    return clips[clips.length - 1]
  }, [clips, clipPositions, playheadPosition])

  // Calculate playhead position relative to current clip
  const relativePlayheadPosition = useMemo(() => {
    if (!currentClip) return 0
    const position = clipPositions.get(currentClip.id)
    if (!position) return 0
    return playheadPosition - position.start
  }, [currentClip, clipPositions, playheadPosition])

  const handlePlayPause = (): void => {
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = (time: number): void => {
    if (!currentClip) return

    const position = clipPositions.get(currentClip.id)
    if (!position) return

    const newPlayheadPosition = position.start + time

    // Check if we've reached the end of current clip
    if (newPlayheadPosition >= position.end) {
      // Find next clip
      const currentIndex = clips.findIndex((c) => c.id === currentClip.id)
      if (currentIndex < clips.length - 1) {
        // Auto-advance to next clip
        const nextClip = clips[currentIndex + 1]
        const nextPosition = clipPositions.get(nextClip.id)
        if (nextPosition) {
          setPlayheadPosition(nextPosition.start)
        }
      } else {
        // Reached end of timeline
        setPlayheadPosition(totalDuration)
        setIsPlaying(false)
      }
    } else {
      setPlayheadPosition(newPlayheadPosition)
    }
  }

  const handleClipSelect = (): void => {
    // Clicking a clip doesn't change playhead, just for future features
  }

  const handleTrimChange = (clipId: string, newTrimStart: number, newTrimEnd: number): void => {
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
  }

  const handlePlayheadChange = (position: number): void => {
    setPlayheadPosition(position)
    setIsPlaying(false)
  }

  const handleExport = useCallback(async (): Promise<void> => {
    if (clips.length === 0) return

    const outputPath = await window.api.selectSavePath()
    if (!outputPath) return

    // For now, export first clip only
    await window.api.exportVideo(
      currentClip.sourcePath,
      outputPath,
      currentClip.sourceStartTime,
      currentClip.timelineDuration
    )
  }, [clips, currentClip])

  // Listen for menu events
  useEffect(() => {
    const handleMenuExport = (): void => {
      if (clips.length > 0) {
        handleExport()
      }
    }

    window.api.onMenuExport(handleMenuExport)

    return () => {
      window.api.removeAllListeners('menu-export')
    }
  }, [clips, handleExport])

  return (
    <div className="video-editor">
      <div className="preview-panel">
        {currentClip ? (
          <VideoPreview
            key={currentClip.id}
            sourcePath={currentClip.sourcePath}
            trimStart={currentClip.sourceStartTime}
            trimEnd={currentClip.sourceStartTime + currentClip.timelineDuration}
            playheadPosition={relativePlayheadPosition}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onTimeUpdate={handleTimeUpdate}
          />
        ) : null}
      </div>

      {/* Multi-clip Timeline */}
      <Timeline
        clips={clips}
        selectedClipId={selectedClipId}
        playheadPosition={playheadPosition}
        onClipSelect={handleClipSelect}
        onTrimChange={handleTrimChange}
        onPlayheadChange={handlePlayheadChange}
      />

      <div className="info-panel">
        <div className="info-content">
          <h3>Video Info</h3>
          <div className="info-item">
            <strong>Clips:</strong> {clips.length}
          </div>
          {currentClip && (
            <>
              <div className="info-item">
                <strong>File:</strong> {currentClip.metadata.filename}
              </div>
              <div className="info-item">
                <strong>Resolution:</strong> {currentClip.metadata.resolution}
              </div>
              <div className="info-item">
                <strong>Duration:</strong> {Math.floor(currentClip.sourceDuration)}s
              </div>
              <div className="info-item">
                <strong>Trim:</strong> {Math.floor(currentClip.sourceStartTime)}s -{' '}
                {Math.floor(currentClip.sourceStartTime + currentClip.timelineDuration)}s
              </div>
            </>
          )}
        </div>

        <ExportButton hasClips={clips.length > 0} onExport={handleExport} />
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  // NEW multi-clip state
  const [clips, setClips] = useState<TimelineClip[]>([])
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showWebcamRecorder, setShowWebcamRecorder] = useState(false)
  const [showScreenRecorder, setShowScreenRecorder] = useState(false)

  const handleWebcamRecordingComplete = async (
    blob: Blob,
    durationSeconds: number
  ): Promise<void> => {
    try {
      // Prevent double-calls by immediately closing the webcam recorder
      setShowWebcamRecorder(false)

      const arrayBuffer = await blob.arrayBuffer()
      const tempPath = await window.api.saveRecordingBlob(arrayBuffer)

      const result = await window.api.saveRecordingPermanent(tempPath)

      // User cancelled the save dialog
      if (!result.saved) {
        console.log('User cancelled save')
        return
      }

      const finalPath = result.path

      const metadata = await window.api.getVideoMetadata(finalPath)

      const newClip: TimelineClip = {
        id: generateClipId(),
        sourceType: 'webcam',
        sourcePath: finalPath,
        sourceStartTime: 0,
        sourceDuration: durationSeconds, // Use actual recording duration
        timelineDuration: durationSeconds,
        metadata: {
          filename: metadata.filename,
          resolution: `${metadata.width}x${metadata.height}`,
          codec: metadata.codec
        }
      }

      // Add to clips array and select it for preview
      setClips((prev) => [...prev, newClip])
      setSelectedClipId(newClip.id)
    } catch (error) {
      console.error('Failed to save recording:', error)
      alert(`Failed to save recording: ${error}`)
    }
  }

  const handleScreenRecordingComplete = async (
    blob: Blob,
    durationSeconds: number
  ): Promise<void> => {
    try {
      // Prevent double-calls by immediately closing the screen recorder
      setShowScreenRecorder(false)

      const arrayBuffer = await blob.arrayBuffer()
      const tempPath = await window.api.saveRecordingBlob(arrayBuffer)

      const result = await window.api.saveRecordingPermanent(tempPath)

      // User cancelled the save dialog
      if (!result.saved) {
        console.log('User cancelled save')
        return
      }

      const finalPath = result.path

      const metadata = await window.api.getVideoMetadata(finalPath)

      const newClip: TimelineClip = {
        id: generateClipId(),
        sourceType: 'screen',
        sourcePath: finalPath,
        sourceStartTime: 0,
        sourceDuration: durationSeconds, // Use actual recording duration
        timelineDuration: durationSeconds,
        metadata: {
          filename: metadata.filename,
          resolution: `${metadata.width}x${metadata.height}`,
          codec: metadata.codec
        }
      }

      // Add to clips array and select it for preview
      setClips((prev) => [...prev, newClip])
      setSelectedClipId(newClip.id)
    } catch (error) {
      console.error('Failed to save screen recording:', error)
      alert(`Failed to save recording: ${error}`)
    }
  }

  // Import handler
  const handleImport = useCallback(async (): Promise<void> => {
    try {
      const filePath = await window.api.selectVideoFile()
      if (!filePath) return

      // Get metadata
      const metadata = await window.api.getVideoMetadata(filePath)

      const newClip: TimelineClip = {
        id: generateClipId(),
        sourceType: 'imported',
        sourcePath: filePath,
        sourceStartTime: 0,
        sourceDuration: metadata.duration,
        timelineDuration: metadata.duration,
        metadata: {
          filename: metadata.filename,
          resolution: `${metadata.width}x${metadata.height}`,
          codec: metadata.codec
        }
      }

      // Add to clips array and select it for preview
      setClips((prev) => [...prev, newClip])
      setSelectedClipId(newClip.id)
    } catch (error) {
      console.error('Import failed:', error)
      alert(`Failed to import video: ${error}`)
    }
  }, [])

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const videoFiles = files.filter((file) => {
      const ext = file.name.toLowerCase().split('.').pop()
      return ['mp4', 'mov'].includes(ext || '')
    })

    if (videoFiles.length === 0) {
      alert('Please drop a video file (MP4 or MOV)')
      return
    }

    const filePath = (videoFiles[0] as File & { path: string }).path
    if (!filePath) return

    try {
      const metadata = await window.api.getVideoMetadata(filePath)

      const newClip: TimelineClip = {
        id: generateClipId(),
        sourceType: 'imported',
        sourcePath: filePath,
        sourceStartTime: 0,
        sourceDuration: metadata.duration,
        timelineDuration: metadata.duration,
        metadata: {
          filename: metadata.filename,
          resolution: `${metadata.width}x${metadata.height}`,
          codec: metadata.codec
        }
      }

      setClips((prev) => [...prev, newClip])
    } catch (error) {
      console.error('Drag-and-drop import failed:', error)
      alert(`Failed to import video: ${error}`)
    }
  }

  // Listen for menu import event
  useEffect(() => {
    const handleMenuImport = (): void => {
      handleImport()
    }

    window.api.onMenuImport(handleMenuImport)

    return () => {
      window.api.removeAllListeners('menu-import')
    }
  }, [handleImport])

  return (
    <div
      onDragOver={ENABLE_DRAG_AND_DROP ? handleDragOver : undefined}
      onDragLeave={ENABLE_DRAG_AND_DROP ? handleDragLeave : undefined}
      onDrop={ENABLE_DRAG_AND_DROP ? handleDrop : undefined}
      style={{ width: '100%', height: '100vh' }}
    >
      {clips.length === 0 ? (
        <WelcomeScreen onImport={handleImport} isDragging={isDragging} />
      ) : (
        <VideoEditor
          clips={clips}
          setClips={setClips}
          selectedClipId={selectedClipId}
          playheadPosition={playheadPosition}
          setPlayheadPosition={setPlayheadPosition}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
        />
      )}

      {showWebcamRecorder && (
        <WebcamRecorder
          onRecordingComplete={handleWebcamRecordingComplete}
          onClose={() => setShowWebcamRecorder(false)}
        />
      )}

      {showScreenRecorder && (
        <ScreenRecorder
          onRecordingComplete={handleScreenRecordingComplete}
          onClose={() => setShowScreenRecorder(false)}
        />
      )}

      {/* TEMPORARY TEST BUTTONS */}
      <button
        onClick={() => setShowWebcamRecorder(true)}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 150,
          zIndex: 999,
          padding: '12px 24px',
          background: '#646cff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        Test Webcam
      </button>
      <button
        onClick={() => setShowScreenRecorder(true)}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 999,
          padding: '12px 24px',
          background: '#ff6b6b',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        Test Screen
      </button>
    </div>
  )
}

export default App
