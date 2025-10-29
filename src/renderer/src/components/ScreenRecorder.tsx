import { useState, useRef, useEffect } from 'react'
import ScreenSourcePicker from './ScreenSourcePicker'

interface ScreenRecorderProps {
  onRecordingComplete: (blob: Blob) => void
  onClose: () => void
}

function ScreenRecorder({ onRecordingComplete, onClose }: ScreenRecorderProps): React.JSX.Element {
  const [stage, setStage] = useState<'picker' | 'countdown' | 'recording'>('picker')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const handleSourceSelect = async (sourceId: string): Promise<void> => {
    try {
      // Electron's desktopCapturer requires non-standard constraints format
      const constraints = {
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          }
        },
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          }
        }
      } as unknown as MediaStreamConstraints

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)

      setStage('countdown')
      setCountdown(3)

      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval)
            beginRecording(mediaStream)
            return null
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      console.error('Screen recording error:', err)
      alert('Failed to start screen recording')
      onClose()
    }
  }

  const beginRecording = async (mediaStream: MediaStream): Promise<void> => {
    try {
      // Start floating recorder window
      await window.api.startFloatingRecorder()

      // Reset chunks array
      chunksRef.current = []

      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000 // 2.5 Mbps for better quality
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Ensure we have data
        if (chunksRef.current.length === 0) {
          console.error('No recording data available')
          alert('Recording failed: No data captured')
          await window.api.stopFloatingRecorder()
          onClose()
          return
        }

        const blob = new Blob(chunksRef.current, { type: 'video/webm' })

        // Verify blob has content
        if (blob.size === 0) {
          console.error('Recording blob is empty')
          alert('Recording failed: File is empty')
          await window.api.stopFloatingRecorder()
          onClose()
          return
        }

        console.log(`Recording complete: ${blob.size} bytes, ${chunksRef.current.length} chunks`)
        await window.api.stopFloatingRecorder()
        onRecordingComplete(blob)
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        alert('Recording error occurred')
      }

      mediaRecorder.start(1000) // Collect data every second
      mediaRecorderRef.current = mediaRecorder
      setStage('recording')
    } catch (err) {
      console.error('Recording start error:', err)
      alert('Failed to start recording')
      onClose()
    }
  }

  // Listen for stop event from floating window
  useEffect(() => {
    const handleStop = (): void => {
      if (mediaRecorderRef.current && stage === 'recording') {
        mediaRecorderRef.current.stop()
        if (stream) {
          stream.getTracks().forEach((track) => track.stop())
        }
      }
    }

    window.api.onStopRecording(handleStop)

    return () => {
      window.api.removeAllListeners('stop-recording')
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [stage, stream])

  if (stage === 'picker') {
    return <ScreenSourcePicker onSelect={handleSourceSelect} onCancel={onClose} />
  }

  if (stage === 'countdown' && countdown !== null) {
    return (
      <div className="countdown-overlay fullscreen">
        <div className="countdown-number">{countdown}</div>
        <p>Get ready to record...</p>
      </div>
    )
  }

  // During recording, render nothing (floating window handles UI)
  return <></>
}

export default ScreenRecorder
