# clipforge

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Known Behavior

### Video Preview Seeking

When playing across split clips, pausing/resuming, or seeking to a new position, you may notice the video preview briefly "rewinds" by a fraction of a second. This is **normal behavior** caused by how browsers seek to the nearest keyframe in video files.

**Important:** This visual artifact **only affects the preview** and **does not affect exported videos**. FFmpeg performs frame-accurate seeking during export, ensuring your final output is precisely trimmed and split as intended.

## Troubleshooting

### Zoom Reset

If you zoom in/out and can't get back to normal view (even after restarting the app), press:

- **macOS**: `Cmd+0`
- **Windows/Linux**: `Ctrl+0`

This resets the zoom level to 100%.
