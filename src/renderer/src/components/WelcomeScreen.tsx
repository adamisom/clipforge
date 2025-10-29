interface WelcomeScreenProps {
  onImport: () => void
  onRecordWebcam: () => void
  onRecordScreen: () => void
  isDragging: boolean
  enableDragAndDrop?: boolean
}

function WelcomeScreen({
  onImport,
  onRecordWebcam,
  onRecordScreen,
  isDragging,
  enableDragAndDrop = true
}: WelcomeScreenProps): React.JSX.Element {
  return (
    <div className={`welcome-screen ${isDragging ? 'drag-over' : ''}`}>
      <h1>ClipForge</h1>
      <p>Import a video to get started</p>
      {enableDragAndDrop && <p className="drag-hint">or drag and drop a video file here</p>}
      <button onClick={onImport} className="import-button">
        Import Video
      </button>

      <div className="welcome-divider">
        <span>or</span>
      </div>

      <p className="welcome-hint">Record a new video (see Menu bar for shortcuts)</p>
      <div className="welcome-record-buttons">
        <button
          onClick={onRecordScreen}
          className="welcome-record-button"
          title="Record Screen (Cmd+Shift+R)"
        >
          🖥️
        </button>
        <button
          onClick={onRecordWebcam}
          className="welcome-record-button"
          title="Record Webcam (Cmd+Shift+W)"
        >
          📹
        </button>
      </div>
    </div>
  )
}

export default WelcomeScreen
