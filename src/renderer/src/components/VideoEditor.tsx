import { useCallback, useEffect, useState } from 'react'
import { TimelineClip } from '../types/timeline'
import Timeline from './Timeline'
import VideoPreview from './VideoPreview'
import InfoPanel from './InfoPanel'
import { generateClipId } from '../utils/clipUtils'
import { useMultiClipPlayback } from '../hooks/useMultiClipPlayback'

interface VideoEditorProps {
  clips: TimelineClip[]
  setClips: React.Dispatch<React.SetStateAction<TimelineClip[]>>
  selectedClipId: string | null
  onImport: () => void
  onRecordScreen: () => void
  onRecordWebcam: () => void
}

function VideoEditor({
  clips,
  setClips,
  selectedClipId,
  onImport,
  onRecordScreen,
  onRecordWebcam
}: VideoEditorProps): React.JSX.Element {
  const {
    playheadPosition,
    isPlaying,
    currentClip,
    relativePlayheadPosition,
    handleTimeUpdate,
    handlePlayheadChange,
    togglePlayPause,
    play,
    pause
  } = useMultiClipPlayback(clips)

  const [wasPlayingBeforeDrag, setWasPlayingBeforeDrag] = useState(false)

  const handlePlayheadDragStart = useCallback(() => {
    setWasPlayingBeforeDrag(isPlaying)
    if (isPlaying) {
      pause()
    }
  }, [isPlaying, pause])

  const handlePlayheadDragEnd = useCallback(() => {
    if (wasPlayingBeforeDrag) {
      play()
    }
  }, [wasPlayingBeforeDrag, play])

  const handleClipSelect = useCallback(() => {
    // Clicking a clip doesn't change playhead, just for future features
  }, [])

  const handleTrimChange = useCallback(
    (clipId: string, newTrimStart: number, newTrimEnd: number) => {
      setClips((prevClips) =>
        prevClips.map((clip) =>
          clip.id === clipId
            ? {
                ...clip,
                sourceStartTime: newTrimStart,
                timelineDuration: newTrimEnd - newTrimStart
              }
            : clip
        )
      )
    },
    [setClips]
  )

  const handleSplitAtPlayhead = useCallback((): void => {
    if (!currentClip) return

    const clipPositions = new Map<string, { start: number; end: number }>()
    let pos = 0
    for (const clip of clips) {
      clipPositions.set(clip.id, { start: pos, end: pos + clip.timelineDuration })
      pos += clip.timelineDuration
    }

    const position = clipPositions.get(currentClip.id)
    if (!position) return

    const relativePos = playheadPosition - position.start

    // Calculate split point relative to the clip's source video
    const splitPoint = relativePos + currentClip.sourceStartTime

    // Don't split if we're at the very beginning or end of the clip
    if (relativePos < 0.1 || relativePos > currentClip.timelineDuration - 0.1) {
      return
    }

    // Create two new clips from the split
    const firstClip: TimelineClip = {
      ...currentClip,
      id: generateClipId(),
      timelineDuration: relativePos
    }

    const secondClip: TimelineClip = {
      ...currentClip,
      id: generateClipId(),
      sourceStartTime: splitPoint,
      timelineDuration: currentClip.timelineDuration - relativePos
    }

    // Replace the original clip with the two new clips
    setClips((prevClips) => {
      const index = prevClips.findIndex((c) => c.id === currentClip.id)
      if (index === -1) return prevClips
      const newClips = [...prevClips]
      newClips.splice(index, 1, firstClip, secondClip)
      return newClips
    })
  }, [currentClip, clips, playheadPosition, setClips])

  // Listen for Cmd+K keyboard shortcut for split
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        handleSplitAtPlayhead()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleSplitAtPlayhead])

  const handleExport = useCallback(async (): Promise<void> => {
    if (clips.length === 0) return

    const outputPath = await window.api.selectSavePath()
    if (!outputPath) return

    if (clips.length === 1) {
      // Single clip export (simple trim)
      await window.api.exportVideo(
        clips[0].sourcePath,
        outputPath,
        clips[0].sourceStartTime,
        clips[0].timelineDuration
      )
    } else {
      // Multi-clip export (concatenate)
      await window.api.exportMultiClip(clips, outputPath)
    }
  }, [clips])

  // Listen for menu events
  useEffect(() => {
    const handleMenuExport = (): void => {
      if (clips.length > 0) {
        handleExport()
      }
    }

    window.api.onMenuExport(handleMenuExport)

    return () => {
      window.api.removeAllListeners('menu-export')
    }
  }, [clips, handleExport])

  return (
    <div className="video-editor">
      <div className="preview-panel">
        {currentClip ? (
          <VideoPreview
            key={currentClip.id}
            sourcePath={currentClip.sourcePath}
            trimStart={currentClip.sourceStartTime}
            trimEnd={currentClip.sourceStartTime + currentClip.timelineDuration}
            playheadPosition={relativePlayheadPosition}
            isPlaying={isPlaying}
            onPlayPause={togglePlayPause}
            onTimeUpdate={handleTimeUpdate}
          />
        ) : null}
      </div>

      {/* Multi-clip Timeline */}
      <Timeline
        clips={clips}
        selectedClipId={selectedClipId}
        playheadPosition={playheadPosition}
        onClipSelect={handleClipSelect}
        onTrimChange={handleTrimChange}
        onPlayheadChange={handlePlayheadChange}
        onPlayheadDragStart={handlePlayheadDragStart}
        onPlayheadDragEnd={handlePlayheadDragEnd}
        onImport={onImport}
        onRecordScreen={onRecordScreen}
        onRecordWebcam={onRecordWebcam}
      />

      <InfoPanel currentClip={currentClip} totalClips={clips.length} onExport={handleExport} />
    </div>
  )
}

export default VideoEditor
