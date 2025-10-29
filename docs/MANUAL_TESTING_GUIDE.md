# ClipForge Manual Testing Guide

## ⚡ TLDR Smoke Test (2 minutes)

**Quick sanity check:** Import video → plays → trim handles work → scrub playhead → export → video trims correctly. If all work, you're good. If any fail, dig deeper below.

---

## 🚀 Quick Smoke Test (5 minutes)

**Purpose:** Verify core functionality is working

### Prerequisites

- Sample video file (MP4 or MOV)
- Built/running ClipForge app

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

3. **Playback**
   - Click "Play" button
   - ✅ Video plays
   - ✅ Playhead (red line) moves along timeline
   - ✅ Playback stops at trim end
   - Click "Pause"
   - ✅ Video pauses

4. **Trim**
   - Drag left trim handle (blue) to 2 seconds
   - ✅ Clip shortens from left
   - ✅ Trim info updates in panel
   - Drag right trim handle to -2 seconds from end
   - ✅ Clip shortens from right
   - ✅ Play button starts from new trim start

5. **Scrubbing**
   - Drag playhead (red line) left/right
   - ✅ Video scrubs to new position
   - ✅ Preview updates to show frame at playhead

6. **Export**
   - Click "Export Video" button
   - ✅ Save dialog opens
   - Choose location, click Save
   - ✅ Progress bar appears and fills
   - ✅ "Export completed successfully!" alert appears
   - Open exported video in player
   - ✅ Video plays correctly
   - ✅ Trim applied (duration matches trimmed range)

7. **Keyboard Shortcuts**
   - Press `Cmd+O` (macOS) or `Ctrl+O` (Windows)
   - ✅ Import dialog opens
   - Press `Cmd+E` (macOS) or `Ctrl+E` (Windows)
   - ✅ Export dialog opens (if video loaded)

**Result:** If all ✅ pass, core functionality is working!

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

### 12. Multi-Platform Tests (if applicable)

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
