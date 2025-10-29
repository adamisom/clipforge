import { useState, useRef, useEffect } from 'react'

interface WebcamRecorderProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void
  onClose: () => void
}

function WebcamRecorder({ onRecordingComplete, onClose }: WebcamRecorderProps): React.JSX.Element {
  const [stage, setStage] = useState<'preview' | 'countdown' | 'recording'>('preview')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasCompletedRef = useRef(false) // Prevent double-completion
  const recordingStartTimeRef = useRef<number>(0) // Track actual start time for accurate duration
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize webcam on mount and handle Esc key
  useEffect(() => {
    const initWebcam = async (): Promise<void> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        console.error('Webcam access error:', err)
        setError('Could not access webcam. Please check permissions.')
      }
    }

    initWebcam()

    // Handle Esc key during countdown
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // Cancel countdown if in countdown stage
        if (countdownIntervalRef.current) {
          handleCancelCountdown()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown)

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, []) // Empty deps - only run on mount/unmount

  const startCountdown = (): void => {
    setStage('countdown')
    setCountdown(3)

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
          }
          beginRecording()
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
    setStage('preview')
  }

  const beginRecording = (): void => {
    if (!streamRef.current) {
      setError('Stream not available')
      return
    }

    // Prevent double-initialization
    if (mediaRecorderRef.current) {
      console.warn('MediaRecorder already exists, skipping initialization')
      return
    }

    try {
      // Reset chunks array
      chunksRef.current = []

      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Prevent double-completion (can happen if component unmounts during recording)
        if (hasCompletedRef.current) {
          console.log('Recording already completed, ignoring duplicate onstop')
          return
        }

        // Calculate final duration from actual start time (more accurate than state)
        const finalDuration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)

        if (chunksRef.current.length === 0) {
          console.error('No recording data available')
          setError('Recording failed: No data captured')
          return
        }

        const blob = new Blob(chunksRef.current, { type: 'video/webm' })

        if (blob.size === 0) {
          console.error('Recording blob is empty')
          setError('Recording failed: File is empty')
          return
        }

        console.log(
          `Recording complete: ${blob.size} bytes, ${chunksRef.current.length} chunks, ${finalDuration}s`
        )
        hasCompletedRef.current = true
        onRecordingComplete(blob, finalDuration)
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        setError('Recording error occurred')
      }

      mediaRecorder.start() // No timeslice - only get data when stop() is called
      mediaRecorderRef.current = mediaRecorder

      // Start recording timer BEFORE setting stage to avoid re-render race
      setRecordingTime(0)
      recordingStartTimeRef.current = Date.now()

      // Clear any existing timer before starting new one
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      setStage('recording')
    } catch (err) {
      console.error('Recording start error:', err)
      setError('Failed to start recording')
    }
  }

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (error) {
    return (
      <div className="webcam-recorder-overlay">
        <div className="webcam-recorder-modal">
          <div className="error-message">
            <p>{error}</p>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="webcam-recorder-overlay">
      {stage === 'recording' && (
        <div className="recording-indicator">
          <span className="recording-dot">●</span>
          <span>{formatTime(recordingTime)}</span>
        </div>
      )}

      <div className="webcam-recorder-modal">
        <video ref={videoRef} autoPlay muted className="webcam-preview" />

        {stage === 'countdown' && countdown !== null && (
          <div className="countdown-overlay">
            <div className="countdown-number">{countdown}</div>
            <p className="countdown-cancel-hint">
              Press <kbd>Esc</kbd> to cancel
            </p>
          </div>
        )}

        <div className="webcam-controls">
          {stage === 'preview' && (
            <>
              <button onClick={startCountdown} className="start-button">
                Start Recording
              </button>
              <button onClick={onClose} className="cancel-button">
                Cancel
              </button>
            </>
          )}

          {stage === 'recording' && (
            <button onClick={stopRecording} className="stop-button">
              Stop Recording
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default WebcamRecorder
