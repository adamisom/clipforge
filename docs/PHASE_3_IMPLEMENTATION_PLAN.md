# ClipForge Phase 3: Multi-Track + Recording Enhancements

**Focus:** Multi-track timeline with PiP support, simultaneous recording, audio mixing, and timeline zoom

**Estimated Effort:** ~35 hours (4-5 full days)

---

## Overview

Phase 3 transforms ClipForge from a single-track sequential editor to a professional multi-track editor with picture-in-picture support, simultaneous screen+webcam recording, and advanced timeline controls.

### Key Features

1. ✅ **Multi-track timeline** (2 tracks: Track 0 main, Track 1 PiP overlay)
2. ✅ **Simultaneous screen + webcam recording** (separate files, composite on export)
3. ✅ **PiP position/size presets** (4 positions × 3 sizes)
4. ✅ **Audio mixing controls** (volume sliders per track)
5. ✅ **Timeline zoom** (mouse wheel + menu + keyboard shortcuts)

### Deferred to Phase 4

- Drag-to-rearrange clips
- Delete clips
- Project save/load
- Error handling improvements
- Loading states
- Performance optimizations
- Export presets
- Keyboard shortcuts help panel
- Security fix + DMG distribution

---

## Design Decisions

### Multi-Track Architecture

**Hybrid Auto-Assignment:**
- Webcam recordings → Auto-assign to Track 1 (PiP)
- Screen recordings → Auto-assign to Track 0 (main)
- Imported videos → Auto-assign to Track 0 (main)
- Context menu option: "Move to Track 0/1" for manual override

**Track Behavior:**
- Track 0: Full-frame video (main content)
- Track 1: Overlay rendered on top during export (PiP)
- Clips on Track 1 render at preset position/size over Track 0

### PiP Configuration

**4 Preset Positions:**
- Bottom-Right (default)
- Bottom-Left
- Top-Right
- Top-Left

**3 Preset Sizes:**
- Small: 15% of main video width
- Medium: 25% of main video width (default)
- Large: 40% of main video width

**UI Location:** Dropdown in export dialog

### Simultaneous Recording

**Implementation:** Option B from planning (separate recordings)
- Start two `MediaRecorder` instances simultaneously (same event loop tick)
- Screen recording → saved to Track 0
- Webcam recording → saved to Track 1
- FFmpeg overlay filter composites on export

**UI:** New menu item: "Record Screen + Webcam" (Cmd+Shift+B)

### Audio Mixing

**Controls:**
- Track 0 audio: Volume slider 0-200% (default 100%)
- Track 1 audio: Volume slider 0-200% (default 100%)
- UI location: Export dialog
- FFmpeg implementation: `-filter:a volume=` filters

### Timeline Zoom

**Zoom Methods:**
1. Mouse wheel: Cmd/Ctrl + scroll
2. Menu bar: View → Zoom In/Out/Reset
3. Keyboard: Cmd+/Cmd-/Cmd+0
4. UI controls: +/− buttons near timeline

**Zoom Parameters:**
- Min: 10 px/sec (very zoomed out, good for 10+ min videos)
- Max: 200 px/sec (very zoomed in, frame-accurate)
- Default: 50 px/sec (current auto-scale baseline)
- **Zoom center:** Playhead position (keeps playhead visually stable)

---

## Phase Breakdown

### **Phase A: Multi-Track Timeline Foundation** (~8 hours)

**Goal:** Extend state and UI to support 2-track timeline

#### A.1: Update State Structure (~1 hour)

**Files to Update:**
- `src/renderer/src/types/timeline.ts`
- `src/renderer/src/hooks/useClips.ts`

**Changes:**
```typescript
// Add trackIndex to TimelineClip
interface TimelineClip {
  // ... existing fields
  trackIndex: 0 | 1  // NEW: Track assignment
}

// Update clip creation functions
const createClipFromMetadata = (..., sourceType) => {
  const trackIndex = sourceType === 'webcam' ? 1 : 0  // Auto-assign
  return { ..., trackIndex }
}
```

**Testing Checkpoint:**
- Import video → verify `trackIndex: 0`
- No visual changes yet (just state prep)

---

#### A.2: Render Two-Track Timeline UI (~3 hours)

**Files to Update:**
- `src/renderer/src/components/Timeline.tsx`
- `src/renderer/src/assets/main.css`

**Changes:**
```tsx
// Timeline.tsx - render two tracks vertically
<div className="timeline">
  <div className="timeline-track" data-track="0">
    {clips.filter(c => c.trackIndex === 0).map(clip => 
      <TimelineClip ... />
    )}
  </div>
  
  <div className="timeline-track" data-track="1">
    {clips.filter(c => c.trackIndex === 1).map(clip => 
      <TimelineClip ... />
    )}
  </div>
  
  <div className="playhead" ... />
</div>
```

**CSS:**
```css
.timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeline-track {
  height: 80px;
  background: #2a2a2a;
  border: 1px solid #444;
  position: relative;
}

.timeline-track[data-track="0"] {
  /* Main track - slightly taller */
  height: 100px;
}

.timeline-track[data-track="1"] {
  /* PiP track - slightly shorter */
  height: 60px;
  opacity: 0.9;
}

.timeline-clip[data-track="1"] {
  /* Visual distinction for PiP clips */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

**Testing Checkpoint:**
- Import video → appears on Track 0
- Two empty track lanes visible
- Playhead spans both tracks vertically

---

#### A.3: Context Menu for Track Assignment (~2 hours)

**Files to Update:**
- `src/renderer/src/components/Timeline.tsx`

**Changes:**
```tsx
const [contextMenu, setContextMenu] = useState<{
  visible: boolean
  x: number
  y: number
  clipId: string | null
}>({ visible: false, x: 0, y: 0, clipId: null })

const handleClipRightClick = (e: React.MouseEvent, clipId: string) => {
  e.preventDefault()
  setContextMenu({
    visible: true,
    x: e.clientX,
    y: e.clientY,
    clipId
  })
}

const handleMoveToTrack = (trackIndex: 0 | 1) => {
  if (contextMenu.clipId) {
    updateClip(contextMenu.clipId, { trackIndex })
    setContextMenu({ visible: false, x: 0, y: 0, clipId: null })
  }
}

// Render context menu
{contextMenu.visible && (
  <div 
    className="context-menu"
    style={{ left: contextMenu.x, top: contextMenu.y }}
  >
    <button onClick={() => handleMoveToTrack(0)}>
      Move to Track 0 (Main)
    </button>
    <button onClick={() => handleMoveToTrack(1)}>
      Move to Track 1 (PiP)
    </button>
  </div>
)}
```

**Testing Checkpoint:**
- Right-click clip → context menu appears
- "Move to Track 1" → clip moves to Track 1
- "Move to Track 0" → clip returns to Track 0

**⚠️ Note:** Add click-outside handler to close context menu (overlay with onClick to dismiss).

---

#### A.4: Multi-Track Playback Logic (~2 hours)

**Files to Update:**
- `src/renderer/src/hooks/useMultiClipPlayback.ts`
- `src/renderer/src/components/VideoPreview.tsx`

**Changes:**
```typescript
// useMultiClipPlayback.ts
// CRITICAL: Calculate positions PER TRACK, not globally
const currentClip = useMemo(() => {
  const track0Clips = clips.filter(c => c.trackIndex === 0)
  const track0Positions = calculateClipPositions(track0Clips)  // Calculate for Track 0 only
  return getCurrentClip(track0Clips, track0Positions, playheadPosition)
}, [clips, playheadPosition])

// Note: Track 1 clips are NOT played back in preview
// They only appear during export as overlay
```

**VideoPreview.tsx:**
```tsx
// No changes needed - continues to play Track 0 only
// Track 1 is "overlay metadata" that affects export, not preview
```

**Testing Checkpoint:**
- Import video on Track 0 → plays normally
- Move clip to Track 1 → preview shows blank (expected)
- Add clip to Track 0 + clip on Track 1 → Track 0 plays

---

### **Phase B: Simultaneous Screen + Webcam Recording** (~6 hours)

**Goal:** Record screen and webcam simultaneously, save to separate tracks

#### B.1: New Recording Component (~3 hours)

**Files to Create:**
- `src/renderer/src/components/SimultaneousRecorder.tsx`

**Implementation:**
```tsx
const SimultaneousRecorder = ({ onComplete, onClose }) => {
  const [stage, setStage] = useState<'source-select' | 'countdown' | 'recording'>('source-select')
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)
  const screenRecorderRef = useRef<MediaRecorder | null>(null)
  const webcamRecorderRef = useRef<MediaRecorder | null>(null)
  
  const startRecording = async () => {
    // Get both streams
    const screen = await getScreenStream(selectedSourceId)
    const webcam = await getWebcamStream()
    
    setScreenStream(screen)
    setWebcamStream(webcam)
    
    // Create recorders
    screenRecorderRef.current = new MediaRecorder(screen)
    webcamRecorderRef.current = new MediaRecorder(webcam)
    
    // Start both in same event loop tick (for sync)
    screenRecorderRef.current.start()
    webcamRecorderRef.current.start()
    
    setStage('recording')
  }
  
  const stopRecording = async () => {
    // Stop both
    screenRecorderRef.current?.stop()
    webcamRecorderRef.current?.stop()
    
    // Wait for both blobs
    const [screenBlob, webcamBlob] = await Promise.all([
      getBlobFromRecorder(screenRecorderRef.current),
      getBlobFromRecorder(webcamRecorderRef.current)
    ])
    
    onComplete({ screenBlob, webcamBlob })
  }
  
  // ... render screen picker, countdown, recording UI
}
```

**Testing Checkpoint:**
- Click "Record Screen + Webcam"
- Select screen source → shows webcam preview + countdown
- Recording indicator shows both "Screen" + "Webcam" active
- Stop → both recordings saved

**⚠️ Note:** Simultaneous recordings may have slightly different durations (±0.1s) due to MediaRecorder timing. Use recording timer as source of truth for both clips, not individual blob durations. Also add error handling for permission denials and stream failures.

---

#### B.2: Dual Recording Handler in App (~2 hours)

**Files to Update:**
- `src/renderer/src/hooks/useRecording.ts`
- `src/renderer/src/App.tsx`

**Changes:**
```typescript
// useRecording.ts
const [showSimultaneousRecorder, setShowSimultaneousRecorder] = useState(false)

const handleSimultaneousRecordingComplete = async (
  screenBlob: Blob,
  webcamBlob: Blob,
  screenDuration: number,
  webcamDuration: number
) => {
  setShowSimultaneousRecorder(false)
  
  try {
    // Save both to temp
    const screenPath = await window.api.saveRecordingBlob(await screenBlob.arrayBuffer())
    const webcamPath = await window.api.saveRecordingBlob(await webcamBlob.arrayBuffer())
    
    // Prompt for screen save
    const screenSaveResult = await window.api.saveRecordingPermanent(screenPath)
    
    // Prompt for webcam save
    const webcamSaveResult = await window.api.saveRecordingPermanent(webcamPath)
    
    // Get metadata for both
    const screenMetadata = await window.api.getVideoMetadata(screenSaveResult.path)
    const webcamMetadata = await window.api.getVideoMetadata(webcamSaveResult.path)
    
    // Create clips
    const screenClip = createClipFromMetadata('screen', screenSaveResult.path, screenMetadata, screenDuration)
    screenClip.trackIndex = 0  // Main track
    
    const webcamClip = createClipFromMetadata('webcam', webcamSaveResult.path, webcamMetadata, webcamDuration)
    webcamClip.trackIndex = 1  // PiP track
    
    // Add both
    onClipAdded(screenClip)
    onClipAdded(webcamClip)
    
    // Select screen clip
    onClipSelected(screenClip.id)
  } catch (error) {
    console.error('Failed to save simultaneous recording:', error)
  }
}
```

**Testing Checkpoint:**
- Complete simultaneous recording
- Prompted to save screen recording
- Prompted to save webcam recording
- Screen clip appears on Track 0
- Webcam clip appears on Track 1

---

#### B.3: Menu Integration (~1 hour)

**Files to Update:**
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`

**Changes:**
```typescript
// src/main/index.ts - Add menu item
{
  label: 'Record',
  submenu: [
    {
      label: 'Record Webcam',
      accelerator: 'CmdOrCtrl+Shift+W',
      click: () => mainWindow.webContents.send('menu-record-webcam')
    },
    {
      label: 'Record Screen',
      accelerator: 'CmdOrCtrl+Shift+R',
      click: () => mainWindow.webContents.send('menu-record-screen')
    },
    { type: 'separator' },
    {
      label: 'Record Screen + Webcam',  // NEW
      accelerator: 'CmdOrCtrl+Shift+B',
      click: () => mainWindow.webContents.send('menu-record-simultaneous')
    }
  ]
}

// Preload: expose listener
onMenuRecordSimultaneous: (callback) => 
  ipcRenderer.on('menu-record-simultaneous', callback)
```

**Testing Checkpoint:**
- Menu → "Record Screen + Webcam" → opens SimultaneousRecorder
- Cmd+Shift+B → opens SimultaneousRecorder

---

### **Phase C: PiP Position/Size Configuration** (~4 hours)

**Goal:** Allow users to choose where and how big the PiP overlay appears

#### C.1: PiP Config State & UI (~2 hours)

**Files to Update:**
- `src/renderer/src/components/VideoEditor.tsx` (or create new `ExportDialog.tsx`)
- `src/renderer/src/assets/main.css`

**Changes:**
```tsx
const [pipConfig, setPipConfig] = useState<{
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  size: 'small' | 'medium' | 'large'
}>({
  position: 'bottom-right',
  size: 'medium'
})

// In export dialog (shown before export)
<div className="export-dialog">
  <h3>Export Settings</h3>
  
  <div className="export-option">
    <label>PiP Position:</label>
    <select 
      value={pipConfig.position}
      onChange={(e) => setPipConfig(prev => ({ ...prev, position: e.target.value }))}
    >
      <option value="bottom-right">⬊ Bottom-Right</option>
      <option value="bottom-left">⬋ Bottom-Left</option>
      <option value="top-right">⬈ Top-Right</option>
      <option value="top-left">⬉ Top-Left</option>
    </select>
  </div>
  
  <div className="export-option">
    <label>PiP Size:</label>
    <select 
      value={pipConfig.size}
      onChange={(e) => setPipConfig(prev => ({ ...prev, size: e.target.value }))}
    >
      <option value="small">Small (15%)</option>
      <option value="medium">Medium (25%)</option>
      <option value="large">Large (40%)</option>
    </select>
  </div>
  
  <button onClick={() => handleExportWithPiP(pipConfig)}>Export</button>
</div>
```

**Testing Checkpoint:**
- Click Export with Track 1 clips → shows PiP config dialog
- Change position dropdown → selection updates
- Change size dropdown → selection updates

---

#### C.2: Multi-Track Export with PiP (~2 hours)

**Files to Update:**
- `src/main/index.ts` (add new IPC handler `export-multi-track`)

**Implementation:**
```typescript
ipcMain.handle('export-multi-track', async (event, { 
  track0Clips, 
  track1Clips, 
  pipConfig, 
  outputPath 
}) => {
  try {
    // CRITICAL: Check if tracks have different durations
    const track0Duration = getTotalDuration(track0Clips)
    const track1Duration = getTotalDuration(track1Clips)
    
    if (Math.abs(track0Duration - track1Duration) > 0.5) {
      // Duration mismatch > 0.5 seconds
      console.warn(`Track duration mismatch: Track 0=${track0Duration}s, Track 1=${track1Duration}s`)
      // FFmpeg will overlay for shortest duration, then continue Track 0 alone
      // Consider showing warning to user in renderer
    }
    
    // Export Track 0 to temp file (concatenated)
    const track0TempPath = path.join(os.tmpdir(), 'clipforge-track0-temp.mp4')
    await exportMultiClip(track0Clips, track0TempPath)
    
    // Export Track 1 to temp file (concatenated)
    const track1TempPath = path.join(os.tmpdir(), 'clipforge-track1-temp.mp4')
    await exportMultiClip(track1Clips, track1TempPath)
    
    // Calculate PiP overlay position based on config
    const { x, y, scale } = calculatePipPosition(pipConfig)
    
    // Use FFmpeg overlay filter
    return new Promise((resolve, reject) => {
      ffmpeg(track0TempPath)
        .input(track1TempPath)
        .complexFilter([
          `[1:v]scale=iw*${scale}:ih*${scale}[pip]`,  // Resize Track 1
          `[0:v][pip]overlay=${x}:${y}[out]`          // Position overlay
        ])
        .map('[out]')
        .output(outputPath)
        .on('progress', (progress) => {
          mainWindow.webContents.send('export-progress', progress.percent)
        })
        .on('end', () => {
          // Cleanup temp files
          fs.unlinkSync(track0TempPath)
          fs.unlinkSync(track1TempPath)
          resolve({ success: true })
        })
        .on('error', reject)
        .run()
    })
  } catch (error) {
    return { success: false, error: error.message }
  }
})

function calculatePipPosition(pipConfig) {
  const sizeMap = {
    small: 0.15,
    medium: 0.25,
    large: 0.40
  }
  
  const scale = sizeMap[pipConfig.size]
  const padding = 20
  
  const positionMap = {
    'bottom-right': { x: `main_w-overlay_w-${padding}`, y: `main_h-overlay_h-${padding}` },
    'bottom-left': { x: padding, y: `main_h-overlay_h-${padding}` },
    'top-right': { x: `main_w-overlay_w-${padding}`, y: padding },
    'top-left': { x: padding, y: padding }
  }
  
  return { ...positionMap[pipConfig.position], scale }
}
```

**Testing Checkpoint:**
- Export with Track 0 + Track 1 clips
- PiP appears in selected position
- PiP size matches selected size
- Audio from both tracks mixes

---

### **Phase D: Audio Mixing Controls** (~3 hours)

**Goal:** Allow users to adjust relative volume of each track

#### D.1: Audio Mix UI (~1 hour)

**Files to Update:**
- `src/renderer/src/components/VideoEditor.tsx` (or `ExportDialog.tsx`)

**Changes:**
```tsx
const [audioMix, setAudioMix] = useState({
  track0Volume: 100,  // Percentage
  track1Volume: 100
})

// Add to export dialog
<div className="export-option">
  <label>Track 0 Audio: {audioMix.track0Volume}%</label>
  <input 
    type="range" 
    min="0" 
    max="200" 
    value={audioMix.track0Volume}
    onChange={(e) => setAudioMix(prev => ({ ...prev, track0Volume: parseInt(e.target.value) }))}
  />
</div>

<div className="export-option">
  <label>Track 1 Audio: {audioMix.track1Volume}%</label>
  <input 
    type="range" 
    min="0" 
    max="200" 
    value={audioMix.track1Volume}
    onChange={(e) => setAudioMix(prev => ({ ...prev, track1Volume: parseInt(e.target.value) }))}
  />
</div>
```

**Testing Checkpoint:**
- Drag slider → percentage updates
- Values persist until export

---

#### D.2: FFmpeg Audio Mixing (~2 hours)

**Files to Update:**
- `src/main/index.ts` (update `export-multi-track` handler)

**Changes:**
```typescript
// In export-multi-track handler
// CRITICAL: Handle single-track exports (no Track 1)
const hasTrack1 = track1Clips.length > 0

const videoFilters = [
  `[1:v]scale=iw*${scale}:ih*${scale}[pip]`,
  `[0:v][pip]overlay=${x}:${y}[out]`
]

const audioFilters = hasTrack1
  ? [
      `[0:a]volume=${audioMix.track0Volume / 100}[a0]`,
      `[1:a]volume=${audioMix.track1Volume / 100}[a1]`,
      `[a0][a1]amix=inputs=2:duration=first[aout]`
    ]
  : [
      `[0:a]volume=${audioMix.track0Volume / 100}[aout]`
    ]

ffmpeg(track0TempPath)
  .input(hasTrack1 ? track1TempPath : null)
  .complexFilter([...videoFilters, ...audioFilters])
  .map('[out]')    // Video output
  .map('[aout]')   // Audio output
  .output(outputPath)
  .run()
```

**Testing Checkpoint:**
- Export with track0Volume=50%, track1Volume=100%
- Track 0 audio quieter, Track 1 normal
- Export with track0Volume=200%, track1Volume=50%
- Track 0 louder, Track 1 quieter

---

### **Phase E: Timeline Zoom** (~8 hours)

**Goal:** Allow zooming in/out of timeline for precision editing

#### E.1: Zoom State Management (~1 hour)

**Files to Update:**
- `src/renderer/src/components/Timeline.tsx`

**Changes:**
```tsx
const [zoomLevel, setZoomLevel] = useState(50)  // px per second
const MIN_ZOOM = 10
const MAX_ZOOM = 200

const zoomIn = () => setZoomLevel(prev => Math.min(prev * 1.2, MAX_ZOOM))
const zoomOut = () => setZoomLevel(prev => Math.max(prev / 1.2, MIN_ZOOM))
const resetZoom = () => setZoomLevel(50)
```

**Testing Checkpoint:**
- `zoomLevel` state exists and updates
- No visual changes yet

---

#### E.2: Mouse Wheel Zoom (~2 hours)

**Files to Update:**
- `src/renderer/src/components/Timeline.tsx`

**Changes:**
```tsx
const timelineRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const handleWheel = (e: WheelEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      
      if (e.deltaY < 0) {
        zoomIn()
      } else {
        zoomOut()
      }
    }
  }
  
  const timeline = timelineRef.current
  if (timeline) {
    timeline.addEventListener('wheel', handleWheel, { passive: false })
    return () => timeline.removeEventListener('wheel', handleWheel)
  }
}, [])

// Apply zoomLevel to clip widths
const clipWidth = clip.timelineDuration * zoomLevel  // Use zoomLevel instead of fixed pixelsPerSecond
```

**Testing Checkpoint:**
- Cmd+scroll up → timeline zooms in (clips wider)
- Cmd+scroll down → timeline zooms out (clips narrower)
- Zoom clamped to MIN/MAX

**⚠️ Note:** Pass `zoomLevel` as prop to child components that calculate clip widths.

---

#### E.3: Zoom to Playhead (Not Viewport Center) (~1 hour)

**Files to Update:**
- `src/renderer/src/components/Timeline.tsx`

**Changes:**
```tsx
const [scrollLeft, setScrollLeft] = useState(0)

const zoomInWithPlayhead = () => {
  const timeline = timelineRef.current
  if (!timeline) return
  
  const oldZoom = zoomLevel
  const newZoom = Math.min(oldZoom * 1.2, MAX_ZOOM)
  
  // Calculate playhead position before zoom
  const playheadOffsetBefore = playheadPosition * oldZoom
  const playheadViewportPosBefore = playheadOffsetBefore - timeline.scrollLeft
  
  // Update zoom
  setZoomLevel(newZoom)
  
  // Calculate new scroll position to keep playhead in same visual spot
  const playheadOffsetAfter = playheadPosition * newZoom
  const newScrollLeft = playheadOffsetAfter - playheadViewportPosBefore
  
  timeline.scrollLeft = newScrollLeft
}

// Similar for zoomOut
```

**Testing Checkpoint:**
- Position playhead mid-timeline
- Zoom in → playhead stays in same visual position
- Zoom out → playhead stays in same visual position

**⚠️ Note:** Use `useLayoutEffect` instead of `useEffect` for scroll manipulation to prevent flicker.

---

#### E.4: Menu Bar Zoom Controls (~2 hours)

**Files to Update:**
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/components/Timeline.tsx`

**Changes:**
```typescript
// src/main/index.ts - Add View menu
{
  label: 'View',
  submenu: [
    {
      label: 'Zoom In',
      accelerator: 'CmdOrCtrl+=',
      click: () => mainWindow.webContents.send('zoom-in')
    },
    {
      label: 'Zoom Out',
      accelerator: 'CmdOrCtrl+-',
      click: () => mainWindow.webContents.send('zoom-out')
    },
    {
      label: 'Reset Zoom',
      accelerator: 'CmdOrCtrl+0',
      click: () => mainWindow.webContents.send('zoom-reset')
    }
  ]
}

// Preload: expose listeners
onZoomIn: (callback) => ipcRenderer.on('zoom-in', callback),
onZoomOut: (callback) => ipcRenderer.on('zoom-out', callback),
onZoomReset: (callback) => ipcRenderer.on('zoom-reset', callback)

// Timeline.tsx: listen for events
useEffect(() => {
  window.api.onZoomIn(zoomIn)
  window.api.onZoomOut(zoomOut)
  window.api.onZoomReset(resetZoom)
  
  return () => {
    window.api.removeAllListeners('zoom-in')
    window.api.removeAllListeners('zoom-out')
    window.api.removeAllListeners('zoom-reset')
  }
}, [])
```

**Testing Checkpoint:**
- Menu → View → Zoom In → timeline zooms in
- Cmd+= → zooms in
- Cmd+− → zooms out
- Cmd+0 → resets to default

---

#### E.5: Zoom UI Controls (~2 hours)

**Files to Update:**
- `src/renderer/src/components/Timeline.tsx`
- `src/renderer/src/assets/main.css`

**Changes:**
```tsx
// Add zoom controls near timeline
<div className="timeline-controls">
  <button onClick={zoomOut} disabled={zoomLevel <= MIN_ZOOM}>−</button>
  <span className="zoom-level">{Math.round(zoomLevel)}px/sec</span>
  <button onClick={zoomIn} disabled={zoomLevel >= MAX_ZOOM}>+</button>
  <button onClick={resetZoom} className="zoom-reset">Reset</button>
</div>
```

**CSS:**
```css
.timeline-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
}

.timeline-controls button {
  padding: 4px 12px;
  font-size: 18px;
  background: #333;
  border: 1px solid #555;
  color: white;
  cursor: pointer;
}

.timeline-controls button:hover:not(:disabled) {
  background: #444;
}

.timeline-controls button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.zoom-level {
  min-width: 80px;
  text-align: center;
  color: #888;
  font-size: 12px;
}
```

**Testing Checkpoint:**
- Click "+" → zooms in
- Click "−" → zooms out
- Click "Reset" → returns to 50px/sec
- Buttons disable at MIN/MAX

---

### **Phase F: Integration & Testing** (~6 hours)

**Goal:** Ensure all Phase 3 features work together seamlessly

#### F.1: End-to-End Multi-Track Workflow (~2 hours)

**Manual Testing Scenarios:**

1. **Basic Multi-Track:**
   - Import video → appears on Track 0
   - Record webcam → auto-appears on Track 1
   - Export → PiP overlay works

2. **Simultaneous Recording:**
   - Record Screen + Webcam
   - Save both recordings
   - Verify Track 0 has screen, Track 1 has webcam
   - Export → overlay correct

3. **Track Reassignment:**
   - Import video → Track 0
   - Right-click → Move to Track 1
   - Verify clip moves
   - Export → works as PiP

4. **PiP Configuration:**
   - Add clips to both tracks
   - Export → change position to top-left
   - Verify overlay position
   - Export → change size to large
   - Verify overlay size

5. **Audio Mixing:**
   - Add clips with audio to both tracks
   - Export → Track 0 at 50%, Track 1 at 150%
   - Verify audio levels

6. **Timeline Zoom:**
   - Add 3+ clips
   - Zoom in (Cmd+=) → clips wider
   - Zoom out (Cmd+-) → clips narrower
   - Verify playhead stays centered during zoom
   - Reset (Cmd+0) → returns to default

---

#### F.2: Bug Fixes & Polish (~3 hours)

**Expected Issues to Address:**

- Audio sync drift in simultaneous recording
- PiP overlay clipping at edges
- Timeline scroll position jumping during zoom
- Context menu positioning at screen edges
- Export progress not updating for multi-track
- Memory leaks from multiple MediaRecorder instances

**Files Likely to Update:**
- `src/renderer/src/components/SimultaneousRecorder.tsx`
- `src/renderer/src/components/Timeline.tsx`
- `src/main/index.ts`

---

#### F.3: Update Documentation (~1 hour)

**Files to Update:**
- `docs/ARCHITECTURE.md` (add multi-track section)
- `docs/MANUAL_TESTING_GUIDE.md` (add Phase 3 test scenarios)

---

### **Phase G: Commit & Deploy** (~1 hour)

**Goal:** Package Phase 3 changes for testing

#### G.1: Validation (~30 min)

```bash
npm run validate
```

Fix any linting/typecheck errors.

---

#### G.2: Commit (~15 min)

```bash
git add -A
git commit -m "feat: Phase 3 - Multi-track timeline + simultaneous recording + zoom

✨ New Features:
- Multi-track timeline (Track 0: main, Track 1: PiP overlay)
- Simultaneous screen + webcam recording
- PiP position/size presets (4 positions × 3 sizes)
- Audio mixing controls (volume per track)
- Timeline zoom (mouse wheel, menu, keyboard, UI controls)

🎨 UI Improvements:
- Two-track timeline layout
- Context menu for track assignment
- Export dialog with PiP/audio config
- Zoom controls near timeline

🔧 Technical:
- Multi-track export with FFmpeg overlay filter
- Audio mixing with FFmpeg amix filter
- Zoom-to-playhead logic
- Dual MediaRecorder management

📦 Files Added:
- src/renderer/src/components/SimultaneousRecorder.tsx

📝 Files Updated:
- Timeline.tsx, VideoEditor.tsx, useClips.ts, useRecording.ts
- src/main/index.ts (export-multi-track handler)
- types/timeline.ts (trackIndex field)
- main.css (multi-track styles)

⚡ Phase 3 Complete - Ready for Testing"
```

---

#### G.3: Build & Test Packaged App (~15 min)

```bash
npm run build
npm run build:mac
```

**Test packaged app:**
- Multi-track workflow
- Simultaneous recording
- Export with PiP
- Timeline zoom

---

## Testing Checklist

### Manual Testing (Do this after Phase G)

**Multi-Track Timeline:**
- [ ] Import video → appears on Track 0
- [ ] Record webcam → appears on Track 1
- [ ] Right-click → Move to Track 0 → clip moves
- [ ] Right-click → Move to Track 1 → clip moves
- [ ] Track 1 clips have purple gradient
- [ ] Playhead spans both tracks

**Simultaneous Recording:**
- [ ] Menu → Record Screen + Webcam
- [ ] Cmd+Shift+B works
- [ ] Shows screen picker + webcam preview
- [ ] Countdown 3-2-1
- [ ] Both recording indicators visible
- [ ] Stop recording → prompted for both saves
- [ ] Screen on Track 0, webcam on Track 1

**PiP Configuration:**
- [ ] Export with Track 1 clips → shows config dialog
- [ ] Change position → dropdown updates
- [ ] Change size → dropdown updates
- [ ] Export bottom-right medium → PiP in correct spot
- [ ] Export top-left large → PiP in correct spot

**Audio Mixing:**
- [ ] Track 0 slider → value updates
- [ ] Track 1 slider → value updates
- [ ] Export with 50%/150% → audio levels correct

**Timeline Zoom:**
- [ ] Cmd+scroll up → zooms in
- [ ] Cmd+scroll down → zooms out
- [ ] Cmd+= → zooms in
- [ ] Cmd+− → zooms out
- [ ] Cmd+0 → resets zoom
- [ ] Click + button → zooms in
- [ ] Click − button → zooms out
- [ ] Click Reset → resets zoom
- [ ] Playhead stays visually centered during zoom
- [ ] Buttons disable at MIN/MAX

**Integration:**
- [ ] Multi-track + zoom works
- [ ] Simultaneous recording + PiP config works
- [ ] Audio mixing + zoom works
- [ ] No crashes, no console errors
- [ ] Memory usage stable

---

## Known Limitations & Future Work

**Deferred to Phase 4:**
- Drag-to-rearrange clips (clips are added sequentially for now)
- Delete clips (can still be removed via re-import workaround)
- Project save/load
- Error handling improvements
- Loading states
- Performance optimizations
- Export presets
- Keyboard shortcuts help panel
- Security fix (custom protocol handler)
- DMG distribution

**Technical Debt:**
- `webSecurity: false` still enabled (fix in Phase 4)
- No audio waveform visualization on timeline
- No real-time PiP preview (only visible on export)
- Timeline zoom doesn't persist between sessions

---

## Success Criteria

Phase 3 is complete when:

✅ Multi-track timeline displays Track 0 and Track 1  
✅ Clips auto-assign to correct track based on source type  
✅ Context menu allows moving clips between tracks  
✅ Simultaneous screen + webcam recording works  
✅ Export with Track 1 clips shows PiP config dialog  
✅ PiP position/size presets work correctly  
✅ Audio mixing sliders adjust relative volume  
✅ Timeline zoom works (mouse wheel, menu, keyboard, UI)  
✅ Zoom centers on playhead  
✅ All manual tests pass  
✅ No regressions in Phase 2 features  
✅ Code validates (lint + typecheck + build)

---

**Estimated Total Effort:** ~35 hours  
**Recommended Schedule:** 5 days × 7 hours/day  
**Next:** Phase 4 (Polish + Production Ready)

