# Known Issues

## White Screen Crash on Screen Recorder (UNRESOLVED)

### Symptoms
- Clicking "Record Screen" button causes the entire Electron app to crash with a white screen
- Dev Tools disconnects immediately when the crash occurs
- The renderer process is terminated by Electron

### Error Messages
In the dev server terminal logs:
```
[main] Getting screen sources...
[main] Found 3 sources
[17729:1029/231536.677482:ERROR:content/browser/bad_message.cc(29)] Terminating renderer for bad IPC message, reason 263
```

In the renderer console (before crash):
- No errors appear before the crash
- Dev Tools shows "DevTools was disconnected from the page"

### Root Cause
The error code `reason 263` corresponds to `BAD_MESSAGE_RFH_CAN_ACCESS_FILES_OF_PAGE_STATE` in Chromium's source code. This indicates that the renderer process is attempting to access file-related data in a way that violates Electron's security policies.

The issue occurs during the IPC call to `get-screen-sources`, which uses Electron's `desktopCapturer.getSources()` API in the main process. The crash happens when returning thumbnail data (as data URLs) from the main process to the renderer process.

### Attempted Fixes (Did Not Work)
1. **Reduced thumbnail size**: Changed from 300x200 to 150x100 pixels - did not resolve the crash
2. **Changed image format**: Switched from PNG (`toDataURL()`) to JPEG at 60% quality - did not resolve the crash
3. **Added error handling**: Wrapped IPC handler in try-catch with logging - crash still occurs before catch block

### Technical Details
- **IPC Handler**: `src/main/index.ts` line ~672
- **Component**: `ScreenSourcePicker.tsx` calls `window.api.getScreenSources()`
- **Preload**: `src/preload/index.ts` exposes `getScreenSources` via `ipcRenderer.invoke()`
- **Security Context**: 
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: false` (required for screen recording)
  - `webSecurity: false` (for dev mode file:// URLs)

### Why This Is Hard to Debug
1. **Renderer process terminates immediately**: No stack traces or detailed error messages
2. **Dev Tools disconnects**: Cannot inspect state at time of crash
3. **Error code is cryptic**: Chromium's "bad IPC message" errors provide minimal context
4. **Works on some Electron versions**: This issue may be version-specific or platform-specific

### Potential Solutions (Untested)
1. **Avoid sending thumbnails via IPC**: 
   - Return only source IDs and names
   - Have renderer request thumbnails separately via a different IPC channel
   - Or skip thumbnails entirely (text-only picker)

2. **Use file protocol instead of data URLs**:
   - Save thumbnails to temp files
   - Return file:// URLs instead of data URLs
   - Requires additional cleanup logic

3. **Investigate Electron version compatibility**:
   - Test with different Electron versions
   - Check if this is a known issue in Electron's GitHub

4. **Use native image handling**:
   - Investigate if Electron's `nativeImage` has different serialization options
   - Try `toBitmap()` or `toPNG()` with different settings

### Workaround
For now, screen recording functionality requires reverting to an earlier branch where this issue did not occur. The earlier implementation may have used:
- Different thumbnail handling
- Different IPC serialization
- Different Electron configuration

### Related Files
- `src/main/index.ts` (IPC handler)
- `src/preload/index.ts` (IPC exposure)
- `src/renderer/src/components/ScreenRecorder.tsx`
- `src/renderer/src/components/ScreenSourcePicker.tsx`

### Date Identified
October 29, 2024

### Status
**UNRESOLVED** - Requires deeper investigation into Electron's IPC security model and desktopCapturer API limitations.

