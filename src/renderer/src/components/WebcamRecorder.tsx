import { useState, useRef, useEffect } from 'react'

interface WebcamRecorderProps {
  onRecordingComplete: (blob: Blob) => void
  onClose: () => void
}

function WebcamRecorder({ onRecordingComplete, onClose }: WebcamRecorderProps) {
  const [stage, setStage] = useState<'preview' | 'countdown' | 'recording'>('preview')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize webcam on mount
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

    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [])

  const startCountdown = (): void => {
    setStage('countdown')
    setCountdown(3)

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval)
          beginRecording()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  const beginRecording = (): void => {
    if (!streamRef.current) {
      setError('Stream not available')
      return
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9'
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        onRecordingComplete(blob)
      }

      mediaRecorder.start(1000)
      mediaRecorderRef.current = mediaRecorder
      setStage('recording')

      // Start recording timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
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
      <div className="webcam-recorder-modal">
        <video ref={videoRef} autoPlay muted className="webcam-preview" />

        {stage === 'countdown' && countdown !== null && (
          <div className="countdown-overlay">
            <div className="countdown-number">{countdown}</div>
          </div>
        )}

        {stage === 'recording' && (
          <div className="recording-indicator">
            <span className="recording-dot">●</span>
            <span>{formatTime(recordingTime)}</span>
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

