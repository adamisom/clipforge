import { useState, useEffect, useCallback } from 'react'
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
  playheadPosition,
  setPlayheadPosition,
  isPlaying,
  setIsPlaying
}: {
  clips: TimelineClip[]
  setClips: React.Dispatch<React.SetStateAction<TimelineClip[]>>
  playheadPosition: number
  setPlayheadPosition: (pos: number) => void
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
}): React.JSX.Element {
  // For now, just show first clip
  const currentClip = clips[0]
  const totalDuration = clips.reduce((sum, c) => sum + c.timelineDuration, 0)

  const handlePlayPause = (): void => {
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = (time: number): void => {
    setPlayheadPosition(time)
  }

  const handleTrimChange = (newTrimStart: number, newTrimEnd: number): void => {
    setClips((prevClips) =>
      prevClips.map((clip, index) =>
        index === 0
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
            sourcePath={currentClip.sourcePath}
            trimStart={currentClip.sourceStartTime}
            trimEnd={currentClip.sourceStartTime + currentClip.timelineDuration}
            playheadPosition={playheadPosition}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onTimeUpdate={handleTimeUpdate}
          />
        ) : null}
      </div>

      {/* Temporarily pass first clip data to Timeline */}
      <Timeline
        duration={totalDuration}
        trimStart={currentClip ? currentClip.sourceStartTime : 0}
        trimEnd={currentClip ? currentClip.sourceStartTime + currentClip.timelineDuration : 0}
        playheadPosition={playheadPosition}
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
  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showWebcamRecorder, setShowWebcamRecorder] = useState(false)
  const [showScreenRecorder, setShowScreenRecorder] = useState(false)

  const handleWebcamRecordingComplete = async (blob: Blob): Promise<void> => {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const tempPath = await window.api.saveRecordingBlob(arrayBuffer)

      const result = await window.api.saveRecordingPermanent(tempPath)
      const finalPath = result.path

      const metadata = await window.api.getVideoMetadata(finalPath)

      const newClip: TimelineClip = {
        id: generateClipId(),
        sourceType: 'webcam',
        sourcePath: finalPath,
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
      setShowWebcamRecorder(false)
    } catch (error) {
      console.error('Failed to save recording:', error)
      alert(`Failed to save recording: ${error}`)
      setShowWebcamRecorder(false)
    }
  }

  const handleScreenRecordingComplete = async (blob: Blob): Promise<void> => {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const tempPath = await window.api.saveRecordingBlob(arrayBuffer)

      const result = await window.api.saveRecordingPermanent(tempPath)
      const finalPath = result.path

      const metadata = await window.api.getVideoMetadata(finalPath)

      const newClip: TimelineClip = {
        id: generateClipId(),
        sourceType: 'screen',
        sourcePath: finalPath,
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
      setShowScreenRecorder(false)
    } catch (error) {
      console.error('Failed to save screen recording:', error)
      alert(`Failed to save recording: ${error}`)
      setShowScreenRecorder(false)
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

      setClips((prev) => [...prev, newClip])
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
          right: 120,
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
