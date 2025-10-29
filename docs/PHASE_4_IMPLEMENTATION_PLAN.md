# ClipForge Phase 4: Polish + Production Ready

**Focus:** UX polish, production readiness, project management, and distribution

**Estimated Effort:** ~25 hours (3-4 full days)

---

## Overview

Phase 4 transforms ClipForge from a feature-complete prototype to a production-ready application with professional polish, comprehensive error handling, and user-friendly workflows.

### Key Features

1. ✅ **Drag-to-rearrange clips** (timeline reordering)
2. ✅ **Delete clips** (Delete key + confirmation dialog + context menu)
3. ✅ **Project save/load** (.clipforge format, auto-save, Cmd+S, save-on-quit warning)
4. ✅ **Error handling** (toast notifications + modal dialogs hybrid)
5. ✅ **Loading states** (progress indicators, spinners)
6. ✅ **Input validation** (file format checks, codec validation)
7. ✅ **Timeline performance** (virtual scrolling, memoization)
8. ✅ **Export presets** (YouTube, Instagram, TikTok, custom)
9. ✅ **Keyboard shortcuts help** (in-app panel)
10. ✅ **Security fix** (custom protocol handler for video files)
11. ✅ **DMG distribution** (macOS installer)

---

## Design Decisions

### Drag-to-Rearrange

**Conflict Resolution:**
- Clips draggable from **center area** only (not edges)
- Trim handles on edges remain independent
- Visual drop indicators between clips
- Snap behavior when near other clips

**Library:** `@dnd-kit/sortable` (already in dependencies)

### Delete Clips

**Methods:**
1. Delete key (primary)
2. Context menu → Delete
3. Backspace key (secondary)

**Confirmation:** Modal dialog with clip filename

### Project Save/Load

**File Format:** `.clipforge` (JSON)

**Structure:**
```json
{
  "version": "1.0",
  "metadata": {
    "name": "My Project",
    "created": "2025-10-29T...",
    "lastModified": "2025-10-29T..."
  },
  "clips": [...],  // Full TimelineClip array
  "playheadPosition": 0,
  "selectedClipId": null
}
```

**Auto-Save:**
- Every 30 seconds
- Only if project has been manually saved once
- Toast notification: "Auto-saved" (1 second)

**Save-on-Quit:**
- Warning dialog with 3 options: Save, Don't Save, Cancel
- Similar to existing temp file warning

### Error Handling

**Toast (Non-Blocking):**
- Import success
- Export success
- Auto-save success
- Recording started
- Non-critical warnings

**Modal (Blocking):**
- Export failed (disk full, FFmpeg error)
- Permission denied
- Invalid file format
- Unsaved changes on quit

**Library:** `react-hot-toast` (simple, beautiful, 2KB)

### Export Presets

**Presets:**
1. **YouTube 1080p:** 1920×1080, 30fps, 8000k bitrate
2. **Instagram Reel:** 1080×1920, 30fps, 5000k bitrate
3. **TikTok:** 1080×1920, 30fps, 4500k bitrate
4. **Twitter:** 1280×720, 30fps, 6000k bitrate
5. **Custom:** User-defined settings

**UI:** Dropdown in export dialog

---

## Phase Breakdown

### **Phase A: Drag-to-Rearrange Clips** (~5 hours)

#### A.1: Install dnd-kit Components (~15 min)

Already installed, verify:
```bash
npm list @dnd-kit/sortable
```

---

#### A.2: Implement Sortable Timeline (~3 hours)

**Files to Update:**
- `src/renderer/src/components/Timeline.tsx`

**Changes:**
```tsx
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const Timeline = ({ clips, setClips, ... }) => {
  // Prevent drag conflicts with trim handles
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,  // Require 8px drag before activating
      },
    })
  )
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      setClips((prevClips) => {
        const oldIndex = prevClips.findIndex((c) => c.id === active.id)
        const newIndex = prevClips.findIndex((c) => c.id === over.id)
        
        return arrayMove(prevClips, oldIndex, newIndex)
      })
    }
  }
  
  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter} 
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={clips.map(c => c.id)} 
        strategy={horizontalListSortingStrategy}
      >
        <div className="timeline-track">
          {clips.map(clip => (
            <SortableClip key={clip.id} clip={clip} ... />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

const SortableClip = ({ clip, ... }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  
  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="timeline-clip"
    >
      {/* Draggable area (center only, not edges) */}
      <div className="clip-drag-handle" {...attributes} {...listeners}>
        <div className="clip-content">{clip.metadata.filename}</div>
      </div>
      
      {/* Trim handles (separate from drag) */}
      <div className="trim-handle-left" onMouseDown={handleTrimStart} />
      <div className="trim-handle-right" onMouseDown={handleTrimEnd} />
    </div>
  )
}
```

**CSS:**
```css
.clip-drag-handle {
  cursor: move;
  flex: 1;
  padding: 8px;
}

.timeline-clip {
  display: flex;
  position: relative;
}

.trim-handle-left,
.trim-handle-right {
  cursor: ew-resize;
  width: 8px;
  background: rgba(255, 255, 255, 0.2);
}

.trim-handle-left:hover,
.trim-handle-right:hover {
  background: rgba(255, 255, 255, 0.5);
}
```

**Testing Checkpoint:**
- Drag clip from center → reorders
- Drag trim handle → doesn't reorder, only trims
- Visual feedback during drag (opacity, drop indicator)

---

#### A.3: Prevent Reordering During Trim (~1 hour)

**Issue:** User might accidentally trigger reorder when trimming

**Solution:**
```tsx
const [isTrimmingClip, setIsTrimmingClip] = useState<string | null>(null)

const handleTrimStart = (clipId: string) => (e: React.MouseEvent) => {
  e.stopPropagation()  // Prevent drag
  setIsTrimmingClip(clipId)
  // ... existing trim logic
}

const handleTrimEnd = () => {
  setIsTrimmingClip(null)
}

// Disable drag during trim
<SortableClip 
  disabled={isTrimmingClip === clip.id}
  ...
/>
```

**Testing Checkpoint:**
- Trim left handle → no reorder
- Trim right handle → no reorder
- Drag center → reorders normally

---

#### A.4: Multi-Track Drag Support (~45 min)

**Files to Update:**
- `src/renderer/src/components/Timeline.tsx`

**Changes:**
```tsx
// Allow vertical drag between tracks
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event
  
  if (!over) return
  
  const activeClip = clips.find(c => c.id === active.id)
  const overClip = clips.find(c => c.id === over.id)
  
  if (!activeClip || !overClip) return
  
  // Check if dragged to different track
  if (activeClip.trackIndex !== overClip.trackIndex) {
    // Move to new track
    setClips(prev => prev.map(c => 
      c.id === active.id 
        ? { ...c, trackIndex: overClip.trackIndex } 
        : c
    ))
  } else {
    // Reorder within same track
    const trackClips = clips.filter(c => c.trackIndex === activeClip.trackIndex)
    const oldIndex = trackClips.findIndex(c => c.id === active.id)
    const newIndex = trackClips.findIndex(c => c.id === over.id)
    
    const reorderedTrackClips = arrayMove(trackClips, oldIndex, newIndex)
    
    // Merge back with other track
    setClips(prev => [
      ...prev.filter(c => c.trackIndex !== activeClip.trackIndex),
      ...reorderedTrackClips
    ])
  }
}
```

**Testing Checkpoint:**
- Drag clip down to Track 1 → moves tracks
- Drag clip up to Track 0 → moves tracks
- Drag within same track → reorders

---

### **Phase B: Delete Clips** (~2 hours)

#### B.1: Delete Key Handler (~45 min)

**Files to Update:**
- `src/renderer/src/components/VideoEditor.tsx`

**Changes:**
```tsx
const [showDeleteConfirm, setShowDeleteConfirm] = useState<{
  visible: boolean
  clipId: string | null
  clipName: string
}>({ visible: false, clipId: null, clipName: '' })

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
      const clip = clips.find(c => c.id === selectedClipId)
      if (clip) {
        setShowDeleteConfirm({
          visible: true,
          clipId: selectedClipId,
          clipName: clip.metadata.filename
        })
      }
    }
  }
  
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [selectedClipId, clips])

const handleConfirmDelete = () => {
  if (showDeleteConfirm.clipId) {
    removeClip(showDeleteConfirm.clipId)
    setShowDeleteConfirm({ visible: false, clipId: null, clipName: '' })
  }
}

const handleCancelDelete = () => {
  setShowDeleteConfirm({ visible: false, clipId: null, clipName: '' })
}
```

**Testing Checkpoint:**
- Select clip, press Delete → confirmation dialog
- Select clip, press Backspace → confirmation dialog
- Click Cancel → clip not deleted
- Click Delete → clip removed

---

#### B.2: Confirmation Dialog UI (~30 min)

**Files to Update:**
- `src/renderer/src/assets/main.css`

**Changes:**
```tsx
{showDeleteConfirm.visible && (
  <div className="modal-overlay">
    <div className="modal delete-confirm-modal">
      <h3>Delete Clip?</h3>
      <p>Are you sure you want to delete "{showDeleteConfirm.clipName}"?</p>
      <p className="modal-hint">This cannot be undone.</p>
      
      <div className="modal-actions">
        <button onClick={handleCancelDelete} className="button-secondary">
          Cancel
        </button>
        <button onClick={handleConfirmDelete} className="button-danger">
          Delete
        </button>
      </div>
    </div>
  </div>
)}
```

**CSS:**
```css
.delete-confirm-modal {
  max-width: 400px;
}

.delete-confirm-modal p {
  margin: 16px 0;
  color: #ccc;
}

.modal-hint {
  font-size: 12px;
  color: #888;
}

.button-danger {
  background: #dc3545;
  color: white;
}

.button-danger:hover {
  background: #c82333;
}
```

**Testing Checkpoint:**
- Dialog centered on screen
- Clip name displays correctly
- Buttons styled appropriately

---

#### B.3: Context Menu Delete Option (~45 min)

**Files to Update:**
- `src/renderer/src/components/Timeline.tsx`

**Changes:**
```tsx
// Add to existing context menu (from Phase 3)
<div className="context-menu" ...>
  <button onClick={() => handleMoveToTrack(0)}>
    Move to Track 0 (Main)
  </button>
  <button onClick={() => handleMoveToTrack(1)}>
    Move to Track 1 (PiP)
  </button>
  <div className="context-menu-separator" />
  <button 
    onClick={() => {
      setShowDeleteConfirm({
        visible: true,
        clipId: contextMenu.clipId,
        clipName: clip.metadata.filename
      })
      setContextMenu({ visible: false, x: 0, y: 0, clipId: null })
    }}
    className="context-menu-danger"
  >
    Delete
  </button>
</div>
```

**Testing Checkpoint:**
- Right-click clip → shows Delete option
- Click Delete → confirmation dialog appears

---

### **Phase C: Project Save/Load** (~8 hours)

#### C.1: Project File Format & Types (~30 min)

**Files to Create:**
- `src/renderer/src/types/project.ts`

**Implementation:**
```typescript
export interface ClipForgeProject {
  version: '1.0'
  metadata: {
    name: string
    created: string
    lastModified: string
    totalDuration: number
  }
  clips: TimelineClip[]
  playheadPosition: number
  selectedClipId: string | null
}
```

---

#### C.2: Save Project Handler (Main Process) (~1 hour)

**Files to Update:**
- `src/main/index.ts`

**Changes:**
```typescript
ipcMain.handle('save-project', async (event, { projectPath, projectData }) => {
  try {
    await fs.promises.writeFile(
      projectPath, 
      JSON.stringify(projectData, null, 2), 
      'utf-8'
    )
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('load-project', async (event, projectPath) => {
  try {
    const fileContent = await fs.promises.readFile(projectPath, 'utf-8')
    const project: ClipForgeProject = JSON.parse(fileContent)
    
    // Validate version
    if (project.version !== '1.0') {
      throw new Error('Unsupported project version')
    }
    
    // Validate file paths still exist
    const validatedClips = await Promise.all(
      project.clips.map(async (clip) => {
        const exists = await fs.promises.access(clip.sourcePath)
          .then(() => true)
          .catch(() => false)
        
        return { ...clip, _exists: exists }
      })
    )
    
    return { 
      success: true, 
      project: { ...project, clips: validatedClips }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('select-project-save-path', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Save Project',
    defaultPath: 'Untitled.clipforge',
    filters: [{ name: 'ClipForge Project', extensions: ['clipforge'] }]
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('select-project-open-path', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open Project',
    properties: ['openFile'],
    filters: [{ name: 'ClipForge Project', extensions: ['clipforge'] }]
  })
  return result.canceled ? null : result.filePaths[0]
})
```

---

#### C.3: Save/Load UI & State (~2 hours)

**Files to Update:**
- `src/renderer/src/App.tsx` (or create `useProject.ts` hook)

**Changes:**
```tsx
const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null)
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

const saveProject = async (savePath?: string) => {
  const pathToUse = savePath || currentProjectPath
  
  if (!pathToUse) {
    // Show Save As dialog
    const newPath = await window.api.selectProjectSavePath()
    if (!newPath) return
    setCurrentProjectPath(newPath)
    return saveProject(newPath)
  }
  
  const projectData: ClipForgeProject = {
    version: '1.0',
    metadata: {
      name: path.basename(pathToUse, '.clipforge'),
      created: currentProjectPath ? existingProject.metadata.created : new Date().toISOString(),
      lastModified: new Date().toISOString(),
      totalDuration: getTotalDuration(clips)
    },
    clips,
    playheadPosition,
    selectedClipId
  }
  
  const result = await window.api.saveProject(pathToUse, projectData)
  
  if (result.success) {
    setHasUnsavedChanges(false)
    toast.success('Project saved!', { duration: 2000 })
  } else {
    showErrorModal({
      title: 'Save Failed',
      message: result.error
    })
  }
}

const saveProjectAs = async () => {
  const newPath = await window.api.selectProjectSavePath()
  if (newPath) {
    await saveProject(newPath)
  }
}

const loadProject = async () => {
  const projectPath = await window.api.selectProjectOpenPath()
  if (!projectPath) return
  
  const result = await window.api.loadProject(projectPath)
  
  if (result.success) {
    const { project } = result
    
    // Check for missing files
    const missingFiles = project.clips.filter(c => !c._exists)
    if (missingFiles.length > 0) {
      showWarningModal({
        title: 'Missing Files',
        message: `${missingFiles.length} file(s) could not be found and will be skipped.`
      })
    }
    
    // Load project state
    setClips(project.clips.filter(c => c._exists))
    setPlayheadPosition(project.playheadPosition)
    setSelectedClipId(project.selectedClipId)
    setCurrentProjectPath(projectPath)
    setHasUnsavedChanges(false)
    
    toast.success(`Opened: ${project.metadata.name}`)
  } else {
    showErrorModal({
      title: 'Open Failed',
      message: result.error
    })
  }
}

// Mark unsaved changes when state changes
useEffect(() => {
  if (currentProjectPath) {
    setHasUnsavedChanges(true)
  }
}, [clips, playheadPosition])
```

---

#### C.4: Menu Integration (~1 hour)

**Files to Update:**
- `src/main/index.ts`

**Changes:**
```typescript
// Update File menu
{
  label: 'File',
  submenu: [
    {
      label: 'New Project',
      accelerator: 'CmdOrCtrl+N',
      click: () => mainWindow.webContents.send('menu-new-project')
    },
    { type: 'separator' },
    {
      label: 'Open Project...',
      accelerator: 'CmdOrCtrl+O',
      click: () => mainWindow.webContents.send('menu-open-project')
    },
    { type: 'separator' },
    {
      label: 'Save Project',
      accelerator: 'CmdOrCtrl+S',
      click: () => mainWindow.webContents.send('menu-save-project')
    },
    {
      label: 'Save Project As...',
      accelerator: 'CmdOrCtrl+Shift+S',
      click: () => mainWindow.webContents.send('menu-save-project-as')
    },
    { type: 'separator' },
    {
      label: 'Import Video...',
      accelerator: 'CmdOrCtrl+I',
      click: () => mainWindow.webContents.send('menu-import')
    },
    {
      label: 'Export Video...',
      accelerator: 'CmdOrCtrl+E',
      click: () => mainWindow.webContents.send('menu-export')
    }
  ]
}
```

**Renderer listeners:**
```tsx
useEffect(() => {
  window.api.onMenuNewProject(() => {
    // Prompt to save if unsaved changes
    if (hasUnsavedChanges) {
      // ... confirmation dialog
    }
    // Reset to empty project
    setClips([])
    setCurrentProjectPath(null)
    setHasUnsavedChanges(false)
  })
  
  window.api.onMenuOpenProject(loadProject)
  window.api.onMenuSaveProject(() => saveProject())
  window.api.onMenuSaveProjectAs(saveProjectAs)
  
  return () => {
    window.api.removeAllListeners('menu-new-project')
    window.api.removeAllListeners('menu-open-project')
    window.api.removeAllListeners('menu-save-project')
    window.api.removeAllListeners('menu-save-project-as')
  }
}, [hasUnsavedChanges, currentProjectPath])
```

---

#### C.5: Auto-Save (~1 hour)

**Files to Update:**
- `src/renderer/src/App.tsx`

**Changes:**
```tsx
useEffect(() => {
  if (!currentProjectPath) return  // Only auto-save if project has been manually saved
  
  const interval = setInterval(async () => {
    await saveProject()
    toast.success('Auto-saved', { duration: 1000 })
  }, 30000)  // 30 seconds
  
  return () => clearInterval(interval)
}, [currentProjectPath, clips, playheadPosition, selectedClipId])
```

**Testing Checkpoint:**
- Save project once
- Wait 30 seconds → "Auto-saved" toast appears
- Verify file updated on disk

---

#### C.6: Save-on-Quit Warning (~2 hours)

**Files to Update:**
- `src/main/index.ts`
- `src/preload/index.ts`

**Changes:**
```typescript
// Main process
app.on('before-quit', async (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault()
    
    const response = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved Changes',
      message: 'Do you want to save changes to your project before quitting?',
      detail: 'Your changes will be lost if you don\'t save them.'
    })
    
    if (response.response === 0) {
      // Save
      mainWindow.webContents.send('save-before-quit')
      // Wait for save to complete
      ipcMain.once('save-complete', () => {
        app.quit()
      })
    } else if (response.response === 1) {
      // Don't Save
      app.quit()
    }
    // response === 2: Cancel (do nothing)
  }
})

// Also check temp recordings (existing logic)
```

**Renderer:**
```tsx
useEffect(() => {
  window.api.onSaveBeforeQuit(async () => {
    await saveProject()
    window.api.saveComplete()
  })
  
  window.api.onCheckUnsavedChanges(() => {
    window.api.respondUnsavedChanges({ hasUnsavedChanges })
  })
  
  return () => {
    window.api.removeAllListeners('save-before-quit')
    window.api.removeAllListeners('check-unsaved-changes')
  }
}, [hasUnsavedChanges])
```

---

### **Phase D: Error Handling & Loading States** (~4 hours)

#### D.1: Install react-hot-toast (~5 min)

```bash
npm install react-hot-toast
```

---

#### D.2: Toast System Integration (~1 hour)

**Files to Update:**
- `src/renderer/src/App.tsx`

**Changes:**
```tsx
import { Toaster, toast } from 'react-hot-toast'

function App() {
  return (
    <>
      <Toaster 
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      {/* ... rest of app */}
    </>
  )
}

// Use throughout app:
toast.success('Video imported successfully!')
toast.error('Export failed: Not enough disk space')
toast('Recording started', { icon: '🎥' })
```

**Testing Checkpoint:**
- Import video → success toast
- Invalid file → error toast
- Recording start → info toast

---

#### D.3: Modal Error System (~1 hour)

**Files to Create:**
- `src/renderer/src/components/ErrorModal.tsx`

**Implementation:**
```tsx
interface ErrorModalProps {
  title: string
  message: string
  details?: string
  onClose: () => void
}

const ErrorModal = ({ title, message, details, onClose }: ErrorModalProps) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal error-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">⚠️</div>
        <h3>{title}</h3>
        <p>{message}</p>
        {details && (
          <details className="error-details">
            <summary>Technical Details</summary>
            <pre>{details}</pre>
          </details>
        )}
        <button onClick={onClose} className="button-primary">OK</button>
      </div>
    </div>
  )
}
```

**Usage:**
```tsx
const [errorModal, setErrorModal] = useState<{
  visible: boolean
  title: string
  message: string
  details?: string
}>({ visible: false, title: '', message: '' })

const showErrorModal = (error: { title: string; message: string; details?: string }) => {
  setErrorModal({ visible: true, ...error })
}

// Use for critical errors:
try {
  await exportVideo(...)
} catch (error) {
  showErrorModal({
    title: 'Export Failed',
    message: 'Could not render video. Check disk space and try again.',
    details: error.message
  })
}
```

---

#### D.4: Loading States (~2 hours)

**Files to Update:**
- `src/renderer/src/hooks/useClipImport.ts`
- `src/renderer/src/components/VideoEditor.tsx`

**Changes:**
```tsx
// Import loading
const [importStatus, setImportStatus] = useState<{
  loading: boolean
  filename?: string
}>({ loading: false })

const handleImport = async () => {
  try {
    const filePath = await window.api.selectVideoFile()
    if (!filePath) return
    
    setImportStatus({ loading: true, filename: path.basename(filePath) })
    
    const metadata = await window.api.getVideoMetadata(filePath)
    const newClip = createClipFromMetadata('imported', filePath, metadata)
    onClipAdded(newClip)
    
    toast.success(`Imported: ${metadata.filename}`)
  } catch (error) {
    toast.error(`Import failed: ${error.message}`)
  } finally {
    setImportStatus({ loading: false })
  }
}

// Export loading (already has progress, enhance)
{exportStatus.active && (
  <div className="export-modal">
    <div className="loading-spinner" />
    <h3>Exporting Video</h3>
    <div className="progress-bar">
      <div 
        className="progress-fill" 
        style={{ width: `${exportStatus.progress}%` }}
      />
    </div>
    <p>{Math.round(exportStatus.progress)}% complete</p>
    <button onClick={cancelExport} className="button-secondary">
      Cancel
    </button>
  </div>
)}
```

**CSS:**
```css
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}
```

---

### **Phase E: Performance & Validation** (~3 hours)

#### E.1: Input Validation (~1 hour)

**Files to Update:**
- `src/main/index.ts`

**Changes:**
```typescript
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv']
const ALLOWED_VIDEO_CODECS = ['h264', 'hevc', 'vp8', 'vp9', 'av1']

ipcMain.handle('validate-video-file', async (event, filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  
  // Check extension
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file type: ${ext}`,
      suggestion: `Supported formats: ${ALLOWED_VIDEO_EXTENSIONS.join(', ')}`
    }
  }
  
  // Check codec with ffprobe
  try {
    const metadata = await getVideoMetadata(filePath)
    
    if (!ALLOWED_VIDEO_CODECS.includes(metadata.codec)) {
      return {
        valid: false,
        error: `Unsupported codec: ${metadata.codec}`,
        suggestion: 'Try converting the video to H.264 format'
      }
    }
    
    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: 'Could not read video file',
      suggestion: 'File may be corrupted or incomplete'
    }
  }
})

// Use before import:
const validation = await window.api.validateVideoFile(filePath)
if (!validation.valid) {
  showErrorModal({
    title: 'Invalid Video File',
    message: validation.error,
    details: validation.suggestion
  })
  return
}
```

---

#### E.2: Timeline Performance (~2 hours)

**Files to Update:**
- `src/renderer/src/components/Timeline.tsx`
- `src/renderer/src/hooks/useMultiClipPlayback.ts`

**Changes:**
```tsx
// 1. Memoize expensive calculations
const clipPositions = useMemo(() => 
  calculateClipPositions(clips), 
  [clips]
)

const totalDuration = useMemo(() => 
  getTotalDuration(clips), 
  [clips]
)

// 2. Memoize TimelineClip components
const TimelineClip = React.memo(({ clip, ... }) => {
  return <div className="timeline-clip" ... />
}, (prev, next) => {
  return (
    prev.clip.id === next.clip.id &&
    prev.clip.timelineDuration === next.clip.timelineDuration &&
    prev.clip.sourceStartTime === next.clip.sourceStartTime &&
    prev.isSelected === next.isSelected
  )
})

// 3. Throttle playhead updates during playback
import { throttle } from 'lodash'

const updatePlayhead = throttle((position: number) => {
  setPlayheadPosition(position)
}, 33)  // ~30fps

// 4. Use CSS containment (already in Phase 2)
```

**Testing Checkpoint:**
- Add 20+ clips → timeline remains responsive
- Scrub playhead → no dropped frames
- Zoom in/out → smooth animation

---

### **Phase F: Export Presets** (~2 hours)

#### F.1: Preset Configuration (~30 min)

**Files to Create:**
- `src/main/utils/exportPresets.ts`

**Implementation:**
```typescript
export interface ExportPreset {
  id: string
  name: string
  description: string
  resolution: string
  fps: number
  bitrate: string
  codec: string
}

export const EXPORT_PRESETS: Record<string, ExportPreset> = {
  'youtube-1080p': {
    id: 'youtube-1080p',
    name: 'YouTube 1080p',
    description: 'Optimized for YouTube uploads',
    resolution: '1920x1080',
    fps: 30,
    bitrate: '8000k',
    codec: 'libx264'
  },
  'instagram-reel': {
    id: 'instagram-reel',
    name: 'Instagram Reel',
    description: 'Vertical 9:16 format',
    resolution: '1080x1920',
    fps: 30,
    bitrate: '5000k',
    codec: 'libx264'
  },
  'tiktok': {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Vertical 9:16 format',
    resolution: '1080x1920',
    fps: 30,
    bitrate: '4500k',
    codec: 'libx264'
  },
  'twitter': {
    id: 'twitter',
    name: 'Twitter',
    description: 'Compressed for fast uploads',
    resolution: '1280x720',
    fps: 30,
    bitrate: '6000k',
    codec: 'libx264'
  }
}
```

---

#### F.2: Preset UI (~1 hour)

**Files to Update:**
- `src/renderer/src/components/VideoEditor.tsx`

**Changes:**
```tsx
const [selectedPreset, setSelectedPreset] = useState<string | null>('youtube-1080p')
const [customSettings, setCustomSettings] = useState({ 
  resolution: '1920x1080', 
  fps: 30, 
  bitrate: '8000k' 
})

// In export dialog
<div className="export-option">
  <label>Export Preset:</label>
  <select 
    value={selectedPreset || 'custom'}
    onChange={(e) => {
      if (e.target.value === 'custom') {
        setSelectedPreset(null)
      } else {
        setSelectedPreset(e.target.value)
      }
    }}
  >
    <option value="youtube-1080p">YouTube 1080p (1920×1080, 8000k)</option>
    <option value="instagram-reel">Instagram Reel (1080×1920, 5000k)</option>
    <option value="tiktok">TikTok (1080×1920, 4500k)</option>
    <option value="twitter">Twitter (1280×720, 6000k)</option>
    <option value="custom">Custom Settings...</option>
  </select>
</div>

{!selectedPreset && (
  <div className="custom-settings">
    <input 
      type="text" 
      value={customSettings.resolution}
      onChange={(e) => setCustomSettings(prev => ({ ...prev, resolution: e.target.value }))}
      placeholder="1920x1080"
    />
    {/* ... more custom inputs */}
  </div>
)}
```

---

#### F.3: Apply Preset to Export (~30 min)

**Files to Update:**
- `src/main/index.ts`

**Changes:**
```typescript
ipcMain.handle('export-with-preset', async (event, { clips, presetId, outputPath }) => {
  const preset = EXPORT_PRESETS[presetId]
  
  return new Promise((resolve, reject) => {
    ffmpeg(clips[0].sourcePath)
      .size(preset.resolution)
      .fps(preset.fps)
      .videoBitrate(preset.bitrate)
      .videoCodec(preset.codec)
      .output(outputPath)
      .on('end', () => resolve({ success: true }))
      .on('error', reject)
      .run()
  })
})
```

---

### **Phase G: Keyboard Shortcuts Help Panel** (~1 hour)

#### G.1: Help Panel Component (~45 min)

**Files to Create:**
- `src/renderer/src/components/KeyboardShortcutsHelp.tsx`

**Implementation:**
```tsx
const KeyboardShortcutsHelp = ({ onClose }) => {
  const shortcuts = [
    { category: 'File', items: [
      { keys: 'Cmd+N', action: 'New Project' },
      { keys: 'Cmd+O', action: 'Open Project' },
      { keys: 'Cmd+S', action: 'Save Project' },
      { keys: 'Cmd+Shift+S', action: 'Save Project As' },
      { keys: 'Cmd+I', action: 'Import Video' },
      { keys: 'Cmd+E', action: 'Export Video' }
    ]},
    { category: 'Recording', items: [
      { keys: 'Cmd+Shift+W', action: 'Record Webcam' },
      { keys: 'Cmd+Shift+R', action: 'Record Screen' },
      { keys: 'Cmd+Shift+B', action: 'Record Screen + Webcam' }
    ]},
    { category: 'Editing', items: [
      { keys: 'Space', action: 'Play/Pause' },
      { keys: 'Cmd+K', action: 'Split Clip at Playhead' },
      { keys: 'Delete', action: 'Delete Selected Clip' }
    ]},
    { category: 'View', items: [
      { keys: 'Cmd+=', action: 'Zoom In' },
      { keys: 'Cmd+-', action: 'Zoom Out' },
      { keys: 'Cmd+0', action: 'Reset Zoom' }
    ]}
  ]
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard Shortcuts</h2>
        
        {shortcuts.map(({ category, items }) => (
          <div key={category} className="shortcuts-category">
            <h3>{category}</h3>
            <div className="shortcuts-list">
              {items.map(({ keys, action }) => (
                <div key={action} className="shortcut-item">
                  <kbd>{keys}</kbd>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        <button onClick={onClose} className="button-primary">Close</button>
      </div>
    </div>
  )
}
```

---

#### G.2: Trigger Help Panel (~15 min)

**Files to Update:**
- `src/renderer/src/App.tsx`

**Changes:**
```tsx
const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)

// Listen for Cmd+/
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault()
      setShowShortcutsHelp(true)
    }
  }
  
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])

// Add menu item
{
  label: 'Help',
  submenu: [
    {
      label: 'Keyboard Shortcuts',
      accelerator: 'CmdOrCtrl+/',
      click: () => mainWindow.webContents.send('show-shortcuts-help')
    }
  ]
}
```

---

### **Phase H: Security Fix (Custom Protocol)** (~2 hours)

#### H.1: Implement Custom Protocol (~1.5 hours)

**Files to Update:**
- `src/main/index.ts`

**Changes:**
```typescript
import { protocol } from 'electron'

app.whenReady().then(() => {
  // Register custom protocol for safe video file access
  protocol.registerFileProtocol('clipforge', (request, callback) => {
    const url = request.url.replace('clipforge:///', '')
    const decodedPath = decodeURIComponent(url)
    
    // Validate path is a video file
    const ext = path.extname(decodedPath).toLowerCase()
    if (!['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(ext)) {
      callback({ error: -6 })  // ERR_FILE_NOT_FOUND
      return
    }
    
    callback({ path: decodedPath })
  })
  
  createWindow()
})
```

---

#### H.2: Update Video Sources (~30 min)

**Files to Update:**
- `src/renderer/src/components/VideoPreview.tsx`

**Changes:**
```tsx
// Before (insecure):
<video src={`file://${sourcePath}`} />

// After (secure):
<video src={`clipforge:///${sourcePath}`} />
```

**Remove from webPreferences:**
```typescript
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  // webSecurity: false,  ❌ REMOVE THIS
  // allowRunningInsecureContent: true,  ❌ REMOVE THIS
  preload: join(__dirname, '../preload/index.js')
}
```

---

### **Phase I: DMG Distribution** (~1 hour)

#### I.1: Fix DMG Build Issues (~30 min)

**Files to Update:**
- `electron-builder.yml`

**Changes:**
```yaml
mac:
  target:
    - target: dmg
      arch: [arm64, x64]
  category: public.app-category.video
  icon: build/icon.icns

dmg:
  format: UDZO
  backgroundColor: '#1a1a1a'
  window:
    width: 540
    height: 380
  contents:
    - x: 140
      y: 190
      type: file
    - x: 400
      y: 190
      type: link
      path: /Applications
```

**Try alternative approach if hdiutil fails:**
```bash
# Run build with elevated permissions (one-time)
sudo npm run build:mac

# Or use ZIP for now, DMG can be added later
```

---

#### I.2: Test DMG Installation (~30 min)

```bash
npm run build:mac
```

**Manual Test:**
- Open generated DMG
- Drag app to Applications folder
- Launch from Applications
- Verify all features work
- Check app signing/notarization (if applicable)

---

### **Phase J: Final Integration & Testing** (~2 hours)

#### J.1: End-to-End Testing (~1.5 hours)

**Complete Workflow Tests:**

1. **Project Lifecycle:**
   - New project → Add clips → Save → Quit
   - Relaunch → Open project → Verify state
   - Make changes → Auto-save works
   - Cmd+S → Manual save works

2. **Drag & Reorder:**
   - Import 3 clips → Drag to reorder
   - Move clip to Track 1 → Verify assignment
   - Drag back to Track 0 → Verify

3. **Delete:**
   - Select clip → Press Delete → Confirm
   - Right-click → Delete → Confirm
   - Export after deletion → Works

4. **Error Handling:**
   - Import invalid file → Error modal
   - Export with no disk space → Error modal
   - Missing file in project → Warning on load

5. **Loading States:**
   - Import large video → Spinner shows
   - Export → Progress bar updates

6. **Performance:**
   - Add 30 clips → Timeline responsive
   - Zoom in/out → Smooth

7. **Presets:**
   - Export with YouTube preset → Correct resolution
   - Export with Instagram preset → Vertical format

8. **Security:**
   - Videos play with `clipforge:///` protocol
   - No `webSecurity: false` in webPreferences

---

#### J.2: Documentation Updates (~30 min)

**Files to Update:**
- `docs/ARCHITECTURE.md`
- `docs/MANUAL_TESTING_GUIDE.md`

**Add Phase 4 sections:**
- Project save/load architecture
- Error handling strategy
- Performance optimizations applied
- Export preset system

---

### **Phase K: Commit & Release** (~1 hour)

#### K.1: Validation (~15 min)

```bash
npm run validate
npm test
```

Fix any errors.

---

#### K.2: Commit (~15 min)

```bash
git add -A
git commit -m "feat: Phase 4 - Production polish & project management

✨ New Features:
- Drag-to-rearrange clips (within track & between tracks)
- Delete clips (Delete key + context menu + confirmation)
- Project save/load (.clipforge format, Cmd+S, Cmd+O)
- Auto-save every 30 seconds
- Save-on-quit warning
- Export presets (YouTube, Instagram, TikTok, Twitter)
- Keyboard shortcuts help panel (Cmd+/)

🎨 UX Improvements:
- Toast notifications (react-hot-toast)
- Error modals for critical failures
- Loading states & progress indicators
- Input validation (file format, codec checks)

⚡ Performance:
- Memoized expensive calculations
- React.memo for timeline clips
- Throttled playhead updates
- CSS containment

🔒 Security:
- Custom protocol handler (clipforge:///)
- Removed webSecurity: false
- Safe video file access

📦 Distribution:
- DMG packaging for macOS
- Professional installer experience

📝 Files Added:
- KeyboardShortcutsHelp.tsx
- ErrorModal.tsx
- exportPresets.ts

📝 Files Updated:
- Timeline.tsx (drag-to-rearrange)
- VideoEditor.tsx (delete, project save/load)
- App.tsx (toast system, error handling)
- main.ts (custom protocol, project IPC handlers)
- useClips.ts, useMultiClipPlayback.ts (memoization)

✅ Phase 4 Complete - Production Ready!"
```

---

#### K.3: Build Final Release (~30 min)

```bash
# Clean build
rm -rf dist out node_modules/.vite
npm install
npm run build
npm run build:mac
```

**Test final package:**
- Install DMG on clean Mac
- Run through all manual tests
- Verify no console errors
- Check performance

---

## Testing Checklist

### Manual Testing (Do this after Phase K)

**Drag & Reorder:**
- [ ] Drag clip center → reorders
- [ ] Drag trim handle → only trims, doesn't reorder
- [ ] Drag clip to other track → moves tracks
- [ ] Visual feedback during drag

**Delete:**
- [ ] Delete key → confirmation dialog
- [ ] Context menu → Delete → confirmation
- [ ] Cancel → clip not deleted
- [ ] Confirm → clip removed
- [ ] Export after delete → works

**Project Save/Load:**
- [ ] Cmd+S first time → shows Save As dialog
- [ ] Cmd+S after → saves to existing file
- [ ] Cmd+Shift+S → always shows Save As
- [ ] Cmd+O → opens project
- [ ] Auto-save works every 30 seconds
- [ ] Quit with unsaved → warning dialog
- [ ] Open project with missing files → warning

**Error Handling:**
- [ ] Import invalid file → error modal
- [ ] Export failure → error modal
- [ ] Success operations → toast
- [ ] Info messages → toast

**Loading States:**
- [ ] Import → spinner shows
- [ ] Export → progress bar
- [ ] Recording → indicators

**Performance:**
- [ ] 30 clips → responsive
- [ ] Zoom → smooth
- [ ] Scrub → no lag

**Export Presets:**
- [ ] YouTube preset → 1920×1080
- [ ] Instagram preset → 1080×1920
- [ ] Custom settings → works

**Shortcuts Help:**
- [ ] Cmd+/ → opens help
- [ ] Menu → Help → Shortcuts
- [ ] All shortcuts listed

**Security:**
- [ ] Videos play with custom protocol
- [ ] No security errors in console

**DMG:**
- [ ] DMG opens
- [ ] Drag to Applications
- [ ] App launches
- [ ] All features work

---

## Success Criteria

Phase 4 is complete when:

✅ Drag-to-rearrange works for single & multi-track  
✅ Delete clips works with confirmation  
✅ Project save/load works (.clipforge format)  
✅ Auto-save works every 30 seconds  
✅ Save-on-quit warning works  
✅ Toast notifications for info/success  
✅ Modal dialogs for critical errors  
✅ Loading states for all async operations  
✅ Input validation prevents invalid files  
✅ Timeline performs well with 30+ clips  
✅ Export presets work correctly  
✅ Keyboard shortcuts help panel accessible  
✅ Custom protocol handler enabled  
✅ `webSecurity: false` removed  
✅ DMG builds successfully  
✅ All manual tests pass  
✅ No regressions in Phase 2/3 features  
✅ Code validates (lint + typecheck + build)  
✅ Production-ready for distribution

---

**Estimated Total Effort:** ~25 hours  
**Recommended Schedule:** 3-4 days × 6-8 hours/day  
**Next:** User testing, feedback iteration, marketing prep  
**Goal:** Ship v1.0! 🚀

