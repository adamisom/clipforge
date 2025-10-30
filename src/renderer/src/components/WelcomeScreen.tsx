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
    <div className="welcome-screen">
      <h1>ClipForge</h1>
      <p>Import a video to get started</p>

      {/* Designated Drop Zone */}
      {enableDragAndDrop && (
        <div className={`drop-zone ${isDragging ? 'drag-over' : ''}`}>
          <div className="drop-zone-icon">📁</div>
          <p className="drop-zone-text">Drop video file here</p>
          <p className="drop-zone-hint">or click below to browse</p>
        </div>
      )}

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
