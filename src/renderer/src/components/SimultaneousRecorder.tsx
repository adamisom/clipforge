import { useState, useRef, useEffect } from 'react'

interface SimultaneousRecorderProps {
  onComplete: (screenBlob: Blob, webcamBlob: Blob, duration: number) => void
  onClose: () => void
}

interface ScreenSource {
  id: string
  name: string
  thumbnail: string
}

type Stage = 'source-select' | 'countdown' | 'recording'

function SimultaneousRecorder({
  onComplete,
  onClose
}: SimultaneousRecorderProps): React.JSX.Element | null {
  const [stage, setStage] = useState<Stage>('source-select')
  const [sources, setSources] = useState<ScreenSource[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const screenStreamRef = useRef<MediaStream | null>(null)
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const screenRecorderRef = useRef<MediaRecorder | null>(null)
  const webcamRecorderRef = useRef<MediaRecorder | null>(null)
  const screenChunksRef = useRef<Blob[]>([])
  const webcamChunksRef = useRef<Blob[]>([])
  const recordingStartTimeRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const webcamVideoRef = useRef<HTMLVideoElement>(null)

  // Fetch screen sources
  useEffect(() => {
    const fetchSources = async (): Promise<void> => {
      try {
        const sources = await window.api.getScreenSources()
        setSources(sources)
      } catch (err) {
        setError('Failed to get screen sources')
        console.error(err)
      }
    }
    fetchSources()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [])

  // Show webcam preview
  useEffect(() => {
    if (stage === 'source-select' && selectedSourceId) {
      const getWebcam = async (): Promise<void> => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          webcamStreamRef.current = stream
          if (webcamVideoRef.current) {
            webcamVideoRef.current.srcObject = stream
          }
        } catch (err) {
          setError('Failed to access webcam')
          console.error(err)
        }
      }
      getWebcam()
    }
  }, [stage, selectedSourceId])

  const startCountdown = (): void => {
    setStage('countdown')
    setCountdown(3)

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval)
          startRecording()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  const startRecording = async (): Promise<void> => {
    try {
      // Get screen stream (video only, no audio to avoid duplication)
      const screenStream = await navigator.mediaDevices.getUserMedia({
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedSourceId
          }
        } as MediaTrackConstraints,
        audio: false // No audio - webcam will capture microphone
      })
      screenStreamRef.current = screenStream

      // Webcam stream already initialized
      if (!webcamStreamRef.current) {
        throw new Error('Webcam not initialized')
      }

      // Create recorders
      screenRecorderRef.current = new MediaRecorder(screenStream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      })
      webcamRecorderRef.current = new MediaRecorder(webcamStreamRef.current, {
        mimeType: 'video/webm;codecs=vp8,opus'
      })

      // Handle screen data
      screenRecorderRef.current.ondataavailable = (e): void => {
        if (e.data.size > 0) {
          screenChunksRef.current.push(e.data)
        }
      }

      // Handle webcam data
      webcamRecorderRef.current.ondataavailable = (e): void => {
        if (e.data.size > 0) {
          webcamChunksRef.current.push(e.data)
        }
      }

      // Start both recorders simultaneously (same event loop tick for sync)
      screenRecorderRef.current.start()
      webcamRecorderRef.current.start()

      recordingStartTimeRef.current = Date.now()
      setStage('recording')

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
          setRecordingDuration(elapsed)
        }
      }, 1000)

      // Register global shortcut and notification
      await window.api.startRecording()
    } catch (err) {
      setError(`Recording failed: ${err}`)
      console.error(err)
    }
  }

  const stopRecording = async (): Promise<void> => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }

    const finalDuration = recordingStartTimeRef.current
      ? (Date.now() - recordingStartTimeRef.current) / 1000
      : recordingDuration

    await window.api.stopRecording()

    // Stop both recorders
    return new Promise((resolve) => {
      let screenDone = false
      let webcamDone = false

      const checkComplete = (): void => {
        if (screenDone && webcamDone) {
          const screenBlob = new Blob(screenChunksRef.current, { type: 'video/webm' })
          const webcamBlob = new Blob(webcamChunksRef.current, { type: 'video/webm' })
          onComplete(screenBlob, webcamBlob, finalDuration)
          resolve()
        }
      }

      if (screenRecorderRef.current) {
        screenRecorderRef.current.onstop = (): void => {
          screenDone = true
          screenStreamRef.current?.getTracks().forEach((track) => track.stop())
          checkComplete()
        }
        screenRecorderRef.current.stop()
      } else {
        screenDone = true
      }

      if (webcamRecorderRef.current) {
        webcamRecorderRef.current.onstop = (): void => {
          webcamDone = true
          webcamStreamRef.current?.getTracks().forEach((track) => track.stop())
          checkComplete()
        }
        webcamRecorderRef.current.stop()
      } else {
        webcamDone = true
      }

      checkComplete()
    })
  }

  // Handle escape key to cancel
  useEffect(() => {
    if (stage !== 'countdown') return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [stage, onClose])

  if (error) {
    return (
      <div className="recorder-overlay">
        <div className="recorder-modal">
          <h2>Error</h2>
          <p className="error-message">{error}</p>
          <button onClick={onClose} className="cancel-button">
            Close
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'source-select') {
    return (
      <div className="recorder-overlay">
        <div className="recorder-modal">
          <h2>Record Screen + Webcam</h2>
          <p>Select a screen or window to record:</p>

          <div className="screen-source-grid">
            {sources.map((source) => (
              <div
                key={source.id}
                className={`screen-source-item ${selectedSourceId === source.id ? 'selected' : ''}`}
                onClick={() => setSelectedSourceId(source.id)}
              >
                <img src={source.thumbnail} alt={source.name} />
                <span>{source.name}</span>
              </div>
            ))}
          </div>

          {selectedSourceId && webcamStreamRef.current && (
            <div className="webcam-preview-small">
              <p>Webcam preview:</p>
              <video
                ref={webcamVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '200px', borderRadius: '8px' }}
              />
            </div>
          )}

          <div className="button-group">
            <button onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button
              onClick={startCountdown}
              disabled={!selectedSourceId || !webcamStreamRef.current}
              className="start-button"
            >
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
        <p>Get ready to record screen + webcam...</p>
        <div className="stop-recording-hint">
          <p className="stop-hint-primary">To stop recording, press:</p>
          <div className="stop-hint-shortcut">
            <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>
          </div>
        </div>
        <p className="countdown-cancel-hint">
          Press <kbd>Esc</kbd> to cancel
        </p>
      </div>
    )
  }

  if (stage === 'recording') {
    return (
      <div className="recording-indicator">
        <span className="recording-dot"></span>
        <span>
          Recording Screen + Webcam: {Math.floor(recordingDuration / 60)}:
          {(recordingDuration % 60).toString().padStart(2, '0')}
        </span>
        <button onClick={stopRecording} className="stop-button">
          Stop Recording
        </button>
      </div>
    )
  }

  return null
}

export default SimultaneousRecorder
