# ClipForge Phase 2: Implementation Plan & Task List

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
- **Auto-minimize** main window when recording starts
- **Floating controls** appear with recording indicator and stop button
- **3-2-1 countdown** before recording begins
- **Screen picker** shows thumbnails of available screens/windows
- **Remember last source** for convenience

### File Handling
- Record to temp directory initially
- **Prompt to save** immediately after recording stops
- **Auto-add to timeline** regardless of save location
- **Warn on quit** if unsaved temp files exist
- **Visual indicator** (⚠️) on temp file clips

### Multi-Clip Behavior
- **Append to end** by default (new clips added sequentially)
- **Clips snap together** (no gaps between clips)
- **Auto-play across clips** (continuous playback)
- **Settings toggle** to pause between clips (future)

### Split Behavior
- **Cmd+K** keyboard shortcut (primary method)
- **Right-click** option (future)
- **Both pieces** remain on timeline after split
- **Visual indicator** shows where split will occur

### Export Options
- **Single clip**: Simple trim export
- **Multiple clips**: FFmpeg concat (default)
- **UI options** for gaps/separate files (future)

---

## New State Structure

```typescript
interface TimelineClip {
  id: string
  sourceType: 'imported' | 'screen' | 'webcam'
  sourcePath: string
  sourceStartTime: number  // Trim start in source file
  sourceDuration: number   // Full duration of source file
  timelinePosition: number // Start position on timeline (seconds)
  timelineDuration: number // Duration on timeline (after trim)
  metadata: {
    filename: string
    resolution: string
    codec: string
  }
}

interface AppState {
  clips: TimelineClip[]
  totalDuration: number
  playheadPosition: number
  isPlaying: boolean
}
```

---

# 🟢 PHASE A: Foundation & Temp File Management

## ✅ TASK A.1: Create Temp File Manager

**📁 Files to create:**
- `src/main/utils/tempFileManager.ts`

**📁 Files to modify:**
- `src/main/index.ts`

**Implementation:**
- Create utility for managing temp recordings
- Functions: `initTempDir()`, `cleanupTempDir()`, `getTempRecordingPath()`, `checkTempDirSize()`
- Max temp size: 5 GB
- Max file age: 7 days
- Auto-delete old/unreferenced files on app start

**🧪 CHECKPOINT A.1:**
- Run app → verify `/tmp/clipforge-recordings/` directory created
- Check console for no errors

---

## ✅ TASK A.2: Add IPC Handler for Saving Blobs

**📁 Files to modify:**
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`

**Implementation:**
- `save-recording-blob`: Save ArrayBuffer to temp directory
- `save-recording-permanent`: Show save dialog, move from temp to permanent location
- Check temp dir size before saving

**🧪 CHECKPOINT A.2:**
- Test in DevTools: `await window.api.saveRecordingBlob(new ArrayBuffer(100))`
- Should return temp file path

---

# 🟢 PHASE B: Webcam Recording

## ✅ TASK B.1: Create Recording State & Types

**📁 Files to create:**
- `src/renderer/src/types/timeline.ts`

**Implementation:**
- Define `TimelineClip`, `RecordingState`, `AppState` interfaces

**🧪 CHECKPOINT B.1:**
- Verify TypeScript compiles: `npm run build`

---

## ✅ TASK B.2: Create Webcam Recording Component

**📁 Files to create:**
- `src/renderer/src/components/WebcamRecorder.tsx`

**Implementation:**
- Request webcam via `getUserMedia`
- Show live preview
- 3-2-1 countdown before recording
- Use `MediaRecorder` to capture
- Recording indicator with timer
- Stop button to end recording

**🧪 CHECKPOINT B.2:**
- Create temp test in App.tsx
- Webcam preview should appear
- Recording should work with countdown

---

## ✅ TASK B.3: Add Webcam Recording Styles

**📁 Files to modify:**
- `src/renderer/src/assets/main.css`

**Implementation:**
- Modal styles for recorder
- Countdown animation
- Recording indicator with blinking red dot
- Button styles

**🧪 CHECKPOINT B.3:**
- Verify styles look polished
- Countdown animation smooth

---

## ✅ TASK B.4: Integrate Webcam Recorder into App

**📁 Files to modify:**
- `src/renderer/src/App.tsx`

**Implementation:**
- Add state: `showWebcamRecorder`
- Handler: `handleWebcamRecordingComplete`
  - Save blob to temp
  - Prompt for permanent save
  - Get metadata
  - Add to clips array (replaces single video for now)
- Render `<WebcamRecorder>` modal
- Add test button

**🧪 CHECKPOINT B.4:**
- Click test button → record webcam
- Save dialog appears after recording
- Recording added to timeline

---

# 🟢 PHASE C: Screen Recording with System Audio

## ✅ TASK C.1: Add IPC Handler for Screen Sources

**📁 Files to modify:**
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`

**Implementation:**
- `get-screen-sources`: Use `desktopCapturer.getSources()`
- Return array with id, name, thumbnail (base64)

**🧪 CHECKPOINT C.1:**
- Test: `await window.api.getScreenSources()`
- Should return sources with thumbnails

---

## ✅ TASK C.2: Create Screen Source Picker Component

**📁 Files to create:**
- `src/renderer/src/components/ScreenSourcePicker.tsx`

**Implementation:**
- Grid of available screens/windows
- Show thumbnails
- Click to select
- "Start Recording" button

**🧪 CHECKPOINT C.2:**
- Should see grid of sources
- Clicking should select
- Multiple monitors should show

---

## ✅ TASK C.3: Add Screen Source Picker Styles

**📁 Files to modify:**
- `src/renderer/src/assets/main.css`

**Implementation:**
- Grid layout for sources
- Selected state styling
- Hover effects

**🧪 CHECKPOINT C.3:**
- Verify responsive grid
- Selected state clear

---

## ✅ TASK C.4: Create Screen Recorder Component

**📁 Files to create:**
- `src/renderer/src/components/ScreenRecorder.tsx`

**Implementation:**
- Show `ScreenSourcePicker` initially
- Request screen stream with system audio
- 3-2-1 countdown
- Floating controls during recording
- Stop button

**🧪 CHECKPOINT C.4:**
- Select screen → countdown → recording starts
- Floating controls visible
- Stop recording works

---

## ✅ TASK C.5: Add Screen Recorder Styles

**📁 Files to modify:**
- `src/renderer/src/assets/main.css`

**Implementation:**
- Fullscreen countdown overlay
- Floating recorder controls (top-center)
- Always-on-top styling

**🧪 CHECKPOINT C.5:**
- Floating controls at top center
- Styles modern and polished

---

## ✅ TASK C.6: Integrate Screen Recorder into App

**📁 Files to modify:**
- `src/renderer/src/App.tsx`

**Implementation:**
- Add state: `showScreenRecorder`
- Handler: `handleScreenRecordingComplete`
- Render `<ScreenRecorder>` modal
- Add test button

**🧪 CHECKPOINT C.6:**
- Click test button → select screen
- Recording should work
- Save dialog appears

---

## ✅ TASK C.7: Implement App Minimize During Recording

**📁 Files to modify:**
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/components/ScreenRecorder.tsx`

**Implementation:**
- IPC handlers: `minimize-window`, `restore-window`
- Call minimize when recording starts
- Call restore when recording stops
- Floating controls remain visible

**🧪 CHECKPOINT C.7:**
- Start screen recording
- Main window should minimize after countdown
- Floating controls remain clickable
- Stop recording → window restores

---

# 🟢 PHASE D: Multi-Clip Timeline State Refactor

## ✅ TASK D.1: Migrate State from Single Video to Multi-Clip

**📁 Files to modify:**
- `src/renderer/src/App.tsx`

**Implementation:**
- Replace `VideoState` with multi-clip structure
- `clips: TimelineClip[]`, `playheadPosition`, `isPlaying`
- Helper: `generateClipId()`
- Update `handleImport` to add to clips array
- Update recording handlers to add to clips array
- Update WelcomeScreen condition: `clips.length === 0`
- Calculate `totalDuration` from clips

**🧪 CHECKPOINT D.1:**
- Multiple imports add multiple clips
- Console.log clips array to verify structure

---

## ✅ TASK D.2: Update VideoEditor for Multi-Clip

**📁 Files to modify:**
- `src/renderer/src/App.tsx` (VideoEditor function)

**Implementation:**
- Update props: `clips`, `setClips`, etc.
- Helper: `getClipAtPosition()` - find clip at playhead
- Helper: `getPositionInClip()` - position within current clip
- Update `handleTimeUpdate` for clip transitions
- Update `handleTrimChange` for clip-specific trim
- Update info panel to show clip count
- Add "+ Add Clip" button

**🧪 CHECKPOINT D.2:**
- App compiles and runs
- Info panel shows "Clips: 1"
- Timeline will have errors (fix in next task)

---

## ✅ TASK D.3: Update Timeline for Multi-Clip

**📁 Files to create:**
- `src/renderer/src/components/TimelineClip.tsx`

**📁 Files to modify:**
- `src/renderer/src/components/Timeline.tsx`

**Implementation:**
- Create `TimelineClip` component:
  - Individual clip visualization
  - Trim handles per clip
  - Selection state
  - Type icon (🖥️ 📹 📁)
- Update `Timeline` component:
  - Map over clips array
  - Render `<TimelineClip>` for each
  - Pass `pixelsPerSecond` to each
  - Handle clip selection

**🧪 CHECKPOINT D.3:**
- Import 2-3 clips → all appear side-by-side
- Each clip independently trimmable
- Clicking clip selects it
- Playhead moves across all clips

---

## ✅ TASK D.4: Add Multi-Clip Timeline Styles

**📁 Files to modify:**
- `src/renderer/src/assets/main.css`
- `src/renderer/src/components/TimelineClip.tsx`

**Implementation:**
- Different colors per clip type:
  - Screen: Purple gradient
  - Webcam: Pink gradient
  - Imported: Blue gradient
- Selected state: Gold border
- Hover effects
- Clip icons

**🧪 CHECKPOINT D.4:**
- Different clip types have different colors
- Selected clip has gold border
- Hover effects work

---

# 🟢 PHASE E: Multi-Clip Playback

## ✅ TASK E.1: Implement Automatic Clip Transitions

**📁 Files to modify:**
- `src/renderer/src/components/VideoPreview.tsx`

**Implementation:**
- Detect when video source changes
- Handle `onTimeUpdate` to check for clip end
- Notify parent when clip boundary reached
- Update video `src` when clip changes
- Handle seeking across clip boundaries

**🧪 CHECKPOINT E.1:**
- Load 2 clips
- Press play
- Should automatically transition from clip 1 to clip 2
- (May have brief pause at transition)

---

## ✅ TASK E.2: Handle Clip Boundary Transitions in VideoEditor

**📁 Files to modify:**
- `src/renderer/src/App.tsx` (VideoEditor function)

**Implementation:**
- Update `handleTimeUpdate`:
  - Detect when reached end of current clip
  - Move playhead to start of next clip
  - If no next clip, stop playback
- Handle edge cases (end of timeline)

**🧪 CHECKPOINT E.2:**
- Load 2+ clips
- Press play
- Should play through all clips automatically
- Should stop at end of last clip

---

# 🟢 PHASE F: Split Functionality

## ✅ TASK F.1: Add Split Function

**📁 Files to modify:**
- `src/renderer/src/App.tsx` (VideoEditor function)

**Implementation:**
- Function: `handleSplitClip()`
  - Find current clip at playhead
  - Calculate position within clip
  - Create two new clips (left and right pieces)
  - Update clips array
- Keyboard shortcut: Cmd+K
- Add split button in preview panel
- Don't split near edges (<0.1s from start/end)

**🧪 CHECKPOINT F.1:**
- Load a clip
- Move playhead to middle
- Press Cmd+K or click Split button
- Clip splits into two pieces
- Both pieces playable

---

## ✅ TASK F.2: Add Split Visual Indicator

**📁 Files to modify:**
- `src/renderer/src/components/Timeline.tsx`
- `src/renderer/src/assets/main.css`

**Implementation:**
- Detect if playhead is over a clip
- Show gold vertical line at playhead position
- Only show when over a clip
- CSS: Gold line with shadow

**🧪 CHECKPOINT F.2:**
- Move playhead over clip
- Should see gold split indicator line
- Line shows where split will occur

---

# 🟢 PHASE G: Multi-Clip Export

## ✅ TASK G.1: Add FFmpeg Concat Export Handler

**📁 Files to modify:**
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`

**Implementation:**
- IPC handler: `export-multi-clip`
- Use FFmpeg complex filter:
  - Trim each clip
  - Concat all clips (video + audio)
  - Map outputs
- Send progress events

**🧪 CHECKPOINT G.1:**
- Test will be in next task

---

## ✅ TASK G.2: Update Export Button for Multi-Clip

**📁 Files to modify:**
- `src/renderer/src/App.tsx` (VideoEditor function)
- `src/renderer/src/components/ExportButton.tsx`

**Implementation:**
- Update `handleExport`:
  - If 1 clip: use simple export
  - If multiple clips: use `exportMultiClip`
- Update `ExportButton` props: `hasClips` instead of `sourcePath`
- Update button text: "Export Timeline"

**🧪 CHECKPOINT G.2:**
- Load 2-3 clips
- Click Export
- Should concatenate all clips
- Output video plays all clips in sequence

---

# 🟢 PHASE H: Polish & Temp File Management Integration

## ✅ TASK H.1: Track Temp File References

**📁 Files to modify:**
- `src/renderer/src/App.tsx`
- `src/main/index.ts`

**Implementation:**
- Helper: `getTempFileClips()` - find clips using temp files
- Add `before-quit` handler in main process
- Check for unsaved recordings
- Show warning dialog if temp files exist
- IPC: `check-unsaved-recordings` event

**🧪 CHECKPOINT H.1:**
- Record clip, keep in temp
- Try to quit app
- Should see warning dialog
- "Quit Anyway" quits, "Cancel" stays open

---

## ✅ TASK H.2: Add Visual Indicator for Temp Files

**📁 Files to modify:**
- `src/renderer/src/components/TimelineClip.tsx`
- `src/renderer/src/assets/main.css`

**Implementation:**
- Detect if `sourcePath` contains 'clipforge-recordings'
- Add ⚠️ icon to clip
- Orange color for temp file clips
- Tooltip: "Unsaved recording"

**🧪 CHECKPOINT H.2:**
- Record clip, cancel save
- Clip should have orange color and ⚠️ icon
- Hover shows tooltip

---

## ✅ TASK H.3: Initialize Temp Dir on App Start

**📁 Files to modify:**
- `src/main/index.ts`

**Implementation:**
- Call `initializeOnAppStart([])` in `app.whenReady()`
- Pass empty array for now (will pass timeline refs later)

**🧪 CHECKPOINT H.3:**
- Add old test files to `/tmp/clipforge-recordings/`
- Start app
- Old files (7+ days) should be deleted

---

## ✅ TASK H.4: Remove Test Buttons & Clean Up UI

**📁 Files to modify:**
- `src/renderer/src/App.tsx`

**Implementation:**
- Remove temporary test buttons
- Add proper recording controls to info panel:
  - "🖥️ Record Screen" button
  - "📹 Record Webcam" button
- Add CSS for recording controls
- Polish overall layout

**🧪 CHECKPOINT H.4:**
- Test buttons removed
- Recording controls in info panel
- UI looks intentional and polished

---

# 🎯 FINAL COMPREHENSIVE TEST

**Complete workflow test:**

1. **Import & Recording:**
   - [ ] Import video file → timeline
   - [ ] Record webcam → timeline
   - [ ] Record screen → timeline
   - [ ] Verify 3 clips on timeline

2. **Timeline:**
   - [ ] Clips positioned sequentially
   - [ ] Correct icons (📁 🖥️ 📹)
   - [ ] Clicking selects clip
   - [ ] Temp files show ⚠️

3. **Trim:**
   - [ ] Drag trim handles works
   - [ ] Clip width updates
   - [ ] Info panel shows duration

4. **Playback:**
   - [ ] Play → plays first clip
   - [ ] Automatic transitions
   - [ ] Plays through all clips
   - [ ] Stops at end

5. **Split:**
   - [ ] Cmd+K splits clip
   - [ ] Both pieces remain
   - [ ] Both playable

6. **Export:**
   - [ ] Export dialog works
   - [ ] Progress shows
   - [ ] Output plays all clips
   - [ ] Trim points respected

7. **Temp Files:**
   - [ ] Unsaved clips have ⚠️
   - [ ] Quit warning appears
   - [ ] Cleanup on restart

8. **System Audio (macOS 13+):**
   - [ ] Screen recording captures audio
   - [ ] Playback includes system audio

---

## Task Summary

**Total Tasks:** 37 tasks across 8 phases
**Estimated Time:** 25-30 hours

### Phase Breakdown:
- **Phase A:** Foundation (3 tasks, ~2 hours)
- **Phase B:** Webcam Recording (4 tasks, ~3 hours)
- **Phase C:** Screen Recording (7 tasks, ~5 hours)
- **Phase D:** Multi-Clip State (4 tasks, ~4 hours)
- **Phase E:** Multi-Clip Playback (2 tasks, ~2 hours)
- **Phase F:** Split Functionality (2 tasks, ~2 hours)
- **Phase G:** Multi-Clip Export (2 tasks, ~3 hours)
- **Phase H:** Polish & Cleanup (4 tasks, ~2 hours)

### Checkpoints:
- **37 individual task checkpoints**
- **1 comprehensive final test**

---

## Next Steps

1. Begin with Phase A (Foundation)
2. Complete each task in order
3. Run checkpoint tests after each task
4. Commit after completing each phase
5. Run final comprehensive test before marking complete

---

**Document Version:** 1.0  
**Created:** October 29, 2025  
**Status:** Ready for implementation

