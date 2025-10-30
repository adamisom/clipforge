# ClipForge Architecture Document

## Overview

ClipForge is a desktop video editor built with Electron and React. This document describes the high-level architecture, data flow, and key design decisions for the MVP and Phase 2 implementation.

**Current Status**: MVP + Phase 2 Complete
- ✅ Basic video editing (import, trim, export)
- ✅ Multi-clip timeline support
- ✅ Screen and webcam recording
- ✅ Split functionality
- ✅ Drag-and-drop import
- ✅ Temp file management

---

## System Architecture

### Three-Process Model

ClipForge follows Electron's standard three-process architecture:

1. **Main Process** (`src/main/index.ts`)
   - Node.js process with full system access
   - Handles file I/O, FFmpeg operations, window management, recording controls
   - Manages temp file cleanup and app quit warnings
   - Entry point: `electron .`

2. **Renderer Process** (`src/renderer/`)
   - React application running in Chromium
   - Handles UI, user interactions, visual feedback, recording UI
   - Multi-clip state management with `clips[]` array
   - Has NO direct Node.js access (security)

3. **Preload Script** (`src/preload/index.ts`)
   - Bridge between main and renderer
   - Exposes secure API via `contextBridge`
   - Runs in isolated context

### Security Model

```typescript
// Main process (src/main/index.ts)
webPreferences: {
  contextIsolation: true,     // Isolates renderer
  nodeIntegration: false,     // No Node.js in renderer
  preload: join(__dirname, '../preload/index.js')  // Bridge
}
```

**Why**: Prevents XSS attacks. Renderer cannot access file system or Node.js APIs. All access goes through preload bridge.

---

## Data Flow

### Import Workflow

```
User clicks Import (or drags file)
    ↓
Renderer: calls window.api.selectVideoFile()
    ↓
Preload: ipcRenderer.invoke('select-video-file')
    ↓
Main: Shows file picker dialog
    ↓
Main: Returns file path to renderer
    ↓
Renderer: calls window.api.getVideoMetadata(filePath)
    ↓
Main: Runs ffprobe to extract metadata
    ↓
Main: Returns { duration, width, height, codec, filename }
    ↓
Renderer: Creates TimelineClip, adds to clips[] array
```

**Key Points**:

- All file operations happen in main process
- Metadata extraction (ffprobe) returns filename to avoid using `path` module in renderer
- Each clip gets unique ID and is added to clips array
- Drag-and-drop uses same metadata extraction flow

### Recording Workflow (Screen/Webcam)

```
User clicks "Test Screen" or "Test Webcam"
    ↓
Renderer: Shows ScreenRecorder or WebcamRecorder component
    ↓
[Screen Only] Renderer: Fetches available sources via window.api.getScreenSources()
    ↓
[Screen Only] Main: Uses desktopCapturer API, returns source list with thumbnails
    ↓
[Screen Only] User selects source → Countdown → Window minimizes (if not recording self)
    ↓
Renderer: Uses getUserMedia() to capture MediaStream
    ↓
Renderer: MediaRecorder records to Blob
    ↓
[Screen Only] Main: Shows notification + registers Cmd+Shift+S shortcut
    ↓
User stops recording (button or shortcut)
    ↓
Renderer: Converts Blob to ArrayBuffer, calls window.api.saveRecordingBlob()
    ↓
Main: Writes to temp directory (/tmp/clipforge-recording-YYYY-MM-DD-HH-MM-SS.webm)
    ↓
Main: Returns temp path
    ↓
Renderer: Prompts user to save permanently via window.api.saveRecordingPermanent()
    ↓
Main: Shows save dialog, copies temp file to chosen location
    ↓
Renderer: Gets metadata, creates TimelineClip with temp or permanent path
    ↓
Renderer: Adds to clips[] array, displays ⚠️ if still temp
```

**Key Points**:

- Recording happens in renderer (MediaRecorder API)
- File writing happens in main process
- Temp files get orange border + ⚠️ indicator on timeline
- Screen recording uses notification + global shortcut for better UX
- Window minimize logic skips if recording ClipForge/Electron itself

### Multi-Clip Export Workflow

```
User clicks Export (with multiple clips)
    ↓
Renderer: Checks clips.length
    ↓
If single clip: window.api.exportVideo() (simple trim)
If multiple clips: window.api.exportMultiClip(clips, outputPath)
    ↓
Main: Detects if any clips have trimming
    ↓
[No Trimming] FFmpeg concat demuxer with -c copy (fast)
[With Trimming] FFmpeg complex filter: trim each + concat (re-encode)
    ↓
Main: Creates temp concat list file if needed
    ↓
Main: Executes FFmpeg, sends progress via webContents.send()
    ↓
Renderer: Updates UI with progress
    ↓
Main: Cleans up temp files, sends completion event
    ↓
Renderer: Shows success message
```

**Key Points**:

- Export automatically chooses optimal method based on trimming
- Simple concat is much faster (no re-encoding) when no trimming
- Complex filter handles per-clip trimming + concatenation in one pass

### Export Workflow

```
User clicks Export
    ↓
Renderer: calls window.api.selectSavePath()
    ↓
Main: Shows save dialog
    ↓
Main: Returns output path
    ↓
Renderer: calls window.api.exportVideo(params)
    ↓
Main: Configures FFmpeg with trim parameters
    ↓
Main: Executes FFmpeg, sends progress via webContents.send()
    ↓
Renderer: Updates UI with progress
    ↓
Main: Sends completion event
    ↓
Renderer: Shows success message
```

**Key Points**:

- Export runs in main process (doesn't block renderer)
- Progress communication uses `webContents.send()`, not IPC return values
- User can't interact with timeline during export (UI disabled)

### Multi-Clip Playback Workflow

```
User clicks Play (with multiple clips on timeline)
    ↓
Renderer: Calculates which clip playhead is currently in
    ↓
Renderer: Passes currentClip + relativePlayheadPosition to VideoPreview
    ↓
VideoPreview: Plays from currentClip.sourceStartTime + relativePosition
    ↓
Video fires onTimeUpdate events
    ↓
Renderer: Updates absolute playheadPosition
    ↓
When clip ends: Renderer checks for next clip
    ↓
If next clip exists: Advance playhead to next clip's start
If no next clip: Stop playback at timeline end
    ↓
VideoPreview: Re-mounts with new clip source (key={currentClip.id})
    ↓
Timeline: Re-renders playhead position
```

**Key Constraints**:

- Playhead represents absolute position across all clips
- VideoPreview shows relative position within current clip
- Seamless transitions between clips via key prop forcing re-mount
- Auto-advance stops at timeline end

### Split Workflow

```
User positions playhead mid-clip, presses Cmd+K
    ↓
Renderer: Calculates split point relative to source video
    ↓
Renderer: Creates two new TimelineClip objects:
  - First: sourceStartTime unchanged, duration = playhead position
  - Second: sourceStartTime = splitPoint, duration = remaining time
    ↓
Renderer: Replaces original clip in clips[] array
    ↓
Timeline: Re-renders showing two clips with boundary
```

**Key Points**:

- Split doesn't modify source file, only clip metadata
- Both resulting clips reference the same source file
- Each clip gets unique ID for independent trimming

### Playback Workflow

```
User clicks Play
    ↓
Renderer: Sets videoState.isPlaying = true
    ↓
HTML5 Video: Starts playback
    ↓
Video fires onTimeUpdate events
    ↓
Renderer: Updates playheadPosition = currentTime - trimStart
    ↓
Timeline: Re-renders playhead position
```

**Key Constraints**:

- Video always plays from `trimStart` to `trimEnd`
- Playhead represents position in trimmed section (0 to trimmed duration)
- Playback is constrained to trimmed region

### Scrubbing Workflow

```
User drags playhead
    ↓
Renderer: Calculates new playhead position from mouse X
    ↓
Clamp: playheadPosition to 0 ≤ pos ≤ (trimEnd - trimStart)
    ↓
Renderer: Sets video.currentTime = trimStart + playheadPosition
    ↓
Video: Seeks to new position
    ↓
Preview updates to show frame at new position
```

**Key Constraints**:

- Playhead cannot go outside trimmed section
- Dragging outside timeline rectangle handled by global mouseup event
- Smooth scrubbing uses `requestAnimationFrame`

---

## State Management

### State Structure

```typescript
interface VideoState {
  sourcePath: string | null // File path on disk
  duration: number // Full video duration (seconds)
  trimStart: number // Trim start point (0 to duration)
  trimEnd: number // Trim end point (trimStart to duration)
  playheadPosition: number // Position in trimmed section (0 to trimmed duration)
  isPlaying: boolean // Playback state
  metadata: {
    filename: string // Extracted in main process
    resolution: string // e.g., "1920x1080"
  }
}
```

### State Relationships

**Critical Invariants**:

1. `trimStart < trimEnd` (must be strictly less)
2. `0 ≤ trimStart ≤ duration`
3. `trimStart ≤ trimEnd ≤ duration`
4. `0 ≤ playheadPosition ≤ (trimEnd - trimStart)`
5. `video.currentTime = trimStart + playheadPosition`

### State Updates

```typescript
// Using React useState
const [videoState, setVideoState] = useState<VideoState>({
  sourcePath: null,
  duration: 0,
  trimStart: 0,
  trimEnd: 0,
  playheadPosition: 0,
  isPlaying: false,
  metadata: { filename: '', resolution: '' }
})

// Updates use functional form to avoid stale closures
setVideoState((prev) => ({ ...prev, trimStart: newStart }))
```

**Why**: Functional updates prevent race conditions and ensure latest state is used.

---

## Component Hierarchy

```
App
  ├─ WelcomeScreen (when no video)
  │   ├─ Import Button
  │   └─ Drag-and-Drop Zone
  │
  └─ VideoEditor (when video loaded)
      ├─ VideoPreview
      │   ├─ <video> element
      │   └─ Play/Pause button
      │
      ├─ Timeline
      │   ├─ TimeRuler (shows seconds)
      │   ├─ Playhead (vertical red line)
      │   └─ TimelineClip
      │       ├─ Clip visualization
      │       ├─ Left trim handle
      │       └─ Right trim handle
      │
      ├─ VideoInfo
      │   ├─ Filename display
      │   ├─ Resolution display
      │   └─ Trim range display
      │
      └─ ExportButton
```

**Key Components**:

- **TimelineClip**: Simple div with transform-based positioning for performance
- **Playhead**: Always positioned above timeline track for visual clarity
- **Trim handles**: Small draggable areas on clip edges (West/East)

---

## IPC Communication

### Main Process Handlers

```typescript
// File selection
ipcMain.handle('select-video-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mov'] }]
  })
  return result.canceled ? null : result.filePaths[0]
})

// Metadata extraction
ipcMain.handle('get-video-metadata', async (event, path) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, metadata) => {
      if (err) return reject(err)
      const videoStream = metadata.streams.find((s) => s.codec_type === 'video')
      resolve({
        duration: metadata.format.duration,
        width: videoStream.width,
        height: videoStream.height,
        codec: videoStream.codec_name,
        filename: path.split(/[/\\]/).pop()
      })
    })
  })
})

// Export with progress communication
ipcMain.handle('export-video', async (event, { sourcePath, outputPath, trimStart, duration }) => {
  const mainWindow = BrowserWindow.getAllWindows()[0]

  ffmpeg.setFfmpegPath(ffmpegPath)
  ffmpeg(sourcePath)
    .setStartTime(trimStart)
    .setDuration(duration)
    .output(outputPath)
    .on('progress', (progress) => {
      mainWindow.webContents.send('export-progress', progress)
    })
    .on('end', () => {
      mainWindow.webContents.send('export-complete')
    })
    .run()
})
```

### Preload API

```typescript
// Exposed to renderer
const api = {
  // Invoke methods (request-response)
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  getVideoMetadata: (path: string) => ipcRenderer.invoke('get-video-metadata', path),
  exportVideo: (src, dest, start, dur) =>
    ipcRenderer.invoke('export-video', {
      sourcePath: src,
      outputPath: dest,
      trimStart: start,
      duration: dur
    }),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),

  // Event listeners (one-way events)
  onExportProgress: (callback) => ipcRenderer.on('export-progress', callback),
  onExportComplete: (callback) => ipcRenderer.on('export-complete', callback),
  onExportError: (callback) => ipcRenderer.on('export-error', callback),
  onMenuImport: (callback) => ipcRenderer.on('menu-import', callback),
  onMenuExport: (callback) => ipcRenderer.on('menu-export', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}

contextBridge.exposeInMainWorld('api', api)
```

### TypeScript Definitions

```typescript
// src/preload/index.d.ts
declare global {
  interface Window {
    api: {
      // Invoke methods (request-response)
      selectVideoFile: () => Promise<string | null>
      getVideoMetadata: (path: string) => Promise<{
        duration: number
        width: number
        height: number
        codec: string
        filename: string
      }>
      exportVideo: (src: string, dest: string, start: number, dur: number) => Promise<void>
      selectSavePath: () => Promise<string | null>

      // Event listeners (one-way events)
      onExportProgress: (callback: (event: any, progress: any) => void) => void
      onExportComplete: (callback: (event: any) => void) => void
      onExportError: (callback: (event: any, error: { message: string }) => void) => void
      onMenuImport: (callback: (event: any) => void) => void
      onMenuExport: (callback: (event: any) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}
```

### Menu Actions (Event-based IPC)

```typescript
// Main process menu definition
const menu = Menu.buildFromTemplate([
  {
    label: 'File',
    submenu: [
      {
        label: 'Import Video',
        accelerator: 'CmdOrCtrl+O',
        click: () => mainWindow.webContents.send('menu-import')
      },
      {
        label: 'Export Video',
        accelerator: 'CmdOrCtrl+E',
        click: () => mainWindow.webContents.send('menu-export')
      },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
    ]
  }
])
Menu.setApplicationMenu(menu)
```

```typescript
// Renderer listeners
useEffect(() => {
  window.api.onMenuImport(handleImport)
  window.api.onMenuExport(handleExport)

  return () => {
    window.api.removeAllListeners('menu-import')
    window.api.removeAllListeners('menu-export')
  }
}, [])

// Also listen to export events
useEffect(() => {
  window.api.onExportProgress((event, progress) => {
    setExportProgress(progress.percent)
  })

  window.api.onExportComplete(() => {
    // Show success
  })

  window.api.onExportError((event, { message }) => {
    // Show error
  })

  return () => {
    window.api.removeAllListeners('export-progress')
    window.api.removeAllListeners('export-complete')
    window.api.removeAllListeners('export-error')
  }
}, [])
```

**Key Pattern**:

- **Synchronous operations**: Use `window.api.methodName()` for request-response
- **Event notifications**: Use `window.api.onEventName()` for one-way events
- All IPC access goes through controlled preload API (never direct `ipcRenderer`)
- Main process never needs renderer state

---

## Performance Considerations

### Timeline Rendering

**Problem**: Timeline clips must re-render as playhead moves (60fps during playback)

**Solution**: Transform-based positioning

```css
.timeline-clip {
  transform: translateX(${position}px); /* GPU-accelerated */
  willchange: 'transform'; /* Hint to browser */
}
```

**Why NOT use `left`**: Causes layout reflow. Transform uses GPU.

### Drag Handler Cleanup

**Problem**: User drags trim handle outside component → mousemove fires but mouseup doesn't

**Solution**: Global event listeners

```typescript
useEffect(() => {
  if (isDragging) {
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }
}, [isDragging])
```

### State Update Batching

**Problem**: Scrubbing playhead updates state 60fps → React re-renders repeatedly

**Solution**: Throttle state updates, use transform for visual updates

```typescript
const rafRef = useRef()
const handleMouseMove = (e) => {
  if (rafRef.current) return
  rafRef.current = requestAnimationFrame(() => {
    const newTime = calculateTime(e.clientX)
    setPlayheadPosition(newTime)
    rafRef.current = null
  })
}
```

---

## FFmpeg Integration

### Binary Path Setup

```typescript
// In main process
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'

// Separate binaries for FFmpeg and FFprobe
const ffmpegPath = app.isPackaged
  ? join(process.resourcesPath, 'ffmpeg') // Production: bundled binary
  : ffmpegInstaller.path // Development: node_modules

const ffprobePath = app.isPackaged
  ? join(process.resourcesPath, 'ffprobe') // Production: bundled binary
  : ffprobeInstaller.path // Development: node_modules

// Verify binaries exist
if (!fs.existsSync(ffmpegPath)) {
  console.error('FFmpeg not found at:', ffmpegPath)
} else {
  ffmpeg.setFfmpegPath(ffmpegPath)
  console.log('FFmpeg path set to:', ffmpegPath)
}

if (!fs.existsSync(ffprobePath)) {
  console.error('FFprobe not found at:', ffprobePath)
} else {
  ffmpeg.setFfprobePath(ffprobePath)
  console.log('FFprobe path set to:', ffprobePath)
}
```

**Important**: We use **separate** `@ffprobe-installer/ffprobe` package because `@ffmpeg-installer` bundles `ffprobe` as a symlink to `ffmpeg`, which causes issues in packaged Electron apps (argv[0] detection fails, binary runs as `ffmpeg` instead of `ffprobe`).

### Export Command

```typescript
ffmpeg(sourcePath)
  .setStartTime(trimStart) // Start trimming from here
  .setDuration(trimEnd - trimStart) // Keep this duration
  .output(outputPath)
  .on('progress', (progress) => {
    // progress.percent = 0-100
    mainWindow.webContents.send('export-progress', progress)
  })
  .on('end', () => {
    mainWindow.webContents.send('export-complete')
  })
  .on('error', (err) => {
    mainWindow.webContents.send('export-error', { message: err.message })
  })
  .run()
```

**Key Parameters**:

- `setStartTime()`: Where to start in source video (in seconds)
- `setDuration()`: How much to keep (in seconds)
- Output format: MP4 with default codec settings

---

## File Loading Strategy

### Development Mode

```typescript
// src/main/index.ts
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  preload: join(__dirname, '../preload/index.js'),
  sandbox: false,
  webSecurity: false,  // Required for file:// URLs in development
  allowRunningInsecureContent: true  // Allow mixed content in dev
}
```

**Why**: `file://` protocol is blocked by default Content Security Policy. `webSecurity: false` allows loading local files in development.

**⚠️ CRITICAL SECURITY CONCERN**: This is **NOT production-ready**. See `POST_MVP.md` for migration to custom protocol handler.

**Content Security Policy** (in `index.html`):

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' file: data:"
/>
```

**Renderer**:

```typescript
<video src={`file://${videoState.sourcePath}`} />
```

### Production Mode

**TODO**: Migrate to custom protocol handler for security

```typescript
// Future enhancement
protocol.registerFileProtocol('clipforge', (request, callback) => {
  const filePath = request.url.replace('clipforge://', '');
  callback({ path: filePath });
});

// Renderer would use:
<video src="clipforge://path/to/video.mp4" />
```

---

## Timeline Coordinate System

### Concepts

1. **Timeline** (absolute): Shows full video duration, 0 to `duration`
2. **Clip** (absolute): Positioned at `trimStart * pixelsPerSecond`, width = `(trimEnd - trimStart) * pixelsPerSecond`
3. **Playhead** (relative): Position in trimmed section, 0 to `(trimEnd - trimStart)`

### Transformation

```typescript
// Playhead position on timeline (absolute)
const playheadAbsolutePosition = trimStart + playheadPosition

// Clip position on timeline (absolute)
const clipPosition = trimStart * pixelsPerSecond

// Playhead visual position (pixels)
const playheadPixelPosition = playheadPosition * pixelsPerSecond
```

### Pixels Per Second

```typescript
const pixelsPerSecond = timelineWidth / duration
// Example: 800px timeline, 30s video = 26.67 px/s
```

**Why**: Scales timeline proportionally. Long videos get narrower clips, short videos get wider clips.

---

## Export Flow Diagram

```
User clicks Export
    ↓
[Renderer] Open save dialog
    ↓
    Select output path
    ↓
[Renderer] Call export API
    ↓
[Main] Configure FFmpeg
    ↓
[Main] Start FFmpeg process
    ↓ (async)
    Progress events → webContents.send('export-progress')
    ↓
[Renderer] Receive progress → Update UI
    ↓
    Complete event → webContents.send('export-complete')
    ↓
[Renderer] Show success notification
```

---

## Error Handling Strategy

### Import Errors

```typescript
try {
  const metadata = await window.api.getVideoMetadata(filePath)
} catch (error) {
  // Error types:
  // - File not found
  // - Unsupported codec
  // - Corrupt video file
  // Show user-friendly message
}
```

### Export Errors

```typescript
// Listen to export error events from main process
useEffect(() => {
  const handleExportError = (event, errorMessage) => {
    // Error types:
    // - FFmpeg not found
    // - Disk full
    // - Invalid parameters
    // - Export cancelled
    // Show error modal
  }

  window.api.onExportError(handleExportError)

  return () => {
    window.api.removeAllListeners('export-error')
  }
}, [])
```

### Playback Errors

```typescript
videoRef.current.onerror = () => {
  // Error types:
  // - Codec not supported
  // - File can't be decoded
  // - Network error (if using URL)
  // Fall back to audio-only or show error
}
```

---

## Testing Strategy

### Unit Tests

**Targets**:

- State validation functions
- Time formatting utilities
- Trim boundary checks
- Timeline calculations

**Example**:

```typescript
describe('trim validation', () => {
  it('rejects trimStart >= trimEnd', () => {
    expect(validateTrim(5, 5)).toBe(false)
    expect(validateTrim(6, 5)).toBe(false)
  })

  it('accepts valid trim range', () => {
    expect(validateTrim(0, 10)).toBe(true)
    expect(validateTrim(5, 10)).toBe(true)
  })
})
```

### Integration Tests

**Targets**:

- IPC communication
- FFmpeg metadata extraction
- Export functionality

**Example**:

```typescript
it('should extract video metadata', async () => {
  const metadata = await window.api.getVideoMetadata(testVideoPath)
  expect(metadata.duration).toBeGreaterThan(0)
  expect(metadata.width).toBe(1920)
  expect(metadata.height).toBe(1080)
})
```

### E2E Tests

**Targets**:

- Full import → trim → export workflow
- Multiple file formats
- Large file handling
- Error recovery

---

## Deployment Considerations

### FFmpeg Bundling

```yaml
# electron-builder.yml
extraResources:
  - from: node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg
    to: ffmpeg
  - from: node_modules/@ffprobe-installer/darwin-arm64/ffprobe
    to: ffprobe
```

**Why**:

- FFmpeg and FFprobe binaries must be outside `.asar` archive (cannot execute files inside .asar)
- We bundle **both** binaries separately (not symlinks)
- Path must match the architecture: `darwin-arm64` for Apple Silicon Macs

**Note**: DMG distribution is currently disabled due to `hdiutil` errors. Using `.zip` format instead. See `POST_MVP.md` for details.

### Application Size

- Electron: ~150 MB
- FFmpeg: ~35 MB (darwin-arm64)
- FFprobe: ~17 MB (darwin-arm64)
- App code: ~10 MB
- **Total**: ~212 MB

### Distribution

Build command: `npm run build:mac`
Output: `.zip` file in `dist/` directory (DMG currently disabled)

**Testing**: Install on clean macOS (no Node.js, no dev tools) and verify all features work.

---

## Future Enhancements (Post-MVP)

### Recording Features

- Screen recording with desktopCapturer
- Webcam recording
- Simultaneous screen + webcam

### Timeline Enhancements

- Multiple clips
- Drag-and-drop to reorder
- Split clips
- Two-track timeline (overlays)

### Export Enhancements

- Resolution options (720p, 1080p, source)
- Export presets
- Background export (continue editing)

### UI Enhancements

- Keyboard shortcuts
- Undo/redo
- Timeline zoom
- Snap-to-grid

---

**Last Updated**: October 29, 2025
**Version**: MVP v1.0 (Complete)
