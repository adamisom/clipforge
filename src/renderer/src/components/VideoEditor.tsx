import { useCallback, useEffect, useState } from 'react'
import { TimelineClip, PiPConfig, DEFAULT_PIP_CONFIG } from '../types/timeline'
import Timeline from './Timeline'
import VideoPreview from './VideoPreview'
import InfoPanel from './InfoPanel'
import { useMultiClipPlayback } from '../hooks/useMultiClipPlayback'
import { useClipOperations } from '../hooks/useClipOperations'
import { usePiPClip } from '../hooks/usePiPClip'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

interface VideoEditorProps {
  clips: TimelineClip[]
  setClips: React.Dispatch<React.SetStateAction<TimelineClip[]>>
  selectedClipId: string | null
  setSelectedClipId: React.Dispatch<React.SetStateAction<string | null>>
  onImport: () => void
  onRecordScreen: () => void
  onRecordWebcam: () => void
}

function VideoEditor({
  clips,
  setClips,
  selectedClipId,
  setSelectedClipId,
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
  const [pipConfig, setPipConfig] = useState<PiPConfig>(DEFAULT_PIP_CONFIG)

  // Calculate current PiP clip (Track 1) at playhead position
  const currentPipClip = usePiPClip(clips, playheadPosition)

  // Clip operations (split, delete, trim, move to track, save)
  const {
    handleMoveToTrack,
    handleTrimChange,
    handleSplitAtPlayhead,
    handleDeleteClip,
    handleSavePermanently
  } = useClipOperations({
    clips,
    setClips,
    selectedClipId,
    setSelectedClipId,
    currentClip,
    playheadPosition,
    isPlaying,
    pause,
    handlePlayheadChange
  })

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

  const handleClipSelect = useCallback(
    (clipId: string) => {
      setSelectedClipId(clipId)
    },
    [setSelectedClipId]
  )

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSplit: handleSplitAtPlayhead,
    onDelete: handleDeleteClip,
    onPlayPause: togglePlayPause
  })

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
            key={currentClip.sourcePath}
            sourcePath={currentClip.sourcePath}
            trimStart={currentClip.sourceStartTime}
            trimEnd={currentClip.sourceStartTime + currentClip.timelineDuration}
            playheadPosition={relativePlayheadPosition}
            isPlaying={isPlaying}
            pipClip={currentPipClip}
            pipConfig={pipConfig}
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
        onMoveToTrack={handleMoveToTrack}
      />

      <InfoPanel
        currentClip={currentClip}
        totalClips={clips.length}
        pipConfig={pipConfig}
        onPipConfigChange={setPipConfig}
        onExport={handleExport}
        onDeleteClip={handleDeleteClip}
        onSavePermanently={handleSavePermanently}
      />
    </div>
  )
}

export default VideoEditor
