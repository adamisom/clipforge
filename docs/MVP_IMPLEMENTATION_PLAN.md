# ClipForge MVP Implementation Plan (Revised)

This document provides a corrected, step-by-step implementation plan for the MVP.

## ⚠️ Important Notes

- **API Naming**: This plan uses `window.api` (not `window.electronAPI`) to match existing codebase
- **Filename Extraction**: Done in main process via metadata API (avoids Node.js path module in renderer)
- **File Loading**: Uses `webSecurity: false` for development (see Phase 4.1)
- **Global Events**: All drag handlers include proper cleanup for mousemove outside component
- **Export Progress**: Uses `webContents.send()` to communicate progress from main to renderer
- **Menu Actions**: Uses IPC events from main process to trigger renderer actions

---

## 📋 Key Architectural Decisions

### State Structure
```typescript
interface VideoState {
  sourcePath: string | null;
  duration: number; // Full video duration
  trimStart: number; // Start of keep section (0 to duration)
  trimEnd: number; // End of keep section (trimStart to duration)
  playheadPosition: number; // Position in trimmed section (0 to trimmed duration)
  isPlaying: boolean;
  metadata: {
    filename: string;
    resolution: string;
  };
}
```

### Component Structure
- `App` (main container)
  - `WelcomeScreen` (shown when no video)
  - `VideoEditor` (shown when video loaded)
    - `VideoPreview` (video element + controls)
    - `Timeline` (ruler + playhead + clip)
    - `VideoInfo` (filename, duration, trim points)
    - `ExportButton`

### Data Flow
- Main Process: IPC handlers for file ops, FFmpeg execution
- Preload: Exposes secure API via `contextBridge`
- Renderer: React UI that calls exposed API

---

## Phase 1: IPC Foundation

**Goal**: Set up secure communication between processes

### 1.1 Main Process IPC Handlers
- [ ] Implement `ipcMain.handle('select-video-file')`:
  ```typescript
  ipcMain.handle('select-video-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov'] }]
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ```

- [ ] Implement `ipcMain.handle('get-video-metadata', path)`:
  ```typescript
  // Use ffprobe to get duration, resolution, codec info
  // Implementation:
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, metadata) => {
      if (err) reject(err);
      else {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        resolve({
          duration: metadata.format.duration,
          width: videoStream.width,
          height: videoStream.height,
          codec: videoStream.codec_name,
          filename: path.split(/[/\\]/).pop()
        });
      }
    });
  });
  ```

- [ ] Implement `ipcMain.handle('export-video', { sourcePath, outputPath, trimStart, duration })`:
  ```typescript
  // Use fluent-ffmpeg to trim and export
  // Handle FFmpeg setup (dev vs production paths)
  ```

- [ ] Implement `ipcMain.handle('select-save-path')`:
  ```typescript
  // Show save dialog
  // Return selected path
  ```

- [ ] Set up FFmpeg binary path logic (app.isPackaged check)
- **Test**: Console logs when handlers are called

### 1.2 Preload Script - Expose API
- [ ] Update `src/preload/index.ts`:
  ```typescript
  const api = {
    selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
    getVideoMetadata: (path: string) => ipcRenderer.invoke('get-video-metadata', path),
    exportVideo: (sourcePath: string, outputPath: string, trimStart: number, duration: number) => 
      ipcRenderer.invoke('export-video', { sourcePath, outputPath, trimStart, duration }),
    selectSavePath: () => ipcRenderer.invoke('select-save-path')
  };
  
  contextBridge.exposeInMainWorld('api', api);
  ```

- [ ] Update TypeScript definitions in `src/preload/index.d.ts`:
  ```typescript
  interface Window {
    api: {
      selectVideoFile: () => Promise<string | null>;
      getVideoMetadata: (path: string) => Promise<any>;
      exportVideo: (src: string, dest: string, start: number, dur: number) => Promise<void>;
      selectSavePath: () => Promise<string | null>;
    };
  }
  ```
- **Test**: `window.api.selectVideoFile` exists in renderer console

### 1.3 Create State Management
- [ ] Install dependencies if needed (none required for MVP)
- [ ] Define state structure in App component:
  ```typescript
  const [videoState, setVideoState] = useState<VideoState>({
    sourcePath: null,
    duration: 0,
    trimStart: 0,
    trimEnd: 0,
    playheadPosition: 0,
    isPlaying: false,
    metadata: { filename: '', resolution: '' }
  });
  ```
- **Test**: State logs correctly in console

**Checkpoint 1**: IPC communication works, state structure defined
- [Manual Test]: Open DevTools, call `await window.api.selectVideoFile()` - file picker opens

---

## Phase 2: UI Layout & Import Functionality

**Goal**: Create editor layout and import capability

### 2.1 Create Basic Layout Components
- [ ] Replace welcome screen with conditional rendering:
  ```typescript
  {!videoState.sourcePath ? <WelcomeScreen /> : <VideoEditor />}
  ```

- [ ] Create `WelcomeScreen` component with:
  - Import button
  - Drag-and-drop target (already partially implemented)
  - App branding

- [ ] Create `VideoEditor` component shell with three panels:
  - Top: Preview area (placeholder)
  - Bottom: Timeline area (placeholder)  
  - Right: Info panel (placeholder)

- [ ] Style with flexbox layout
- **Test**: Layout renders correctly, no video shows welcome screen

### 2.2 Implement Import via Button
- [ ] Add import handler in App:
  ```typescript
  const handleImport = async () => {
    const filePath = await window.api.selectVideoFile();
    if (!filePath) return;
    
    // Get metadata
    const metadata = await window.api.getVideoMetadata(filePath);
    
    // Update state (filename comes from metadata API)
    setVideoState({
      sourcePath: filePath,
      duration: metadata.duration,
      trimStart: 0,
      trimEnd: metadata.duration,
      playheadPosition: 0,
      isPlaying: false,
      metadata: {
        filename: metadata.filename,
        resolution: `${metadata.width}x${metadata.height}`
      }
    });
  };
  ```
- [ ] Connect button to handler
- **Test**: Importing video switches from welcome to editor

### 2.3 Implement Drag-and-Drop Import
- [ ] Update existing drag handler in App.tsx to:
  - Filter for video files (mp4, mov)
  - Call same import handler as button
  - Show loading feedback
- **Test**: Dragging video imports it

### 2.4 Add Video Info Panel
- [ ] Create `VideoInfo` component showing:
  - Filename
  - Resolution
  - Full duration
  - Trim range (trimStart to trimEnd)
- [ ] Add styling
- **Test**: Info panel displays imported video details

**Checkpoint 2**: Can import videos and see UI switch to editor
- [Manual Test]: Import sample video, verify editor layout appears with info

---

## Phase 3: Timeline Visualization

**Goal**: Display video clip on timeline with visual representation

### 3.1 Create Timeline Component Structure
- [ ] Create `Timeline` component with:
  - Time ruler showing seconds (0 to duration)
  - Track area for clips
  - Playhead indicator
- [ ] Calculate `pixelsPerSecond` based on video duration
- [ ] Style timeline with fixed height, horizontal scroll
- **Test**: Timeline renders with correct width for video duration

### 3.2 Add Time Ruler
- [ ] Generate tick marks every second (or every 10 seconds for long videos)
- [ ] Display time labels below ticks
- [ ] Style ruler (border, background)
- **Test**: Ruler shows correct time divisions

### 3.3 Add Clip Visualization
- [ ] Create simple div representing the clip:
  ```typescript
  <div 
    className="timeline-clip"
    style={{
      transform: `translateX(${trimStart * pixelsPerSecond}px)`,
      width: `${(trimEnd - trimStart) * pixelsPerSecond}px`,
      willChange: 'transform'
    }}
  >
    {videoState.metadata.filename}
  </div>
  ```
- [ ] Style clip (background color, border)
- [ ] Show clip on timeline track
- **Test**: Clip appears on timeline at correct position and size

**Checkpoint 3**: Timeline displays video clip visually
- [Manual Test]: Clip appears on timeline, positioned correctly

---

## Phase 4: Video Preview with Playhead

**Goal**: Show video preview with position indicator

### 4.1 Create VideoPreview Component
- [ ] Create component with HTML5 `<video>` element
- [ ] IMPORTANT: Ensure `webSecurity: false` is set in main process for development
  - Check `src/main/index.ts` WebPreferences
  - Should have: `webSecurity: false` (for `file://` URLs in dev)
- [ ] Set video source:
  ```typescript
  <video 
    src={`file://${videoState.sourcePath}`}
    ref={videoRef}
    onTimeUpdate={handleTimeUpdate}
  />
  ```
- [ ] Add useEffect to sync initial video position:
  ```typescript
  useEffect(() => {
    if (videoRef.current && videoState.sourcePath) {
      videoRef.current.currentTime = videoState.trimStart;
    }
  }, [videoState.sourcePath]);
  ```
- [ ] Add play/pause button
- **Test**: Video loads and preview works

### 4.2 Add Playhead Component
- [ ] Create `Playhead` component:
  ```typescript
  <div 
    className="playhead"
    style={{
      transform: `translateX(${playheadPosition * pixelsPerSecond}px)`,
      left: 0,
      top: 0,
      bottom: 0,
      width: '2px',
      backgroundColor: 'red'
    }}
  />
  ```
- [ ] Position in timeline above clip
- **Test**: Playhead appears on timeline

### 4.3 Implement Play/Pause Functionality
- [ ] Add play/pause handler:
  ```typescript
  const handlePlayPause = () => {
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };
  ```
- [ ] Sync video currentTime with playhead:
  ```typescript
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      // Playhead should move but be constrained to trimmed section
      setPlayheadPosition(currentTime);
    }
  };
  ```
- **Test**: Clicking play/pause works, video plays, playhead moves

### 4.4 Constrain Playhead to Trimmed Section
- [ ] Ensure playhead cannot go beyond trimStart/trimEnd
- [ ] When video plays, it should start at trimStart and end at trimEnd
- **Test**: Playback stays within trimmed region

**Checkpoint 4**: Preview plays video, playhead shows position
- [Manual Test]: Play video, verify playhead moves and playback is constrained to trim

---

## Phase 5: Trim Functionality

**Goal**: User can adjust start and end points

### 5.1 Add Visual Trim Handles
- [ ] Add left handle (trim start) and right handle (trim end) on clip
- [ ] Style handles (small draggable areas at clip edges)
- [ ] Position handles at clip edges
- **Test**: Handles appear on clip edges

### 5.2 Make Trim Handles Draggable
- [ ] Add mousedown/mousemove/mouseup handlers to handles
- [ ] Add global mouse event cleanup:
  ```typescript
  useEffect(() => {
    if (isDragging) {
      const handleMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging]);
  ```
- [ ] Calculate new trim position on drag:
  ```typescript
  const handleTrimDrag = (type: 'start' | 'end', deltaX: number) => {
    const deltaTime = deltaX / pixelsPerSecond;
    if (type === 'start') {
      const newStart = Math.max(0, Math.min(trimStart + deltaTime, trimEnd - 0.1));
      setVideoState(prev => ({ ...prev, trimStart: newStart }));
    } else {
      const newEnd = Math.max(trimStart + 0.1, Math.min(duration, trimEnd + deltaTime));
      setVideoState(prev => ({ ...prev, trimEnd: newEnd }));
    }
  };
  ```
- [ ] Clamp values to valid ranges (trimStart < trimEnd, within 0 to duration)
- **Test**: Dragging handles updates trim points

### 5.3 Update Clip Visual on Trim
- [ ] Recalculate clip position and width when trim changes
- [ ] Update clip transform and width
- **Test**: Clip visual updates when trim changes

### 5.4 Update Preview with Trim
- [ ] When playhead changes, set video currentTime to:
  ```typescript
  videoRef.current.currentTime = trimStart + playheadPosition;
  ```
- [ ] Ensure playback starts at trimStart
- **Test**: Preview shows only trimmed region

**Checkpoint 5**: Can adjust trim handles and preview updates
- [Manual Test]: Drag trim handles, verify clip size changes and preview updates

---

## Phase 6: Scrubbing

**Goal**: Drag playhead to scrub through video

### 6.1 Make Playhead Draggable
- [ ] Add mousedown handler to playhead
- [ ] Track drag state
- **Test**: Can start dragging playhead

### 6.2 Update Position on Drag
- [ ] Calculate new playhead position on mousemove:
  ```typescript
  const handlePlayheadDrag = (clientX: number) => {
    const timelineRect = timelineRef.current.getBoundingClientRect();
    const x = clientX - timelineRect.left;
    const newTime = Math.max(0, Math.min((trimEnd - trimStart), x / pixelsPerSecond));
    setVideoState(prev => ({ ...prev, playheadPosition: newTime }));
  };
  ```
- [ ] Update video currentTime to match:
  ```typescript
  videoRef.current.currentTime = trimStart + playheadPosition;
  ```
- **Test**: Dragging playhead updates video position

### 6.3 Smooth Scrubbing Performance
- [ ] Use `requestAnimationFrame` for smooth updates during drag
- [ ] Throttle state updates if needed
- **Test**: Scrubbing is smooth

**Checkpoint 6**: Can scrub through video by dragging playhead
- [Manual Test]: Drag playhead, verify video scrubs smoothly

---

## Phase 7: Export Functionality

**Goal**: Export trimmed video to MP4

### 7.1 Create Export Button
- [ ] Add "Export" button to UI
- [ ] Enable only when video is loaded and trimmed
- [ ] Style button
- **Test**: Button appears and is enabled/disabled correctly

### 7.2 Implement Export Handler
- [ ] Create export function:
  ```typescript
  const handleExport = async () => {
    // Get output path
    const outputPath = await window.api.selectSavePath();
    if (!outputPath) return;
    
    // Calculate trim parameters
    const duration = trimEnd - trimStart;
    
    // Call export
    await window.api.exportVideo(
      sourcePath, 
      outputPath, 
      trimStart, 
      duration
    );
    
    // Show success message
    console.log('Export complete:', outputPath);
  };
  ```
- [ ] Show loading state during export
- **Test**: Export can be called

### 7.3 Execute FFmpeg Export
- [ ] In main process, implement FFmpeg command:
  ```typescript
  const mainWindow = BrowserWindow.getAllWindows()[0];
  
  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg(sourcePath)
    .setStartTime(trimStart)
    .setDuration(duration)
    .output(outputPath)
    .on('progress', (progress) => {
      // Send progress to renderer
      mainWindow.webContents.send('export-progress', {
        percent: progress.percent,
        timemark: progress.timemark
      });
    })
    .on('end', () => {
      // Send completion
      mainWindow.webContents.send('export-complete');
    })
    .on('error', (err) => {
      // Send error
      mainWindow.webContents.send('export-error', err.message);
    })
    .run();
  ```
- **Test**: Export creates MP4 file

### 7.4 Add Export Progress
- [ ] Show "Exporting..." modal
- [ ] Display progress percentage
- [ ] Disable UI during export
- [ ] Show success/error message
- **Test**: Progress indicator shows, user sees completion

**Checkpoint 7**: Can export trimmed video
- [Manual Test]: Import, trim, export - verify output file is correct

---

## Phase 8: Menu Bar

**Goal**: Native macOS menu

### 8.1 Create Menu Template
- [ ] Add menu in main process:
  ```typescript
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'Import Video', accelerator: 'CmdOrCtrl+O', click: handleImport },
        { label: 'Export Video', accelerator: 'CmdOrCtrl+E', click: handleExport },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
  ```
- **Test**: Menu appears in menu bar

### 8.2 Connect Menu Actions
- [ ] Implement menu -> renderer communication:
  ```typescript
  // In menu click handler
  mainWindow.webContents.send('menu-import');
  mainWindow.webContents.send('menu-export');
  ```
- [ ] In renderer App component, add IPC listeners:
  ```typescript
  useEffect(() => {
    const handleImport = () => handleImportClick();
    const handleExport = () => handleExportClick();
    
    window.api.onImportMenu(() => handleImport());
    window.api.onExportMenu(() => handleExport());
    
    return () => {
      // Cleanup listeners
    };
  }, []);
  ```
- **Test**: Menu items trigger correct actions

**Checkpoint 8**: Menu bar works
- [Manual Test]: Menu items work

---

## Phase 9: Error Handling

**Goal**: Handle common error cases gracefully

### 9.1 Handle Import Errors
- [ ] Invalid file type - show error message
- [ ] Corrupt video file - show error message
- [ ] FFprobe errors - show user-friendly message
- **Test**: Errors show helpful messages

### 9.2 Handle Export Errors
- [ ] FFmpeg not found - show error
- [ ] Disk full - show error
- [ ] Export cancelled - handle gracefully
- [ ] Invalid output path - validate before export
- **Test**: Export errors are handled

### 9.3 Handle Playback Errors
- [ ] Video can't play - show error
- [ ] Network error (if applicable)
- [ ] Codec not supported - show message
- **Test**: Playback errors don't crash app

**Checkpoint 9**: App handles errors gracefully
- [Manual Test]: Try invalid files, cancel export, etc.

---

## Phase 10: Testing & Refinement

**Goal**: Verify everything works together

### 10.1 End-to-End Testing
- [ ] Test full workflow:
  1. Launch app → See welcome screen
  2. Click import → File picker opens
  3. Import video → Editor appears, clip on timeline
  4. Drag trim handles → Clip size changes
  5. Play video → Playhead moves, stays in bounds
  6. Drag playhead → Video scrubs
  7. Click export → Save dialog opens
  8. Export → Progress shows, file created
  9. Play exported file → Verify it's correct
- **Test**: All features work in sequence

### 10.2 Performance Testing
- [ ] Test with 5+ minute video
- [ ] Test scrubbing performance
- [ ] Test export time
- **Test**: Performance is acceptable

### 10.3 UI Polish
- [ ] Fix any visual glitches
- [ ] Improve button styling
- [ ] Add hover states
- **Test**: UI looks polished

**Checkpoint 10**: MVP is complete and working
- [Manual Test]: Complete workflow from start to export

---

## Phase 11: Packaging

**Goal**: Create distributable macOS app

### 11.1 Configure electron-builder
- [ ] Update `electron-builder.yml` with FFmpeg bundling:
  ```yaml
  extraResources:
    - from: "node_modules/@ffmpeg-installer/darwin-x64/ffmpeg"
      to: "ffmpeg"
  ```
- [ ] Test build command
- **Test**: Build configuration is valid

### 11.2 Build and Test
- [ ] Run `npm run build:mac`
- [ ] Open `.dmg` file
- [ ] Install app
- [ ] Test in packaged app:
  - Import works
  - Timeline displays
  - Preview plays
  - Trim works
  - Export creates MP4
- **Test**: Packaged app works

### 11.3 Test on Clean Machine
- [ ] Copy .dmg to another Mac
- [ ] Install without developer tools
- [ ] Verify all features work
- **Test**: App works on clean macOS

**Checkpoint 11**: App is packaged and distributable
- [Manual Test]: Test .dmg installation and features

---

## Success Criteria

✅ Launches as native Mac app from .dmg  
✅ Opens file picker and imports MP4/MOV  
✅ Shows clip on timeline  
✅ Video preview plays imported clip  
✅ Can set trim in/out points with handles  
✅ Playhead scrubs through trimmed region  
✅ Export creates trimmed MP4 file  
✅ Menu bar has Import/Export  
✅ No crashes during 5-minute test  
✅ Works on clean Mac without dev tools

---

## Implementation Notes

### Key Design Decisions

1. **File Loading**: Using `webSecurity: false` for MVP simplicity. TODO: Migrate to custom protocol for production.
2. **Playhead**: Represents position in trimmed section (0 to trimmed duration).
3. **State**: Structured useState, can refactor to reducer if complexity grows.
4. **Timeline**: Simple div for MVP, called "TimelineClip" for future extension.
5. **Playback**: Playhead auto-advances during playback but allows manual drag.
6. **Export**: Always prompts for save location.
7. **UI**: Welcome screen replaced by editor when video imported.

### Common Pitfalls

- FFmpeg path must be set for both dev and production
- Video file paths with spaces need quoting
- Transform-based positioning for performance
- Trim values must satisfy: 0 ≤ trimStart < trimEnd ≤ duration
- Playhead position: 0 ≤ playheadPosition ≤ (trimEnd - trimStart)

### Testing Strategy

- Test each phase before moving to next
- Use sample video files (different durations, resolutions)
- Test edge cases (very short videos, trimming to 1 second, etc.)
- Monitor console for errors
- Test on different macOS versions

---

**Estimated Total Time**: 6-8 hours

**Session Breakdown**:
- Session 1 (2h): Phases 1-2 (IPC, Layout, Import)
- Session 2 (2.5h): Phases 3-5 (Timeline, Preview, Trim)
- Session 3 (1.5h): Phases 6-7 (Scrubbing, Export)
- Session 4 (2h): Phases 8-11 (Menu, Errors, Testing, Packaging)

