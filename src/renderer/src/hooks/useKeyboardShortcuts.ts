import { useEffect } from 'react'

interface KeyboardShortcutHandlers {
  onSplit?: () => void
  onDelete?: () => void
  onPlayPause?: () => void
}

/**
 * Hook to manage keyboard shortcuts for video editing
 * - Cmd+K: Split clip at playhead
 * - Delete/Backspace: Delete selected clip
 * - Spacebar: Toggle play/pause
 */
export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers): void => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        handlers.onSplit?.()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handlers.onDelete?.()
      } else if (e.key === ' ' || e.code === 'Space') {
        // Spacebar for play/pause
        e.preventDefault()
        handlers.onPlayPause?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handlers])
}
