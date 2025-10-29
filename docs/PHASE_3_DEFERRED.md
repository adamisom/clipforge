# ClipForge Phase 3: Deferred Features

Features deferred from Phase 2 implementation for future development.

---

## Drag-to-Rearrange Clips

**Description:** Allow users to drag clips within the timeline to reorder them.

**Effort Estimate:** 6-8 hours additional work

**Requirements:**

- Make each timeline clip draggable
- Show drop indicators between all clips during drag
- Handle drag preview/ghost element
- Calculate drop position from mouse coordinates
- Animate reordering transitions
- Prevent drag conflicts with trim handles and playhead
- Update clips array order on drop

**Rationale for Deferral:**

- Phase 2 already includes substantial work (recording, multi-clip, split)
- Users can delete and re-import to change order (workaround exists)
- Better to test simpler append/prepend workflow first
- Rearranging is less common than sequential appending
- Solidify core multi-clip functionality before advanced features

---

## System Audio Capture

**Description:** Capture system audio during screen recording (macOS 13+).

**Requirements:**

- Research macOS audio capture permissions and APIs
- Implement audio routing through virtual audio devices or screen capture with audio
- Handle permission requests and error states
- Ensure audio sync with video
- Add UI controls for audio source selection

**Rationale for Deferral:**

- Requires additional research for macOS permissions and APIs
- Not critical for MVP recording functionality
- Can be added incrementally without breaking existing recording
- May have compatibility/permission complexities on different macOS versions

---

## Clips Library/Bin

**Description:** A separate panel showing all imported/recorded clips for easy access and management.

**Features:**

- Grid or list view of all clips
- Drag from library to timeline
- Preview clips before adding
- Delete/organize clips
- Search/filter functionality

**Rationale for Deferral:**

- Not essential for basic multi-clip workflow
- Current workflow (import → auto-add to timeline) is sufficient for Phase 2
- Would require significant UI/UX design work
- Better suited for Phase 3 after core timeline functionality is proven

---

## Future Considerations

Other potential Phase 3+ features to consider:

- Transitions between clips
- Audio track management (multiple audio sources)
- Clip effects and filters
- Markers and annotations on timeline
- Keyboard shortcuts for timeline navigation
- Undo/redo functionality
- Project save/load functionality
