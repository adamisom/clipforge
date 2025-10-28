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

### Files to modify/create:
- **Modify**: `src/main/index.ts` (add IPC handlers)
- **Modify**: `src/preload/index.ts` (expose API)
- **Modify**: `src/preload/index.d.ts` (TypeScript definitions)

### 1.1 Main Process IPC Handlers
- [ ] File to modify: `src/main/index.ts`
- [ ] Add imports at top of file:
  ```typescript
  import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
  import { join } from 'path'
  import { electronApp, optimizer, is } from '@electron-toolkit/utils'
  import icon from '../../resources/icon.png?asset'
  import ffmpeg from 'fluent-ffmpeg'
  import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
  import fs from 'fs'
  ```

- [ ] Add FFmpeg setup (after imports, before createWindow):
  ```typescript
  // Set up FFmpeg binary path (dev vs production)
  const ffmpegPath = app.isPackaged
    ? join(process.resourcesPath, 'ffmpeg')
    : ffmpegInstaller.path;
  
  if (!fs.existsSync(ffmpegPath)) {
    console.error('FFmpeg not found at:', ffmpegPath);
  }
  
  ffmpeg.setFfmpegPath(ffmpegPath);
  ```

- [ ] Add IPC handlers after `app.whenReady()`:
  ```typescript
  // Remove the test handler: ipcMain.on('ping', ...)
  ```

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
  // NOTE: Full implementation in Phase 7.3, but stub needed here
  ipcMain.handle('export-video', async (event, { sourcePath, outputPath, trimStart, duration }) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    
    // ffmpegPath is already set globally (see setup above)
    
    return new Promise((resolve, reject) => {
      ffmpeg(sourcePath)
        .setStartTime(trimStart)
        .setDuration(duration)
        .output(outputPath)
        .on('progress', (progress) => {
          mainWindow.webContents.send('export-progress', progress);
        })
        .on('end', () => {
          mainWindow.webContents.send('export-complete');
          resolve({ success: true });
        })
        .on('error', (err) => {
          mainWindow.webContents.send('export-error', { message: err.message });
          reject(err);
        })
        .run();
    });
  });
  ```

- [ ] Implement `ipcMain.handle('select-save-path')`:
  ```typescript
  ipcMain.handle('select-save-path', async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: 'trimmed-video.mp4',
      filters: [{ name: 'MP4', extensions: ['mp4'] }]
    });
    return result.canceled ? null : result.filePath;
  });
  ```

- [ ] Verify FFmpeg setup is in place (see setup above)
- **Test**: Console logs when handlers are called, verify FFmpeg path is set

### 1.2 Preload Script - Expose API
- [ ] Update `src/preload/index.ts`:
  ```typescript
  const api = {
    // Invoke methods (request-response)
    selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
    getVideoMetadata: (path: string) => ipcRenderer.invoke('get-video-metadata', path),
    exportVideo: (sourcePath: string, outputPath: string, trimStart: number, duration: number) => 
      ipcRenderer.invoke('export-video', { sourcePath, outputPath, trimStart, duration }),
    selectSavePath: () => ipcRenderer.invoke('select-save-path'),
    
    // Event listeners (one-way events)
    onExportProgress: (callback) => ipcRenderer.on('export-progress', callback),
    onExportComplete: (callback) => ipcRenderer.on('export-complete', callback),
    onExportError: (callback) => ipcRenderer.on('export-error', callback),
    onMenuImport: (callback) => ipcRenderer.on('menu-import', callback),
    onMenuExport: (callback) => ipcRenderer.on('menu-export', callback),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
  };
  
  contextBridge.exposeInMainWorld('api', api);
  ```

- [ ] Update TypeScript definitions in `src/preload/index.d.ts`:
  ```typescript
  interface Window {
    api: {
      // Invoke methods (request-response)
      selectVideoFile: () => Promise<string | null>;
      getVideoMetadata: (path: string) => Promise<any>;
      exportVideo: (src: string, dest: string, start: number, dur: number) => Promise<void>;
      selectSavePath: () => Promise<string | null>;
      
      // Event listeners (one-way events)
      onExportProgress: (callback: (event: any, progress: any) => void) => void;
      onExportComplete: (callback: (event: any) => void) => void;
      onExportError: (callback: (event: any, error: { message: string }) => void) => void;
      onMenuImport: (callback: (event: any) => void) => void;
      onMenuExport: (callback: (event: any) => void) => void;
      removeAllListeners: (channel: string) => void;
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

### Files to modify/create:
- **Modify**: `src/renderer/src/App.tsx` (add conditional rendering, state, handlers)
- **Create** (optional): `src/renderer/src/components/WelcomeScreen.tsx`
- **Create** (optional): `src/renderer/src/components/VideoEditor.tsx`
- **Create**: `src/renderer/src/components/VideoInfo.tsx`
- **Modify**: `src/renderer/src/assets/main.css` (add layout styles)

### 2.1 Create Basic Layout Components
- [ ] Update `src/renderer/src/App.tsx`:
  - Remove existing welcome screen content
  - Add conditional rendering

- [ ] Replace welcome screen with conditional rendering:
  ```typescript
  return (
    <>
      {!videoState.sourcePath ? <WelcomeScreen /> : <VideoEditor videoState={videoState} />}
    </>
  );
  ```

- [ ] Create `WelcomeScreen` component inline or in new file `src/renderer/src/components/WelcomeScreen.tsx`:
  ```typescript
  function WelcomeScreen({ onImport }) {
    return (
      <div className="welcome-screen">
        <h1>ClipForge</h1>
        <p>Import a video to get started</p>
        <button onClick={onImport}>Import Video</button>
      </div>
    );
  }
  ```

- [ ] Create `VideoEditor` component inline or in new file `src/renderer/src/components/VideoEditor.tsx`:
  ```typescript
  function VideoEditor({ videoState }) {
    return (
      <div className="video-editor">
        <div className="preview-panel">
          {/* Placeholder */}
        </div>
        <div className="timeline-panel">
          {/* Placeholder */}
        </div>
        <div className="info-panel">
          {/* Placeholder */}
        </div>
      </div>
    );
  }
  ```

- [ ] Add basic CSS in `src/renderer/src/assets/main.css`:
  ```css
  .welcome-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }
  
  .video-editor {
    display: grid;
    grid-template-rows: 1fr auto;
    height: 100vh;
  }
  
  .preview-panel {
    background: #000;
  }
  
  .timeline-panel {
    background: #1a1a1a;
    height: 200px;
  }
  
  .info-panel {
    background: #2a2a2a;
    width: 250px;
  }
  ```
- **Test**: Layout renders correctly, no video shows welcome screen

### 2.2 Implement Import via Button
- [ ] Add import handler in `App.tsx` (after state declaration):
  ```typescript
  const handleImport = async () => {
    try {
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
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Failed to import video: ${error.message}`);
    }
  };
  ```

- [ ] Update WelcomeScreen to receive and use onImport prop:
  ```typescript
  <WelcomeScreen onImport={handleImport} />
  ```

- [ ] Connect import button in WelcomeScreen:
  ```typescript
  <button onClick={onImport}>Import Video</button>
  ```

- **Test**: Importing video switches from welcome to editor

### 2.3 Implement Drag-and-Drop Import
- [ ] Update existing drag handler in `App.tsx` (already partially implemented):
  ```typescript
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent): void => {
    e.preventDefault();
    
    const files = Array.from(e.dataTransfer.files);
    const videoFiles = files.filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return ['mp4', 'mov'].includes(ext);
    });
    
    if (videoFiles.length === 0) {
      alert('Please drop a video file (MP4 or MOV)');
      return;
    }
    
    // Get file path (Electron provides path property)
    const filePath = videoFiles[0].path;
    if (!filePath) return;
    
    // Call same import logic as button handler
    try {
      const metadata = await window.api.getVideoMetadata(filePath);
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
    } catch (error) {
      console.error('Drag-and-drop import failed:', error);
      alert(`Failed to import video: ${error.message}`);
    }
  };

  // Apply to main container
  <div onDragOver={handleDragOver} onDrop={handleDrop}>
    {/* ... content ... */}
  </div>
  ```

- **Test**: Dragging video imports it

### 2.4 Add Video Info Panel
- [ ] Create `VideoInfo` component in `src/renderer/src/components/VideoInfo.tsx`:
  ```typescript
  import React from 'react';

  interface VideoInfoProps {
    videoState: {
      metadata: {
        filename: string;
        resolution: string;
      };
      duration: number;
      trimStart: number;
      trimEnd: number;
    };
  }

  function VideoInfo({ videoState }: VideoInfoProps) {
    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <div className="video-info">
        <h3>Video Info</h3>
        <div className="info-item">
          <strong>File:</strong> {videoState.metadata.filename}
        </div>
        <div className="info-item">
          <strong>Resolution:</strong> {videoState.metadata.resolution}
        </div>
        <div className="info-item">
          <strong>Duration:</strong> {formatTime(videoState.duration)}
        </div>
        <div className="info-item">
          <strong>Trim:</strong> {formatTime(videoState.trimStart)} - {formatTime(videoState.trimEnd)}
        </div>
      </div>
    );
  }

  export default VideoInfo;
  ```

- [ ] Add to VideoEditor component:
  ```typescript
  import VideoInfo from './components/VideoInfo';
  
  <div className="info-panel">
    <VideoInfo videoState={videoState} />
  </div>
  ```

- [ ] Add styling to `main.css`:
  ```css
  .video-info {
    padding: 16px;
    color: #fff;
  }
  
  .info-item {
    margin: 8px 0;
  }
  ```

- **Test**: Info panel displays imported video details

**Checkpoint 2**: Can import videos and see UI switch to editor
- [Manual Test]: Import sample video, verify editor layout appears with info

---

## Phase 3: Timeline Visualization

**Goal**: Display video clip on timeline with visual representation

### Files to modify/create:
- **Create**: `src/renderer/src/components/Timeline.tsx`
- **Modify**: `src/renderer/src/components/VideoEditor.tsx` (add Timeline)
- **Modify**: `src/renderer/src/assets/main.css` (timeline styles)

### 3.1 Create Timeline Component Structure
- [ ] Create `src/renderer/src/components/Timeline.tsx`:
  ```typescript
  import React from 'react';
  
  interface TimelineProps {
    duration: number;
    trimStart: number;
    trimEnd: number;
    playheadPosition: number;
  }
  
  function Timeline({ duration, trimStart, trimEnd, playheadPosition }: TimelineProps) {
    // Calculate pixels per second (300px for 1 second by default)
    const pixelsPerSecond = 300;
    const timelineWidth = duration * pixelsPerSecond;
    
    return (
      <div className="timeline-container" style={{ width: `${timelineWidth}px` }}>
        <div className="time-ruler">
          {/* Time marks will go here */}
        </div>
        <div className="timeline-track">
          {/* Clip and playhead will go here */}
        </div>
      </div>
    );
  }
  
  export default Timeline;
  ```

- [ ] Add CSS to `main.css`:
  ```css
  .timeline-container {
    height: 120px;
    overflow-x: auto;
    overflow-y: hidden;
    position: relative;
  }
  
  .time-ruler {
    height: 30px;
    border-bottom: 1px solid #444;
    position: relative;
  }
  
  .timeline-track {
    height: 90px;
    position: relative;
  }
  ```

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

### Files to modify/create:
- **Create**: `src/renderer/src/components/VideoPreview.tsx`
- **Modify**: `src/renderer/src/components/VideoEditor.tsx` (add VideoPreview)
- **Modify**: `src/renderer/src/assets/main.css` (preview styles)

### 4.1 Create VideoPreview Component
- [ ] Create `src/renderer/src/components/VideoPreview.tsx`:
  ```typescript
  import React, { useRef, useEffect, useState } from 'react';
  
  interface VideoPreviewProps {
    sourcePath: string | null;
    trimStart: number;
    isPlaying: boolean;
    onPlayPause: () => void;
  }
  
  function VideoPreview({ sourcePath, trimStart, isPlaying, onPlayPause }: VideoPreviewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    // Sync initial video position
    useEffect(() => {
      if (videoRef.current && sourcePath) {
        videoRef.current.currentTime = trimStart;
      }
    }, [sourcePath, trimStart]);
    
    // Handle time updates during playback
    const handleTimeUpdate = () => {
      // Will be implemented in Phase 6 with playhead sync
    };
    
    return (
      <div className="video-preview-container">
        <video 
          ref={videoRef}
          src={sourcePath ? `file://${sourcePath}` : undefined}
          onTimeUpdate={handleTimeUpdate}
          style={{ width: '100%', height: '100%' }}
        />
        <div className="video-controls">
          <button onClick={onPlayPause}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>
    );
  }
  
  export default VideoPreview;
  ```

- [ ] IMPORTANT: Ensure `webSecurity: false` is set in `src/main/index.ts`:
  ```typescript
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    webSecurity: false  // ADD THIS for development
  }
  ```

- [ ] Add CSS:
  ```css
  .video-preview-container {
    width: 100%;
    height: 100%;
    position: relative;
    background: #000;
  }
  
  .video-controls {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
  }
  ```

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

### Files to modify:
- **Modify**: `src/renderer/src/components/Timeline.tsx` (add trim handles)
- **Modify**: `src/renderer/src/components/VideoPreview.tsx` (sync with trim)
- **Modify**: `src/renderer/src/assets/main.css` (trim handle styles)

### 5.1 Add Visual Trim Handles
- [ ] Update Timeline component to add trim handles on clip:
  ```typescript
  // In Timeline.tsx, in the clip div:
  <div className="timeline-clip" style={{ /* ... */ }}>
    {videoState.metadata.filename}
    
    {/* Left trim handle */}
    <div 
      className="trim-handle trim-handle-left"
      style={{
        position: 'absolute',
        left: '0',
        top: '0',
        bottom: '0',
        width: '8px',
        cursor: 'ew-resize'
      }}
      onMouseDown={(e) => handleTrimDragStart(e, 'start')}
    />
    
    {/* Right trim handle */}
    <div 
      className="trim-handle trim-handle-right"
      style={{
        position: 'absolute',
        right: '0',
        top: '0',
        bottom: '0',
        width: '8px',
        cursor: 'ew-resize'
      }}
      onMouseDown={(e) => handleTrimDragStart(e, 'end')}
    />
  </div>
  ```

- [ ] Add CSS for handles:
  ```css
  .trim-handle {
    background: #007AFF;
    opacity: 0.7;
  }
  
  .trim-handle:hover {
    opacity: 1;
    background: #0066FF;
  }
  ```

- **Test**: Handles appear on clip edges

### 5.2 Make Trim Handles Draggable
- [ ] Add drag state and handlers to Timeline component:
  ```typescript
  const [isDraggingTrim, setIsDraggingTrim] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | null>(null);
  const [startX, setStartX] = useState(0);
  
  const handleTrimDragStart = (e: React.MouseEvent, type: 'start' | 'end') => {
    setIsDraggingTrim(true);
    setDragType(type);
    setStartX(e.clientX);
  };
  
  useEffect(() => {
    if (!isDraggingTrim) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaTime = deltaX / pixelsPerSecond;
      
      if (dragType === 'start') {
        const newStart = Math.max(0, Math.min(trimStart + deltaTime, trimEnd - 0.1));
        setVideoState(prev => ({ ...prev, trimStart: newStart }));
      } else if (dragType === 'end') {
        const newEnd = Math.max(trimStart + 0.1, Math.min(duration, trimEnd + deltaTime));
        setVideoState(prev => ({ ...prev, trimEnd: newEnd }));
      }
    };
    
    const handleMouseUp = () => {
      setIsDraggingTrim(false);
      setDragType(null);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingTrim, dragType, startX, trimStart, trimEnd, duration]);
  ```

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

### Files to modify:
- **Modify**: `src/renderer/src/components/Timeline.tsx` (playhead drag)
- **Modify**: `src/renderer/src/components/VideoPreview.tsx` (scrub video)

### 6.1 Make Playhead Draggable
- [ ] Add drag state to Timeline component:
  ```typescript
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const playheadRef = useRef<HTMLDivElement>(null);
  
  const handlePlayheadDragStart = (e: React.MouseEvent) => {
    setIsDraggingPlayhead(true);
    e.preventDefault();
  };
  ```

- **Test**: Can start dragging playhead

### 6.2 Update Position on Drag
- [ ] Add mouse move and up handlers:
  ```typescript
  useEffect(() => {
    if (!isDraggingPlayhead) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - timelineRect.left;
      const newTime = Math.max(0, Math.min((trimEnd - trimStart), x / pixelsPerSecond));
      setVideoState(prev => ({ ...prev, playheadPosition: newTime }));
    };
    
    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, trimStart, trimEnd]);
  ```

- [ ] Update VideoPreview to sync currentTime:
  ```typescript
  // In VideoPreview.tsx
  useEffect(() => {
    if (videoRef.current && !isPlaying) {
      videoRef.current.currentTime = trimStart + playheadPosition;
    }
  }, [playheadPosition, trimStart, isPlaying]);
  ```

- **Test**: Dragging playhead updates video position

### 6.3 Smooth Scrubbing Performance
- [ ] Use `requestAnimationFrame` if needed (may not be necessary with modern React)
- **Test**: Scrubbing is smooth

**Checkpoint 6**: Can scrub through video by dragging playhead
- [Manual Test]: Drag playhead, verify video scrubs smoothly

---

## Phase 7: Export Functionality

**Goal**: Export trimmed video to MP4

### Files to modify/create:
- **Create**: `src/renderer/src/components/ExportButton.tsx`
- **Modify**: `src/renderer/src/components/VideoEditor.tsx` (add ExportButton)
- **Modify**: `src/renderer/src/assets/main.css` (export UI styles)

### 7.1 Create Export Button
- [ ] Create `src/renderer/src/components/ExportButton.tsx`:
  ```typescript
  import React from 'react';
  
  interface ExportButtonProps {
    sourcePath: string | null;
    onExport: () => void;
    isExporting: boolean;
  }
  
  function ExportButton({ sourcePath, onExport, isExporting }: ExportButtonProps) {
    const isDisabled = !sourcePath || isExporting;
    
    return (
      <button 
        onClick={onExport} 
        disabled={isDisabled}
        className="export-button"
      >
        {isExporting ? 'Exporting...' : 'Export'}
      </button>
    );
  }
  
  export default ExportButton;
  ```

- [ ] Add CSS:
  ```css
  .export-button {
    padding: 12px 24px;
    font-size: 16px;
    background: #007AFF;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
  
  .export-button:disabled {
    background: #666;
    cursor: not-allowed;
  }
  ```

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
      mainWindow.webContents.send('export-error', { message: err.message });
    })
    .run();
  ```
- **Test**: Export creates MP4 file

### 7.4 Add Export Progress
- [ ] Add IPC listeners in renderer for export events:
  ```typescript
  useEffect(() => {
    const handleProgress = (event, progress) => {
      setExportProgress(progress.percent);
    };
    
    const handleComplete = () => {
      setExportProgress(100);
      // Show success message
    };
    
    const handleError = (event, { message }) => {
      // Show error message
    };
    
    window.api.onExportProgress(handleProgress);
    window.api.onExportComplete(handleComplete);
    window.api.onExportError(handleError);
    
    return () => {
      window.api.removeAllListeners('export-progress');
      window.api.removeAllListeners('export-complete');
      window.api.removeAllListeners('export-error');
    };
  }, []);
  ```
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

### Files to modify:
- **Modify**: `src/main/index.ts` (add menu definition)
- **Modify**: `src/renderer/src/App.tsx` (add menu event listeners)

### 8.1 Create Menu Template
- [ ] Add menu in main process (see 8.2 for complete implementation)
- **Test**: Menu appears in menu bar

### 8.2 Connect Menu Actions
- [ ] Implement menu -> renderer communication:
  ```typescript
  // In main process menu handlers:
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
  ]);
  ```
- [ ] In renderer App component, add IPC listeners:
  ```typescript
  useEffect(() => {
    window.api.onMenuImport(handleImport);
    window.api.onMenuExport(handleExport);
    
    return () => {
      window.api.removeAllListeners('menu-import');
      window.api.removeAllListeners('menu-export');
    };
  }, []);
  ```
- **Test**: Menu items trigger correct actions

**Checkpoint 8**: Menu bar works
- [Manual Test]: Menu items work

---

## Phase 9: Error Handling

**Goal**: Handle common error cases gracefully

### Files to modify:
- **Modify**: `src/renderer/src/App.tsx` (add error handling)
- **Modify**: All component files (add error states)
- **Modify**: `src/renderer/src/assets/main.css` (error message styles)

### 9.1 Handle Import Errors
- [ ] Update import handler in App.tsx:
  ```typescript
  const handleImport = async () => {
    try {
      const filePath = await window.api.selectVideoFile();
      if (!filePath) return;
      
      const metadata = await window.api.getVideoMetadata(filePath);
      
      // Validate metadata
      if (!metadata.duration || metadata.duration <= 0) {
        throw new Error('Invalid video file: cannot read duration');
      }
      
      setVideoState({ /* ... */ });
    } catch (error) {
      const message = error.message || 'Failed to import video';
      alert(`Import Error: ${message}`);
      console.error('Import failed:', error);
    }
  };
  ```

- **Test**: Errors show helpful messages

### 9.2 Handle Export Errors
- [ ] Update export handler with error handling:
  ```typescript
  const handleExport = async () => {
    try {
      const outputPath = await window.api.selectSavePath();
      if (!outputPath) return;
      
      await window.api.exportVideo(sourcePath, outputPath, trimStart, duration);
      
      alert('Export completed successfully!');
    } catch (error) {
      alert(`Export failed: ${error.message}`);
      console.error('Export error:', error);
    }
  };
  ```

- [ ] Add error listener in App.tsx:
  ```typescript
  useEffect(() => {
    const handleExportError = (event, { message }) => {
      alert(`Export Error: ${message}`);
    };
    
    window.api.onExportError(handleExportError);
    
    return () => {
      window.api.removeAllListeners('export-error');
    };
  }, []);
  ```

- **Test**: Export errors are handled

### 9.3 Handle Playback Errors
- [ ] Update VideoPreview component:
  ```typescript
  const handleVideoError = () => {
    alert('Video playback error: Cannot decode this file. Please try a different format.');
  };
  
  <video 
    // ... other props
    onError={handleVideoError}
  />
  ```

- **Test**: Playback errors don't crash app

**Checkpoint 9**: App handles errors gracefully
- [Manual Test]: Try invalid files, cancel export, etc.

---

## Phase 10: Testing & Refinement

**Goal**: Verify everything works together

### Files to modify:
- **Modify**: All component files (fix bugs, polish UI)
- **Modify**: `src/renderer/src/assets/main.css` (final styling)

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

### Files to modify:
- **Modify**: `electron-builder.yml` (bundle FFmpeg)
- **Modify**: `src/main/index.ts` (ensure FFmpeg path works in production)

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

