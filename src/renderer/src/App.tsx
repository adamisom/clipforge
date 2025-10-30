import { useState, useEffect } from 'react'
import './assets/main.css'
import WelcomeScreen from './components/WelcomeScreen'
import VideoEditor from './components/VideoEditor'
import WebcamRecorder from './components/WebcamRecorder'
import ScreenRecorder from './components/ScreenRecorder'
import { useClips } from './hooks/useClips'
import { useClipImport } from './hooks/useClipImport'
import { useRecording } from './hooks/useRecording'
import { isTempFile } from './utils/clipUtils'

// Feature flags
const ENABLE_DRAG_AND_DROP = true

function App(): React.JSX.Element {
  const { clips, selectedClipId, setClips, setSelectedClipId, addClip } = useClips()
  const { handleImport, handleDrop } = useClipImport(addClip)
  const {
    showWebcamRecorder,
    showScreenRecorder,
    setShowWebcamRecorder,
    setShowScreenRecorder,
    handleWebcamRecordingComplete,
    handleScreenRecordingComplete
  } = useRecording(addClip)

  const [isDragging, setIsDragging] = useState(false)

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDropEvent = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setIsDragging(false)
    await handleDrop(e.dataTransfer.files)
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

  // Listen for menu recording events
  useEffect(() => {
    const handleMenuRecordWebcam = (): void => {
      setShowWebcamRecorder(true)
    }

    const handleMenuRecordScreen = (): void => {
      setShowScreenRecorder(true)
    }

    window.api.onMenuRecordWebcam(handleMenuRecordWebcam)
    window.api.onMenuRecordScreen(handleMenuRecordScreen)

    return () => {
      window.api.removeAllListeners('menu-record-webcam')
      window.api.removeAllListeners('menu-record-screen')
    }
  }, [setShowWebcamRecorder, setShowScreenRecorder])

  // Listen for quit check - respond with whether we have temp files
  useEffect(() => {
    const handleCheckUnsavedRecordings = (): void => {
      const hasTempFiles = clips.some((clip) => isTempFile(clip.sourcePath))
      window.api.respondUnsavedRecordings(hasTempFiles)
    }

    window.api.onCheckUnsavedRecordings(handleCheckUnsavedRecordings)

    return () => {
      window.api.removeAllListeners('check-unsaved-recordings')
    }
  }, [clips])

  return (
    <div
      onDragOver={ENABLE_DRAG_AND_DROP ? handleDragOver : undefined}
      onDragLeave={ENABLE_DRAG_AND_DROP ? handleDragLeave : undefined}
      onDrop={ENABLE_DRAG_AND_DROP ? handleDropEvent : undefined}
      style={{ width: '100%', height: '100vh' }}
    >
      {clips.length === 0 ? (
        <WelcomeScreen
          onImport={handleImport}
          onRecordWebcam={() => setShowWebcamRecorder(true)}
          onRecordScreen={() => setShowScreenRecorder(true)}
          isDragging={isDragging}
          enableDragAndDrop={ENABLE_DRAG_AND_DROP}
        />
      ) : (
        <VideoEditor
          clips={clips}
          setClips={setClips}
          selectedClipId={selectedClipId}
          setSelectedClipId={setSelectedClipId}
          onImport={handleImport}
          onRecordScreen={() => setShowScreenRecorder(true)}
          onRecordWebcam={() => setShowWebcamRecorder(true)}
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
    </div>
  )
}

export default App
