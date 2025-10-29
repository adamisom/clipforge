import { useState, useRef, useEffect } from 'react'
import ScreenSourcePicker from './ScreenSourcePicker'

interface ScreenRecorderProps {
  onRecordingComplete: (blob: Blob) => void
  onClose: () => void
}

function ScreenRecorder({ onRecordingComplete, onClose }: ScreenRecorderProps): React.JSX.Element {
  const [stage, setStage] = useState<'picker' | 'countdown' | 'recording'>('picker')
  const [countdown, setCountdown] = useState<number | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const handleSourceSelect = async (sourceId: string): Promise<void> => {
    try {
      // Electron's desktopCapturer approach: pass sourceId to getUserMedia
      console.log('Requesting screen capture for source:', sourceId)

      const constraints = {
        audio: false, // Disable audio for now
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          }
        }
      } as unknown as MediaStreamConstraints

      console.log('getUserMedia constraints:', constraints)
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('Media stream obtained:', mediaStream)

      // Verify we got video tracks
      const videoTracks = mediaStream.getVideoTracks()
      console.log('Video tracks:', videoTracks.length, videoTracks)

      if (videoTracks.length === 0) {
        throw new Error('No video tracks in stream')
      }

      streamRef.current = mediaStream

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
      alert(
        'Failed to start screen recording: ' + (err instanceof Error ? err.message : String(err))
      )
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
        console.error('No video track available')
        alert('No video track available')
        await window.api.stopRecording()
        onClose()
        return
      }

      // Log all supported mimetypes
      const testTypes = [
        'video/webm',
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp8,opus',
        'video/mp4'
      ]
      console.log('Supported mimetypes:')
      testTypes.forEach((type) => {
        console.log(`  ${type}: ${MediaRecorder.isTypeSupported(type)}`)
      })

      // Use the absolute simplest configuration - NO timeslice
      console.log('Creating MediaRecorder with NO options...')
      const mediaRecorder = new MediaRecorder(mediaStream) // No options at all!

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
          console.error('No recording data available after stop')
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

        console.log(`Recording complete: ${blob.size} bytes, ${chunksRef.current.length} chunks`)
        await window.api.stopRecording()
        onRecordingComplete(blob)
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error event:', event)
        if (event.error) {
          console.error('Error details:', event.error)
        }
      }

      console.log('Starting MediaRecorder...')

      // Small delay to ensure stream is fully ready
      await new Promise((resolve) => setTimeout(resolve, 100))

      console.log('Calling mediaRecorder.start() with NO timeslice...')
      mediaRecorder.start() // NO timeslice - only get data when we call stop()

      // Check state after a brief moment
      setTimeout(() => {
        console.log('MediaRecorder state after 200ms:', mediaRecorder.state)
        if (mediaRecorder.state === 'inactive') {
          console.error('CRITICAL: MediaRecorder failed to start - still inactive after 200ms!')
          console.error('This usually means the codec/stream combination is not supported')
        }
      }, 200)

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
        // Don't stop stream here - let onstop handler do it
      }
    }

    window.api.onStopRecording(handleStop)

    return () => {
      window.api.removeAllListeners('stop-recording')
      // DON'T stop stream tracks in cleanup - this was causing premature stop!
      // Stream will be stopped in mediaRecorder.onstop handler
    }
  }, [stage])

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
