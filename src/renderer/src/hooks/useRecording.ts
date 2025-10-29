import { useState, useCallback } from 'react'
import { TimelineClip } from '../types/timeline'
import { createClipFromMetadata } from '../utils/clipUtils'

interface UseRecordingReturn {
  showWebcamRecorder: boolean
  showScreenRecorder: boolean
  setShowWebcamRecorder: React.Dispatch<React.SetStateAction<boolean>>
  setShowScreenRecorder: React.Dispatch<React.SetStateAction<boolean>>
  handleWebcamRecordingComplete: (blob: Blob, durationSeconds: number) => Promise<void>
  handleScreenRecordingComplete: (blob: Blob, durationSeconds: number) => Promise<void>
}

export const useRecording = (onClipAdded: (clip: TimelineClip) => void): UseRecordingReturn => {
  const [showWebcamRecorder, setShowWebcamRecorder] = useState(false)
  const [showScreenRecorder, setShowScreenRecorder] = useState(false)

  const handleWebcamRecordingComplete = useCallback(
    async (blob: Blob, durationSeconds: number): Promise<void> => {
      try {
        // Prevent double-calls by immediately closing the webcam recorder
        setShowWebcamRecorder(false)

        const arrayBuffer = await blob.arrayBuffer()
        const tempPath = await window.api.saveRecordingBlob(arrayBuffer)

        const result = await window.api.saveRecordingPermanent(tempPath)
        const finalPath = result.path

        const metadata = await window.api.getVideoMetadata(finalPath)

        const newClip = createClipFromMetadata('webcam', finalPath, metadata, durationSeconds)

        onClipAdded(newClip)
      } catch (error) {
        console.error('Failed to save webcam recording:', error)
        alert(`Failed to save recording: ${error}`)
      }
    },
    [onClipAdded]
  )

  const handleScreenRecordingComplete = useCallback(
    async (blob: Blob, durationSeconds: number): Promise<void> => {
      try {
        const arrayBuffer = await blob.arrayBuffer()
        const tempPath = await window.api.saveRecordingBlob(arrayBuffer)

        const result = await window.api.saveRecordingPermanent(tempPath)
        const finalPath = result.path

        const metadata = await window.api.getVideoMetadata(finalPath)

        const newClip = createClipFromMetadata('screen', finalPath, metadata, durationSeconds)

        onClipAdded(newClip)
      } catch (error) {
        console.error('Failed to save screen recording:', error)
        alert(`Failed to save recording: ${error}`)
      }
    },
    [onClipAdded]
  )

  return {
    showWebcamRecorder,
    showScreenRecorder,
    setShowWebcamRecorder,
    setShowScreenRecorder,
    handleWebcamRecordingComplete,
    handleScreenRecordingComplete
  }
}
