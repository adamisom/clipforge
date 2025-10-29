import { useState } from 'react'
import './assets/main.css'
import Timeline from './components/Timeline'
import VideoPreview from './components/VideoPreview'

// Type definitions
interface VideoState {
  sourcePath: string | null
  duration: number
  trimStart: number
  trimEnd: number
  playheadPosition: number
  isPlaying: boolean
  metadata: {
    filename: string
    resolution: string
  }
}

// Components will be defined inline for now
function WelcomeScreen({ onImport }: { onImport: () => void }): React.JSX.Element {
  return (
    <div className="welcome-screen">
      <h1>ClipForge</h1>
      <p>Import a video to get started</p>
      <button onClick={onImport} className="import-button">
        Import Video
      </button>
    </div>
  )
}

function VideoEditor({
  videoState,
  setVideoState
}: {
  videoState: VideoState
  setVideoState: React.Dispatch<React.SetStateAction<VideoState>>
}): React.JSX.Element {
  const handlePlayPause = (): void => {
    setVideoState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))
  }

  const handleTimeUpdate = (time: number): void => {
    setVideoState((prev) => ({ ...prev, playheadPosition: time }))
  }

  const handleTrimChange = (newTrimStart: number, newTrimEnd: number): void => {
    setVideoState((prev) => ({
      ...prev,
      trimStart: newTrimStart,
      trimEnd: newTrimEnd,
      // Reset playhead if it's outside new trim range
      playheadPosition: Math.min(prev.playheadPosition, newTrimEnd - newTrimStart)
    }))
  }

  const handlePlayheadChange = (position: number): void => {
    setVideoState((prev) => ({ ...prev, playheadPosition: position, isPlaying: false }))
  }

  return (
    <div className="video-editor">
      <div className="preview-panel">
        <VideoPreview
          sourcePath={videoState.sourcePath}
          trimStart={videoState.trimStart}
          trimEnd={videoState.trimEnd}
          playheadPosition={videoState.playheadPosition}
          isPlaying={videoState.isPlaying}
          onPlayPause={handlePlayPause}
          onTimeUpdate={handleTimeUpdate}
        />
      </div>
      <Timeline
        duration={videoState.duration}
        trimStart={videoState.trimStart}
        trimEnd={videoState.trimEnd}
        playheadPosition={videoState.playheadPosition}
        onTrimChange={handleTrimChange}
        onPlayheadChange={handlePlayheadChange}
      />
      <div className="info-panel">
        <div className="info-content">
          <h3>Video Info</h3>
          <div className="info-item">
            <strong>File:</strong> {videoState.metadata.filename}
          </div>
          <div className="info-item">
            <strong>Resolution:</strong> {videoState.metadata.resolution}
          </div>
          <div className="info-item">
            <strong>Duration:</strong> {Math.floor(videoState.duration)}s
          </div>
          <div className="info-item">
            <strong>Trim:</strong> {Math.floor(videoState.trimStart)}s -{' '}
            {Math.floor(videoState.trimEnd)}s
          </div>
        </div>
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  const [videoState, setVideoState] = useState<VideoState>({
    sourcePath: null,
    duration: 0,
    trimStart: 0,
    trimEnd: 0,
    playheadPosition: 0,
    isPlaying: false,
    metadata: { filename: '', resolution: '' }
  })

  // Import handler
  const handleImport = async (): Promise<void> => {
    try {
      const filePath = await window.api.selectVideoFile()
      if (!filePath) return

      // Get metadata
      const metadata = await window.api.getVideoMetadata(filePath)

      // Update state
      setVideoState({
        sourcePath: filePath,
        duration: metadata.duration,
        trimStart: 0,
        trimEnd: metadata.duration,
        playheadPosition: 0,
        isPlaying: false,
        metadata: {
          filename: metadata.filename,
          resolution: `${metadata.width}x${metadata.height}`
        }
      })
    } catch (error) {
      console.error('Import failed:', error)
      alert(`Failed to import video: ${error}`)
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()

    const files = Array.from(e.dataTransfer.files)
    const videoFiles = files.filter((file) => {
      const ext = file.name.toLowerCase().split('.').pop()
      return ['mp4', 'mov'].includes(ext || '')
    })

    if (videoFiles.length === 0) {
      alert('Please drop a video file (MP4 or MOV)')
      return
    }

    // Get file path (Electron provides path property)
    const filePath = (videoFiles[0] as File & { path: string }).path
    if (!filePath) return

    // Call same import logic
    try {
      const metadata = await window.api.getVideoMetadata(filePath)
      setVideoState({
        sourcePath: filePath,
        duration: metadata.duration,
        trimStart: 0,
        trimEnd: metadata.duration,
        playheadPosition: 0,
        isPlaying: false,
        metadata: {
          filename: metadata.filename,
          resolution: `${metadata.width}x${metadata.height}`
        }
      })
    } catch (error) {
      console.error('Drag-and-drop import failed:', error)
      alert(`Failed to import video: ${error}`)
    }
  }

  return (
    <div onDragOver={handleDragOver} onDrop={handleDrop} style={{ width: '100%', height: '100vh' }}>
      {!videoState.sourcePath ? (
        <WelcomeScreen onImport={handleImport} />
      ) : (
        <VideoEditor videoState={videoState} setVideoState={setVideoState} />
      )}
    </div>
  )
}

export default App
