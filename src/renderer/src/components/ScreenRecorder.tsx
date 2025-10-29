import { useState, useRef, useEffect } from 'react'
import ScreenSourcePicker from './ScreenSourcePicker'

interface ScreenRecorderProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void
  onClose: () => void
}

function ScreenRecorder({ onRecordingComplete, onClose }: ScreenRecorderProps): React.JSX.Element {
  const [stage, setStage] = useState<'picker' | 'ready-to-record' | 'countdown' | 'recording'>(
    'picker'
  )
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedSourceName, setSelectedSourceName] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const hasCompletedRef = useRef(false) // Prevent double-completion
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const recordingStartTimeRef = useRef<number>(0)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const handleSourceSelect = (sourceId: string, sourceName: string): void => {
    // Store both ID and name
    setSelectedSourceId(sourceId)
    setSelectedSourceName(sourceName)
    setStage('ready-to-record')
  }

  const isRecordingOwnApp = (): boolean => {
    // Check if recording ClipForge or Electron (case-insensitive)
    if (!selectedSourceName) return false
    const nameLower = selectedSourceName.toLowerCase()
    return nameLower.includes('clipforge') || nameLower.includes('electron')
  }

  const handleStartRecording = (): void => {
    // Start countdown FIRST (user sees 3-2-1)
    setStage('countdown')
    setCountdown(3)

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
          }
          // AFTER countdown completes, get stream and start recording
          if (selectedSourceId) {
            getStreamAndBeginRecording(selectedSourceId)
          }
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleCancelCountdown = (): void => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }
    setCountdown(null)
    setStage('ready-to-record')
  }

  const getStreamAndBeginRecording = async (sourceId: string): Promise<void> => {
    try {
      // NOW get the screen stream (capturing starts here)
      const constraints = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          }
        }
      } as unknown as MediaStreamConstraints

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      // Verify we got video tracks
      const videoTracks = mediaStream.getVideoTracks()

      if (videoTracks.length === 0) {
        throw new Error('No video tracks in stream')
      }

      streamRef.current = mediaStream

      // If recording own app, skip minimize. Otherwise, minimize first.
      if (isRecordingOwnApp()) {
        // Recording own app - start immediately without minimizing
        beginRecording(mediaStream)
      } else {
        // Recording other content - minimize and start recording
        minimizeAndBeginRecording(mediaStream)
      }
    } catch (err) {
      console.error('Screen recording error:', err)
      alert(
        'Failed to start screen recording: ' + (err instanceof Error ? err.message : String(err))
      )
      onClose()
    }
  }

  const minimizeAndBeginRecording = async (mediaStream: MediaStream): Promise<void> => {
    try {
      // Minimize window, show notification, register shortcut
      await window.api.startRecording()

      // Wait longer for macOS minimize animation to complete (typically ~500ms)
      await new Promise((resolve) => setTimeout(resolve, 800))

      // Now actually start recording (window should be fully minimized)
      beginRecording(mediaStream)
    } catch (err) {
      console.error('Failed to start recording:', err)
      alert('Failed to start recording: ' + (err instanceof Error ? err.message : String(err)))
      onClose()
    }
  }

  const beginRecording = async (mediaStream: MediaStream): Promise<void> => {
    try {
      // Reset chunks array
      chunksRef.current = []

      // Verify stream has active tracks
      const videoTracks = mediaStream.getVideoTracks()
      const audioTracks = mediaStream.getAudioTracks()
      console.log('Stream tracks:', {
        video: videoTracks.length,
        audio: audioTracks.length,
        videoActive: videoTracks.some((t) => t.enabled && t.readyState === 'live'),
        audioActive: audioTracks.some((t) => t.enabled && t.readyState === 'live')
      })

      if (videoTracks.length === 0) {
        alert('No video track available')
        await window.api.stopRecording()
        onClose()
        return
      }

      const mediaRecorder = new MediaRecorder(mediaStream)

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped')

        // Stop timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current)
        }

        // Calculate final duration (more accurate than state)
        const finalDuration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)

        // Prevent double-completion (can happen if component unmounts during recording)
        if (hasCompletedRef.current) {
          console.log('Recording already completed, ignoring duplicate onstop')
          return
        }

        // Stop all tracks
        mediaStream.getTracks().forEach((track) => {
          track.stop()
        })
        // Ensure we have data
        if (chunksRef.current.length === 0) {
          console.error('No recording data available')
          await window.api.stopRecording()
          onClose()
          return
        }

        const blob = new Blob(chunksRef.current, { type: 'video/webm' })

        // Verify blob has content
        if (blob.size === 0) {
          console.error('Recording blob is empty')
          await window.api.stopRecording()
          onClose()
          return
        }

        console.log(
          `Recording complete: ${blob.size} bytes, ${chunksRef.current.length} chunks, ${finalDuration}s`
        )
        hasCompletedRef.current = true
        await window.api.stopRecording()
        onRecordingComplete(blob, finalDuration)
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        if (event.error) {
          console.error('Error details:', event.error)
        }
      }

      // Small delay to ensure stream is fully ready
      await new Promise((resolve) => setTimeout(resolve, 100))

      mediaRecorder.start() // No timeslice - only get data when stop() is called

      mediaRecorderRef.current = mediaRecorder
      setStage('recording')

      // Start recording timer - initialize to 0 then increment every second
      setRecordingTime(0)
      recordingStartTimeRef.current = Date.now()
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Recording start error:', err)
      alert('Failed to start recording')
      await window.api.stopRecording()
      onClose()
    }
  }

  // Listen for stop event from notification/shortcut/dock
  useEffect(() => {
    const handleStop = (): void => {
      if (mediaRecorderRef.current && stage === 'recording') {
        mediaRecorderRef.current.stop()
        // Don't stop stream here - let onstop handler do it
      }
    }

    // Handle Esc key during countdown
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && stage === 'countdown') {
        handleCancelCountdown()
      }
    }

    window.api.onStopRecording(handleStop)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.api.removeAllListeners('stop-recording')
      window.removeEventListener('keydown', handleKeyDown)
      // DON'T stop stream tracks in cleanup - this was causing premature stop!
      // Stream will be stopped in mediaRecorder.onstop handler

      // Cleanup countdown interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [stage])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (stage === 'picker') {
    return <ScreenSourcePicker onSelect={handleSourceSelect} onCancel={onClose} />
  }

  if (stage === 'ready-to-record') {
    const recordingOwnApp = isRecordingOwnApp()
    return (
      <div className="countdown-overlay fullscreen">
        <div className="ready-dialog">
          <h2>Ready to Record</h2>
          {recordingOwnApp ? (
            <p>When you click Start, recording will begin after a 3-2-1 countdown.</p>
          ) : (
            <p>
              When you click Start, this window will minimize and recording will begin after a 3-2-1
              countdown.
            </p>
          )}
          <p>
            To stop recording, press <kbd>Cmd+Shift+S</kbd> or click the notification.
          </p>
          <div className="ready-actions">
            <button onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button onClick={handleStartRecording} className="start-button">
              Start Recording
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'countdown' && countdown !== null) {
    return (
      <div className="countdown-overlay fullscreen">
        <div className="countdown-number">{countdown}</div>
        <p>Get ready to record...</p>
        <p className="countdown-cancel-hint">
          Press <kbd>Esc</kbd> to cancel
        </p>
      </div>
    )
  }

  // During recording, show a simple indicator
  if (stage === 'recording') {
    return (
      <div className="recording-overlay">
        <div className="recording-indicator-box">
          <div className="recording-dot"></div>
          <p>Recording in progress • {formatTime(recordingTime)}</p>
          <p className="recording-hint">
            Window is minimized. Press <kbd>Cmd+Shift+S</kbd> to stop, or click the notification.
          </p>
        </div>
      </div>
    )
  }

  return <></>
}

export default ScreenRecorder
