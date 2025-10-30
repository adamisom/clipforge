# ClipForge Architecture Document

## Overview

ClipForge is a desktop video editor built with Electron and React. This document describes the high-level architecture, data flow, and key design decisions for the MVP, Phase 2, and Phase 3 A-C implementations.

**Current Status**: MVP + Phase 2 + Phase 3 A-C Complete
- ✅ Basic video editing (import, trim, export)
- ✅ Multi-clip timeline support (Phase 2)
- ✅ Screen and webcam recording (Phase 2)
- ✅ Split functionality (Phase 2)
- ✅ Drag-and-drop import (Phase 2)
- ✅ Temp file management (Phase 2)
- ✅ Multi-track timeline (Track 0 + Track 1) (Phase 3 A)
- ✅ Simultaneous screen + webcam recording (Phase 3 B)
- ✅ Picture-in-Picture (PiP) configuration and preview (Phase 3 C)
- ✅ Multi-track export with FFmpeg overlay and audio mixing (Phase 3 C)

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

### Simultaneous Recording Workflow (Phase 3 B)

```
User clicks Record → Screen + Webcam
    ↓
Renderer: Shows SimultaneousRecorder component
    ↓
Renderer: Fetches available screen sources via window.api.getScreenSources()
    ↓
User selects screen source
    ↓
Renderer: Initializes webcam stream via getUserMedia({ video: true, audio: true })
    ↓
User sees webcam preview → Clicks "Start Recording"
    ↓
Renderer: Shows 3-2-1 countdown
    ↓
[If not recording ClipForge/Electron] Main: Minimizes window
    ↓
Renderer: Captures screen stream via getUserMedia({ video, audio: false })
    ↓
Renderer: Two MediaRecorders record simultaneously:
  - Screen: video only (no audio to avoid duplication)
  - Webcam: video + microphone audio
    ↓
Main: Shows tray icon "🔴REC 0:XX" with timer
    ↓
User stops recording (Cmd+Shift+S or tray menu)
    ↓
Renderer: Stops both recorders, converts Blobs to ArrayBuffers
    ↓
Renderer: Saves both recordings to temp directory
    ↓
Main: Returns temp paths for both recordings
    ↓
Renderer: Shows save dialog for screen recording
    ↓
User saves screen recording permanently
    ↓
Renderer: Shows save dialog for webcam recording
    ↓
User saves webcam recording permanently
    ↓
Renderer: Gets metadata for both recordings
    ↓
Renderer: Creates two TimelineClips:
  - Screen clip: trackIndex = 0 (Track 0 / Main)
  - Webcam clip: trackIndex = 1 (Track 1 / PiP)
    ↓
Renderer: Adds both clips to clips[] array at position 0
```

**Key Points**:

- Two separate MediaRecorder instances run in parallel
- Screen recording: `audio: false` (video only)
- Webcam recording: `audio: true` (video + microphone)
- This prevents duplicate/echo audio in multi-track export
- Both clips have same duration (from single recording timer)
- Clips automatically assigned to correct tracks (screen → Track 0, webcam → Track 1)
- Immediate save flow (not deferred like standalone recording)

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

### Multi-Track Export with PiP Overlay (Phase 3 C.4)

```
User clicks Export (with clips on Track 0 and Track 1)
    ↓
Renderer: Filters clips into track0Clips and track1Clips
    ↓
Renderer: Checks if multi-track (track1Clips.length > 0)
    ↓
[Multi-Track Path]
    ↓
Renderer: Calculates total duration for each track
    ↓
If duration mismatch > 0.5s: Shows warning dialog
    ↓
User confirms or cancels
    ↓
Renderer: Calls window.api.exportMultiTrack(track0Clips, track1Clips, pipConfig, outputPath)
    ↓
Main: Builds FFmpeg complex filter:
  1. Add all Track 0 and Track 1 clips as inputs
  2. Trim each clip: setpts=PTS-STARTPTS
  3. Concatenate clips within each track (if multiple)
  4. Scale Track 1 (PiP) based on size setting (15%, 25%, 40%)
  5. Overlay scaled PiP onto Track 0 at position (top-left, etc.)
  6. Mix audio from both tracks: amix=inputs=2:duration=longest
    ↓
Main: FFmpeg command example:
  ffmpeg -i track0_clip1.mp4 -i track1_clip1.webm \
    -filter_complex "\
      [0:v]trim=0:10,setpts=PTS-STARTPTS[v0];\
      [1:v]trim=0:10,setpts=PTS-STARTPTS[v1];\
      [v1]scale=iw*0.25:ih*0.25[v1scaled];\
      [v0][v1scaled]overlay=W-w-20:H-h-20[outv];\
      [0:a][1:a]amix=inputs=2:duration=longest[outa]"\
    -map [outv] -map [outa] output.mp4
    ↓
Main: Executes FFmpeg, sends progress
    ↓
Renderer: Updates UI, shows completion notification
```

**Key Points**:

- Multi-track export uses FFmpeg `overlay` filter for PiP positioning
- PiP size: small (15%), medium (25%), large (40%) of main video
- PiP position: 20px padding from edges (bottom-right, top-left, etc.)
- Audio mixing: `amix` filter combines audio from both tracks
- Track 0 (screen) may have no audio, Track 1 (webcam) has microphone
- No echo/duplication because screen recording disables audio in simultaneous mode
- Export duration matches longer track (shorter track freezes/blacks out at end)
- If Track 0 missing: Error shown (multi-track requires main track)

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
// Single video state (MVP)
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

// Multi-clip state (Phase 2+)
interface TimelineClip {
  id: string // Unique identifier (crypto.randomUUID())
  sourcePath: string // Original video file path
  sourceStartTime: number // Where clip starts in source (trimStart)
  timelineDuration: number // Duration of clip on timeline (trimEnd - trimStart)
  totalSourceDuration: number // Full source video duration
  filename: string // Display name
  resolution: string // e.g., "1920x1080"
  trackIndex: 0 | 1 // Track 0 (main) or Track 1 (PiP overlay)
}

// App state
interface AppState {
  clips: TimelineClip[] // Array of clips on timeline (Phase 2+)
  selectedClipId: string | null // Currently selected clip for preview/editing
  playheadPosition: number // Absolute position across all clips
  isPlaying: boolean // Global playback state
  pipConfig: {
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    size: 'small' | 'medium' | 'large'
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
  │   ├─ Designated Drop Zone (with icon and instructions)
  │   ├─ Import Button
  │   ├─ Test Webcam Button (icon)
  │   └─ Test Screen Button (icon)
  │
  └─ VideoEditor (when video loaded)
      ├─ VideoPreview
      │   ├─ <video> element (main video - Track 0)
      │   ├─ <video> element (PiP overlay - Track 1, if present)
      │   └─ Play/Pause button
      │
      ├─ Timeline
      │   ├─ Timeline Toolbar (import/record buttons)
      │   ├─ Track 0 (Main)
      │   │   ├─ TimeRuler (shows seconds)
      │   │   ├─ Playhead (draggable, with triangle handle)
      │   │   └─ TimelineClip(s)
      │   │       ├─ Clip visualization
      │   │       ├─ Left trim handle
      │   │       ├─ Right trim handle
      │   │       ├─ Split line indicator (if split)
      │   │       ├─ Temp file indicator (⚠️ emoji)
      │   │       └─ Context menu (right-click)
      │   │
      │   └─ Track 1 (Picture-in-Picture)
      │       └─ TimelineClip(s)
      │           ├─ Clip visualization
      │           ├─ Left trim handle
      │           ├─ Right trim handle
      │           ├─ Temp file indicator (⚠️ emoji)
      │           └─ Context menu (right-click)
      │
      ├─ InfoPanel
      │   ├─ Filename display
      │   ├─ Resolution display
      │   ├─ Trim range display
      │   └─ Save Permanently button (if temp file)
      │
      ├─ PiP Settings (if Track 1 has clips)
      │   ├─ Position selector (bottom-right, top-left, etc.)
      │   └─ Size selector (small, medium, large)
      │
      └─ ExportButton
```

**Key Components**:

- **TimelineClip**: Simple div with transform-based positioning for performance
- **Playhead**: Draggable with triangle handle, resumes playback on release
- **Trim handles**: Small draggable areas on clip edges (West/East)
- **Context Menu**: Right-click on clip to move between tracks, delete, etc.
- **PiP Preview**: Second `<video>` element overlaid on main video, synced playback
- **Timeline Toolbar**: Import/record buttons accessible from main screen
- **Designated Drop Zone**: Visual drop area on welcome screen with instructions

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

**Note**: DMG distribution is now supported (Phase 3+). Users can build either DMG or ZIP.

### Application Size

- Electron: ~150 MB
- FFmpeg: ~35 MB (darwin-arm64)
- FFprobe: ~17 MB (darwin-arm64)
- App code: ~10 MB
- **Total**: ~212 MB

### Distribution

**Build Commands:**
- `npm run build:mac` → Builds DMG installer (professional, drag-to-Applications UI)
- `npm run build:mac:zip` → Builds ZIP archive (simple, smaller file)

**Output:**
- DMG: `dist/clipforge-1.0.0-arm64.dmg` (~153 MB)
- ZIP: `dist/clipforge-1.0.0-arm64-mac.zip` (~145 MB)

**DMG Features:**
- Professional installer experience
- Dark background (#1a1a1a)
- 540x380 window with drag-to-Applications layout
- Visual instructions for users
- Standard macOS distribution format

**Note**: App is unsigned. Users must right-click → Open on first launch to bypass Gatekeeper.

**Testing**: Install on clean macOS (no Node.js, no dev tools) and verify all features work.

---

## Future Enhancements (Phases 3 D-F & Phase 4)

### Phase 3 Remaining (D-F)

- Audio mixing controls (volume sliders for Track 0 and Track 1)
- Timeline zoom (fit-to-view, zoom in/out)
- Integration testing and polish

### Phase 4

- Drag-and-drop to reorder clips
- Project save/load (persist timeline state)
- Error handling improvements
- Loading states and progress indicators
- Input validation
- Timeline performance optimizations
- Export presets (resolution, codec options)
- Keyboard shortcuts help panel
- Security fix (custom protocol handler for file URLs)
- Code signing and notarization (macOS)

### Completed Features ✅

- ✅ Screen recording with desktopCapturer (Phase 2)
- ✅ Webcam recording (Phase 2)
- ✅ Simultaneous screen + webcam (Phase 3 B)
- ✅ Multiple clips (Phase 2)
- ✅ Split clips (Phase 2)
- ✅ Two-track timeline (overlays) (Phase 3 A)
- ✅ Multi-track export with PiP (Phase 3 C)
- ✅ DMG distribution (Phase 3 off-script)

---

**Last Updated**: October 30, 2025  
**Version**: MVP + Phase 2 + Phase 3 A-C Complete
