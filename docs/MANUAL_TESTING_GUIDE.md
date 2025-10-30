# ClipForge Manual Testing Guide

**Version:** MVP + Phase 2 + Phase 3 A-C (Multi-Track, Simultaneous Recording, PiP, Export)  
**Last Updated:** October 30, 2025

## ⚡ TLDR Smoke Test (3 minutes)

**Quick sanity check:** Import video → plays → record webcam → multiple clips on timeline → trim/split → playback across clips → export → video correct. If all work, you're good!

---

## 🚀 Quick Smoke Test (10 minutes)

**Purpose:** Verify core functionality including Phase 2 features

### Prerequisites

- Sample video file (MP4 or MOV)
- Built/running ClipForge app
- Webcam access (for recording test)
- Screen Recording permission (macOS)

### Steps

1. **Launch App**
   - ✅ App launches without errors
   - ✅ Welcome screen displays

2. **Import Video**
   - Click "Import Video" button OR drag-and-drop video
   - ✅ File picker opens / drop accepted
   - ✅ Video loads and displays in preview panel
   - ✅ Timeline appears with video clip
   - ✅ Info panel shows: filename, resolution, duration, trim range

3. **Record Webcam**
   - Click "Test Webcam" button
   - ✅ Webcam preview appears with countdown
   - ✅ Recording timer counts up
   - ✅ Click "Stop" to end recording
   - ✅ Save dialog appears
   - ✅ Recording added to timeline with ⚠️ indicator

4. **Multi-Clip Timeline**
   - ✅ Both clips appear on timeline
   - ✅ Clips snap together (no gaps)
   - ✅ Click clip to select (green border)
   - ✅ Timeline auto-resizes for total duration

5. **Playback Across Clips**
   - Click "Play" button
   - ✅ Video plays through first clip
   - ✅ Auto-advances to second clip seamlessly
   - ✅ Playhead moves continuously across clips
   - ✅ Stops at end of timeline

6. **Split Functionality**
   - Position playhead mid-clip, press `Cmd+K`
   - ✅ Clip splits into two
   - ✅ Both pieces appear on timeline
   - ✅ Playback works across split

7. **Trim Individual Clips**
   - Click clip to select
   - ✅ Trim handles appear only on selected clip
   - Drag trim handles
   - ✅ Only selected clip trims
   - ✅ Other clips unaffected

8. **Export Multi-Clip**
   - Click "Export Video" button
   - ✅ Save dialog opens
   - Choose location, click Save
   - ✅ Progress bar appears
   - ✅ Export completes successfully
   - Open exported video
   - ✅ All clips concatenated correctly
   - ✅ Trims applied correctly

9. **Temp File Warning**
   - Try to quit app with unsaved recordings
   - ✅ Warning dialog appears
   - ✅ "Quit Anyway" or "Cancel" options work

**Result:** If all ✅ pass, core functionality + Phase 2 features are working!

---

## 📋 Comprehensive Test Suite

### 1. Import Tests

#### 1.1 Button Import

- [ ] Click "Import Video" button
- [ ] File picker opens
- [ ] Select valid MP4 file
- [ ] Video loads and displays
- [ ] Info panel populates with correct metadata

#### 1.2 Drag-and-Drop Import

- [ ] Drag MP4 file onto app window
- [ ] Drop zone highlights (if implemented)
- [ ] Video loads on drop
- [ ] Multiple file drop shows error or imports first only

#### 1.3 File Format Support

- [ ] Import .mp4 file → Success
- [ ] Import .mov file → Success
- [ ] Import unsupported format (.avi, .mkv) → Error message
- [ ] Import corrupt video → Error message

#### 1.4 Edge Cases

- [ ] File path with spaces → Works
- [ ] File path with special characters → Works
- [ ] Very long filename (>200 chars) → Handles gracefully
- [ ] Cancel file picker → App remains stable

---

### 2. Video Playback Tests

#### 2.1 Basic Playback

- [ ] Click Play → Video plays
- [ ] Click Pause → Video pauses
- [ ] Play/Pause multiple times → Works consistently
- [ ] Playback starts from trim start position
- [ ] Playback stops at trim end position

#### 2.2 Playhead Sync

- [ ] Playhead moves smoothly during playback
- [ ] Playhead position accurate (matches video time)
- [ ] Pausing stops playhead movement
- [ ] Resuming continues from paused position

#### 2.3 Video Aspect Ratios

- [ ] Portrait video (9:16) → Displays correctly centered
- [ ] Landscape video (16:9) → Displays correctly centered
- [ ] Square video (1:1) → Displays correctly centered
- [ ] Ultra-wide video (21:9) → Displays without distortion
- [ ] All videos maintain aspect ratio (no stretching)

---

### 3. Timeline Tests

#### 3.1 Timeline Display

- [ ] Timeline shows full video duration
- [ ] Time ruler shows seconds correctly
- [ ] Video clip positioned at correct start time
- [ ] Clip width proportional to duration
- [ ] Scrollable if video longer than viewport

#### 3.2 Zoom

- [ ] Can zoom in/out on timeline (if implemented)
- [ ] Clip scaling updates correctly
- [ ] Time ruler updates with zoom level

---

### 4. Trim Functionality Tests

#### 4.1 Left Trim Handle

- [ ] Hover over left handle → Cursor changes to resize
- [ ] Drag handle right → Trim start increases
- [ ] Cannot drag past right handle (minimum gap enforced)
- [ ] Cannot drag before 0 seconds
- [ ] Trim start value updates in info panel
- [ ] Video playback starts from new trim start

#### 4.2 Right Trim Handle

- [ ] Hover over right handle → Cursor changes to resize
- [ ] Drag handle left → Trim end decreases
- [ ] Cannot drag before left handle (minimum gap enforced)
- [ ] Cannot drag past video duration
- [ ] Trim end value updates in info panel
- [ ] Video playback stops at new trim end

#### 4.3 Trim Edge Cases

- [ ] Trim to very short duration (< 1 second) → Works
- [ ] Trim entire video except 0.1s → Works
- [ ] Rapid trim handle dragging → Smooth, no glitches
- [ ] Drag handle outside timeline → Clamped to bounds

---

### 5. Scrubbing Tests

#### 5.1 Playhead Dragging

- [ ] Click and drag playhead → Video scrubs
- [ ] Preview updates in real-time during scrub
- [ ] Release playhead → Video stays at new position
- [ ] Drag outside timeline bounds → Playhead clamped to trim range
- [ ] Scrubbing pauses playback if playing

#### 5.2 Scrubbing Accuracy

- [ ] Playhead position matches preview frame
- [ ] No lag between playhead drag and preview update
- [ ] Scrubbing through full trim range works smoothly

---

### 6. Export Tests

#### 6.1 Basic Export

- [ ] Click "Export Video" button
- [ ] Save dialog opens with default filename
- [ ] Select location and save
- [ ] Export progress bar appears
- [ ] Progress updates from 0% to 100%
- [ ] Success alert appears on completion
- [ ] Exported file exists at chosen location
- [ ] Exported file is valid MP4

#### 6.2 Export Validation

- [ ] Play exported video in external player → Works
- [ ] Exported duration matches trim range
- [ ] Exported video starts at trim start
- [ ] Exported video ends at trim end
- [ ] Video quality acceptable (no major artifacts)
- [ ] Audio in sync with video (if audio present)

#### 6.3 Export Edge Cases

- [ ] Export very short trim (< 1 second) → Works
- [ ] Export full untrimmed video → Works
- [ ] Cancel save dialog → Export aborts gracefully
- [ ] Export with file name containing spaces → Works
- [ ] Export to path with special characters → Works
- [ ] Disk full error → Shows error message

#### 6.4 Export Progress

- [ ] Progress bar visible during export
- [ ] Progress percentage displayed
- [ ] Export button disabled during export
- [ ] Cannot start second export while one running
- [ ] UI responsive during export (doesn't freeze)

---

### 7. UI/UX Tests

#### 7.1 Layout

- [ ] Video preview takes up majority of space
- [ ] Timeline visible at bottom
- [ ] Info panel visible on right
- [ ] No overlapping elements
- [ ] All text readable (not cut off)
- [ ] Scrollbars appear when needed

#### 7.2 Responsive Behavior

- [ ] Window resize → Layout adjusts appropriately
- [ ] Minimum window size enforced
- [ ] Video scales with window size
- [ ] Timeline scrolls horizontally if needed

#### 7.3 Visual Feedback

- [ ] Buttons have hover states
- [ ] Disabled buttons look disabled (grayed out)
- [ ] Loading states shown where appropriate
- [ ] Cursor changes on draggable elements

---

### 8. Keyboard Shortcuts Tests

#### 8.1 File Menu

- [ ] `Cmd/Ctrl+O` → Opens import dialog
- [ ] `Cmd/Ctrl+E` → Opens export dialog (if video loaded)
- [ ] `Cmd/Ctrl+Q` → Quits app

#### 8.2 View Menu

- [ ] `Cmd/Ctrl+0` → Resets zoom
- [ ] `Cmd/Ctrl++` → Zooms in
- [ ] `Cmd/Ctrl+-` → Zooms out
- [ ] `Cmd/Ctrl+R` → Reloads (dev)
- [ ] `F12` or `Cmd/Ctrl+Shift+I` → Opens DevTools

#### 8.3 Playback Shortcuts (if implemented)

- [ ] `Space` → Play/Pause
- [ ] `Left Arrow` → Seek backward
- [ ] `Right Arrow` → Seek forward

---

### 9. Error Handling Tests

#### 9.1 Import Errors

- [ ] Import non-video file → User-friendly error
- [ ] Import corrupt video → Error message (not crash)
- [ ] File not found → Error message
- [ ] Permission denied → Error message

#### 9.2 Export Errors

- [ ] Export to read-only location → Error message
- [ ] Disk full during export → Error message
- [ ] Invalid output path → Error message
- [ ] FFmpeg error → User-friendly error (not technical jargon)

#### 9.3 Playback Errors

- [ ] Video codec not supported → Error message
- [ ] Source file deleted during playback → Error message

---

### 10. Performance Tests

#### 10.1 Video Sizes

- [ ] 480p video (< 50MB) → Loads quickly, smooth playback
- [ ] 1080p video (< 500MB) → Loads reasonably, smooth playback
- [ ] 4K video (> 1GB) → Loads (may be slow), playback acceptable

#### 10.2 Long Videos

- [ ] 30 second video → Instant load
- [ ] 5 minute video → Load within 5 seconds
- [ ] 30 minute video → Load within 10 seconds (may vary)

#### 10.3 Responsiveness

- [ ] Scrubbing is smooth (no jank)
- [ ] Trim handle dragging is smooth
- [ ] Timeline scrolling is smooth
- [ ] No UI freezing during operations

---

### 11. Stability Tests

#### 11.1 Repeated Operations

- [ ] Import → Export → Import again → Works
- [ ] Import 5 different videos in sequence → Works
- [ ] Play → Pause 50 times → No crash
- [ ] Trim handles adjusted 20+ times → No issues

#### 11.2 Memory Leaks

- [ ] Import large video, then import small video → Memory released
- [ ] Playback for 5+ minutes → No memory bloat
- [ ] Multiple import/export cycles → App doesn't slow down

#### 11.3 Edge Cases

- [ ] Minimize then restore window → Works fine
- [ ] Switch to another app and back → Works fine
- [ ] Leave app idle for 5 minutes → Still responsive
- [ ] Network disconnect (shouldn't matter for local app) → Works fine

---

### 12. Recording Tests (Phase 2)

#### 12.1 Webcam Recording

- [ ] Click "Test Webcam" button
- [ ] Webcam preview appears
- [ ] 3-2-1 countdown displays
- [ ] Recording starts after countdown
- [ ] Recording timer counts up accurately
- [ ] Click "Stop Recording" button
- [ ] Save dialog appears
- [ ] Recording saved to chosen location
- [ ] Recording added to timeline automatically
- [ ] Temp file indicator (⚠️) shows if not saved permanently
- [ ] Recording plays correctly in preview

#### 12.2 Screen Recording

- [ ] Click "Test Screen" button
- [ ] Screen source picker appears with thumbnails
- [ ] Select entire screen → "Ready to Record" dialog shows
- [ ] Click "Start Recording" → Countdown shows
- [ ] App minimizes after countdown (if not recording itself)
- [ ] macOS notification appears with "Stop Recording" button
- [ ] Press `Cmd+Shift+S` → Recording stops
- [ ] OR click notification button → Recording stops
- [ ] Save dialog appears
- [ ] Recording saved correctly
- [ ] Recording added to timeline with ⚠️ indicator
- [ ] Recording content is correct (captured screen)

#### 12.3 Screen Recording - Special Cases

- [ ] Select "ClipForge" or "Electron" window → App doesn't minimize
- [ ] Countdown still shows when recording self
- [ ] Recording captures the app correctly
- [ ] Press Esc during countdown → Recording cancels
- [ ] No permission granted → Clear error message with instructions

#### 12.4 Recording Quality

- [ ] Webcam recording is clear (not pixelated)
- [ ] Screen recording is sharp
- [ ] Recording duration matches timer display
- [ ] Audio (if enabled) syncs with video
- [ ] No dropped frames or stuttering

---

### 13. Multi-Clip Timeline Tests (Phase 2)

#### 13.1 Multiple Clips Display

- [ ] Import 2+ videos → All appear on timeline
- [ ] Clips snap together (no gaps)
- [ ] Clip positions calculated correctly (sequential)
- [ ] Timeline width auto-resizes for total duration
- [ ] Timeline compresses for long total duration (>30s)
- [ ] Each clip shows filename
- [ ] Temp files show ⚠️ indicator

#### 13.2 Clip Selection

- [ ] Click clip → Green border appears
- [ ] Click different clip → Selection changes
- [ ] Selected clip info shows in panel
- [ ] Trim handles only appear on selected clip
- [ ] Playhead can move across all clips

#### 13.3 Per-Clip Trimming

- [ ] Select clip, drag trim handle → Only that clip trims
- [ ] Other clips unaffected by trim
- [ ] Timeline positions update correctly after trim
- [ ] Total duration updates in timeline
- [ ] Playback respects per-clip trimming

#### 13.4 Clip Visual Indicators

- [ ] Temp files have orange border + ⚠️ icon
- [ ] Saved files have default blue border
- [ ] Selected clip has green border
- [ ] Hover shows clip details in tooltip

---

### 14. Multi-Clip Playback Tests (Phase 2)

#### 14.1 Sequential Playback

- [ ] Play with multiple clips → Plays first clip
- [ ] Reaches end of first clip → Auto-advances to second
- [ ] Playback continues seamlessly (no pause/gap)
- [ ] Playhead moves continuously across clips
- [ ] Reaches end of last clip → Stops

#### 14.2 Cross-Clip Seeking

- [ ] Drag playhead from clip 1 to clip 2 → Video changes
- [ ] Preview shows correct frame at playhead position
- [ ] Playback resumes from new position in new clip
- [ ] Seeking back and forth works smoothly

#### 14.3 Playback Edge Cases

- [ ] Play from middle of clip 1 → Continues to clip 2
- [ ] Play from last clip → Stops at end
- [ ] Pause in clip 1, resume → Continues correctly
- [ ] Seek while playing → Playback updates immediately

---

### 15. Split Functionality Tests (Phase 2)

#### 15.1 Basic Split

- [ ] Position playhead mid-clip, press `Cmd+K`
- [ ] Clip splits into two pieces
- [ ] Both pieces appear on timeline
- [ ] Original clip removed from timeline
- [ ] Split point is accurate (matches playhead)
- [ ] Both pieces reference same source file

#### 15.2 Split Validation

- [ ] Try split at 0.05s from start → Ignored (too close to edge)
- [ ] Try split at 0.05s from end → Ignored (too close to edge)
- [ ] Split at exact middle → Creates equal pieces
- [ ] Split multiple times → Each split works correctly

#### 15.3 Split and Trim

- [ ] Split clip, then trim first piece → Works
- [ ] Split clip, then trim second piece → Works
- [ ] Trim clip, then split → Works
- [ ] Trimmed portions preserved correctly

#### 15.4 Split and Playback

- [ ] Split clip → Playback works across split
- [ ] No audio/video glitch at split point
- [ ] Seeking across split point works

---

### 16. Multi-Clip Export Tests (Phase 2)

#### 16.1 Export Mode Detection

- [ ] Export single clip → Uses simple trim (fast)
- [ ] Export multiple untrimmed clips → Uses concat demuxer (-c copy)
- [ ] Export multiple trimmed clips → Uses complex filter (re-encode)
- [ ] Export decision logged correctly

#### 16.2 Multi-Clip Export Validation

- [ ] Export 2 clips → Both in output video
- [ ] Export 5+ clips → All concatenated correctly
- [ ] Clips in correct order in output
- [ ] No gaps between clips in output
- [ ] Total duration matches timeline total

#### 16.3 Export with Trimming

- [ ] Export trimmed clips → Trims applied correctly
- [ ] Each clip starts/ends at trimmed points
- [ ] No extra frames from untrimmed portions

#### 16.4 Export Edge Cases

- [ ] Export with mix of trimmed/untrimmed → Works
- [ ] Export with very short clips (< 1s) → Works
- [ ] Export 10+ clips → Completes successfully
- [ ] Export with mixed formats (MP4 + MOV sources) → Works

---

### 17. Temp File Management Tests (Phase 2)

#### 17.1 Temp File Creation

- [ ] Record webcam → Temp file created in /tmp
- [ ] Temp filename format: `clipforge-recording-YYYY-MM-DD-HH-MM-SS.webm`
- [ ] Temp file has valid content (not empty)

#### 17.2 Temp File Indicators

- [ ] Unsaved recording shows ⚠️ on timeline
- [ ] Unsaved recording has orange border
- [ ] Hover shows "Unsaved recording" tooltip
- [ ] After saving permanently → Indicator disappears

#### 17.3 Quit Warning

- [ ] Quit with unsaved recordings → Warning dialog shows
- [ ] Dialog shows correct message
- [ ] Click "Cancel" → App doesn't quit
- [ ] Click "Quit Anyway" → App quits, temp files deleted
- [ ] Quit with no temp files → No warning, quits immediately

#### 17.4 Temp File Cleanup

- [ ] Restart app → Old temp files deleted automatically
- [ ] Temp directory size checked on new recording
- [ ] Exceeding 5GB limit → Error shown, user warned

---

### 18. Drag-and-Drop Tests (Phase 2)

#### 18.1 Basic Drag-and-Drop

- [ ] Drag MP4 file onto welcome screen → Imports
- [ ] Drag MOV file onto app window → Imports
- [ ] Drag multiple files → First file imported (or error shown)
- [ ] Drag hint appears on welcome screen

#### 18.2 Drag-and-Drop Validation

- [ ] Drag non-video file → Error message
- [ ] Drag unsupported format → Error message
- [ ] Drag outside app window → No action
- [ ] Drop while video loaded → Adds to timeline (or replaces)

---

### 19. Keyboard Shortcuts Tests (Updated)

#### 19.1 File Menu

- [ ] `Cmd/Ctrl+O` → Opens import dialog
- [ ] `Cmd/Ctrl+E` → Opens export dialog (if clips loaded)
- [ ] `Cmd/Ctrl+Q` → Shows quit warning if temp files exist

#### 19.2 Editing Shortcuts (Phase 2)

- [ ] `Cmd+K` → Splits clip at playhead
- [ ] `Cmd+K` at clip boundary → No action (too close)
- [ ] `Cmd+K` with no clip → No action

#### 19.3 Recording Shortcuts (Phase 2)

- [ ] `Cmd+Shift+S` during screen recording → Stops recording
- [ ] `Esc` during recording countdown → Cancels recording
- [ ] Shortcuts work even when app minimized (screen recording)

---

### 20. Multi-Platform Tests (if applicable)

#### 12.1 macOS

- [ ] App launches on macOS 10.15+
- [ ] Menu bar displays correctly
- [ ] Keyboard shortcuts work (Cmd+O, etc.)
- [ ] File picker is native macOS dialog
- [ ] Export creates valid video

#### 12.2 Windows (future)

- [ ] App launches on Windows 10+
- [ ] Menu bar displays correctly
- [ ] Keyboard shortcuts work (Ctrl+O, etc.)
- [ ] File picker is native Windows dialog
- [ ] Export creates valid video

---

## 🎬 Phase 3 A-C: Multi-Track, Simultaneous Recording, PiP Export (30 minutes)

**Purpose:** Verify multi-track timeline, simultaneous recording, PiP preview, and multi-track export

### Test 1: Multi-Track Timeline UI

**Goal:** Verify Track 0 and Track 1 display and clip management

**Steps:**
1. Launch app and import a video
2. Verify clip appears on **Track 0 (Main)**
3. Right-click clip → Select "Move to Track 1"
4. Verify clip moves to **Track 1 (Picture-in-Picture)**
5. Import another video
6. Verify it appears on **Track 0**
7. Right-click Track 1 clip → "Move to Track 0"
8. Verify both clips now on Track 0

**Expected:**
- [ ] Track 0 and Track 1 labels visible
- [ ] Clips display in correct track rows
- [ ] Context menu shows track options
- [ ] Clips move smoothly between tracks
- [ ] Selection works on both tracks

---

### Test 2: Simultaneous Screen + Webcam Recording

**Goal:** Verify simultaneous recording creates clips on both tracks

**Steps:**
1. Menu Bar → Record → Screen + Webcam
2. Select a screen/window source (e.g., Chrome, Full Screen)
3. Verify webcam preview appears → Click "Start Recording"
4. Confirm minimize dialog (if recording full screen/other window)
5. App minimizes (or stays open if recording itself)
6. Record for **10-15 seconds**
7. Look for menu bar tray icon "🔴REC 0:XX" → Click "Stop Recording"
8. Or use **Cmd+Shift+S** shortcut to stop
9. Verify notification: "Recording saved"
10. App restores → Save dialog appears
11. Save recordings

**Expected:**
- [ ] Two clips added to timeline:
  - **Track 0:** Screen recording (no audio)
  - **Track 1:** Webcam recording (with microphone audio)
- [ ] Both clips have same duration (from timer)
- [ ] Clips start at position 0 on timeline
- [ ] Clips appear with ⚠️ emoji (temp files)
- [ ] Tray icon disappears after stop

---

### Test 3: PiP Configuration

**Goal:** Verify PiP settings panel and preview updates

**Pre-requisite:** Have clips on both Track 0 and Track 1

**Steps:**
1. Verify **PiP Settings** panel appears (below Info Panel)
2. Change **Position:**
   - Bottom-Right → Top-Right → Bottom-Left → Top-Left
3. Verify preview updates immediately for each change
4. Change **Size:**
   - Small → Medium → Large
5. Verify PiP overlay scales in preview

**Expected:**
- [ ] PiP Settings panel visible when Track 1 has clips
- [ ] Preview shows Track 1 video as overlay on Track 0
- [ ] Position changes move overlay to correct corner
- [ ] Size changes scale overlay (15%, 25%, 40%)
- [ ] Both videos stay in sync during playback

---

### Test 4: PiP Preview Playback

**Goal:** Verify dual video playback with PiP overlay

**Pre-requisite:** Clips on Track 0 and Track 1, same start position

**Steps:**
1. Set playhead to 0
2. Press **Play** (or Spacebar)
3. Observe main preview area
4. Observe PiP overlay
5. Scrub playhead to different positions
6. Resume playback

**Expected:**
- [ ] **Track 0 video** plays in main preview area
- [ ] **Track 1 video** plays as PiP overlay
- [ ] Both videos sync perfectly (same frame at same time)
- [ ] PiP position/size matches settings
- [ ] PiP overlay has border/shadow for visibility
- [ ] Only one audio track plays (from Track 1 webcam)
- [ ] Scrubbing updates both videos in sync

**Known Limitation:**
- PiP video may have slight sync drift after ~30+ seconds (browser `<video>` element limitation)
- This does NOT affect export quality (FFmpeg handles perfect sync)

---

### Test 5: Multi-Track Export with PiP Overlay

**Goal:** Verify FFmpeg correctly overlays Track 1 onto Track 0 with audio mixing

**Pre-requisite:** Clips on both tracks

**Steps:**
1. Set PiP Settings: Position = Bottom-Right, Size = Medium
2. Click **Export** button
3. If track durations differ by >0.5s:
   - ✅ Verify warning dialog appears
   - ✅ Shows Track 0 and Track 1 durations
   - Choose "Continue" or "Cancel"
4. Choose export location
5. Wait for export progress (may take 10-30 seconds)
6. Verify notification: "Export complete"
7. **Open exported video in QuickTime/VLC**

**Expected:**
- [ ] Track 0 video fills entire frame
- [ ] Track 1 video appears as PiP overlay at bottom-right
- [ ] PiP size is ~25% of frame (medium)
- [ ] PiP has 20px padding from edges
- [ ] Audio plays (microphone from Track 1 webcam)
- [ ] **No audio echo or duplication**
- [ ] Both videos perfectly in sync throughout
- [ ] Export duration matches longer track
- [ ] If Track 0 longer: PiP disappears when Track 1 ends
- [ ] If Track 1 longer: Main video freezes/black when Track 0 ends

---

### Test 6: Microphone Audio Capture (Standalone vs. Simultaneous)

**Goal:** Verify audio capture works correctly and no duplicate audio in simultaneous mode

**Test 6a: Standalone Screen Recording**

**Steps:**
1. Menu Bar → Record → Screen
2. Select source → Record 5 seconds → Stop → Save
3. Play clip in ClipForge
4. Export clip
5. Open exported video → **Verify audio plays** (microphone)

**Test 6b: Standalone Webcam Recording**

**Steps:**
1. Menu Bar → Record → Webcam
2. Record 5 seconds while talking → Stop → Save
3. Play clip in ClipForge
4. Export clip
5. Open exported video → **Verify audio plays** (microphone)

**Test 6c: Simultaneous Recording (Audio Check)**

**Steps:**
1. Menu Bar → Record → Screen + Webcam
2. Record 10 seconds **while talking continuously**
3. Stop → Save both recordings
4. **Play Track 0 clip** (screen) → ✅ **No audio** (muted)
5. **Play Track 1 clip** (webcam) → ✅ **Audio plays** (microphone)
6. Export multi-track video
7. Open exported video → **Verify audio plays once (no echo)**

**Expected:**
- [ ] Standalone screen: Audio captured
- [ ] Standalone webcam: Audio captured
- [ ] Simultaneous: Only Track 1 (webcam) has audio
- [ ] Simultaneous: Track 0 (screen) is silent
- [ ] Exported multi-track: Single audio track (no duplication/echo)

---

### Test 7: Drag-and-Drop Improved UX

**Goal:** Verify designated drop zone on welcome screen

**Steps:**
1. Launch app (fresh state, no clips)
2. Observe welcome screen
3. Verify **designated drop zone** appears:
   - 📁 Icon at top
   - "Drop video file here" text
   - "or click below to browse" hint
4. Drag video file from Finder **onto drop zone**
5. Verify drop zone highlights (blue border, slight scale up)
6. Drop file
7. Verify video imports

**Expected:**
- [ ] Drop zone visually distinct (dashed border, background)
- [ ] Hover effect (border color change)
- [ ] Drag-over effect (blue glow, scale up)
- [ ] Drop imports video correctly
- [ ] Drop zone also works on main screen (after importing first video)

---

### Test 8: Track Duration Mismatch Warning

**Goal:** Verify warning dialog when track durations differ

**Steps:**
1. Import a 10-second video → Place on Track 0
2. Record 5-second webcam → Place on Track 1
3. Click **Export**
4. Verify warning dialog appears:
   - ✅ Shows Track 0 duration (10.0s)
   - ✅ Shows Track 1 duration (5.0s)
   - ✅ Warning message about mismatch
   - ✅ "Continue" and "Cancel" buttons
5. Click "Cancel" → Export aborted
6. Click Export again → Click "Continue" → Export proceeds

**Expected:**
- [ ] Warning only appears if duration difference > 0.5 seconds
- [ ] User can choose to continue or cancel
- [ ] Export works correctly regardless of mismatch
- [ ] Longer track determines final video duration

---

### Test 9: DMG Distribution (macOS)

**Goal:** Verify DMG installer builds and installs correctly

**Steps:**
1. Build DMG: `npm run build:mac`
2. Verify build completes (~2-3 minutes)
3. Locate `dist/clipforge-1.0.0-arm64.dmg` (or `x64` variant)
4. Double-click DMG to mount
5. Verify installer window appears:
   - ✅ ClipForge app icon on left
   - ✅ Applications folder shortcut on right
   - ✅ Dark background (#1a1a1a)
   - ✅ Clear drag-to-install layout
6. Drag ClipForge.app to Applications
7. Eject DMG
8. Open **Finder → Applications**
9. Right-click ClipForge → Open (first launch, unsigned app)
10. Confirm "Open" in Gatekeeper dialog
11. App launches
12. **Run full smoke test** (import, record, multi-track, export)

**Expected:**
- [ ] DMG builds successfully
- [ ] File size: ~150-160 MB
- [ ] Installer window is professional and clear
- [ ] App installs to Applications folder
- [ ] Installed app launches and runs normally
- [ ] All features work in installed version
- [ ] App has camera/microphone permissions
- [ ] Screen recording permission prompt appears

**Alternative: ZIP Distribution**

**Steps:**
1. Build ZIP: `npm run build:mac:zip`
2. Locate `dist/clipforge-1.0.0-arm64-mac.zip`
3. Unzip (Finder does automatically)
4. Drag ClipForge.app to Applications
5. Right-click → Open (first launch)
6. Run smoke test

**Expected:**
- [ ] ZIP builds successfully
- [ ] File size: ~145-150 MB (slightly smaller than DMG)
- [ ] App works identically to DMG version

---

## 🐛 Bug Reporting Template

When you find a bug, report it with:

```
**Bug:** [Short description]

**Steps to Reproduce:**
1. [First step]
2. [Second step]
3. [...]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Environment:**
- OS: [macOS 13.5, Windows 11, etc.]
- App Version: [e.g., 1.0.0]
- Video File: [Format, resolution, duration]

**Screenshots/Logs:**
[Attach if applicable]
```

---

## ✅ Test Results Summary

| Category    | Pass | Fail | Notes |
| ----------- | ---- | ---- | ----- |
| Import      |      |      |       |
| Playback    |      |      |       |
| Timeline    |      |      |       |
| Trim        |      |      |       |
| Scrubbing   |      |      |       |
| Export      |      |      |       |
| UI/UX       |      |      |       |
| Shortcuts   |      |      |       |
| Errors      |      |      |       |
| Performance |      |      |       |
| Stability   |      |      |       |

---

**Tested By:** **\*\***\_\_\_\_**\*\***  
**Date:** **\*\***\_\_\_\_**\*\***  
**Version:** **\*\***\_\_\_\_**\*\***  
**Overall Result:** ☐ PASS | ☐ FAIL | ☐ PARTIAL
