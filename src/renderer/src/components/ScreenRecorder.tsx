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
      // Minimize window, show notification, register shortcut
      await window.api.startRecording()

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

      // Try different codec options in order of preference
      let options: MediaRecorderOptions | undefined
      const codecs = [
        { mimeType: 'video/webm' }, // Let browser choose codec
        { mimeType: 'video/webm;codecs=vp8' },
        { mimeType: 'video/webm;codecs=h264' }
      ]

      for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec.mimeType)) {
          options = codec
          console.log('Using codec:', codec.mimeType)
          break
        }
      }

      if (!options) {
        console.warn('No preferred codec supported, using default')
        options = {}
      }

      const mediaRecorder = new MediaRecorder(mediaStream, options)

      mediaRecorder.ondataavailable = (event) => {
        console.log(
          'Data chunk received:',
          event.data.size,
          'bytes',
          'at',
          new Date().toISOString()
        )
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstart = () => {
        console.log('MediaRecorder onstart fired, state:', mediaRecorder.state)
      }

      mediaRecorder.onpause = () => {
        console.log('MediaRecorder paused')
      }

      mediaRecorder.onresume = () => {
        console.log('MediaRecorder resumed')
      }

      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder onstop fired')
        // Stop all tracks
        mediaStream.getTracks().forEach((track) => {
          console.log('Stopping track:', track.kind, track.id)
          track.stop()
        })
        // Ensure we have data
        if (chunksRef.current.length === 0) {
          console.error('No recording data available')
          alert('Recording failed: No data captured')
          await window.api.stopRecording()
          onClose()
          return
        }

        const blob = new Blob(chunksRef.current, { type: 'video/webm' })

        // Verify blob has content
        if (blob.size === 0) {
          console.error('Recording blob is empty')
          alert('Recording failed: File is empty')
          await window.api.stopRecording()
          onClose()
          return
        }

        console.log(`Recording complete: ${blob.size} bytes, ${chunksRef.current.length} chunks`)
        await window.api.stopRecording()
        onRecordingComplete(blob)
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        console.error('MediaRecorder state on error:', mediaRecorder.state)
        alert('Recording error occurred')
      }

      console.log('Starting MediaRecorder...')

      // Small delay to ensure stream is fully ready
      await new Promise((resolve) => setTimeout(resolve, 100))

      console.log('Calling mediaRecorder.start(1000)...')
      mediaRecorder.start(1000) // Collect data every second

      // Check state after a brief moment
      setTimeout(() => {
        console.log('MediaRecorder state after 100ms:', mediaRecorder.state)
        if (mediaRecorder.state === 'inactive') {
          console.error('MediaRecorder failed to start - still inactive!')
          alert('Recording failed to start. MediaRecorder went inactive immediately.')
        }
      }, 100)

      mediaRecorderRef.current = mediaRecorder
      setStage('recording')
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

  // During recording, show a simple indicator
  if (stage === 'recording') {
    return (
      <div className="recording-overlay">
        <div className="recording-indicator-box">
          <div className="recording-dot"></div>
          <p>Recording in progress</p>
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
