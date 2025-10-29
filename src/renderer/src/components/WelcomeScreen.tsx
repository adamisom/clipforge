interface WelcomeScreenProps {
  onImport: () => void
  isDragging: boolean
  enableDragAndDrop?: boolean
}

function WelcomeScreen({
  onImport,
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
    </div>
  )
}

export default WelcomeScreen
