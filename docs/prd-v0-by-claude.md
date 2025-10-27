# ClipForge PRD
**Desktop Video Editor - 72 Hour Sprint**

---

## Document Overview

This PRD covers the complete development roadmap for ClipForge, divided into three sections:

- **Part 1: MVP Requirements** - Due Tuesday, October 28th at 10:59 PM CT
- **Part 2: Full Submission Requirements** - Due Wednesday, October 29th at 10:59 PM CT  
- **Appendix: Future Work & Strategic Considerations** - Post-submission roadmap

---

# Part 1: MVP Requirements

## Overview

The MVP is a **hard gate checkpoint** that proves the fundamental media pipeline works. Focus: Get video in, trim it, see it, export it.

**Success Criteria:** A packaged macOS desktop app that can import one video clip, trim it, preview the result, and export to MP4.

---

## MVP Tech Stack

### Desktop Framework
**Electron with electron-vite**

**Rationale:**
- Vite provides fast HMR and excellent dev experience
- Simpler project structure than electron-react-boilerplate
- Better for AI coding agents (cleaner codebase, modern patterns)
- Mature ecosystem with abundant Stack Overflow answers

**Setup:**
```bash
npm create @quick-start/electron@latest clipforge
cd clipforge
npm install
```

**Security Verification:** After scaffolding, verify security config in your main process file (likely `electron/main/index.ts` or similar). Look for the BrowserWindow creation and ensure these settings are present:
```typescript
webPreferences: {
  contextIsolation: true,     // CRITICAL: Isolates renderer from Electron APIs
  nodeIntegration: false,     // CRITICAL: Prevents direct Node.js access in renderer
  preload: path.join(__dirname, '../preload/index.js')  // Bridge for IPC
}
```
If these aren't set by the template, add them immediately. This prevents security vulnerabilities.

### Frontend
**React with TypeScript**

**Rationale:**
- Your strongest framework
- Excellent component ecosystem for UI elements
- AI agents have extensive training data for React patterns
- TypeScript catches errors early (critical for 37-hour sprint)

### Video Processing
**fluent-ffmpeg (Node.js wrapper for FFmpeg)**

**Rationale:**
- Pure JavaScript/TypeScript - no Rust learning curve
- Mature library with extensive documentation
- Works seamlessly in Electron's main process
- FFmpeg binary bundled with app distribution
- **Under the hood:** Uses Node's `child_process.spawn()` to run FFmpeg as a separate process, keeping your app responsive

**Installation:**
```bash
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg
```

**Process Access (for cancellation):**
```typescript
const command = ffmpeg(inputPath)
  .output(outputPath)
  .on('progress', (progress) => { /* ... */ });

// Access underlying process for cancellation
command.on('start', (commandLine) => {
  // Can kill the process if needed
  command.kill('SIGKILL');
});
```

### Timeline UI
**DOM-based with React**

**Rationale:**
- 2-3x faster to implement than Canvas
- AI agents excel at DOM manipulation
- Easy debugging with DevTools
- Performance sufficient for MVP requirements (10+ clips)

**Supporting Libraries:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable  # Modern drag-and-drop
npm install react-resizable  # For trim handles
```

---

## MVP Core Features

### 1. Application Launcher
**Requirements:**
- Desktop app launches successfully
- Window sizing: 1280x720 minimum
- Basic menu bar (File > Open, File > Export, Edit > Quit)

**Implementation:**
- Use electron-vite's default window setup
- Configure in `electron.vite.config.ts`

**Complexity:** Quick

---

### 2. Video Import
**Requirements:**
- File picker to select MP4/MOV files
- Display imported clip in media library area
- Show basic metadata: filename, duration

**Implementation Approach:**
```typescript
// Main process: Handle file selection
ipcMain.handle('select-video-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mov'] }]
  });
  return result.filePaths[0];
});

// Renderer: Get file info
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.ffprobe(filePath, (err, metadata) => {
  const duration = metadata.format.duration;
  const resolution = `${metadata.streams[0].width}x${metadata.streams[0].height}`;
});
```

**Pitfall:** File paths with spaces or special characters
- **Mitigation:** Always wrap paths in quotes when passing to FFmpeg

**Complexity:** Quick

---

### 3. Simple Timeline View
**Requirements:**
- Horizontal timeline showing single imported clip
- Visual representation of clip duration
- Time ruler showing seconds

**Implementation Approach:**
```tsx
// DOM structure
<div className="timeline">
  <div className="time-ruler">
    {/* Generate tick marks every second */}
  </div>
  <div className="timeline-track">
    <div 
      className="clip"
      style={{
        position: 'absolute',
        left: `${clip.startTime * pixelsPerSecond}px`,
        width: `${clip.duration * pixelsPerSecond}px`,
        transform: 'translateZ(0)', // Force GPU acceleration
      }}
    >
      {clip.name}
    </div>
  </div>
</div>
```

**Key Pattern:** Use `transform` for positioning, NOT `left/top` changes
- Prevents layout thrashing
- GPU-accelerated

**Complexity:** Moderate

---

### 4. Video Preview Player
**Requirements:**
- HTML5 video player showing current clip
- Play/pause button
- Shows current frame when paused

**Implementation Approach:**
```tsx
const VideoPreview = ({ clip, currentTime }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);
  
  return (
    <video 
      ref={videoRef}
      src={`file://${clip.filePath}`}
      controls
    />
  );
};
```

**Pitfall:** Video won't load - file protocol issues
- **Mitigation:** Use Electron's `protocol.registerFileProtocol` or serve via custom protocol

**Complexity:** Quick

---

### 5. Basic Trim Functionality
**Requirements:**
- Set in-point (trim start)
- Set out-point (trim end)
- Visual handles on timeline clip
- Preview reflects trimmed region

**Implementation Approach:**
```tsx
// Use react-resizable for trim handles
import { ResizableBox } from 'react-resizable';

const TimelineClip = ({ clip, onTrim }) => {
  return (
    <ResizableBox
      width={clip.duration * pixelsPerSecond}
      height={60}
      onResize={(e, { size }) => {
        const newDuration = size.width / pixelsPerSecond;
        onTrim(clip.id, newDuration);
      }}
      resizeHandles={['e', 'w']} // East and West handles
    >
      <div className="clip-content">
        {clip.name}
      </div>
    </ResizableBox>
  );
};
```

**Pitfall:** Resize handles don't snap to frame boundaries
- **Mitigation:** For MVP, free-form is acceptable; frame-accurate trimming is Full submission feature

**Complexity:** Moderate

---

### 6. Export to MP4
**Requirements:**
- Export button triggers video rendering
- Saves trimmed clip to disk (user selects location)
- Single clip export only

**Implementation Approach:**
```typescript
// Main process
ipcMain.handle('export-video', async (event, { clip, outputPath }) => {
  return new Promise((resolve, reject) => {
    ffmpeg(clip.filePath)
      .setStartTime(clip.trimStart)
      .setDuration(clip.trimEnd - clip.trimStart)
      .output(outputPath)
      .on('end', () => resolve('Export complete'))
      .on('error', (err) => reject(err))
      .run();
  });
});
```

**Critical Pitfall:** FFmpeg binary not found in packaged app
- **Mitigation:** Bundle FFmpeg with app (see Packaging section)

**Complexity:** Moderate

---

### 7. Native App Packaging
**Requirements:**
- Build distributable macOS .dmg or .app
- FFmpeg bundled with application
- User can download and run without developer tools

**Implementation Approach:**

**Step 1: Configure electron-builder**
```json
// package.json
{
  "build": {
    "appId": "com.clipforge.app",
    "mac": {
      "target": "dmg",
      "category": "public.app-category.video"
    },
    "extraResources": [
      {
        "from": "node_modules/@ffmpeg-installer/darwin-x64/ffmpeg",
        "to": "ffmpeg"
      }
    ]
  }
}
```

**What extraResources does:** Copies FFmpeg binary to `app.asar.unpacked/resources/` so it's executable (files inside .asar archive can't be executed).

**Step 2: Reference bundled FFmpeg dynamically**
```typescript
import path from 'path';
import { app } from 'electron';
import ffmpeg from 'fluent-ffmpeg';

// Determine FFmpeg path based on environment
const ffmpegPath = app.isPackaged
  ? path.join(process.resourcesPath, 'ffmpeg')  // Production: bundled binary
  : require('@ffmpeg-installer/ffmpeg').path;    // Development: node_modules

// Set FFmpeg path for fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// Verify path exists (good practice)
if (!fs.existsSync(ffmpegPath)) {
  console.error('FFmpeg binary not found at:', ffmpegPath);
}
```

**Step 3: Build command**
```bash
npm run build       # Vite builds renderer
npm run build:mac   # Electron-builder creates .dmg
```

**Critical Testing Checklist:**
Test the packaged .dmg on a **clean Mac** (no dev tools, no Node.js):
1. ✅ App launches without errors
2. ✅ Can import video files
3. ✅ Can trim and preview video
4. ✅ Can export video (FFmpeg executes successfully)
5. ✅ No "FFmpeg not found" errors in console
6. ✅ Check Console.app for any warnings/errors

**Common Packaging Pitfall:** FFmpeg binary permissions
- If FFmpeg won't execute, check permissions: `chmod +x ffmpeg`
- Electron-builder should handle this, but verify in packaged app

**Debugging packaged app:**
```bash
# Run packaged app with console output
/Applications/ClipForge.app/Contents/MacOS/ClipForge
```

**Complexity:** Moderate to Slow (testing iteration can be time-consuming)

---

## MVP Success Checklist

✅ Launches as native Mac app from .dmg  
✅ Opens file picker and imports MP4/MOV  
✅ Shows clip on timeline  
✅ Video preview plays imported clip  
✅ Can set trim in/out points  
✅ Export creates trimmed MP4 file  
✅ No crashes during 5-minute test session  

---

## MVP Non-Requirements

**Explicitly out of scope for Tuesday:**
- Multiple clips on timeline
- Drag-and-drop import
- Recording features
- Multi-track support
- Split functionality
- Timeline zoom
- Audio visualization
- Effects, transitions, text
- Keyboard shortcuts
- Undo/redo
- Project save/load
- Error recovery

---

# Part 2: Full Submission Requirements

## Overview

Full submission builds on MVP to create a **production-ready desktop video editor** with recording, multi-clip timeline, and professional export features.

**Due:** Wednesday, October 29th at 10:59 PM CT

---

## Recording Features

**Priority Order:** Implement in this sequence to maximize working features if time runs short.

### 1. Screen Recording (Priority 1)
**Requirements:**
- Full screen or window selection
- Start/stop recording controls
- Save recording directly to timeline
- Audio from microphone (optional toggle)

**Implementation Approach:**

**Electron Method (Recommended):**
```typescript
// Main process: Get available sources
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window']
  });
  return sources;
});

// Renderer process: Capture stream
const stream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: {
    mandatory: {
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: sourceId
    }
  }
});

// Add microphone audio
const audioStream = await navigator.mediaDevices.getUserMedia({
  audio: true
});

// Combine streams
const combinedStream = new MediaStream([
  ...stream.getVideoTracks(),
  ...audioStream.getAudioTracks()
]);

// Record with MediaRecorder
const recorder = new MediaRecorder(combinedStream, {
  mimeType: 'video/webm;codecs=vp9'
});

recorder.ondataavailable = (event) => {
  chunks.push(event.data);
};

recorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'video/webm' });
  // Save to file system, add to timeline
};
```

**Pitfalls:**
- **Screen selection UI:** desktopCapturer returns thumbnails - render them for user selection
  - **Mitigation:** Create modal with thumbnail grid
- **Audio/video sync:** Can drift if not started simultaneously
  - **Mitigation:** Start audio and video streams in same event loop tick
- **File format:** MediaRecorder outputs WebM, not MP4
  - **Mitigation:** Convert with FFmpeg after recording OR support WebM in timeline

**Complexity:** Moderate to Slow

---

### 2. Webcam Recording (Priority 2)
**Requirements:**
- Access system camera
- Preview window while recording
- Save to timeline

**Implementation Approach:**
```typescript
const webcamStream = await navigator.mediaDevices.getUserMedia({
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 }
  },
  audio: true
});

// Same MediaRecorder approach as screen recording
```

**Pitfall:** Camera permissions not granted
- **Mitigation:** Handle permission denial gracefully, show error message

**Complexity:** Quick (nearly identical to screen recording)

---

### 3. Simultaneous Screen + Webcam (Priority 3)
**Requirements:**
- Record screen and webcam at same time
- Webcam appears as picture-in-picture overlay
- Save both tracks to timeline

**Implementation Approach:**

**Option A: Composite in real-time during recording**
```typescript
// Use Canvas to composite streams
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const screenVideo = document.createElement('video');
screenVideo.srcObject = screenStream;

const webcamVideo = document.createElement('video');
webcamVideo.srcObject = webcamStream;

function drawFrame() {
  // Draw screen
  ctx.drawImage(screenVideo, 0, 0, 1920, 1080);
  
  // Draw webcam PiP (bottom-right corner)
  ctx.drawImage(webcamVideo, 1600, 880, 320, 180);
  
  requestAnimationFrame(drawFrame);
}

// Capture canvas stream
const compositeStream = canvas.captureStream(30);
const recorder = new MediaRecorder(compositeStream);
```

**Option B: Record separately, composite during export (Recommended)**
- Record screen and webcam as separate files
- Add both to timeline (screen on track 1, webcam on track 2)
- FFmpeg overlays during export

**Rationale for Option B:**
- More flexible (user can reposition PiP)
- Less CPU during recording
- Aligns with multi-track architecture

**Complexity:** Moderate

---

### 4. Audio Capture (Priority 4)
**Requirements:**
- Microphone audio recording
- System audio capture (optional - can be complex)

**Implementation:**
- Microphone: Already covered in screen recording
- System audio: macOS requires permissions and is complex
  - **Recommendation:** Defer system audio to Future Work
  - Focus on microphone audio only for Full submission

**Complexity:** Quick (mic only), Slow (with system audio)

---

## Import & Media Management

### Enhanced Import
**Requirements:**
- **Drag-and-drop** video files onto app window
- File picker (already in MVP)
- Support MP4, MOV, WebM formats

**Drag-and-Drop Implementation:**
```typescript
// Renderer process
const DropZone = ({ onDrop }) => {
  const handleDrop = (e) => {
    e.preventDefault();
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)
    );
    
    files.forEach(file => {
      onDrop(file.path);
    });
  };
  
  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="drop-zone"
    >
      Drop videos here
    </div>
  );
};
```

**Visual Feedback:**
```tsx
const [isDragOver, setIsDragOver] = useState(false);

<div 
  className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
  onDragEnter={() => setIsDragOver(true)}
  onDragLeave={() => setIsDragOver(false)}
  onDrop={(e) => {
    setIsDragOver(false);
    handleDrop(e);
  }}
>
  {isDragOver ? '📁 Drop to import' : 'Drag videos here'}
</div>
```

**CSS:**
```css
.drop-zone {
  border: 2px dashed #ccc;
  transition: all 0.2s;
}

.drop-zone.drag-over {
  border-color: #007AFF;
  background-color: rgba(0, 122, 255, 0.1);
  transform: scale(1.02);
}
```

**Pitfall:** Security - Electron blocks file protocol access by default
- **Mitigation:** Configure webPreferences with `webSecurity: false` in dev OR use custom protocol handler

**Complexity:** Quick

---

### Media Library Panel
**Requirements:**
- Shows all imported clips
- Thumbnail preview for each clip
- Metadata: duration, resolution, file size
- Click to add to timeline

**Implementation:**
```typescript
const MediaLibrary = ({ clips }) => {
  return (
    <div className="media-library">
      {clips.map(clip => (
        <div key={clip.id} className="media-item">
          <video 
            src={`file://${clip.filePath}`}
            width="160"
            height="90"
            // Capture frame at 1 second for thumbnail
            onLoadedMetadata={(e) => {
              e.target.currentTime = 1;
            }}
          />
          <div className="metadata">
            <div>{clip.filename}</div>
            <div>{formatDuration(clip.duration)}</div>
            <div>{clip.resolution}</div>
            <div>{formatFileSize(clip.fileSize)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

**Complexity:** Quick to Moderate

---

## Timeline Editor (Enhanced)

### Architecture Best Practices

**Use transform-based positioning and CSS containment as basic best practices. With these in place, the timeline will easily handle 10+ clips (the Full submission requirement). Further optimizations are covered in the Appendix.**

**CSS Containment (add immediately):**
```css
.timeline-clip {
  contain: layout style paint;
  /* Isolates this element's rendering */
}

.timeline-track {
  contain: layout;
  /* Limits reflow calculations */
}
```

**Transform-based positioning (default approach):**
```tsx
// ✅ DO: GPU-accelerated
<div style={{ 
  transform: `translateX(${position}px)`,
  willChange: 'transform'
}}>

// ❌ DON'T: Causes layout thrashing
<div style={{ left: `${position}px` }}>
```

---

### Multi-Clip Timeline
**Requirements:**
- Arrange multiple clips in sequence
- Drag clips to reorder
- Visual gaps between clips
- Clips snap together (no gaps on final export)

**Implementation Approach:**

**State Structure:**
```typescript
interface TimelineClip {
  id: string;
  sourceClipId: string;  // Reference to imported clip
  trackIndex: number;     // 0 or 1 (two tracks)
  startTime: number;      // Position on timeline (seconds)
  duration: number;       // Clip duration on timeline
  trimStart: number;      // Trim from source clip
  trimEnd: number;        // Trim from source clip
}

const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
```

**Drag-and-Drop with dnd-kit:**
```typescript
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';

const DraggableClip = ({ clip }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: clip.id,
  });
  
  const style = {
    transform: transform 
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
  };
  
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {/* Clip UI */}
    </div>
  );
};
```

**Snap Behavior:**
```typescript
// When dragging, find nearest clip edge
const findSnapPosition = (dragX: number, clips: TimelineClip[]) => {
  const SNAP_THRESHOLD = 10; // pixels
  
  for (const clip of clips) {
    const clipStartX = clip.startTime * pixelsPerSecond;
    const clipEndX = (clip.startTime + clip.duration) * pixelsPerSecond;
    
    if (Math.abs(dragX - clipStartX) < SNAP_THRESHOLD) {
      return clipStartX;
    }
    if (Math.abs(dragX - clipEndX) < SNAP_THRESHOLD) {
      return clipEndX;
    }
  }
  
  return dragX; // No snap
};
```

**Complexity:** Moderate

---

### Split Clips
**Requirements:**
- Split clip at playhead position
- Creates two separate clips on timeline
- Both clips reference original source file

**Implementation:**
```typescript
const splitClipAtPlayhead = (clipId: string, playheadTime: number) => {
  const clip = timelineClips.find(c => c.id === clipId);
  
  // Calculate split position relative to clip
  const splitPosition = playheadTime - clip.startTime;
  
  // Create two new clips
  const leftClip: TimelineClip = {
    ...clip,
    id: generateId(),
    duration: splitPosition,
  };
  
  const rightClip: TimelineClip = {
    ...clip,
    id: generateId(),
    startTime: clip.startTime + splitPosition,
    duration: clip.duration - splitPosition,
    trimStart: clip.trimStart + splitPosition,
  };
  
  // Replace original with two new clips
  setTimelineClips(clips => 
    clips.filter(c => c.id !== clipId).concat([leftClip, rightClip])
  );
};
```

**Pitfall:** Split not frame-accurate
- **Mitigation:** Round to nearest frame boundary based on video framerate
- For MVP/Full: Approximate is acceptable

**Complexity:** Quick

---

### Delete Clips
**Requirements:**
- Select clip on timeline
- Delete key or button removes clip
- Remaining clips stay in place (don't auto-close gaps)

**Implementation:**
```typescript
const deleteClip = (clipId: string) => {
  setTimelineClips(clips => clips.filter(c => c.id !== clipId));
};

// Keyboard handler
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
      deleteClip(selectedClipId);
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [selectedClipId]);
```

**Complexity:** Quick

---

### Multi-Track (Exactly 2 Tracks)
**Requirements:**
- Track 0: Main video track
- Track 1: Overlay track (for PiP webcam or B-roll)
- Clips on track 1 render on top of track 0

**Implementation:**
```typescript
<div className="timeline">
  <div className="timeline-track" data-track="0">
    {timelineClips
      .filter(c => c.trackIndex === 0)
      .map(clip => <TimelineClip key={clip.id} clip={clip} />)}
  </div>
  
  <div className="timeline-track" data-track="1">
    {timelineClips
      .filter(c => c.trackIndex === 1)
      .map(clip => <TimelineClip key={clip.id} clip={clip} />)}
  </div>
</div>
```

**Export Composition:**
```typescript
// FFmpeg overlay filter
ffmpeg(track0Video)
  .input(track1Video)
  .complexFilter([
    {
      filter: 'overlay',
      options: {
        x: '(main_w-overlay_w)-20',  // 20px from right
        y: '(main_h-overlay_h)-20',  // 20px from bottom
      }
    }
  ])
  .output(outputPath);
```

**Complexity:** Moderate

---

### Timeline Zoom
**Requirements:**
- Zoom in/out controls
- Changes pixels-per-second scale
- Centered on playhead or viewport center

**Implementation:**
```typescript
const [zoomLevel, setZoomLevel] = useState(50); // pixels per second

const zoomIn = () => setZoomLevel(z => Math.min(z * 1.5, 200));
const zoomOut = () => setZoomLevel(z => Math.max(z / 1.5, 10));

// Apply to clip width calculation
const clipWidth = clip.duration * zoomLevel;
```

**Complexity:** Quick

---

### Snap to Grid/Clip Edges
**Requirements:**
- Magnetic snapping when dragging clips
- Snap to second boundaries (grid)
- Snap to adjacent clip edges

**Implementation:** See "findSnapPosition" function in Multi-Clip Timeline section above

**Complexity:** Quick

---

## Preview & Playback

### Playhead & Scrubbing
**Requirements:**
- Visual playhead line on timeline
- Drag playhead to scrub through video
- Preview updates in real-time during scrub

**Implementation:**
```typescript
const Playhead = ({ position, onDrag }) => {
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef();
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    // Use requestAnimationFrame for smooth updates
    if (rafRef.current) return;
    
    rafRef.current = requestAnimationFrame(() => {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newTime = x / pixelsPerSecond;
      
      onDrag(Math.max(0, newTime));
      rafRef.current = null;
    });
  };
  
  return (
    <div 
      className="playhead"
      style={{
        transform: `translateX(${position * pixelsPerSecond}px)`,
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '2px',
        backgroundColor: 'red',
        cursor: 'ew-resize'
      }}
      onMouseDown={() => setIsDragging(true)}
    />
  );
};
```

**Complexity:** Moderate

---

### Audio Playback Synchronized
**Requirements:**
- Audio plays in sync with video preview
- Multiple clips: audio transitions smoothly between clips

**Implementation:**

**For Single Clip (Simple):**
```typescript
<video 
  ref={videoRef}
  src={currentClip.filePath}
  onTimeUpdate={(e) => {
    setPlayheadPosition(clip.startTime + e.target.currentTime);
  }}
/>
```

**For Multiple Clips (Complex):**
- Option A: Pre-render audio track, play as single file
- Option B: Switch video source at clip boundaries
  
**Recommendation:** For Full submission, Option B is faster:
```typescript
useEffect(() => {
  const currentClip = findClipAtTime(playheadPosition);
  if (currentClip && videoRef.current.src !== currentClip.filePath) {
    videoRef.current.src = currentClip.filePath;
    videoRef.current.currentTime = playheadPosition - currentClip.startTime + currentClip.trimStart;
  }
}, [playheadPosition]);
```

**Pitfall:** Audio pops/clicks at clip boundaries
- **Mitigation:** Brief fade out/in (10-20ms) at transitions
- For Full submission: Accept minor artifacts

**Complexity:** Moderate to Slow

---

## Export & Sharing

### Resolution Options
**Requirements:**
- 720p (1280x720)
- 1080p (1920x1080)
- Source resolution (maintain original)

**Implementation:**
```typescript
const exportVideo = (resolution: '720p' | '1080p' | 'source') => {
  let scale = '';
  
  if (resolution === '720p') {
    scale = 'scale=1280:720';
  } else if (resolution === '1080p') {
    scale = 'scale=1920:1080';
  }
  // 'source' = no scale filter
  
  const filters = scale ? [scale] : [];
  
  ffmpeg()
    .input(/* ... */)
    .videoFilters(filters)
    .output(outputPath);
};
```

**Complexity:** Quick

---

### Export Progress Indicator
**Requirements:**
- Progress bar showing export percentage
- Estimated time remaining
- Cancel export button

**Implementation:**
```typescript
ffmpeg(/* ... */)
  .on('progress', (progress) => {
    // progress.percent = 0 to 100
    ipcRenderer.send('export-progress', {
      percent: progress.percent,
      currentTime: progress.timemark,
    });
  })
  .on('end', () => {
    ipcRenderer.send('export-complete');
  });

// Renderer
ipcRenderer.on('export-progress', (event, { percent }) => {
  setExportProgress(percent);
});
```

**UI Implementation:**
```tsx
{exportStatus.active && (
  <div className="export-modal">
    <h3>Exporting Video</h3>
    <ProgressBar value={exportStatus.progress} />
    <p>{exportStatus.stage}</p>
    <p>{Math.round(exportStatus.progress)}% complete</p>
    <button onClick={cancelExport}>Cancel</button>
  </div>
)}
```

**Complexity:** Quick

---

## Error Handling & Loading States

These are critical for production quality. Including them elevates the Full submission.

### Error Handling
**Implementation Strategy:**

**File Import Errors:**
```typescript
const importVideo = async (filePath: string) => {
  try {
    const metadata = await getVideoMetadata(filePath);
    
    // Validate file
    if (!metadata.streams || metadata.streams.length === 0) {
      throw new Error('Invalid video file: no streams found');
    }
    
    if (metadata.format.duration === undefined) {
      throw new Error('Cannot read video duration');
    }
    
    // Add to library
    addClipToLibrary(metadata);
    
  } catch (error) {
    // Show user-friendly error
    showErrorToast({
      title: 'Import Failed',
      message: `Could not import ${path.basename(filePath)}: ${error.message}`,
      action: 'Try another file'
    });
  }
};
```

**Export Errors:**
```typescript
const exportTimeline = async (outputPath: string) => {
  try {
    await renderTimeline(outputPath);
    
    showSuccessToast({
      title: 'Export Complete',
      message: `Video saved to ${path.basename(outputPath)}`,
      action: 'Open in Finder'
    });
    
  } catch (error) {
    showErrorToast({
      title: 'Export Failed',
      message: 'Could not render video. Check disk space and try again.',
      details: error.message
    });
  }
};
```

**Recording Errors:**
```typescript
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
} catch (error) {
  if (error.name === 'NotAllowedError') {
    showErrorModal({
      title: 'Camera Access Denied',
      message: 'Please enable camera permissions in System Preferences > Security & Privacy',
      cta: 'Open System Preferences'
    });
  } else if (error.name === 'NotFoundError') {
    showErrorModal({
      title: 'No Camera Found',
      message: 'Connect a webcam to use this feature'
    });
  }
}
```

**UI Components:**
```tsx
// Toast notification component
const Toast = ({ title, message, type }) => (
  <div className={`toast toast-${type}`}>
    <div className="toast-icon">
      {type === 'error' ? '⚠️' : '✓'}
    </div>
    <div>
      <div className="toast-title">{title}</div>
      <div className="toast-message">{message}</div>
    </div>
  </div>
);

// Use react-hot-toast or build simple notification system
```

**Complexity:** Quick to Moderate

---

### Loading States
**Implementation Strategy:**

**Import Loading:**
```tsx
const [importStatus, setImportStatus] = useState<{
  loading: boolean;
  filename?: string;
}>({ loading: false });

const handleImport = async (filePath: string) => {
  setImportStatus({ loading: true, filename: path.basename(filePath) });
  
  try {
    await importVideo(filePath);
  } finally {
    setImportStatus({ loading: false });
  }
};

// UI
{importStatus.loading && (
  <div className="loading-overlay">
    <Spinner />
    <p>Importing {importStatus.filename}...</p>
  </div>
)}
```

**Export Loading:**
```tsx
const [exportStatus, setExportStatus] = useState<{
  active: boolean;
  progress: number;
  stage: string;
}>({ active: false, progress: 0, stage: '' });

// UI (already shown above in Export Progress Indicator section)
```

**Recording Loading:**
```tsx
const [recordingState, setRecordingState] = useState<
  'idle' | 'initializing' | 'recording' | 'stopping'
>('idle');

// Show different UI for each state
{recordingState === 'initializing' && <Spinner />}
{recordingState === 'recording' && <RecordingIndicator />}
{recordingState === 'stopping' && <p>Saving recording...</p>}
```

**Visual Feedback Best Practices:**
- Skeleton screens while loading thumbnails
- Progress bars for long operations (>2 seconds)
- Spinners for quick operations (<2 seconds)
- Disable buttons during loading to prevent double-clicks

**Complexity:** Quick

---

## Project Save/Load (Auto-Save)

### Requirements
- JSON-based project files
- Auto-save every 30 seconds
- Manual save option
- Load existing projects

### Implementation

**Project File Format:**
```typescript
interface ProjectFile {
  version: '1.0';
  metadata: {
    name: string;
    created: string;
    modified: string;
  };
  clips: Array<{
    id: string;
    filePath: string;
    filename: string;
    duration: number;
  }>;
  timeline: {
    clips: TimelineClip[];
    duration: number;
  };
}
```

**Save Implementation:**
```typescript
const saveProject = async (projectPath: string) => {
  const projectData: ProjectFile = {
    version: '1.0',
    metadata: {
      name: path.basename(projectPath, '.clipforge'),
      created: project.created || new Date().toISOString(),
      modified: new Date().toISOString(),
    },
    clips: importedClips,
    timeline: {
      clips: timelineClips,
      duration: calculateTimelineDuration(),
    },
  };
  
  await fs.promises.writeFile(
    projectPath,
    JSON.stringify(projectData, null, 2),
    'utf-8'
  );
};
```

**Auto-Save:**
```typescript
useEffect(() => {
  if (!currentProjectPath) return;
  
  const interval = setInterval(() => {
    saveProject(currentProjectPath);
  }, 30000); // 30 seconds
  
  return () => clearInterval(interval);
}, [currentProjectPath, importedClips, timelineClips]);
```

**Load Implementation:**
```typescript
const loadProject = async (projectPath: string) => {
  const fileContent = await fs.promises.readFile(projectPath, 'utf-8');
  const project: ProjectFile = JSON.parse(fileContent);
  
  // Validate file paths still exist
  const validClips = await Promise.all(
    project.clips.map(async (clip) => {
      const exists = await fs.promises.access(clip.filePath)
        .then(() => true)
        .catch(() => false);
      
      if (!exists) {
        console.warn(`Clip not found: ${clip.filePath}`);
      }
      
      return exists ? clip : null;
    })
  );
  
  setImportedClips(validClips.filter(Boolean));
  setTimelineClips(project.timeline.clips);
};
```

**Pitfall:** File paths break when videos are moved
- **Mitigation:** On load, if file not found, show dialog to locate file
- Future work: Store relative paths or embed videos in project

**Complexity:** Quick to Moderate

---

## Architecture & Security Fundamentals

This section covers critical architectural patterns and security practices that underpin the entire application.

### IPC Communication Pattern

Electron requires secure communication between main process (Node.js) and renderer process (browser). Never expose Node.js directly to the renderer.

**The Three-Layer Pattern:**

**1. Main Process (electron/main/index.ts)** - Exposes functions via IPC handlers:
```typescript
import { ipcMain, dialog } from 'electron';
import { processVideo } from './videoProcessor';

// File selection
ipcMain.handle('select-video-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'webm'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

// Video processing
ipcMain.handle('export-video', async (event, inputPath, outputPath, options) => {
  try {
    await processVideo(inputPath, outputPath, options);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

**2. Preload Script (electron/preload/index.ts)** - Bridges main and renderer securely:
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  exportVideo: (inputPath, outputPath, options) => 
    ipcRenderer.invoke('export-video', inputPath, outputPath, options),
  onExportProgress: (callback) => 
    ipcRenderer.on('export-progress', (_, progress) => callback(progress))
});
```

**3. Renderer (React component)** - Uses exposed API:
```tsx
function VideoEditor() {
  const handleImport = async () => {
    const filePath = await window.electronAPI.selectVideoFile();
    if (filePath) {
      // Process file
    }
  };
  
  const handleExport = async () => {
    const result = await window.electronAPI.exportVideo(input, output, options);
    if (result.success) {
      alert('Export complete!');
    }
  };
  
  return (
    <>
      <button onClick={handleImport}>Import</button>
      <button onClick={handleExport}>Export</button>
    </>
  );
}
```

**Why this pattern?**
- Prevents XSS attacks from accessing file system
- Renderer can't execute arbitrary Node.js code
- Clear contract between processes

---

### Security Best Practices

**File Path Validation** - Prevent access to system files:
```typescript
// In main process
const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm'];
const FORBIDDEN_PATHS = [
  '/System',
  '/Library',
  '/Windows/System32',
];

ipcMain.handle('validate-file-path', async (event, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const normalizedPath = path.normalize(filePath);
  
  // Check extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'Invalid file type' };
  }
  
  // Check forbidden paths
  if (FORBIDDEN_PATHS.some(forbidden => normalizedPath.startsWith(forbidden))) {
    return { valid: false, error: 'Cannot access system files' };
  }
  
  return { valid: true };
});
```

**Content Security Policy** - Add to HTML or main process:
```typescript
// In BrowserWindow creation
win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'; script-src 'self'"]
    }
  });
});
```

**Why security matters:**
- Video editors handle user files from anywhere
- Malicious video files could contain exploits
- User might accidentally select system files
- XSS vulnerabilities could delete files

---

## Full Submission Success Criteria

✅ Screen recording works (full screen + window selection)  
✅ Webcam recording works  
✅ Simultaneous screen + webcam recording  
✅ Microphone audio capture  
✅ Drag-and-drop video import  
✅ Media library with thumbnails and metadata  
✅ Multiple clips on timeline  
✅ Drag clips to reorder  
✅ Trim clips with handles  
✅ Split clips at playhead  
✅ Delete clips  
✅ Two-track timeline (main + overlay)  
✅ Timeline zoom in/out  
✅ Snap to clip edges  
✅ Playhead scrubbing  
✅ Preview updates in real-time  
✅ Audio plays synchronized with video  
✅ Export with resolution options (720p, 1080p, source)  
✅ Export progress indicator  
✅ Project save/load with auto-save  
✅ Error handling for common failures  
✅ Loading states for all async operations  
✅ Packaged macOS app with bundled FFmpeg  
✅ Smooth performance with 10+ clips on timeline  

---

## Full Submission Testing Scenarios

1. **Recording Test:**
   - Start screen recording, record for 30 seconds
   - Stop recording, verify it appears on timeline
   - Repeat with webcam
   - Record screen + webcam simultaneously

2. **Multi-Clip Edit:**
   - Import 3 different video files
   - Drag all to timeline in sequence
   - Trim middle clip
   - Split first clip in half
   - Reorder clips by dragging

3. **Export Test:**
   - Export timeline at 1080p
   - Verify output plays correctly
   - Check file size is reasonable

4. **Performance Test:**
   - Add 10+ clips to timeline
   - Scrub playhead - should remain smooth
   - Drag clips around - no lag
   - Timeline zoom in/out - responsive

5. **Error Recovery:**
   - Try importing invalid file
   - Cancel export mid-process
   - Deny camera permissions
   - Each should show helpful error message

6. **Project Persistence:**
   - Create multi-clip timeline
   - Save project
   - Quit app
   - Relaunch and load project
   - Verify all clips and positions preserved

---

# Appendix: Future Work & Strategic Considerations

## Overview
This appendix covers features, optimizations, and architectural improvements to consider after Wednesday's submission. Organized by priority and effort.

---

## A. Platform Expansion

### Windows Support
**Effort:** Moderate to Large  
**Priority:** High if building a product

**Changes Required:**
- FFmpeg binary: Include Windows build in extraResources
- File paths: Use `path.join()` everywhere (already cross-platform if done correctly)
- Screen recording: desktopCapturer works on Windows, but may need Windows-specific permissions
- Build configuration: Add Windows target to electron-builder
  ```json
  "build": {
    "win": {
      "target": "nsis",
      "icon": "build/icon.ico"
    }
  }
  ```

**Testing:** Requires Windows machine or VM

**Risk Areas:**
- Video codecs: Windows may not support all codecs macOS does
- File dialogs look/behave differently
- Performance may differ

---

### Linux Support
**Effort:** Moderate  
**Priority:** Low (unless open-source community project)

**Considerations:**
- FFmpeg readily available in package managers
- Screen recording permissions vary by distro
- AppImage or .deb distribution format
- Smallest market share

---

## B. Advanced Editing Features

### Text Overlays
**Effort:** Moderate  
**Priority:** High (most requested feature)

**Implementation Approach:**
```typescript
// Add text track to timeline
interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  style: {
    font: string;
    size: number;
    color: string;
    position: { x: number, y: number };
  };
}

// FFmpeg drawtext filter
ffmpeg()
  .input(videoPath)
  .videoFilters([
    {
      filter: 'drawtext',
      options: {
        text: overlay.text,
        fontfile: '/path/to/font.ttf',
        fontsize: overlay.style.size,
        fontcolor: overlay.style.color,
        x: overlay.style.position.x,
        y: overlay.style.position.y,
        enable: `between(t,${overlay.startTime},${overlay.endTime})`
      }
    }
  ]);
```

**Challenges:**
- Font rendering quality
- Text animation (fade in/out, slide)
- Multi-line text with word wrap
- Emoji support

**User Impact:** Very high - transforms basic editor into content creation tool

---

### Transitions
**Effort:** Moderate  
**Priority:** Medium

**Common Transitions:**
1. Fade (easiest)
2. Dissolve/Crossfade
3. Slide (left, right, up, down)
4. Wipe

**Implementation:**
```typescript
// Fade transition with FFmpeg
ffmpeg()
  .input(clip1)
  .input(clip2)
  .complexFilter([
    // Fade out clip1
    '[0:v]fade=t=out:st=9:d=1[v0]',
    // Fade in clip2
    '[1:v]fade=t=in:st=0:d=1[v1]',
    // Overlay during transition
    '[v0][v1]overlay=enable=between(t\,9\,10)[out]'
  ]);
```

**UI Challenge:** Visual representation of transitions on timeline

---

### Audio Controls
**Effort:** Moderate  
**Priority:** Medium

**Features:**
- Volume slider per clip (0-200%)
- Fade in/out
- Normalize audio levels
- Background music track

**Implementation:**
```typescript
// FFmpeg audio filters
ffmpeg()
  .input(videoPath)
  .audioFilters([
    `volume=${clip.volume / 100}`,  // 0.5 = 50%, 2.0 = 200%
    `afade=t=in:st=0:d=0.5`,        // Fade in
    `afade=t=out:st=9.5:d=0.5`      // Fade out
  ]);
```

**Advanced:** Audio waveform visualization on timeline
- Use Web Audio API to analyze audio
- Render waveform on canvas layer
- Effort: Large

---

### Color Correction & Filters
**Effort:** Moderate to Large  
**Priority:** Low to Medium

**Basic Filters:**
```typescript
// FFmpeg video filters
.videoFilters([
  'eq=brightness=0.1:saturation=1.2',  // Brightness + saturation
  'hue=s=0',                            // Black and white
  'colorbalance=rs=0.1',               // Color temperature
])
```

**Preset-Based Approach (Recommended):**
- Create preset library (Cinematic, Vintage, High Contrast, etc.)
- Store as JSON filter configurations
- One-click application

**Advanced:** Real-time preview of filters
- Requires rendering preview at reduced resolution
- Significant performance challenge

---

## C. Performance & Scale Optimizations

### Advanced DOM Optimizations (Beyond Basics)

**When Needed:** If you encounter performance issues beyond 30-50 clips or notice lag with 10+ clips.

#### 1. React.memo for Clips
```tsx
const TimelineClip = React.memo(({ clip, onDrag, onResize }) => {
  return (
    <div className="clip">
      {/* Clip UI */}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return prevProps.clip.id === nextProps.clip.id
    && prevProps.clip.startTime === nextProps.clip.startTime
    && prevProps.clip.duration === nextProps.clip.duration;
});
```

**Impact:** Prevents unnecessary re-renders when playhead moves  
**Complexity:** Quick

---

#### 2. Separate State for Playhead
```tsx
// ❌ DON'T: Playhead updates trigger clip re-renders
const [timelineState, setTimelineState] = useState({
  clips: [...],
  playheadPosition: 0
});

// ✅ DO: Independent state
const [clips, setClips] = useState([...]);
const [playheadPosition, setPlayheadPosition] = useState(0);
```

**Impact:** Playhead can update at 60fps without affecting clips  
**Complexity:** Quick

---

#### 3. Throttle State Updates During Drag
```tsx
import { throttle } from 'lodash';

// Throttle heavy state updates
const updateClipPosition = throttle((clipId, newPosition) => {
  setTimelineClips(clips => 
    clips.map(c => c.id === clipId ? { ...c, startTime: newPosition } : c)
  );
}, 33); // ~30fps

// But keep visual updates smooth with transform
const handleDrag = (e) => {
  // Immediate visual feedback (GPU)
  clipElement.style.transform = `translateX(${e.clientX}px)`;
  
  // Throttled state update
  updateClipPosition(clipId, calculateTime(e.clientX));
};
```

**Impact:** Balances smooth visuals with controlled state updates  
**Complexity:** Moderate

---

#### 4. Stable Event Handler References
```tsx
// ❌ DON'T: Creates new function every render
{clips.map(clip => (
  <Clip key={clip.id} onDrag={(e) => handleDrag(clip.id, e)} />
))}

// ✅ DO: Stable reference
const handleDrag = useCallback((clipId: string, e: MouseEvent) => {
  // Handle drag
}, []);

{clips.map(clip => (
  <Clip key={clip.id} clipId={clip.id} onDrag={handleDrag} />
))}
```

**Impact:** Prevents prop changes that trigger re-renders  
**Complexity:** Quick

---

### Virtualization for 100+ Clips
**Effort:** Large  
**When:** Only if users regularly hit 50+ clips

**Implementation Strategy:**
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const TimelineVirtualized = ({ clips }) => {
  const parentRef = useRef();
  
  const virtualizer = useVirtualizer({
    count: clips.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated clip width
    horizontal: true,
    overscan: 5, // Render 5 clips beyond viewport
  });
  
  return (
    <div ref={parentRef} className="timeline-scroll">
      <div style={{ width: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualItem => {
          const clip = clips[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                left: `${virtualItem.start}px`,
                width: `${virtualItem.size}px`,
              }}
            >
              <TimelineClip clip={clip} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

**Tradeoffs:**
- Adds complexity to drag-and-drop
- Snap behavior more challenging
- Only worthwhile at scale

---

### Canvas Migration
**Effort:** Very Large (essentially rewrite timeline)  
**When:** DOM performance becomes bottleneck (rare for <50 clips)

**Migration Strategy:**
1. **Hybrid Approach First (Recommended):**
   - Keep DOM for UI (buttons, controls, overlays)
   - Use Canvas only for timeline track rendering
   - Best of both worlds

2. **Library Options:**
   - Konva.js: Higher-level API, easier learning curve
   - Fabric.js: Good for interactive objects
   - Raw Canvas: Maximum control, most effort

**Example with Konva:**
```tsx
import Konva from 'konva';
import { Stage, Layer, Rect, Text } from 'react-konva';

const CanvasTimeline = ({ clips }) => {
  return (
    <Stage width={1920} height={200}>
      <Layer>
        {clips.map(clip => (
          <Rect
            key={clip.id}
            x={clip.startTime * pixelsPerSecond}
            y={clip.trackIndex * 80}
            width={clip.duration * pixelsPerSecond}
            height={60}
            fill="#4A90E2"
            draggable
            onDragEnd={(e) => {
              updateClipPosition(clip.id, e.target.x() / pixelsPerSecond);
            }}
          />
        ))}
      </Layer>
    </Stage>
  );
};
```

**Why You Might Need It:**
- 100+ clips cause frame drops
- Complex animations/effects
- Professional-grade scrubbing performance

**Why You Might Not:**
- DOM performs well for most use cases
- Canvas adds significant complexity
- Harder to maintain

---

### Thumbnail Optimization
**Effort:** Moderate  
**Priority:** High if loading times become slow with many clips

**When Needed:** With 10 clips (MVP/Full requirement), simple in-memory thumbnails are sufficient. This optimization becomes important at 30-50+ clips or when users frequently reload projects.

**Performance Comparison:**

| Clips | In-Memory Only | With Disk Cache |
|-------|----------------|-----------------|
| 10    | 3-8 sec load   | 3-8 sec first, instant after |
| 50    | 15-25 sec load | 15-25 sec first, instant after |
| 100   | 30-50 sec load | 30-50 sec first, instant after |

**Simple Approach (Recommended for MVP/Full with ≤10 clips):**
```tsx
// Keep thumbnails in React state - regenerate on app restart
const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());

const generateThumbnail = async (clipId: string, filePath: string) => {
  const thumbnail = await extractFrameAsBase64(filePath, 1.0); // 1 second in
  setThumbnails(prev => new Map(prev).set(clipId, thumbnail));
};
```

**Advanced Strategies (For 30+ clips):**

**1. Lazy Loading:**
```tsx
const ThumbnailImage = ({ clip }) => {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef();
  
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setLoaded(true);
        observer.disconnect();
      }
    });
    
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);
  
  return (
    <div ref={imgRef}>
      {loaded ? <img src={clip.thumbnail} /> : <Skeleton />}
    </div>
  );
};
```

**2. Generate Thumbnails on Import:**
```typescript
// Extract frame at 1 second
const generateThumbnail = (videoPath: string): Promise<string> => {
  return new Promise((resolve) => {
    const outputPath = path.join(tempDir, `${clipId}-thumb.jpg`);
    
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['1'],
        filename: 'thumb.jpg',
        folder: tempDir,
        size: '160x90'
      })
      .on('end', () => resolve(outputPath));
  });
};
```

**3. Cache Thumbnails:**
- Store in `~/.clipforge/thumbnails/`
- Use video file hash as filename
- Persist between sessions

---

### Memory Management
**Effort:** Moderate  
**Priority:** Medium (if seeing crashes/slowdowns)

**Common Issues:**

**1. Node.js Heap Limits**

Node.js has a default heap limit of ~1.4GB. Video processing can exceed this.

**Symptoms:**
- "JavaScript heap out of memory" errors
- App crashes during export
- Crashes when processing 4K video or many clips

**Solution - Increase heap size:**
```json
// package.json
{
  "scripts": {
    "dev": "electron --js-flags='--max-old-space-size=4096' .",
    "start": "electron --js-flags='--max-old-space-size=4096' ."
  }
}
```

Or set in main process startup:
```typescript
// electron/main/index.ts
import { app } from 'electron';

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096'); // 4GB
```

**Trade-offs:**
- Allows processing larger videos
- Uses more system RAM
- Can slow down machine if set too high
- For 1080p video and <50 clips, default is usually fine

**When to use:**
- Processing 4K video
- Exporting videos >10 minutes
- Working with >50 clips
- Getting memory errors

---

**2. Video Element Cleanup**
```tsx
useEffect(() => {
  const video = videoRef.current;
  
  return () => {
    // Clean up when component unmounts
    if (video) {
      video.pause();
      video.src = '';
      video.load(); // Release resources
    }
  };
}, []);
```

**3. FFmpeg Process Cleanup**
```typescript
const exportProcess = ffmpeg(/* ... */);

// Allow cancellation
const cancelExport = () => {
  exportProcess.kill('SIGKILL');
};
```

**4. Monitor with Chrome DevTools**
- Heap snapshots to find memory leaks
- Performance profiler for bottlenecks
- Look for detached DOM nodes

---

## D. User Experience Enhancements

### Keyboard Shortcuts
**Effort:** Moderate  
**Priority:** High (power users demand this)

**Essential Shortcuts:**
```typescript
const keyboardShortcuts = {
  'Space': 'Play/Pause',
  'Delete': 'Delete selected clip',
  'Cmd+Z': 'Undo',
  'Cmd+Shift+Z': 'Redo',
  'Cmd+S': 'Save project',
  'Cmd+E': 'Export',
  'I': 'Set in point',
  'O': 'Set out point',
  'S': 'Split at playhead',
  'J': 'Play backward',
  'K': 'Pause',
  'L': 'Play forward',
  'Left': 'Move playhead back 1 frame',
  'Right': 'Move playhead forward 1 frame',
  'Shift+Left': 'Move playhead back 1 second',
  'Shift+Right': 'Move playhead forward 1 second',
};

// Implementation
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Prevent shortcuts when typing in input fields
    if (e.target instanceof HTMLInputElement) return;
    
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'KeyS' && !e.metaKey) {
      splitAtPlayhead();
    }
    // ... more shortcuts
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [/* dependencies */]);
```

**Advanced:** Custom keybinding editor
- Let users remap shortcuts
- Store preferences in config file

---

### Undo/Redo
**Effort:** Large  
**Priority:** High (expected feature)

**Implementation Strategy:**

**Command Pattern:**
```typescript
interface Command {
  execute: () => void;
  undo: () => void;
}

class AddClipCommand implements Command {
  constructor(
    private clip: TimelineClip,
    private timeline: Timeline
  ) {}
  
  execute() {
    this.timeline.addClip(this.clip);
  }
  
  undo() {
    this.timeline.removeClip(this.clip.id);
  }
}

class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  
  execute(command: Command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack
  }
  
  undo() {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
    }
  }
  
  redo() {
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
    }
  }
}
```

**Challenges:**
- Capturing all state changes
- Memory usage (limit stack size to 50-100 commands)
- Complex operations (batch multiple commands)

**Simpler Alternative (for initial implementation):**
- Store timeline state snapshots
- Limit to last 20 states
- Trade memory for simplicity

---

### Templates & Presets
**Effort:** Moderate  
**Priority:** Medium

**Export Presets:**
```typescript
const EXPORT_PRESETS = {
  'YouTube 1080p': {
    resolution: '1920x1080',
    fps: 30,
    bitrate: '8000k',
    codec: 'libx264',
  },
  'Instagram Reel': {
    resolution: '1080x1920',
    fps: 30,
    bitrate: '5000k',
    codec: 'libx264',
  },
  'TikTok': {
    resolution: '1080x1920',
    fps: 30,
    bitrate: '4500k',
    codec: 'libx264',
  },
};
```

**Project Templates:**
- Tutorial template (screen + webcam PiP)
- Interview template (side-by-side)
- Demo template (full screen + lower third)

**Implementation:**
- JSON files defining clip arrangements
- Load template as starting point

---

### Onboarding & Tooltips
**Effort:** Moderate  
**Priority:** Low to Medium

**First-Time User Experience:**
```tsx
import Joyride from 'react-joyride';

const steps = [
  {
    target: '.import-button',
    content: 'Click here to import video clips',
  },
  {
    target: '.timeline',
    content: 'Drag clips to the timeline to arrange your video',
  },
  {
    target: '.export-button',
    content: 'Export your finished video here',
  },
];

<Joyride steps={steps} run={isFirstTime} />
```

**Contextual Help:**
- Tooltip library (tippy.js)
- Help button in each panel
- Video tutorial links

---

## E. Export & Sharing Enhancements

### Background Export
**Effort:** Moderate to Large  
**Priority:** Medium (nice quality-of-life improvement)

**Implementation:**
- Run FFmpeg in separate Electron window (hidden)
- Continue editing in main window
- Notify when export complete

**Challenges:**
- State management across processes
- What if user modifies timeline during export?
  - Solution: Export uses snapshot of timeline at export start

---

### Direct Upload Integration
**Effort:** Large  
**Priority:** Low (requires backend or OAuth)

**Options:**

**1. YouTube Upload:**
- Use YouTube Data API
- Requires OAuth flow
- Upload via resumable upload protocol

**2. Google Drive/Dropbox:**
- Simpler OAuth
- Just file upload, no video-specific handling

**3. Cloud Hosting with Shareable Links:**
- Requires your own backend
- Upload to S3/GCS
- Generate public URL
- Effort: Very Large

**Recommendation:** Defer until product validation

---

### Export Queue
**Effort:** Moderate  
**Priority:** Low

**Use Case:** Batch export multiple projects overnight

**Implementation:**
```typescript
interface ExportJob {
  id: string;
  projectPath: string;
  outputPath: string;
  preset: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
}

const exportQueue: ExportJob[] = [];

const processQueue = async () => {
  for (const job of exportQueue) {
    if (job.status === 'queued') {
      job.status = 'processing';
      try {
        await exportProject(job);
        job.status = 'complete';
      } catch (error) {
        job.status = 'failed';
      }
    }
  }
};
```

---

## F. Architecture Evolution

### Backend Services Decision Tree

**When to Add Backend:**

**Scenario 1: User Accounts**
- If you want to save projects to cloud
- If you want usage analytics
- **Complexity:** Medium
- **Tech:** Firebase, Supabase, or custom Node.js backend

**Scenario 2: Cloud Rendering**
- If export times > 5 minutes regularly
- If targeting low-end machines
- **Complexity:** High
- **Tech:** AWS MediaConvert, GCP Transcoder API, or custom workers
- **Cost:** Significant (compute + storage)

**Scenario 3: Asset Library**
- If providing stock video/music
- If enabling collaboration
- **Complexity:** Medium to High
- **Tech:** CDN + database

**Scenario 4: Collaboration**
- If building team features (comments, review)
- **Complexity:** Very High
- **Tech:** WebSocket server, real-time database

**Current Recommendation:** Stay local-only
- Simpler privacy story
- No ongoing hosting costs
- Easier to monetize (one-time purchase vs. subscription)

---

### State Management Evolution

**Current (MVP/Full):** React useState/useReducer

**When to Upgrade:**

**Scenario 1: State gets complex (>10 pieces of related state)**
- **Upgrade to:** Zustand or Jotai
- Simpler than Redux, less boilerplate
- Good for medium complexity

**Scenario 2: Need time-travel debugging / undo-redo**
- **Upgrade to:** Redux + Redux Toolkit
- Built-in dev tools
- Middleware for logging

**Scenario 3: Want derived state / memoization**
- **Upgrade to:** Recoil or Jotai
- Atom-based state
- Automatic dependency tracking

**For ClipForge:** Zustand likely sweet spot if you outgrow useState

```typescript
// Example Zustand store
import create from 'zustand';

const useStore = create((set) => ({
  clips: [],
  timelineClips: [],
  playheadPosition: 0,
  
  addClip: (clip) => set((state) => ({
    clips: [...state.clips, clip]
  })),
  
  setPlayhead: (position) => set({ playheadPosition: position }),
}));
```

---

### Testing Strategy

**Current:** Manual testing

**Progressive Testing Approach:**

**Phase 1: E2E Tests (Highest ROI)**
```typescript
// Use Playwright for Electron
import { test, expect } from '@playwright/test';

test('import and export video', async ({ page }) => {
  await page.click('.import-button');
  await page.setInputFiles('input[type="file"]', 'test-video.mp4');
  await expect(page.locator('.timeline-clip')).toBeVisible();
  
  await page.click('.export-button');
  await page.waitForSelector('.export-complete');
});
```

**Phase 2: Integration Tests**
- Test FFmpeg integration
- Test file operations
- Test IPC communication

**Phase 3: Unit Tests**
- Pure functions (timeline calculations, time formatting, etc.)
- Use Vitest (fast, Vite-native)

**When to Add:**
- E2E: Before scaling to more platforms
- Integration: If bugs are frequent
- Unit: For complex logic (not immediately necessary)

---

### Monitoring & Analytics

**Options:**

**1. Crash Reporting:**
- Sentry for Electron
- Automatically captures exceptions
- Stack traces for debugging

**2. Usage Analytics:**
- PostHog (open-source)
- Mixpanel
- Custom events (feature usage, export counts, etc.)

**3. Performance Monitoring:**
- Electron's built-in performance API
- Track app launch time, export time, etc.

**Privacy Considerations:**
- Always opt-in
- Clearly explain what's collected
- Allow disabling

**When to Add:** After public release, to inform roadmap

---

## G. Competitive Differentiation

Since target user and positioning are TBD, here are strategic angles:

### Option 1: Speed-First Editor
**Focus:** Fastest way to create simple videos
- One-click templates
- Smart defaults
- Minimal UI
- 3 clicks from import to export

### Option 2: Privacy-Focused
**Focus:** All local processing, no cloud
- Marketing angle: "Your videos never leave your computer"
- No account required
- No upload to external servers
- Appeal to privacy-conscious users

### Option 3: Developer-Friendly
**Focus:** Automation and scripting
- CLI for batch processing
- JSON project files (Git-friendly)
- API for programmatic editing
- Target: DevRel creating tutorials

### Option 4: Education-Focused
**Focus:** Teachers and course creators
- Templates for lectures
- Quiz overlays
- Chapter markers
- Export to LMS formats

### Option 5: Screen Recording Specialist
**Focus:** Best screen recorder + basic editing
- High-quality system audio capture
- Window tracking (follow active window)
- Annotation tools during recording
- Compete with Loom, not Premiere

**Recommendation:** Validate with users before committing to positioning

---

## H. Effort Estimates Summary

### Quick Wins (< 1 day)
- Keyboard shortcuts (basic set)
- Export presets
- Timeline zoom enhancements
- Basic tooltips
- CSS performance optimizations

### Medium Features (1-3 days)
- Text overlays
- Basic transitions
- Undo/redo (simple version)
- Background export
- Windows support
- Thumbnail optimization
- Audio controls

### Large Features (3-7 days)
- Canvas timeline migration
- Advanced color correction
- Virtualization (100+ clips)
- Direct upload integration
- Collaborative features
- Complex audio editing

### Very Large (1-2 weeks+)
- Full effects library
- Cloud rendering
- Real-time collaboration
- Backend infrastructure
- Mobile companion app

---

## I. Common Pitfalls & Mitigation (Comprehensive)

### 1. FFmpeg Binary Issues
**Pitfall:** FFmpeg not found in packaged app  
**Symptoms:** Export fails silently, "command not found" errors  
**Mitigation:**
- Bundle FFmpeg in extraResources
- Set path dynamically based on app.isPackaged
- Test packaged app on clean machine
- Include fallback to system FFmpeg

### 2. Video Codec Compatibility
**Pitfall:** Some videos won't import (HEVC, VP9, etc.)  
**Symptoms:** Black screen in preview, FFmpeg errors  
**Mitigation:**
- Check codec with ffprobe before import
- Show error message with codec info
- Consider transcoding on import (slow but reliable)

### 3. Memory Leaks in Long Sessions
**Pitfall:** App becomes sluggish after 30+ minutes  
**Symptoms:** Increasing memory usage, eventual crash  
**Mitigation:**
- Clean up video element sources
- Dispose FFmpeg processes
- Profile with Chrome DevTools
- Implement memory monitoring

### 4. Audio Sync Drift
**Pitfall:** Audio and video out of sync in exports  
**Symptoms:** Lip-sync issues, audio ahead/behind video  
**Mitigation:**
- Use `-vsync cfr` flag in FFmpeg (constant frame rate)
- Avoid variable frame rate sources
- Test with 2+ minute exports

### 5. Timeline Performance Degradation
**Pitfall:** Timeline becomes janky with many clips  
**Symptoms:** Dropped frames when scrubbing, lag when dragging  
**Mitigation:**
- Apply DOM optimizations from Appendix Section C
- Profile with React DevTools
- Consider virtualization at 50+ clips

### 6. Export Quality Issues
**Pitfall:** Exports look pixelated or have artifacts  
**Symptoms:** Visible compression, banding, blockiness  
**Mitigation:**
- Use appropriate bitrate (8000k for 1080p)
- Use `-preset slow` for better quality (slower export)
- Avoid re-encoding if possible (copy codec)

### 7. File Path Issues
**Pitfall:** Paths with spaces or special characters break  
**Symptoms:** FFmpeg errors, files not found  
**Mitigation:**
- Always quote paths in FFmpeg commands
- Use fluent-ffmpeg (handles quoting)
- Test with difficult filenames ("my video (2).mp4")

### 8. Permissions on macOS
**Pitfall:** Screen recording or camera access denied  
**Symptoms:** Black screen, empty source list  
**Mitigation:**
- Request permissions explicitly
- Show helpful error messages
- Link to System Preferences
- Test on fresh macOS install

### 9. State Management Complexity
**Pitfall:** State updates cause unexpected re-renders  
**Symptoms:** Laggy UI, components rendering when they shouldn't  
**Mitigation:**
- Use React DevTools Profiler
- Memoize aggressively
- Separate state by concern (don't co-locate unrelated state)

### 10. Build/Packaging Issues
**Pitfall:** Dev works, production build fails or behaves differently  
**Symptoms:** White screen, missing modules, path errors  
**Mitigation:**
- Test packaged app frequently (not just at end)
- Check process.env.NODE_ENV === 'production'
- Verify all assets included in build
- Test on clean machine without dev tools

---

## J. Recommended Learning Resources

### FFmpeg Mastery
- FFmpeg official documentation
- "FFmpeg Libav Tutorial" by Leo Koppel
- Stack Overflow ffmpeg tag

### Electron Best Practices
- Electron official docs (Security section)
- "Electron in Action" by Steve Kinney
- electron-builder documentation

### Timeline UI Patterns
- Study: DaVinci Resolve, Premiere Pro, Final Cut Pro
- Open source editors: Shotcut, Olive Video Editor
- Web editors: Descript, Runway, Kapwing

### Performance Optimization
- "React Performance Optimization" (official docs)
- "High Performance Browser Networking" (for understanding GPU acceleration)
- Chrome DevTools performance profiling tutorials

---

## K. Post-Submission Roadmap (Example)

This is a sample roadmap if continuing development:

**Week 1 (Nov 4-8):**
- Gather user feedback from demo
- Fix critical bugs
- Add keyboard shortcuts (quick win)

**Week 2 (Nov 11-15):**
- Windows support
- Undo/redo implementation

**Week 3 (Nov 18-22):**
- Text overlays
- Export presets

**Month 2:**
- Transitions
- Audio controls
- Performance optimizations

**Month 3:**
- Effects library
- Advanced features based on user requests

**Quarter 2:**
- Potential backend for cloud features
- Mobile companion app (remote control)

---

## L. Final Recommendations

1. **Ship the MVP Tuesday** - Resist scope creep, it's a gate
2. **Focus Wednesday on recording** - It's the biggest unknown
3. **Test packaged app early** - Don't discover issues at 10 PM Wednesday
4. **Use AI agent for boilerplate** - FFmpeg commands, React components, CSS
5. **Profile before optimizing** - Don't guess where slowness is
6. **Keep it simple** - Simple & working > complex & broken
7. **Document as you go** - Future you will thank present you
8. **Ask for help** - Stack Overflow, Discord, documentation
9. **Take breaks** - 72 hours is a marathon, not a sprint
10. **Submit on time** - Incomplete submission > no submission

---

**END OF PRD**

---

**Document Version:** 1.0  
**Last Updated:** October 27, 2025  
**Target Completion:** October 29, 2025, 10:59 PM CT
