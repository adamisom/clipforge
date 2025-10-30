import { useCallback } from 'react'
import { TimelineClip } from '../types/timeline'
import { createClipFromMetadata } from '../utils/clipUtils'

interface UseClipImportReturn {
  handleImport: () => Promise<void>
  handleDrop: (files: FileList) => Promise<void>
}

export const useClipImport = (onClipAdded: (clip: TimelineClip) => void): UseClipImportReturn => {
  const handleImport = useCallback(async (): Promise<void> => {
    try {
      const filePath = await window.api.selectVideoFile()
      if (!filePath) return

      // Get metadata
      const metadata = await window.api.getVideoMetadata(filePath)

      const newClip = createClipFromMetadata('imported', filePath, metadata)

      onClipAdded(newClip)
    } catch (error) {
      console.error('Import failed:', error)
      alert(`Failed to import video: ${error}`)
    }
  }, [onClipAdded])

  const handleDrop = useCallback(
    async (files: FileList): Promise<void> => {
      const videoFiles = Array.from(files).filter((file) => {
        const ext = file.name.toLowerCase().split('.').pop()
        return ['mp4', 'mov'].includes(ext || '')
      })

      if (videoFiles.length === 0) {
        alert('Please drop a video file (MP4 or MOV)')
        return
      }

      const filePath = (videoFiles[0] as File & { path: string }).path
      if (!filePath) return

      try {
        const metadata = await window.api.getVideoMetadata(filePath)
        const newClip = createClipFromMetadata('imported', filePath, metadata)
        onClipAdded(newClip)
      } catch (error) {
        console.error('Drag-and-drop import failed:', error)
        alert(`Failed to import video: ${error}`)
      }
    },
    [onClipAdded]
  )

  return {
    handleImport,
    handleDrop
  }
}
