import { useCallback } from 'react'
import { TimelineClip } from '../types/timeline'
import { createClipFromMetadata } from '../utils/clipUtils'

interface UseClipImportReturn {
  handleImport: () => Promise<void>
  handleDrop: (files: FileList) => Promise<void>
}

export const useClipImport = (
  onClipAdded: (clip: TimelineClip) => void,
  existingClips: TimelineClip[]
): UseClipImportReturn => {
  const handleImport = useCallback(async (): Promise<void> => {
    try {
      const filePath = await window.api.selectVideoFile()
      if (!filePath) return

      // Get metadata
      const metadata = await window.api.getVideoMetadata(filePath)

      const newClip = createClipFromMetadata(
        'imported',
        filePath,
        metadata,
        undefined,
        existingClips
      )

      onClipAdded(newClip)
    } catch (error) {
      console.error('Import failed:', error)
      alert(`Failed to import video: ${error}`)
    }
  }, [onClipAdded, existingClips])

  const handleDrop = useCallback(
    async (files: FileList): Promise<void> => {
      const videoFiles = Array.from(files).filter((file) => {
        const ext = file.name.toLowerCase().split('.').pop()
        return ['mp4', 'mov', 'webm'].includes(ext || '')
      })

      if (videoFiles.length === 0) {
        alert('Please drop a video file (MP4, MOV, or WEBM)')
        return
      }

      const file = videoFiles[0] as File & { path: string }

      // Use Electron's webUtils.getPathForFile to get the actual file path
      const filePath = window.api.getPathForFile(file)

      if (!filePath) {
        console.error('[useClipImport] No file path found!')
        return
      }

      try {
        const metadata = await window.api.getVideoMetadata(filePath)
        const newClip = createClipFromMetadata(
          'imported',
          filePath,
          metadata,
          undefined,
          existingClips
        )
        onClipAdded(newClip)
      } catch (error) {
        console.error('Drag-and-drop import failed:', error)
        alert(`Failed to import video: ${error}`)
      }
    },
    [onClipAdded, existingClips]
  )

  return {
    handleImport,
    handleDrop
  }
}
