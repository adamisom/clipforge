import { useState, useEffect } from 'react'

interface ExportButtonProps {
  sourcePath: string | null
  trimStart: number
  trimEnd: number
  onExport: () => void
}

function ExportButton({
  sourcePath,
  trimStart,
  trimEnd,
  onExport
}: ExportButtonProps): React.JSX.Element {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError, setExportError] = useState<string | null>(null)

  const isDisabled = !sourcePath || isExporting

  // Listen for export events
  useEffect(() => {
    const handleProgress = (_event: unknown, progress: { percent: number }): void => {
      setExportProgress(Math.round(progress.percent || 0))
    }

    const handleComplete = (): void => {
      setIsExporting(false)
      setExportProgress(100)
      setTimeout(() => {
        setExportProgress(0)
        alert('Export completed successfully!')
      }, 500)
    }

    const handleError = (_event: unknown, error: { message: string }): void => {
      setIsExporting(false)
      setExportError(error.message)
      alert(`Export failed: ${error.message}`)
    }

    window.api.onExportProgress(handleProgress)
    window.api.onExportComplete(handleComplete)
    window.api.onExportError(handleError)

    return () => {
      window.api.removeAllListeners('export-progress')
      window.api.removeAllListeners('export-complete')
      window.api.removeAllListeners('export-error')
    }
  }, [])

  const handleClick = (): void => {
    if (isDisabled) return
    setIsExporting(true)
    setExportError(null)
    setExportProgress(0)
    onExport()
  }

  return (
    <div className="export-container">
      <button onClick={handleClick} disabled={isDisabled} className="export-button">
        {isExporting ? `Exporting... ${exportProgress}%` : 'Export Video'}
      </button>
      {isExporting && (
        <div className="export-progress-bar">
          <div className="export-progress-fill" style={{ width: `${exportProgress}%` }} />
        </div>
      )}
      {exportError && <div className="export-error">Error: {exportError}</div>}
      <div className="export-info">
        <small>
          Trim: {trimStart.toFixed(1)}s - {trimEnd.toFixed(1)}s ({(trimEnd - trimStart).toFixed(1)}s
          total)
        </small>
      </div>
    </div>
  )
}

export default ExportButton
