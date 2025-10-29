import { useState, useEffect } from 'react'

interface ScreenSource {
  id: string
  name: string
  thumbnail: string
}

interface ScreenSourcePickerProps {
  onSelect: (sourceId: string) => void
  onCancel: () => void
}

function ScreenSourcePicker({ onSelect, onCancel }: ScreenSourcePickerProps) {
  const [sources, setSources] = useState<ScreenSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSources = async (): Promise<void> => {
      try {
        const availableSources = await window.api.getScreenSources()
        setSources(availableSources)
        setLoading(false)
      } catch (err) {
        console.error('Failed to get screen sources:', err)
        setError('Failed to load screen sources')
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
        <div className="screen-source-picker-modal">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={onCancel}>Close</button>
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
            <div
              key={source.id}
              className="source-item"
              onClick={() => onSelect(source.id)}
            >
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

