import { TimelineClip } from '../types/timeline'
import { useEffect, useState } from 'react'

interface InfoPanelProps {
  currentClip: TimelineClip | undefined
  totalClips: number
  onExport: () => Promise<void>
  onDeleteClip: () => void
  onSavePermanently: () => Promise<void>
}

function InfoPanel({
  currentClip,
  totalClips,
  onExport,
  onDeleteClip,
  onSavePermanently
}: InfoPanelProps): React.JSX.Element {
  const [isTemp, setIsTemp] = useState(false)

  useEffect(() => {
    const checkIfTemp = async (): Promise<void> => {
      if (currentClip) {
        const temp = await window.api.isTempFile(currentClip.sourcePath)
        setIsTemp(temp)
      } else {
        setIsTemp(false)
      }
    }
    checkIfTemp()
  }, [currentClip])
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

      <div className="button-group">
        {isTemp && currentClip && (
          <button
            onClick={onSavePermanently}
            className="save-permanent-button"
            style={{
              padding: '10px 20px',
              background: '#ffa500',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              marginBottom: '12px',
              fontWeight: 'bold'
            }}
            title="Save this temporary recording permanently"
          >
            💾 Save Permanently
          </button>
        )}

        <button
          onClick={onDeleteClip}
          disabled={!currentClip}
          className="delete-button"
          style={{
            padding: '10px 20px',
            background: !currentClip ? '#666' : '#ff4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: !currentClip ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            marginBottom: '12px'
          }}
          title="Delete selected clip (Delete key)"
        >
          Delete Clip
        </button>

        <button
          onClick={onExport}
          disabled={totalClips === 0}
          className="export-button"
          style={{
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
    </div>
  )
}

export default InfoPanel
