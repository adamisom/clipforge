import { useState, useEffect, useRef, useMemo } from 'react'
import { formatTime } from '../utils/videoUtils'
import { calculateClipPositions, isTempFile } from '../utils/clipUtils'
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
  onRecordWebcam
}: TimelineProps): React.JSX.Element {
  const [isDraggingTrim, setIsDraggingTrim] = useState(false)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [dragType, setDragType] = useState<'start' | 'end' | null>(null)
  const [dragClipId, setDragClipId] = useState<string | null>(null)
  const [tempFileFlags, setTempFileFlags] = useState<Map<string, boolean>>(new Map())
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

  // Calculate total duration and clip positions
  const totalDuration = clips.reduce((sum, clip) => sum + clip.timelineDuration, 0)

  const clipPositions = useMemo(() => calculateClipPositions(clips), [clips])

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

          {/* Timeline Track */}
          <div className="timeline-track">
            {/* Render all clips */}
            {clips.map((clip) => {
              const clipPositionData = clipPositions.get(clip.id)
              const clipStart = clipPositionData?.start || 0
              const isSelected = clip.id === selectedClipId
              const isTemp = tempFileFlags.get(clip.id) || false

              return (
                <div
                  key={clip.id}
                  className={`timeline-clip ${isSelected ? 'selected' : ''} ${isTemp ? 'temp-file' : ''}`}
                  style={{
                    transform: `translateX(${clipStart * pixelsPerSecond}px)`,
                    width: `${clip.timelineDuration * pixelsPerSecond}px`,
                    top: '15px'
                  }}
                  onClick={() => handleClipClick(clip.id)}
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

            {/* Playhead */}
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
    </div>
  )
}

export default Timeline
