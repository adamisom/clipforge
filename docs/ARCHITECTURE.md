# ClipForge Architecture Document

## Overview

ClipForge is a desktop video editor built with Electron and React. This document describes the high-level architecture, data flow, and key design decisions for the MVP implementation.

---

## System Architecture

### Three-Process Model

ClipForge follows Electron's standard three-process architecture:

1. **Main Process** (`src/main/index.ts`)
   - Node.js process with full system access
   - Handles file I/O, FFmpeg operations, window management
   - Entry point: `electron .`

2. **Renderer Process** (`src/renderer/`)
   - React application running in Chromium
   - Handles UI, user interactions, visual feedback
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
User clicks Import
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
Renderer: Updates videoState
```

**Key Points**:
- All file operations happen in main process
- Metadata extraction (ffprobe) returns filename to avoid using `path` module in renderer
- State update triggers re-render showing VideoEditor

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
  sourcePath: string | null;     // File path on disk
  duration: number;               // Full video duration (seconds)
  trimStart: number;             // Trim start point (0 to duration)
  trimEnd: number;               // Trim end point (trimStart to duration)
  playheadPosition: number;      // Position in trimmed section (0 to trimmed duration)
  isPlaying: boolean;             // Playback state
  metadata: {
    filename: string;             // Extracted in main process
    resolution: string;           // e.g., "1920x1080"
  };
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
});

// Updates use functional form to avoid stale closures
setVideoState(prev => ({ ...prev, trimStart: newStart }));
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
  });
  return result.canceled ? null : result.filePaths[0];
});

// Metadata extraction
ipcMain.handle('get-video-metadata', async (event, path) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      resolve({
        duration: metadata.format.duration,
        width: videoStream.width,
        height: videoStream.height,
        codec: videoStream.codec_name,
        filename: path.split(/[/\\]/).pop()
      });
    });
  });
});

// Export with progress communication
ipcMain.handle('export-video', async (event, { sourcePath, outputPath, trimStart, duration }) => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  
  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg(sourcePath)
    .setStartTime(trimStart)
    .setDuration(duration)
    .output(outputPath)
    .on('progress', (progress) => {
      mainWindow.webContents.send('export-progress', progress);
    })
    .on('end', () => {
      mainWindow.webContents.send('export-complete');
    })
    .run();
});
```

### Preload API

```typescript
// Exposed to renderer
const api = {
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  getVideoMetadata: (path: string) => ipcRenderer.invoke('get-video-metadata', path),
  exportVideo: (src, dest, start, dur) => 
    ipcRenderer.invoke('export-video', { sourcePath: src, outputPath: dest, trimStart: start, duration: dur }),
  selectSavePath: () => ipcRenderer.invoke('select-save-path')
};

contextBridge.exposeInMainWorld('api', api);
```

### TypeScript Definitions

```typescript
// src/preload/index.d.ts
declare global {
  interface Window {
    api: {
      selectVideoFile: () => Promise<string | null>;
      getVideoMetadata: (path: string) => Promise<{
        duration: number;
        width: number;
        height: number;
        codec: string;
        filename: string;
      }>;
      exportVideo: (src: string, dest: string, start: number, dur: number) => Promise<void>;
      selectSavePath: () => Promise<string | null>;
    };
  }
}
```

---

## Performance Considerations

### Timeline Rendering

**Problem**: Timeline clips must re-render as playhead moves (60fps during playback)

**Solution**: Transform-based positioning
```css
.timeline-clip {
  transform: translateX(${position}px);  /* GPU-accelerated */
  willChange: 'transform';                /* Hint to browser */
}
```

**Why NOT use `left`**: Causes layout reflow. Transform uses GPU.

### Drag Handler Cleanup

**Problem**: User drags trim handle outside component → mousemove fires but mouseup doesn't

**Solution**: Global event listeners
```typescript
useEffect(() => {
  if (isDragging) {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }
}, [isDragging]);
```

### State Update Batching

**Problem**: Scrubbing playhead updates state 60fps → React re-renders repeatedly

**Solution**: Throttle state updates, use transform for visual updates
```typescript
const rafRef = useRef();
const handleMouseMove = (e) => {
  if (rafRef.current) return;
  rafRef.current = requestAnimationFrame(() => {
    const newTime = calculateTime(e.clientX);
    setPlayheadPosition(newTime);
    rafRef.current = null;
  });
};
```

---

## FFmpeg Integration

### Binary Path Setup

```typescript
// In main process
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { app } from 'electron';
import path from 'path';

const ffmpegPath = app.isPackaged
  ? path.join(process.resourcesPath, 'ffmpeg')  // Production: bundled binary
  : ffmpegInstaller.path;                        // Development: node_modules

ffmpeg.setFfmpegPath(ffmpegPath);

// Verify binary exists
if (!fs.existsSync(ffmpegPath)) {
  throw new Error(`FFmpeg not found at: ${ffmpegPath}`);
}
```

### Export Command

```typescript
ffmpeg(sourcePath)
  .setStartTime(trimStart)              // Start trimming from here
  .setDuration(trimEnd - trimStart)     // Keep this duration
  .output(outputPath)
  .on('progress', (progress) => {
    // progress.percent = 0-100
    mainWindow.webContents.send('export-progress', progress);
  })
  .on('end', () => {
    mainWindow.webContents.send('export-complete');
  })
  .on('error', (err) => {
    mainWindow.webContents.send('export-error', err.message);
  })
  .run();
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
  webSecurity: false  // REQUIRED for file:// URLs in dev
}
```

**Why**: `file://` protocol is blocked by default. `webSecurity: false` allows loading local files.

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
const playheadAbsolutePosition = trimStart + playheadPosition;

// Clip position on timeline (absolute)
const clipPosition = trimStart * pixelsPerSecond;

// Playhead visual position (pixels)
const playheadPixelPosition = playheadPosition * pixelsPerSecond;
```

### Pixels Per Second

```typescript
const pixelsPerSecond = (timelineWidth / duration);
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
  const metadata = await window.api.getVideoMetadata(filePath);
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
window.api.onExportError((error) => {
  // Error types:
  // - FFmpeg not found
  // - Disk full
  // - Invalid parameters
  // - Export cancelled
  // Show error modal
});
```

### Playback Errors

```typescript
videoRef.current.onerror = () => {
  // Error types:
  // - Codec not supported
  // - File can't be decoded
  // - Network error (if using URL)
  // Fall back to audio-only or show error
};
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
    expect(validateTrim(5, 5)).toBe(false);
    expect(validateTrim(6, 5)).toBe(false);
  });
  
  it('accepts valid trim range', () => {
    expect(validateTrim(0, 10)).toBe(true);
    expect(validateTrim(5, 10)).toBe(true);
  });
});
```

### Integration Tests

**Targets**:
- IPC communication
- FFmpeg metadata extraction
- Export functionality

**Example**:
```typescript
it('should extract video metadata', async () => {
  const metadata = await window.api.getVideoMetadata(testVideoPath);
  expect(metadata.duration).toBeGreaterThan(0);
  expect(metadata.width).toBe(1920);
  expect(metadata.height).toBe(1080);
});
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
  - from: "node_modules/@ffmpeg-installer/darwin-x64/ffmpeg"
    to: "ffmpeg"
```

**Why**: FFmpeg binary must be outside `.asar` archive (cannot execute files inside .asar).

### Application Size

- Electron: ~150 MB
- FFmpeg: ~50 MB
- App code: ~10 MB
- **Total**: ~210 MB

### Distribution

Build command: `npm run build:mac`
Output: `.dmg` file in `dist/` directory

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

**Last Updated**: October 27, 2024
**Version**: MVP v1.0

