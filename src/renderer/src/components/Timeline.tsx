import { useState, useEffect, useRef, useMemo } from 'react'
import { formatTime } from '../utils/videoUtils'
import {
  calculateClipPositions,
  isTempFile,
  getTrack0Clips,
  getTrack1Clips
} from '../utils/clipUtils'
import { TimelineClip } from '../types/timeline'

interface TimelineProps {
  clips: TimelineClip[]
  selectedClipId: string | null
  playheadPosition: number
  onClipSelect: (clipId: string) => void
  onTrimChange: (clipId: string, trimStart: number, trimEnd: number) => void
  onPlayheadChange: (position: number) => void
  onPlayheadDragStart: () => void
  onPlayheadDragEnd: () => void
  onImport: () => void
  onRecordScreen: () => void
  onRecordWebcam: () => void
  onMoveToTrack: (clipId: string, trackIndex: 0 | 1) => void // NEW
}

function Timeline({
  clips,
  selectedClipId,
  playheadPosition,
  onClipSelect,
  onTrimChange,
  onPlayheadChange,
  onPlayheadDragStart,
  onPlayheadDragEnd,
  onImport,
  onRecordScreen,
  onRecordWebcam,
  onMoveToTrack
}: TimelineProps): React.JSX.Element {
  const [isDraggingTrim, setIsDraggingTrim] = useState(false)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [dragType, setDragType] = useState<'start' | 'end' | null>(null)
  const [dragClipId, setDragClipId] = useState<string | null>(null)
  const [tempFileFlags, setTempFileFlags] = useState<Map<string, boolean>>(new Map())
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    clipId: string | null
  }>({ visible: false, x: 0, y: 0, clipId: null })
  const timelineRef = useRef<HTMLDivElement>(null)

  // Check which clips are temp files
  useEffect(() => {
    const checkTempFiles = async (): Promise<void> => {
      const flags = new Map<string, boolean>()
      for (const clip of clips) {
        const isTemp = await isTempFile(clip.sourcePath)
        flags.set(clip.id, isTemp)
      }
      setTempFileFlags(flags)
    }
    checkTempFiles()
  }, [clips])

  // Calculate total duration and clip positions (per track for correct positioning)
  const track0Clips = getTrack0Clips(clips)
  const track1Clips = getTrack1Clips(clips)

  const track0Positions = useMemo(() => calculateClipPositions(track0Clips), [track0Clips])
  const track1Positions = useMemo(() => calculateClipPositions(track1Clips), [track1Clips])

  const totalDuration = Math.max(
    track0Clips.reduce((sum, clip) => sum + clip.timelineDuration, 0),
    track1Clips.reduce((sum, clip) => sum + clip.timelineDuration, 0)
  )

  // For legacy clipPositions (keep for compatibility)
  const clipPositions = useMemo(() => {
    const positions = new Map<string, { start: number; end: number }>()
    track0Clips.forEach((clip) => {
      const pos = track0Positions.get(clip.id)
      if (pos) positions.set(clip.id, pos)
    })
    track1Clips.forEach((clip) => {
      const pos = track1Positions.get(clip.id)
      if (pos) positions.set(clip.id, pos)
    })
    return positions
  }, [track0Clips, track1Clips, track0Positions, track1Positions])

  // Calculate pixels per second dynamically based on total duration
  const maxTimelineWidth = 1500
  const standardPixelsPerSecond = 50
  const pixelsPerSecond =
    totalDuration <= 30 ? standardPixelsPerSecond : maxTimelineWidth / totalDuration

  const timelineWidth = Math.max(totalDuration * pixelsPerSecond, 800) // Minimum 800px

  // Generate time markers every second
  const timeMarkers: number[] = []
  for (let i = 0; i <= Math.ceil(totalDuration); i++) {
    timeMarkers.push(i)
  }

  // Handle trim drag start
  const handleTrimDragStart = (
    e: React.MouseEvent,
    clipId: string,
    type: 'start' | 'end'
  ): void => {
    e.stopPropagation()
    setIsDraggingTrim(true)
    setDragType(type)
    setDragClipId(clipId)
    onClipSelect(clipId) // Select clip when starting trim
  }

  // Handle playhead drag start
  const handlePlayheadDragStart = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setIsDraggingPlayhead(true)
    onPlayheadDragStart() // Notify parent that drag started
  }

  // Handle clip click to select
  const handleClipClick = (clipId: string): void => {
    onClipSelect(clipId)
  }

  // Handle right-click to show context menu
  const handleClipRightClick = (e: React.MouseEvent, clipId: string): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      clipId
    })
  }

  // Handle move to track
  const handleMoveToTrack = (trackIndex: 0 | 1): void => {
    if (contextMenu.clipId) {
      onMoveToTrack(contextMenu.clipId, trackIndex)
      setContextMenu({ visible: false, x: 0, y: 0, clipId: null })
    }
  }

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu.visible) return

    const handleClick = (): void => {
      setContextMenu({ visible: false, x: 0, y: 0, clipId: null })
    }

    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu.visible])

  // Handle trim dragging
  useEffect(() => {
    if (!isDraggingTrim || !timelineRef.current || !dragClipId) return

    const clip = clips.find((c) => c.id === dragClipId)
    if (!clip) return

    const handleMouseMove = (e: MouseEvent): void => {
      const rect = timelineRef.current!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const absoluteTime = x / pixelsPerSecond

      // Get clip's timeline position
      const clipPositionData = clipPositions.get(dragClipId)
      const clipStart = clipPositionData?.start || 0
      const relativeTime = absoluteTime - clipStart

      if (dragType === 'start') {
        const newStart = Math.max(
          0,
          Math.min(relativeTime, clip.sourceStartTime + clip.timelineDuration - 0.1)
        )
        const newDuration = clip.sourceStartTime + clip.timelineDuration - newStart
        onTrimChange(dragClipId, newStart, newStart + newDuration)
      } else if (dragType === 'end') {
        const maxEnd = clip.sourceDuration
        const newEnd = Math.max(
          clip.sourceStartTime + 0.1,
          Math.min(maxEnd, clip.sourceStartTime + relativeTime)
        )
        onTrimChange(dragClipId, clip.sourceStartTime, newEnd)
      }
    }

    const handleMouseUp = (): void => {
      setIsDraggingTrim(false)
      setDragType(null)
      setDragClipId(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingTrim, dragType, dragClipId, clips, clipPositions, pixelsPerSecond, onTrimChange])

  // Handle playhead dragging
  useEffect(() => {
    if (!isDraggingPlayhead || !timelineRef.current) return

    const handleMouseMove = (e: MouseEvent): void => {
      const rect = timelineRef.current!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = Math.max(0, Math.min(totalDuration, x / pixelsPerSecond))
      onPlayheadChange(time)
    }

    const handleMouseUp = (): void => {
      setIsDraggingPlayhead(false)
      onPlayheadDragEnd() // Notify parent that drag ended
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingPlayhead, totalDuration, pixelsPerSecond, onPlayheadChange, onPlayheadDragEnd])

  return (
    <div className="timeline-panel">
      {/* Timeline Toolbar */}
      <div className="timeline-toolbar">
        <button onClick={onImport} className="timeline-toolbar-button" title="Import Video (Cmd+I)">
          + Import
        </button>
        <button
          onClick={onRecordScreen}
          className="timeline-toolbar-button"
          title="Record Screen (Cmd+Shift+R)"
        >
          🖥️
        </button>
        <button
          onClick={onRecordWebcam}
          className="timeline-toolbar-button"
          title="Record Webcam (Cmd+Shift+W)"
        >
          📹
        </button>
      </div>

      {/* Timeline Content Wrapper */}
      <div className="timeline-content-wrapper">
        <div
          ref={timelineRef}
          className="timeline-container"
          style={{ width: `${timelineWidth}px` }}
        >
          {/* Time Ruler */}
          <div className="time-ruler">
            {timeMarkers.map((time) => (
              <div
                key={time}
                style={{
                  position: 'absolute',
                  left: `${time * pixelsPerSecond}px`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '12px',
                  color: '#888',
                  userSelect: 'none'
                }}
              >
                {formatTime(time)}
              </div>
            ))}
          </div>

          {/* Multi-Track Timeline */}
          <div className="timeline-tracks">
            {/* Track 0: Main Video */}
            <div className="timeline-track" data-track="0">
              <div className="track-label">Main</div>
              {track0Clips.map((clip) => {
                const clipPositionData = track0Positions.get(clip.id)
                const clipStart = clipPositionData?.start || 0
                const isSelected = clip.id === selectedClipId
                const isTemp = tempFileFlags.get(clip.id) || false

                return (
                  <div
                    key={clip.id}
                    className={`timeline-clip ${isSelected ? 'selected' : ''} ${isTemp ? 'temp-file' : ''}`}
                    style={{
                      transform: `translateX(${clipStart * pixelsPerSecond}px)`,
                      width: `${clip.timelineDuration * pixelsPerSecond}px`
                    }}
                    onClick={() => handleClipClick(clip.id)}
                    onContextMenu={(e) => handleClipRightClick(e, clip.id)}
                  >
                    {isTemp && (
                      <span className="temp-indicator" title="Unsaved recording">
                        ⚠️
                      </span>
                    )}
                    <span
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={clip.metadata.filename}
                    >
                      {clip.metadata.filename}
                    </span>

                    {/* Only show trim handles on selected clip */}
                    {isSelected && (
                      <>
                        <div
                          className="trim-handle trim-handle-left"
                          onMouseDown={(e) => handleTrimDragStart(e, clip.id, 'start')}
                        />
                        <div
                          className="trim-handle trim-handle-right"
                          onMouseDown={(e) => handleTrimDragStart(e, clip.id, 'end')}
                        />
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Track 1: PiP Overlay */}
            <div className="timeline-track" data-track="1">
              <div className="track-label">PiP</div>
              {track1Clips.map((clip) => {
                const clipPositionData = track1Positions.get(clip.id)
                const clipStart = clipPositionData?.start || 0
                const isSelected = clip.id === selectedClipId
                const isTemp = tempFileFlags.get(clip.id) || false

                return (
                  <div
                    key={clip.id}
                    className={`timeline-clip ${isSelected ? 'selected' : ''} ${isTemp ? 'temp-file' : ''}`}
                    style={{
                      transform: `translateX(${clipStart * pixelsPerSecond}px)`,
                      width: `${clip.timelineDuration * pixelsPerSecond}px`
                    }}
                    onClick={() => handleClipClick(clip.id)}
                    onContextMenu={(e) => handleClipRightClick(e, clip.id)}
                  >
                    {isTemp && (
                      <span className="temp-indicator" title="Unsaved recording">
                        ⚠️
                      </span>
                    )}
                    <span
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={clip.metadata.filename}
                    >
                      {clip.metadata.filename}
                    </span>

                    {/* Only show trim handles on selected clip */}
                    {isSelected && (
                      <>
                        <div
                          className="trim-handle trim-handle-left"
                          onMouseDown={(e) => handleTrimDragStart(e, clip.id, 'start')}
                        />
                        <div
                          className="trim-handle trim-handle-right"
                          onMouseDown={(e) => handleTrimDragStart(e, clip.id, 'end')}
                        />
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Playhead (spans both tracks) */}
            <div
              className="playhead"
              style={{
                transform: `translateX(${playheadPosition * pixelsPerSecond}px)`
              }}
              onMouseDown={handlePlayheadDragStart}
            />
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <>
          <div
            className="context-menu-overlay"
            onClick={() => setContextMenu({ visible: false, x: 0, y: 0, clipId: null })}
          />
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button onClick={() => handleMoveToTrack(0)}>Move to Track 0 (Main)</button>
            <button onClick={() => handleMoveToTrack(1)}>Move to Track 1 (PiP)</button>
          </div>
        </>
      )}
    </div>
  )
}

export default Timeline
