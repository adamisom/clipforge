import { TimelineClip, PiPConfig } from '../types/timeline'
import { useEffect, useState } from 'react'
import { formatDuration } from '../utils/timeUtils'

interface InfoPanelProps {
  currentClip: TimelineClip | undefined
  totalClips: number
  pipConfig: PiPConfig
  onPipConfigChange: (config: PiPConfig) => void
  onExport: () => Promise<void>
  onSavePermanently: () => Promise<void>
}

function InfoPanel({
  currentClip,
  totalClips,
  pipConfig,
  onPipConfigChange,
  onExport,
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
        {/* Video Info Section - Compressed */}
        <h3 style={{ marginBottom: '8px' }}>Video Info</h3>
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

        {/* Save Permanently button (if temp file) */}
        {isTemp && currentClip && (
          <button
            onClick={onSavePermanently}
            className="save-permanent-button"
            style={{
              padding: '8px 16px',
              background: '#ffa500',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              marginTop: '12px',
              width: '100%',
              fontWeight: 'bold'
            }}
            title="Save this temporary recording permanently"
          >
            💾 Save Permanently
          </button>
        )}

        {/* Export Button with horizontal lines */}
        <hr style={{ margin: '16px 0', border: '1px solid #444' }} />

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
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          Export Video
        </button>

        <hr style={{ margin: '16px 0', border: '1px solid #444' }} />

        {/* PiP Settings Section */}
        <h3 style={{ marginBottom: '8px' }}>PiP Settings</h3>
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
    </div>
  )
}

export default InfoPanel
