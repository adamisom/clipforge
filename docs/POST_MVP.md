# Post-MVP Improvements

This document tracks future enhancements and test additions to consider after MVP validation.

---

## 🚨 Critical Tech Debt

### Security: File URL Handling (MUST FIX BEFORE PRODUCTION)

**Current Implementation:**

```typescript
// src/main/index.ts
webPreferences: {
  webSecurity: false,              // ⚠️ DISABLES same-origin policy, CORS
  allowRunningInsecureContent: true // ⚠️ Allows mixed HTTP/file:// content
}

// src/renderer/.../VideoPreview.tsx
<video src={`file://${sourcePath}`} />  // ⚠️ Direct file:// URLs
```

**Security Risks:**

- `webSecurity: false` disables browser security protections
- Vulnerable to XSS if any user content is rendered
- `file://` URLs blocked by CORS in dev mode (http://localhost:5174)
- Not acceptable for production distribution

**Proper Solution:**
Implement custom protocol handler for safe local file access:

```typescript
// In main process (src/main/index.ts):
import { protocol } from 'electron'

app.whenReady().then(() => {
  protocol.registerFileProtocol('clipforge', (request, callback) => {
    const url = request.url.replace('clipforge://', '')
    const decodedPath = decodeURIComponent(url)
    callback({ path: decodedPath })
  })

  // Remove these from webPreferences:
  // webSecurity: false ❌
  // allowRunningInsecureContent: true ❌
})

// In renderer (VideoPreview.tsx):
<video src={`clipforge:///${sourcePath}`} />
```

**Benefits:**

- ✅ Maintains browser security protections
- ✅ Works in both dev and production
- ✅ Scoped to only serve video files
- ✅ Can add additional validation/sandboxing

**Estimated Effort:** 1-2 hours  
**Priority:** 🔴 CRITICAL before public distribution

---

### DMG Distribution Format (macOS)

**Current Implementation:**
- Only ZIP distribution enabled (DMG disabled due to hdiutil errors)
- Works fine for testing and internal use
- Less polished than DMG for end users

**Issue:**
```bash
⨯ unable to execute hdiutil  args=["create","-srcfolder",...] 
error=Exit code: 1. Command failed: hdiutil create...
```

**Why DMG is Better:**
- ✅ Professional installer experience
- ✅ Drag-to-Applications visual
- ✅ Standard macOS distribution format
- ✅ Better first impression

**Possible Solutions:**

1. **Run hdiutil with elevated permissions** (not recommended)
   - Security risk, file ownership issues

2. **Check macOS security settings**
   ```bash
   # Check if Full Disk Access needed for build tools
   # System Settings → Privacy & Security → Full Disk Access
   ```

3. **Use different DMG tool**
   ```yaml
   # electron-builder.yml
   dmg:
     format: UDZO  # Try different format
     # Or use appdmg instead of hdiutil
   ```

4. **Build on different macOS version**
   - Issue might be specific to macOS 14.x
   - Try on macOS 13.x or 15.x

**Estimated Effort:** 1-2 hours debugging  
**Priority:** 🟡 MEDIUM (ZIP works for MVP, DMG for polish)

---

## 🧪 Medium Priority Tests (Deferred)

### 4. State Update Logic Tests

**Why Important:** Complex state interactions could cause race conditions or stale state bugs.

**Test Cases to Add:**

- When trim changes, verify playhead resets correctly if outside new range
- When playhead moves during playback, verify it stays within bounds
- When trim end moves before playhead, verify playhead clamps to new max
- Rapid state updates don't cause inconsistent state

**Implementation Approach:**

```typescript
// Use React Testing Library with renderHook
describe('VideoEditor state management', () => {
  it('resets playhead when trim range shrinks', () => {
    // Test that playhead=50, then trimEnd moves to 40, playhead clamps to 40
  })

  it('handles rapid trim adjustments without race conditions', () => {
    // Simulate user rapidly dragging trim handles
  })
})
```

**Estimated Effort:** 1-2 hours

---

### 5. Export Path Handling Tests

**Why Important:** File system errors are common pain points (spaces, special chars, permissions).

**Test Cases to Add:**

- Filename sanitization removes invalid characters (`< > : " / \ | ? *`)
- Default export name generation (e.g., `video.mp4` → `video_trimmed.mp4`)
- Path with spaces handled correctly
- Very long filename truncation (if needed)
- Duplicate filename handling (if auto-increment implemented)

**Implementation Approach:**

```typescript
// Pure functions in src/main/utils/exportUtils.ts
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*]/g, '_')
}

export function generateDefaultExportName(originalFilename: string): string {
  const ext = path.extname(originalFilename)
  const base = path.basename(originalFilename, ext)
  return `${base}_trimmed${ext}`
}
```

**Test Examples:**

```typescript
describe('sanitizeFilename', () => {
  it('removes invalid characters', () => {
    expect(sanitizeFilename('my<video>.mp4')).toBe('my_video_.mp4')
  })

  it('preserves valid characters', () => {
    expect(sanitizeFilename('my-video_123.mp4')).toBe('my-video_123.mp4')
  })
})
```

**Estimated Effort:** 1 hour

---

## 🎯 Lower Priority Tests (Nice to Have)

### Component Rendering Tests

- Timeline clip width calculation
- Video preview aspect ratio handling
- Timeline scrolling behavior

### Integration Tests

- IPC communication (requires mocking Electron)
- FFmpeg integration (requires test videos)
- Full import → trim → export workflow

### Performance Tests

- Timeline rendering with 100+ markers
- Scrubbing performance (no dropped frames)
- Memory usage during long playback

---

## 🚀 Future Feature Ideas

### Polish & UX

- Keyboard shortcuts (Space = play/pause, arrows = seek)
- Timeline zoom (Cmd+/Cmd- to adjust pixels per second)
- Playback speed control (0.5x, 1x, 2x)
- Frame-by-frame stepping (left/right arrow when paused)
- Snap to second boundaries when trimming

### Advanced Features

- Multiple clips on timeline
- Audio waveform visualization
- Split clip at playhead
- Undo/redo support
- Project save/load
- Export presets (YouTube, Instagram, etc.)

### Technical Improvements

- Migrate from `webSecurity: false` to custom protocol handler
- Add E2E tests with Playwright
- Implement virtualized timeline for very long videos
- Add thumbnail previews on timeline
- Background export (non-blocking)

---

## 📊 Test Coverage Goals

**Current Coverage (estimated):**

- Utils: ~90% (high-value functions tested)
- Components: ~0% (manual testing only)
- Integration: ~0% (manual testing only)

**Target Coverage:**

- Utils: 95%+ (add state logic tests)
- Components: 70%+ (test complex interactions)
- Integration: 50%+ (key workflows)

---

## 🐛 Known Issues / Tech Debt

_(To be populated after manual testing)_

- [ ] TBD based on user feedback
- [ ] TBD based on bug reports

---

**Last Updated:** October 28, 2025  
**Status:** MVP complete, awaiting manual testing
