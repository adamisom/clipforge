import { useState, useCallback } from 'react'
import { TimelineClip } from '../types/timeline'
import { createClipFromMetadata } from '../utils/clipUtils'

interface UseRecordingReturn {
  showWebcamRecorder: boolean
  showScreenRecorder: boolean
  showSimultaneousRecorder: boolean
  setShowWebcamRecorder: React.Dispatch<React.SetStateAction<boolean>>
  setShowScreenRecorder: React.Dispatch<React.SetStateAction<boolean>>
  setShowSimultaneousRecorder: React.Dispatch<React.SetStateAction<boolean>>
  handleWebcamRecordingComplete: (blob: Blob, durationSeconds: number) => Promise<void>
  handleScreenRecordingComplete: (blob: Blob, durationSeconds: number) => Promise<void>
  handleSimultaneousRecordingComplete: (
    screenBlob: Blob,
    webcamBlob: Blob,
    duration: number
  ) => Promise<void>
}

export const useRecording = (
  onClipAdded: (clip: TimelineClip) => void,
  existingClips: TimelineClip[]
): UseRecordingReturn => {
  const [showWebcamRecorder, setShowWebcamRecorder] = useState(false)
  const [showScreenRecorder, setShowScreenRecorder] = useState(false)
  const [showSimultaneousRecorder, setShowSimultaneousRecorder] = useState(false)

  const handleWebcamRecordingComplete = useCallback(
    async (blob: Blob, durationSeconds: number): Promise<void> => {
      try {
        // Prevent double-calls by immediately closing the webcam recorder
        setShowWebcamRecorder(false)

        const arrayBuffer = await blob.arrayBuffer()
        const tempPath = await window.api.saveRecordingBlob(arrayBuffer)

        // Add to timeline immediately with temp path (user can save permanently later)
        const metadata = await window.api.getVideoMetadata(tempPath)

        const newClip = createClipFromMetadata(
          'webcam',
          tempPath,
          metadata,
          durationSeconds,
          existingClips
        )

        onClipAdded(newClip)
      } catch (error) {
        console.error('Failed to save webcam recording:', error)
        alert(`Failed to save recording: ${error}`)
      }
    },
    [onClipAdded, existingClips]
  )

  const handleScreenRecordingComplete = useCallback(
    async (blob: Blob, durationSeconds: number): Promise<void> => {
      try {
        const arrayBuffer = await blob.arrayBuffer()
        const tempPath = await window.api.saveRecordingBlob(arrayBuffer)

        // Add to timeline immediately with temp path (user can save permanently later)
        const metadata = await window.api.getVideoMetadata(tempPath)

        const newClip = createClipFromMetadata(
          'screen',
          tempPath,
          metadata,
          durationSeconds,
          existingClips
        )

        onClipAdded(newClip)
      } catch (error) {
        console.error('Failed to save screen recording:', error)
        alert(`Failed to save recording: ${error}`)
      }
    },
    [onClipAdded, existingClips]
  )

  const handleSimultaneousRecordingComplete = useCallback(
    async (screenBlob: Blob, webcamBlob: Blob, duration: number): Promise<void> => {
      try {
        setShowSimultaneousRecorder(false)

        // Save both blobs to temp
        const screenArrayBuffer = await screenBlob.arrayBuffer()
        const webcamArrayBuffer = await webcamBlob.arrayBuffer()

        const screenPath = await window.api.saveRecordingBlob(screenArrayBuffer)
        const webcamPath = await window.api.saveRecordingBlob(webcamArrayBuffer)

        // Get metadata for both
        const screenMetadata = await window.api.getVideoMetadata(screenPath)
        const webcamMetadata = await window.api.getVideoMetadata(webcamPath)

        // Create clips with same duration from recording timer
        // Pass existingClips for smart track assignment
        const screenClip = createClipFromMetadata(
          'screen',
          screenPath,
          screenMetadata,
          duration,
          existingClips
        )
        // For simultaneous recording, we want webcam on Track 1 even if no existing clips
        const webcamClip = createClipFromMetadata('webcam', webcamPath, webcamMetadata, duration, [
          screenClip,
          ...existingClips
        ])

        // Add both clips (webcam auto-assigns to Track 1, screen to Track 0)
        onClipAdded(screenClip)
        onClipAdded(webcamClip)
      } catch (error) {
        console.error('Failed to save simultaneous recording:', error)
        alert(`Failed to save recording: ${error}`)
      }
    },
    [onClipAdded, existingClips]
  )

  return {
    showWebcamRecorder,
    showScreenRecorder,
    showSimultaneousRecorder,
    setShowWebcamRecorder,
    setShowScreenRecorder,
    setShowSimultaneousRecorder,
    handleWebcamRecordingComplete,
    handleScreenRecordingComplete,
    handleSimultaneousRecordingComplete
  }
}
