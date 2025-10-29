# ClipForge Phase 3 & 4 Overview

**Status:** Planning Complete, Ready for Implementation

---

## Phase 3: Multi-Track + Recording Enhancements (~35 hours)

### Key Features
1. Multi-track timeline (Track 0: main, Track 1: PiP overlay)
2. Simultaneous screen + webcam recording
3. PiP position/size presets (4 positions × 3 sizes)
4. Audio mixing controls (volume sliders per track)
5. Timeline zoom (mouse wheel, menu, keyboard, UI controls)

### Implementation Phases
- **Phase A:** Multi-Track Timeline Foundation (~8h)
- **Phase B:** Simultaneous Recording (~6h)
- **Phase C:** PiP Configuration (~4h)
- **Phase D:** Audio Mixing (~3h)
- **Phase E:** Timeline Zoom (~8h)
- **Phase F:** Integration & Testing (~6h)

**Recommended Schedule:** 5 days × 7 hours/day

---

## Phase 4: Polish + Production Ready (~25 hours)

### Key Features
1. Drag-to-rearrange clips (within/between tracks)
2. Delete clips (Delete key + confirmation)
3. Project save/load (.clipforge, auto-save, Cmd+S)
4. Error handling (toast + modal hybrid)
5. Loading states & progress indicators
6. Input validation (file format, codec checks)
7. Timeline performance optimizations
8. Export presets (YouTube, Instagram, TikTok, Twitter)
9. Keyboard shortcuts help panel (Cmd+/)
10. Security fix (custom protocol handler)
11. DMG distribution

### Implementation Phases
- **Phase A:** Drag-to-Rearrange (~5h)
- **Phase B:** Delete Clips (~2h)
- **Phase C:** Project Save/Load (~8h)
- **Phase D:** Error Handling & Loading (~4h)
- **Phase E:** Performance & Validation (~3h)
- **Phase F:** Export Presets (~2h)
- **Phase G:** Keyboard Shortcuts Help (~1h)
- **Phase H:** Security Fix (~2h)
- **Phase I:** DMG Distribution (~1h)
- **Phase J:** Final Testing (~2h)

**Recommended Schedule:** 3-4 days × 6-8 hours/day

---

## Combined Effort

**Total Estimated Time:** ~60 hours (7-9 full days)

**Suggested Approach:**
1. Complete Phase 3 (multi-track focus)
2. Test Phase 3 thoroughly
3. Complete Phase 4 (polish focus)
4. Final integration testing
5. Ship v1.0! 🚀

---

## Key Technical Decisions

### Multi-Track
- **Hybrid auto-assignment:** Webcam → Track 1, everything else → Track 0
- **Right-click context menu** for manual track reassignment
- **Track 0 plays in preview**, Track 1 only visible on export

### Recording
- **Separate recordings** (not real-time composite) for flexibility
- **Same event loop tick** for audio/video sync

### PiP
- **4 positions × 3 sizes** = 12 preset combinations
- **FFmpeg overlay filter** during export

### Audio
- **0-200% volume range** per track
- **FFmpeg amix filter** for mixing

### Timeline Zoom
- **10-200 px/sec range**
- **Zoom to playhead** (not viewport center)
- **Multiple input methods** (wheel, menu, keyboard, UI)

### Project Save
- **JSON format** (.clipforge extension)
- **Auto-save every 30 seconds** (if manually saved once)
- **Save-on-quit warning** (similar to temp file warning)

### Error Handling
- **Toast for info/success** (react-hot-toast)
- **Modal for critical errors** (blocking)

### Performance
- **React.memo + useMemo** for expensive calculations
- **Throttled playhead updates** (33ms = ~30fps)
- **CSS containment** (already applied in Phase 2)

### Security
- **Custom protocol** (`clipforge:///`) for video files
- **Remove `webSecurity: false`** (critical before production)

---

## Testing Strategy

### Phase 3 Manual Tests
- Multi-track assignment
- Simultaneous recording
- PiP configuration
- Audio mixing
- Timeline zoom
- Integration (all features together)

### Phase 4 Manual Tests
- Drag & reorder
- Delete clips
- Project save/load workflow
- Error handling scenarios
- Loading states
- Performance with 30+ clips
- Export presets
- Shortcuts help
- Security (custom protocol)
- DMG installation

---

## Success Criteria

### Phase 3 Complete When:
✅ Multi-track timeline displays 2 tracks  
✅ Simultaneous recording works  
✅ PiP config works (position/size)  
✅ Audio mixing works  
✅ Timeline zoom works (all methods)  
✅ No regressions in Phase 2  

### Phase 4 Complete When:
✅ Drag-to-rearrange works  
✅ Delete with confirmation works  
✅ Project save/load works  
✅ Auto-save works  
✅ Error handling comprehensive  
✅ Loading states for all async ops  
✅ Performance optimized  
✅ Export presets work  
✅ Shortcuts help accessible  
✅ Custom protocol enabled  
✅ DMG builds  
✅ Production-ready  

---

## Files Created

### Documentation
- `PHASE_3_IMPLEMENTATION_PLAN.md` (detailed task breakdown)
- `PHASE_4_IMPLEMENTATION_PLAN.md` (detailed task breakdown)
- `PHASE_3_AND_4_OVERVIEW.md` (this file)

### To Be Created During Implementation

**Phase 3:**
- `src/renderer/src/components/SimultaneousRecorder.tsx`
- `src/main/utils/exportPresets.ts` (if not in Phase 4)

**Phase 4:**
- `src/renderer/src/types/project.ts`
- `src/renderer/src/components/ErrorModal.tsx`
- `src/renderer/src/components/KeyboardShortcutsHelp.tsx`
- `src/main/utils/exportPresets.ts` (if not in Phase 3)

---

## Next Steps

1. **Review plans** with team/stakeholders
2. **Identify any missing requirements**
3. **Adjust time estimates** based on team velocity
4. **Begin Phase 3 implementation**
5. **Test thoroughly** before moving to Phase 4
6. **Ship v1.0** after Phase 4 complete 🎉

---

**Last Updated:** October 29, 2025  
**Plans Ready:** Phase 3 & 4  
**Estimated Completion:** 7-9 full days from start

