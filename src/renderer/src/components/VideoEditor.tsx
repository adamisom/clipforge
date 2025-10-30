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

    // Separate clips by track
    const track0Clips = clips.filter((c) => c.trackIndex === 0)
    const track1Clips = clips.filter((c) => c.trackIndex === 1)

    // Check if we have multi-track (Track 1 has clips)
    const hasMultiTrack = track1Clips.length > 0

    if (hasMultiTrack) {
      // Multi-track export with PiP overlay
      if (track0Clips.length === 0) {
        alert('Multi-track export requires at least one clip on Track 0 (Main)')
        return
      }

      // Optional: Warn if track durations don't match
      const track0Duration = track0Clips.reduce((sum, c) => sum + c.timelineDuration, 0)
      const track1Duration = track1Clips.reduce((sum, c) => sum + c.timelineDuration, 0)

      if (Math.abs(track0Duration - track1Duration) > 0.5) {
        const confirmed = window.confirm(
          `Track duration mismatch detected:\n\n` +
            `Track 0 (Main): ${track0Duration.toFixed(1)}s\n` +
            `Track 1 (PiP): ${track1Duration.toFixed(1)}s\n\n` +
            `The shorter track will be padded with black. Continue?`
        )
        if (!confirmed) return
      }

      await window.api.exportMultiTrack(track0Clips, track1Clips, pipConfig, outputPath)
    } else {
      // Single-track export (existing logic)
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
    }
  }, [clips, pipConfig])

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
        isPlaying={isPlaying}
        onPlayPause={togglePlayPause}
        onDeleteClip={handleDeleteClip}
        currentClip={currentClip}
      />

      <InfoPanel
        currentClip={currentClip}
        totalClips={clips.length}
        pipConfig={pipConfig}
        onPipConfigChange={setPipConfig}
        onExport={handleExport}
        onSavePermanently={handleSavePermanently}
      />
    </div>
  )
}

export default VideoEditor
