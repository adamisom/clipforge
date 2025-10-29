import { TimelineClip } from '../types/timeline'

interface InfoPanelProps {
  currentClip: TimelineClip | undefined
  totalClips: number
  onExport: () => Promise<void>
}

function InfoPanel({ currentClip, totalClips, onExport }: InfoPanelProps): React.JSX.Element {
  return (
    <div className="info-panel">
      <div className="info-content">
        <h3>Video Info</h3>
        <div className="info-item">
          <strong>Clips:</strong> {totalClips}
        </div>
        {currentClip && (
          <>
            <div className="info-item">
              <strong>File:</strong> {currentClip.metadata.filename}
            </div>
            <div className="info-item">
              <strong>Resolution:</strong> {currentClip.metadata.resolution}
            </div>
            <div className="info-item">
              <strong>Duration:</strong> {Math.floor(currentClip.sourceDuration)}s
            </div>
            <div className="info-item">
              <strong>Trim:</strong> {Math.floor(currentClip.sourceStartTime)}s -{' '}
              {Math.floor(currentClip.sourceStartTime + currentClip.timelineDuration)}s
            </div>
          </>
        )}
      </div>

      <button
        onClick={onExport}
        disabled={totalClips === 0}
        className="export-button"
        style={{
          marginTop: '20px',
          padding: '12px 24px',
          background: totalClips === 0 ? '#666' : '#646cff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: totalClips === 0 ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        Export Video
      </button>
    </div>
  )
}

export default InfoPanel
