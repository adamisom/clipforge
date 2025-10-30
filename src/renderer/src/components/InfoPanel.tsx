import { TimelineClip, PiPConfig } from '../types/timeline'
import { useEffect, useState } from 'react'
import { formatDuration } from '../utils/timeUtils'

interface InfoPanelProps {
  currentClip: TimelineClip | undefined
  totalClips: number
  pipConfig: PiPConfig
  onPipConfigChange: (config: PiPConfig) => void
  onExport: () => Promise<void>
  onDeleteClip: () => void
  onSavePermanently: () => Promise<void>
}

function InfoPanel({
  currentClip,
  totalClips,
  pipConfig,
  onPipConfigChange,
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
              <strong>Duration:</strong> {formatDuration(currentClip.sourceDuration)}
            </div>
            <div className="info-item">
              <strong>Trim:</strong> {formatDuration(currentClip.sourceStartTime)} -{' '}
              {formatDuration(currentClip.sourceStartTime + currentClip.timelineDuration)}
            </div>
            <div className="info-item">
              <strong>Track:</strong> {currentClip.trackIndex === 0 ? 'Main' : 'PiP'}
            </div>
          </>
        )}

        <hr style={{ margin: '16px 0', border: '1px solid #444' }} />

        <h3>PiP Settings</h3>
        <div className="info-item">
          <label>
            <strong>Position:</strong>
          </label>
          <select
            value={pipConfig.position}
            onChange={(e) =>
              onPipConfigChange({ ...pipConfig, position: e.target.value as PiPConfig['position'] })
            }
            style={{ marginLeft: '8px', padding: '4px' }}
          >
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-right">Top Right</option>
            <option value="top-left">Top Left</option>
          </select>
        </div>
        <div className="info-item">
          <label>
            <strong>Size:</strong>
          </label>
          <select
            value={pipConfig.size}
            onChange={(e) =>
              onPipConfigChange({ ...pipConfig, size: e.target.value as PiPConfig['size'] })
            }
            style={{ marginLeft: '8px', padding: '4px' }}
          >
            <option value="small">Small (15%)</option>
            <option value="medium">Medium (25%)</option>
            <option value="large">Large (40%)</option>
          </select>
        </div>
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
