# ClipForge Phase 2: Implementation Plan & Task List (CORRECTED)

**Recording + Multi-Clip Timeline + Split + System Audio**

---

## Overview

This phase adds:

- **Recording**: Screen and webcam recording (one at a time)
- **System Audio**: Capture system audio during screen recording (macOS 13+)
- **Multi-Clip Timeline**: Support multiple clips that play sequentially
- **Split Functionality**: Split clips at playhead position
- **Temp File Management**: Smart cleanup of temporary recordings

---

## Design Decisions

### Recording UI

- **Floating recorder window** (separate BrowserWindow) during screen recording
- Main window minimizes when recording starts
- Floating window shows recording indicator and stop button
- **3-2-1 countdown** before recording begins
- **Screen picker** shows thumbnails of available screens/windows

⚠️ **Note on Floating Window**: If implementing separate BrowserWindow proves difficult, fallback options:

- **Option B**: Use built-in Electron overlay API (if available for macOS)
- **Option C**: Simplified - show recording bar at top of main window (don't minimize)

### File Handling

- Record to temp directory initially
- **Prompt to save** immediately after recording stops
- **Auto-add to timeline** regardless of save location
- **Warn on quit** if unsaved temp files exist
- **Visual indicator** (⚠️) on temp file clips

### Multi-Clip Behavior

- **Append to end** by default (new clips added sequentially)
- **Clips snap together** (no gaps between clips)
- **Timeline positions calculated dynamically** from clip order
- **Auto-play across clips** (continuous playback)

### Split Behavior

- **Cmd+K** keyboard shortcut (primary method)
- **Both pieces** remain on timeline after split
- **Visual indicator** shows where split will occur

### Export Options

- **Single clip**: Simple trim export
- **Multiple clips**: FFmpeg concat with file list (simpler than complex filter)

---

## New State Structure

```typescript
// src/renderer/src/types/timeline.ts

interface TimelineClip {
  id: string
  sourceType: 'imported' | 'screen' | 'webcam'
  sourcePath: string
  sourceStartTime: number // Trim start in source file (seconds)
  sourceDuration: number // Full duration of source file
  timelineDuration: number // Duration on timeline (after trim)
  metadata: {
    filename: string
    resolution: string
    codec: string
  }
}

// Note: timelinePosition is CALCULATED, not stored
// Helper function:
const calculateClipPositions = (clips: TimelineClip[]): Map<string, number> => {
  const positions = new Map()
  let pos = 0
  for (const clip of clips) {
    positions.set(clip.id, pos)
    pos += clip.timelineDuration
  }
  return positions
}

// Calculate total duration (derived state):
const totalDuration = clips.reduce((sum, clip) => sum + clip.timelineDuration, 0)
```

---

# 🟢 PHASE A: Foundation & Temp File Management

## ✅ TASK A.1: Create Temp File Manager

**📁 Files to create:**

- `src/main/utils/tempFileManager.ts`

**📁 Files to modify:**

- `src/main/index.ts`

**Full Implementation Code in `src/main/utils/tempFileManager.ts`:**

```typescript
import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'

const TEMP_DIR = path.join(app.getPath('temp'), 'clipforge-recordings')
const MAX_TEMP_SIZE = 5 * 1024 * 1024 * 1024  // 5 GB
const MAX_FILE_AGE = 7 * 24 * 60 * 60 * 1000  // 7 days

export async function initTempDir(): Promise<void> {
  await fs.mkdir(TEMP_DIR, { recursive: true })
}

export async function cleanupTempDir(referencedFiles: string[] = []): Promise<void> {
  try {
    const files = await fs.readdir(TEMP_DIR)
    const now = Date.now()

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file)

      if (referencedFiles.includes(filePath)) continue

      const stats = await fs.stat(filePath)

      if (now - stats.mtime.getTime() > MAX_FILE_AGE) {
        await fs.unlink(filePath)
        console.log(\`Deleted old temp file: \${file}\`)
      }
    }
  } catch (err) {
    console.error('Error cleaning temp dir:', err)
  }
}

export async function checkTempDirSize(): Promise<number> {
  try {
    const files = await fs.readdir(TEMP_DIR)
    let totalSize = 0

    for (const file of files) {
      const stats = await fs.stat(path.join(TEMP_DIR, file))
      totalSize += stats.size
    }

    return totalSize
  } catch (err) {
    console.error('Error checking temp dir size:', err)
    return 0
  }
}

export function getTempRecordingPath(): string {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
  return path.join(TEMP_DIR, \`clipforge-recording-\${timestamp}.webm\`)
}

export function isTempFile(filePath: string): boolean {
  return filePath.includes('clipforge-recordings')
}

export async function initializeOnAppStart(referencedFiles: string[]): Promise<void> {
  await initTempDir()
  await cleanupTempDir(referencedFiles)

  const size = await checkTempDirSize()
  if (size > MAX_TEMP_SIZE) {
    console.warn(\`Temp dir size (\${(size / 1024 / 1024 / 1024).toFixed(2)} GB) exceeds limit\`)
  }
}
```

**Modifications to `src/main/index.ts`:**

Add import at top:

```typescript
import { initializeOnAppStart } from './utils/tempFileManager'
```

Add in `app.whenReady()` BEFORE `createWindow()`:

```typescript
app.whenReady().then(async () => {
  await initializeOnAppStart([])

  electronApp.setAppUserModelId('com.electron')
  // ... rest
```

**🧪 CHECKPOINT A.1:**

- Run app: `npm run dev`
- Check `/tmp/clipforge-recordings/` directory exists
- Console should show no errors

---

## ✅ TASK A.2: Add IPC Handlers for Saving Blobs

**📁 Files to modify:**

- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`

**Add to `src/main/index.ts` (after existing IPC handlers):**

Add imports:

```typescript
import { getTempRecordingPath, checkTempDirSize } from './utils/tempFileManager'
import fs from 'fs'
```

Add handlers:

```typescript
  // Save recording blob to temp
  ipcMain.handle('save-recording-blob', async (_event, arrayBuffer: ArrayBuffer) => {
    try {
      const size = await checkTempDirSize()
      const MAX_SIZE = 5 * 1024 * 1024 * 1024

      if (size + arrayBuffer.byteLength > MAX_SIZE) {
        throw new Error('Temp directory size limit exceeded. Please save existing recordings.')
      }

      const tempPath = getTempRecordingPath()
      const buffer = Buffer.from(arrayBuffer)

      await fs.promises.writeFile(tempPath, buffer)
      console.log('Recording saved to temp:', tempPath)

      return tempPath
    } catch (err) {
      console.error('Error saving recording:', err)
      throw err
    }
  })

  // Save recording to permanent location
  ipcMain.handle('save-recording-permanent', async (_event, tempPath: string) => {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
    const result = await dialog.showSaveDialog({
      defaultPath: \`clipforge-recording-\${timestamp}.webm\`,
      filters: [{ name: 'WebM Video', extensions: ['webm'] }]
    })

    if (result.canceled || !result.filePath) {
      return { saved: false, path: tempPath }
    }

    try {
      await fs.promises.copyFile(tempPath, result.filePath)
      await fs.promises.unlink(tempPath)
      return { saved: true, path: result.filePath }
    } catch (err) {
      console.error('Error moving recording:', err)
      throw err
    }
  })
```

**Add to `src/preload/index.ts`:**

```typescript
  saveRecordingBlob: (arrayBuffer: ArrayBuffer) => ipcRenderer.invoke('save-recording-blob', arrayBuffer),
  saveRecordingPermanent: (tempPath: string) => ipcRenderer.invoke('save-recording-permanent', tempPath)
```

**Add to `src/preload/index.d.ts`:**

```typescript
saveRecordingBlob: (arrayBuffer: ArrayBuffer) => Promise<string>
saveRecordingPermanent: (tempPath: string) => Promise<{ saved: boolean; path: string }>
```

**🧪 CHECKPOINT A.2:**

- Run app, open DevTools
- Test: `await window.api.saveRecordingBlob(new ArrayBuffer(100))`
- Should return path like `/tmp/clipforge-recordings/clipforge-recording-2025-10-29T14-30-00.webm`

---

# 🟢 PHASE B: State Migration & Webcam Recording

## ✅ TASK B.0: Migrate to Multi-Clip State (DO THIS FIRST!)

**📁 Files to create:**

- `src/renderer/src/types/timeline.ts`

**📁 Files to modify:**

- `src/renderer/src/App.tsx`
- `src/renderer/src/components/ExportButton.tsx`

**Create `src/renderer/src/types/timeline.ts`:**

```typescript
export interface TimelineClip {
  id: string
  sourceType: 'imported' | 'screen' | 'webcam'
  sourcePath: string
  sourceStartTime: number
  sourceDuration: number
  timelineDuration: number
  metadata: {
    filename: string
    resolution: string
    codec: string
  }
}
```

**Modify `src/renderer/src/App.tsx`:**

Replace state:

```typescript
// REMOVE old VideoState

// ADD new state:
import { TimelineClip } from './types/timeline'

const [clips, setClips] = useState<TimelineClip[]>([])
const [playheadPosition, setPlayheadPosition] = useState(0)
const [isPlaying, setIsPlaying] = useState(false)

const totalDuration = clips.reduce((sum, clip) => sum + clip.timelineDuration, 0)

const generateClipId = (): string => {
  return \`clip-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`
}
```

Update `handleImport`:

```typescript
const handleImport = useCallback(async (): Promise<void> => {
  try {
    const filePath = await window.api.selectVideoFile()
    if (!filePath) return

    const metadata = await window.api.getVideoMetadata(filePath)

    const newClip: TimelineClip = {
      id: generateClipId(),
      sourceType: 'imported',
      sourcePath: filePath,
      sourceStartTime: 0,
      sourceDuration: metadata.duration,
      timelineDuration: metadata.duration,
      metadata: {
        filename: metadata.filename,
        resolution: \`\${metadata.width}x\${metadata.height}\`,
        codec: metadata.codec
      }
    }

    setClips(prev => [...prev, newClip])
  } catch (error) {
    console.error('Import failed:', error)
    alert(\`Failed to import video: \${error}\`)
  }
}, [])
```

Update WelcomeScreen condition:

```typescript
{clips.length === 0 ? (
  <WelcomeScreen onImport={handleImport} isDragging={isDragging} />
) : (
  <VideoEditor
    clips={clips}
    setClips={setClips}
    playheadPosition={playheadPosition}
    setPlayheadPosition={setPlayheadPosition}
    isPlaying={isPlaying}
    setIsPlaying={setIsPlaying}
  />
)}
```

**Modify `src/renderer/src/components/ExportButton.tsx`:**

```typescript
interface ExportButtonProps {
  hasClips: boolean
  onExport: () => void
  isExporting?: boolean
}

function ExportButton({ hasClips, onExport, isExporting = false }: ExportButtonProps) {
  const isDisabled = !hasClips || isExporting

  return (
    <button
      onClick={onExport}
      disabled={isDisabled}
      className="export-button"
    >
      {isExporting ? 'Exporting...' : 'Export Timeline'}
    </button>
  )
}
```

**Update VideoEditor (temporary - will refactor later):**

```typescript
function VideoEditor({
  clips,
  setClips,
  playheadPosition,
  setPlayheadPosition,
  isPlaying,
  setIsPlaying
}: {
  clips: TimelineClip[]
  setClips: React.Dispatch<React.SetStateAction<TimelineClip[]>>
  playheadPosition: number
  setPlayheadPosition: (pos: number) => void
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
}): React.JSX.Element {

  // For now, just show first clip
  const currentClip = clips[0]
  const totalDuration = clips.reduce((sum, c) => sum + c.timelineDuration, 0)

  const handleTrimChange = (newTrimStart: number, newTrimEnd: number): void => {
    setClips(prevClips => prevClips.map((clip, index) =>
      index === 0 ? {
        ...clip,
        sourceStartTime: newTrimStart,
        timelineDuration: newTrimEnd - newTrimStart
      } : clip
    ))
  }

  const handleExport = async (): Promise<void> => {
    if (clips.length === 0) return

    const outputPath = await window.api.selectSavePath()
    if (!outputPath) return

    // For now, export first clip only
    await window.api.exportVideo(
      currentClip.sourcePath,
      outputPath,
      currentClip.sourceStartTime,
      currentClip.timelineDuration
    )
  }

  return (
    <div className="video-editor">
      <div className="preview-panel">
        {currentClip ? (
          <VideoPreview
            sourcePath={currentClip.sourcePath}
            trimStart={currentClip.sourceStartTime}
            trimEnd={currentClip.sourceStartTime + currentClip.timelineDuration}
            playheadPosition={playheadPosition}
            isPlaying={isPlaying}
            onPlayPause={() => setIsPlaying(!isPlaying)}
            onTimeUpdate={(time) => setPlayheadPosition(time)}
          />
        ) : null}
      </div>

      {/* Temporarily pass first clip data to Timeline */}
      <Timeline
        duration={totalDuration}
        trimStart={currentClip ? currentClip.sourceStartTime : 0}
        trimEnd={currentClip ? currentClip.sourceStartTime + currentClip.timelineDuration : 0}
        playheadPosition={playheadPosition}
        onTrimChange={handleTrimChange}
        onPlayheadChange={setPlayheadPosition}
      />

      <div className="info-panel">
        <div className="info-content">
          <h3>Video Info</h3>
          <div className="info-item">
            <strong>Clips:</strong> {clips.length}
          </div>
          {currentClip && (
            <>
              <div className="info-item">
                <strong>File:</strong> {currentClip.metadata.filename}
              </div>
              <div className="info-item">
                <strong>Resolution:</strong> {currentClip.metadata.resolution}
              </div>
            </>
          )}
        </div>

        <ExportButton
          hasClips={clips.length > 0}
          onExport={handleExport}
        />
      </div>
    </div>
  )
}
```

**Update drag-and-drop handler in App.tsx:**

```typescript
const handleDrop = async (e: React.DragEvent): Promise<void> => {
  e.preventDefault()
  setIsDragging(false)

  const files = Array.from(e.dataTransfer.files)
  const videoFiles = files.filter((file) => {
    const ext = file.name.toLowerCase().split('.').pop()
    return ['mp4', 'mov'].includes(ext || '')
  })

  if (videoFiles.length === 0) {
    alert('Please drop a video file (MP4 or MOV)')
    return
  }

  const filePath = (videoFiles[0] as File & { path: string }).path
  if (!filePath) return

  try {
    const metadata = await window.api.getVideoMetadata(filePath)

    const newClip: TimelineClip = {
      id: generateClipId(),
      sourceType: 'imported',
      sourcePath: filePath,
      sourceStartTime: 0,
      sourceDuration: metadata.duration,
      timelineDuration: metadata.duration,
      metadata: {
        filename: metadata.filename,
        resolution: \`\${metadata.width}x\${metadata.height}\`,
        codec: metadata.codec
      }
    }

    setClips(prev => [...prev, newClip])
  } catch (error) {
    console.error('Drag-and-drop import failed:', error)
    alert(\`Failed to import video: \${error}\`)
  }
}
```

**🧪 CHECKPOINT B.0:**

- App compiles with TypeScript
- Import one video → should work
- Clip appears in timeline (might look same as before)
- console.log(clips) → should show array with one clip

---

## ✅ TASK B.1: Create Webcam Recording Component

**📁 Files to create:**

- `src/renderer/src/components/WebcamRecorder.tsx`

**Full implementation:**

```typescript
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
        streamRef.current.getTracks().forEach(track => track.stop())
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
      setCountdown(prev => {
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

      mediaRecorder.start(1000) // Collect data every second
      mediaRecorderRef.current = mediaRecorder
      setStage('recording')

      // Start recording timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
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
      streamRef.current.getTracks().forEach(track => track.stop())
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return \`\${mins}:\${secs.toString().padStart(2, '0')}\`
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
        <video
          ref={videoRef}
          autoPlay
          muted
          className="webcam-preview"
        />

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
```

**🧪 CHECKPOINT B.1:**

- Create temp test to render component
- Webcam preview should show
- Countdown should work
- Recording should capture

---

## ✅ TASK B.2: Add Webcam Recording Styles

**📁 Files to modify:**

- `src/renderer/src/assets/main.css`

**Add CSS:**

```css
/* Webcam Recorder */
.webcam-recorder-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.webcam-recorder-modal {
  position: relative;
  width: 640px;
  max-width: 90vw;
}

.webcam-preview {
  width: 100%;
  border-radius: 12px;
  background: #000;
}

.countdown-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 12px;
}

.countdown-number {
  font-size: 120px;
  font-weight: bold;
  color: #ffffff;
  animation: countdown-pulse 1s ease-in-out;
}

@keyframes countdown-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

.recording-indicator {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
  font-weight: 500;
}

.recording-dot {
  color: #ff3b30;
  font-size: 16px;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}

.webcam-controls {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
}

.webcam-controls button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.start-button {
  background: #646cff;
  color: white;
}

.start-button:hover {
  background: #535bf2;
}

.stop-button {
  background: #ff3b30;
  color: white;
}

.stop-button:hover {
  background: #e02d20;
}

.cancel-button {
  background: #444;
  color: white;
}

.cancel-button:hover {
  background: #555;
}

.error-message {
  color: white;
  text-align: center;
  padding: 40px;
}
```

---

## ✅ TASK B.3: Integrate Webcam Recorder into App

**📁 Files to modify:**

- `src/renderer/src/App.tsx`

Add state:

```typescript
const [showWebcamRecorder, setShowWebcamRecorder] = useState(false)
```

Add handler:

```typescript
const handleWebcamRecordingComplete = async (blob: Blob): Promise<void> => {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const tempPath = await window.api.saveRecordingBlob(arrayBuffer)

    const result = await window.api.saveRecordingPermanent(tempPath)
    const finalPath = result.path

    const metadata = await window.api.getVideoMetadata(finalPath)

    const newClip: TimelineClip = {
      id: generateClipId(),
      sourceType: 'webcam',
      sourcePath: finalPath,
      sourceStartTime: 0,
      sourceDuration: metadata.duration,
      timelineDuration: metadata.duration,
      metadata: {
        filename: metadata.filename,
        resolution: \`\${metadata.width}x\${metadata.height}\`,
        codec: metadata.codec
      }
    }

    setClips(prev => [...prev, newClip])
    setShowWebcamRecorder(false)
  } catch (error) {
    console.error('Failed to save recording:', error)
    alert(\`Failed to save recording: \${error}\`)
    setShowWebcamRecorder(false)
  }
}
```

Render modal:

```typescript
{showWebcamRecorder && (
  <WebcamRecorder
    onRecordingComplete={handleWebcamRecordingComplete}
    onClose={() => setShowWebcamRecorder(false)}
  />
)}
```

Add test button:

```typescript
<button
  onClick={() => setShowWebcamRecorder(true)}
  style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 999 }}
>
  Test Webcam
</button>
```

**🧪 CHECKPOINT B.3:**

- Click test button → record webcam
- Save dialog appears
- Recording added to clips array
- Verify with console.log(clips)

---

# 🟢 PHASE C: Screen Recording with Floating Window

## ✅ TASK C.1: Add IPC Handler for Screen Sources

**📁 Files to modify:**

- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`

**Add to `src/main/index.ts`:**

```typescript
import { desktopCapturer } from 'electron'

// Add IPC handler
ipcMain.handle('get-screen-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 300, height: 200 }
  })

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL()
  }))
})
```

**Add to `src/preload/index.ts`:**

```typescript
getScreenSources: () => ipcRenderer.invoke('get-screen-sources')
```

**Add to `src/preload/index.d.ts`:**

```typescript
interface ScreenSource {
  id: string
  name: string
  thumbnail: string
}

getScreenSources: () => Promise<ScreenSource[]>
```

**🧪 CHECKPOINT C.1:**

- Run app, open DevTools
- Test: `await window.api.getScreenSources()`
- Should return array of screen/window sources

---

## ✅ TASK C.2: Create Screen Source Picker Component

**📁 Files to create:**

- `src/renderer/src/components/ScreenSourcePicker.tsx`

**Full implementation:**

```typescript
import { useState, useEffect } from 'react'

interface ScreenSource {
  id: string
  name: string
  thumbnail: string
}

interface ScreenSourcePickerProps {
  onSelect: (sourceId: string) => void
  onCancel: () => void
}

function ScreenSourcePicker({ onSelect, onCancel }: ScreenSourcePickerProps) {
  const [sources, setSources] = useState<ScreenSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSources = async (): Promise<void> => {
      try {
        const availableSources = await window.api.getScreenSources()
        setSources(availableSources)
        setLoading(false)
      } catch (err) {
        console.error('Failed to get screen sources:', err)
        setError('Failed to load screen sources')
        setLoading(false)
      }
    }

    fetchSources()
  }, [])

  if (loading) {
    return (
      <div className="screen-source-picker-overlay">
        <div className="screen-source-picker-modal">
          <h2>Loading sources...</h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="screen-source-picker-overlay">
        <div className="screen-source-picker-modal">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={onCancel}>Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-source-picker-overlay">
      <div className="screen-source-picker-modal">
        <h2>Select Screen or Window</h2>

        <div className="source-grid">
          {sources.map(source => (
            <div
              key={source.id}
              className="source-item"
              onClick={() => onSelect(source.id)}
            >
              <img
                src={source.thumbnail}
                alt={source.name}
                className="source-thumbnail"
              />
              <p className="source-name">{source.name}</p>
            </div>
          ))}
        </div>

        <button onClick={onCancel} className="cancel-button">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default ScreenSourcePicker
```

**🧪 CHECKPOINT C.2:**

- Render component in test
- Should show grid of available screens/windows
- Thumbnails should display
- Click should trigger onSelect callback

---

## ✅ TASK C.3: Add Screen Source Picker Styles

**📁 Files to modify:**

- `src/renderer/src/assets/main.css`

**Add CSS:**

```css
/* Screen Source Picker */
.screen-source-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.screen-source-picker-modal {
  background: #2a2a2a;
  border-radius: 12px;
  padding: 24px;
  max-width: 800px;
  max-height: 600px;
  overflow-y: auto;
}

.screen-source-picker-modal h2 {
  margin-top: 0;
  color: #ffffff;
  margin-bottom: 20px;
}

.source-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.source-item {
  background: #1a1a1a;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.source-item:hover {
  border-color: #646cff;
  transform: translateY(-2px);
}

.source-thumbnail {
  width: 100%;
  height: auto;
  border-radius: 4px;
  margin-bottom: 8px;
}

.source-name {
  color: #ffffff;
  font-size: 14px;
  margin: 0;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

---

## ✅ TASK C.4: Create Floating Recorder Window Infrastructure

**📁 Files to create:**

- `src/main/floatingRecorder.ts`
- `src/renderer/floating-recorder.html`
- `src/renderer/src/FloatingRecorder.tsx`

**📁 Files to modify:**

- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`

⚠️ **This is the complex part - if trouble is encountered, consider:**

- **Option B**: Check if Electron has overlay API for macOS
- **Option C**: Simplify to just show recording bar at top of main window (no minimize)

**Create `src/main/floatingRecorder.ts`:**

```typescript
import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let floatingWindow: BrowserWindow | null = null

export function createFloatingRecorder(): void {
  if (floatingWindow) return

  floatingWindow = new BrowserWindow({
    width: 320,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    floatingWindow.loadURL(\`\${process.env['ELECTRON_RENDERER_URL']}/floating-recorder.html\`)
  } else {
    floatingWindow.loadFile(join(__dirname, '../renderer/floating-recorder.html'))
  }

  floatingWindow.on('closed', () => {
    floatingWindow = null
  })
}

export function updateFloatingRecorderTime(seconds: number): void {
  if (floatingWindow) {
    floatingWindow.webContents.send('recording-time-update', seconds)
  }
}

export function closeFloatingRecorder(): void {
  if (floatingWindow) {
    floatingWindow.close()
    floatingWindow = null
  }
}

export function getFloatingWindow(): BrowserWindow | null {
  return floatingWindow
}
```

**Add IPC handlers in `src/main/index.ts`:**

```typescript
import {
  createFloatingRecorder,
  closeFloatingRecorder,
  updateFloatingRecorderTime
} from './floatingRecorder'

ipcMain.handle('start-floating-recorder', () => {
  createFloatingRecorder()
  const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isAlwaysOnTop())
  if (mainWindow) mainWindow.minimize()
})

ipcMain.handle('stop-floating-recorder', () => {
  closeFloatingRecorder()
  const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isAlwaysOnTop())
  if (mainWindow) {
    mainWindow.restore()
    mainWindow.focus()
  }
})

ipcMain.handle('stop-recording-from-floating', () => {
  // Send event to main window to stop recording
  const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isAlwaysOnTop())
  if (mainWindow) {
    mainWindow.webContents.send('stop-recording')
  }
})
```

**Create `src/renderer/floating-recorder.html`:**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Recording</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        background: transparent;
        -webkit-app-region: drag;
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
      }
      .floating-recorder {
        background: rgba(0, 0, 0, 0.9);
        border-radius: 24px;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        backdrop-filter: blur(10px);
      }
      .recording-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        color: white;
      }
      .recording-dot {
        color: #ff3b30;
        font-size: 16px;
        animation: blink 1s infinite;
      }
      @keyframes blink {
        0%,
        50% {
          opacity: 1;
        }
        51%,
        100% {
          opacity: 0;
        }
      }
      .stop-button {
        -webkit-app-region: no-drag;
        background: #ff3b30;
        color: white;
        border: none;
        padding: 6px 16px;
        border-radius: 16px;
        font-size: 13px;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div class="floating-recorder">
      <div class="recording-indicator">
        <span class="recording-dot">●</span>
        <span id="time">0:00</span>
      </div>
      <button class="stop-button" onclick="stopRecording()">Stop</button>
    </div>
    <script>
      let seconds = 0
      setInterval(() => {
        seconds++
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        document.getElementById('time').textContent = \`\${mins}:\${secs.toString().padStart(2, '0')}\`
      }, 1000)

      function stopRecording() {
        // Send IPC message directly (window.api is exposed via preload)
        if (window.api && window.api.stopRecordingFromFloating) {
          window.api.stopRecordingFromFloating()
        } else {
          console.error('API not available')
        }
      }
    </script>
  </body>
</html>
```

**Add to preload API (`src/preload/index.ts`):**

```typescript
  startFloatingRecorder: () => ipcRenderer.invoke('start-floating-recorder'),
  stopFloatingRecorder: () => ipcRenderer.invoke('stop-floating-recorder'),
  stopRecordingFromFloating: () => ipcRenderer.invoke('stop-recording-from-floating'),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback)
```

**Add to preload types (`src/preload/index.d.ts`):**

```typescript
    startFloatingRecorder: () => Promise<void>
    stopFloatingRecorder: () => Promise<void>
    stopRecordingFromFloating: () => Promise<void>
    onStopRecording: (callback: () => void) => void
```

**🧪 CHECKPOINT C.4:**

- Test floating window creation independently
- Should appear as small window at top
- Should stay on top of all windows
- Stop button should be clickable

---

## ✅ TASK C.5: Create Screen Recorder Component with Floating Integration

**📁 Files to create:**

- `src/renderer/src/components/ScreenRecorder.tsx`

```typescript
import { useState, useRef, useEffect } from 'react'
import ScreenSourcePicker from './ScreenSourcePicker'

interface ScreenRecorderProps {
  onRecordingComplete: (blob: Blob) => void
  onClose: () => void
}

function ScreenRecorder({ onRecordingComplete, onClose }: ScreenRecorderProps) {
  const [stage, setStage] = useState<'picker' | 'countdown' | 'recording'>('picker')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const handleSourceSelect = async (sourceId: string): Promise<void> => {
    try {
      const constraints: any = {
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
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)

      setStage('countdown')
      setCountdown(3)

      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
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

      const mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm;codecs=vp9' })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        await window.api.stopFloatingRecorder()
        onRecordingComplete(blob)
      }

      mediaRecorder.start(1000)
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
    const handleStop = () => {
      if (mediaRecorderRef.current && stage === 'recording') {
        mediaRecorderRef.current.stop()
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }
      }
    }

    window.api.onStopRecording(handleStop)

    return () => {
      window.api.removeAllListeners('stop-recording')
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
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
  return null
}

export default ScreenRecorder
```

**🧪 CHECKPOINT C.5:**

- Select screen source
- Countdown should show
- Main window minimizes
- Floating window appears
- Recording captures screen
- Stop button works

---

## ✅ TASK C.6: Integrate Screen Recorder into App

Similar to webcam integration but for screen:

```typescript
const handleScreenRecordingComplete = async (blob: Blob): Promise<void> => {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const tempPath = await window.api.saveRecordingBlob(arrayBuffer)

    const result = await window.api.saveRecordingPermanent(tempPath)
    const finalPath = result.path

    const metadata = await window.api.getVideoMetadata(finalPath)

    const newClip: TimelineClip = {
      id: generateClipId(),
      sourceType: 'screen',
      sourcePath: finalPath,
      sourceStartTime: 0,
      sourceDuration: metadata.duration,
      timelineDuration: metadata.duration,
      metadata: {
        filename: metadata.filename,
        resolution: \`\${metadata.width}x\${metadata.height}\`,
        codec: metadata.codec
      }
    }

    setClips(prev => [...prev, newClip])
    setShowScreenRecorder(false)
  } catch (error) {
    console.error('Failed to save screen recording:', error)
    alert(\`Failed to save recording: \${error}\`)
    setShowScreenRecorder(false)
  }
}
```

**🧪 CHECKPOINT C.6:**

- Full screen recording workflow works
- Recording added to clips array
- Can record multiple clips

---

# 🟢 PHASE D-H: Multi-Clip Timeline, Playback, Split, Export & Polish

## 📝 Implementation Note

**Phases D through H build on the multi-clip state created in Phase B.**

The key corrections for these phases are shown below. For full implementation details:

1. Refer to the MVP implementation patterns (similar component structure)
2. Apply the state changes shown in the corrections
3. Use the corrected code snippets as the foundation

The main differences from MVP:

- Timeline now works with `clips[]` array instead of single `videoState`
- VideoPreview dynamically switches sources based on playhead position
- Export logic chooses between single-clip and multi-clip handlers

---

## Key Corrections for Remaining Phases:

### D.3 - Timeline Position Calculation:

```typescript
// In Timeline.tsx, calculate positions dynamically:
const clipPositions = useMemo(() => {
  const positions = new Map<string, number>()
  let pos = 0
  for (const clip of clips) {
    positions.set(clip.id, pos)
    pos += clip.timelineDuration
  }
  return positions
}, [clips])

// Use in TimelineClip:
<TimelineClip
  clip={clip}
  position={clipPositions.get(clip.id) || 0}
  pixelsPerSecond={pixelsPerSecond}
/>
```

### F.1 - Split Function (CORRECTED):

```typescript
const handleSplitClip = (): void => {
  if (!currentClip) return

  const posInClip = getPositionInClip(currentClip)

  if (posInClip < 0.1 || posInClip > currentClip.timelineDuration - 0.1) {
    alert('Cannot split near clip edges')
    return
  }

  setClips((prevClips) => {
    const clipIndex = prevClips.findIndex((c) => c.id === currentClip.id)
    if (clipIndex === -1) return prevClips

    const leftClip: TimelineClip = {
      ...currentClip,
      id: generateClipId(),
      timelineDuration: posInClip
    }

    const rightClip: TimelineClip = {
      ...currentClip,
      id: generateClipId(),
      sourceStartTime: currentClip.sourceStartTime + posInClip,
      timelineDuration: currentClip.timelineDuration - posInClip
    }

    // Replace clip at index with two new clips
    const newClips = [
      ...prevClips.slice(0, clipIndex),
      leftClip,
      rightClip,
      ...prevClips.slice(clipIndex + 1)
    ]

    return newClips
  })
}
```

### G.1 - FFmpeg Export (SIMPLIFIED):

```typescript
import path from 'path'
import os from 'os'
import fs from 'fs'

ipcMain.handle('export-multi-clip', async (_event, { clips, outputPath }) => {
  const mainWindow = BrowserWindow.getAllWindows()[0]

  // Create concat file list
  const concatFilePath = path.join(os.tmpdir(), 'clipforge-concat.txt')
  let concatContent = ''

  for (const clip of clips) {
    // Escape single quotes in path for concat demuxer
    const escapedPath = clip.sourcePath.replace(/'/g, "\\'")
    concatContent += \`file '\${escapedPath}'\n\`
    concatContent += \`inpoint \${clip.sourceStartTime}\n\`
    concatContent += \`outpoint \${clip.sourceStartTime + clip.timelineDuration}\n\`
  }

  await fs.promises.writeFile(concatFilePath, concatContent)

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatFilePath)
      .inputOptions(['-f concat', '-safe 0'])
      // NOTE: inpoint/outpoint require re-encoding, cannot use -c copy
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-c:a aac',
        '-b:a 192k'
      ])
      .output(outputPath)
      .on('progress', (progress) => {
        mainWindow.webContents.send('export-progress', progress)
      })
      .on('end', () => {
        fs.promises.unlink(concatFilePath).catch(() => {})
        mainWindow.webContents.send('export-complete')
        resolve({ success: true })
      })
      .on('error', (err) => {
        fs.promises.unlink(concatFilePath).catch(() => {})
        mainWindow.webContents.send('export-error', { message: err.message })
        reject(err)
      })
      .run()
  })
})
```

### H.1 - App Quit Handler (FIXED):

```typescript
let quitting = false

app.on('before-quit', async (e) => {
  if (quitting) return

  e.preventDefault()

  const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isAlwaysOnTop())
  if (!mainWindow) {
    quitting = true
    app.quit()
    return
  }

  // Check for temp files with timeout
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(false), 2000))

  const checkPromise = new Promise((resolve) => {
    mainWindow.webContents.send('check-unsaved-recordings')
    ipcMain.once('unsaved-recordings-response', (_event, { hasTempFiles }) => {
      resolve(hasTempFiles)
    })
  })

  const hasTempFiles = await Promise.race([checkPromise, timeoutPromise])

  if (hasTempFiles) {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Quit Anyway', 'Cancel'],
      defaultId: 1,
      title: 'Unsaved Recordings',
      message: 'You have unsaved recordings in temporary storage.',
      detail: 'These recordings will be deleted. Make sure to save or export first.'
    })

    if (response.response === 0) {
      quitting = true
      app.quit()
    }
  } else {
    quitting = true
    app.quit()
  }
})
```

---

## Task Summary (UPDATED)

**Total Tasks:** 40 tasks across 8 phases
**Estimated Time:** 28-35 hours (added 3-5 hours for floating window)

### Phase Breakdown:

- **Phase A:** Foundation (2 tasks, ~2 hours)
- **Phase B:** State Migration + Webcam (4 tasks, ~4 hours)
- **Phase C:** Screen Recording + Floating Window (6 tasks, ~7 hours)
- **Phase D:** Multi-Clip Timeline (4 tasks, ~4 hours)
- **Phase E:** Multi-Clip Playback (2 tasks, ~2 hours)
- **Phase F:** Split Functionality (2 tasks, ~2 hours)
- **Phase G:** Multi-Clip Export (2 tasks, ~2 hours)
- **Phase H:** Polish & Cleanup (4 tasks, ~2 hours)

---

## FINAL COMPREHENSIVE TEST

(Same as original - checkpoints are correct)

---

**Document Version:** 2.0 (CORRECTED)
**Created:** October 29, 2025
**Last Updated:** October 29, 2025
**Status:** Ready for implementation
