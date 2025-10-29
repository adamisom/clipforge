# Post-MVP Improvements

This document tracks future enhancements and test additions to consider after MVP validation.

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
