import { useState, useEffect } from 'react'

interface ScreenSource {
  id: string
  name: string
  thumbnail: string
}

interface ScreenSourcePickerProps {
  onSelect: () => void
  onCancel: () => void
}

function ScreenSourcePicker({ onSelect, onCancel }: ScreenSourcePickerProps): React.JSX.Element {
  const [sources, setSources] = useState<ScreenSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSources = async (): Promise<void> => {
      try {
        const availableSources = await window.api.getScreenSources()

        // Check if we got any sources - if not, likely permission denied
        if (!availableSources || availableSources.length === 0) {
          setError(
            'Please grant Screen Recording permission in System Settings > Privacy & Security.'
          )
          setLoading(false)
          return
        }

        setSources(availableSources)
        setLoading(false)
      } catch (err) {
        console.error('Failed to get screen sources:', err)
        setError(
          'Please grant Screen Recording permission in System Settings > Privacy & Security > Screen Recording.'
        )
        setLoading(false)
      }
    }

    fetchSources()
  }, [])

  if (loading) {
    return (
      <div className="screen-source-picker-overlay">
        <div className="screen-source-picker-modal">
          <h2>Loading sources...</h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="screen-source-picker-overlay">
        <div className="screen-source-picker-modal permission-error">
          <div className="permission-icon">🔒</div>
          <h2>Screen Recording Permission Required</h2>
          <p className="error-text">{error}</p>
          <div className="permission-steps">
            <h3>How to grant permission:</h3>
            <ol>
              <li>
                Open <strong>System Settings</strong>
              </li>
              <li>
                Go to <strong>Privacy & Security</strong>
              </li>
              <li>
                Click <strong>Screen Recording</strong>
              </li>
              <li>
                Enable <strong>ClipForge</strong> (or your app name)
              </li>
              <li>Restart ClipForge</li>
            </ol>
          </div>
          <button onClick={onCancel} className="primary-button">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-source-picker-overlay">
      <div className="screen-source-picker-modal">
        <h2>Select Screen or Window</h2>

        <div className="source-grid">
          {sources.map((source) => (
            <div key={source.id} className="source-item" onClick={() => onSelect()}>
              <img src={source.thumbnail} alt={source.name} className="source-thumbnail" />
              <p className="source-name">{source.name}</p>
            </div>
          ))}
        </div>

        <button onClick={onCancel} className="cancel-button">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default ScreenSourcePicker
