import { useState, useEffect, useRef } from 'react'
import { formatTime } from '../utils/videoUtils'

interface TimelineProps {
  duration: number
  trimStart: number
  trimEnd: number
  playheadPosition: number
  onTrimChange: (trimStart: number, trimEnd: number) => void
  onPlayheadChange: (position: number) => void
}

function Timeline({
  duration,
  trimStart,
  trimEnd,
  playheadPosition,
  onTrimChange,
  onPlayheadChange
}: TimelineProps): React.JSX.Element {
  const [isDraggingTrim, setIsDraggingTrim] = useState(false)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [dragType, setDragType] = useState<'start' | 'end' | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  // Calculate pixels per second - 50px per second as a good starting scale
  const pixelsPerSecond = 50
  const timelineWidth = Math.max(duration * pixelsPerSecond, 800) // Minimum 800px

  // Generate time markers every second
  const timeMarkers: number[] = []
  for (let i = 0; i <= Math.ceil(duration); i++) {
    timeMarkers.push(i)
  }

  // Handle trim drag start
  const handleTrimDragStart = (e: React.MouseEvent, type: 'start' | 'end'): void => {
    e.stopPropagation()
    setIsDraggingTrim(true)
    setDragType(type)
  }

  // Handle playhead drag start
  const handlePlayheadDragStart = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setIsDraggingPlayhead(true)
  }

  // Handle trim dragging
  useEffect(() => {
    if (!isDraggingTrim || !timelineRef.current) return

    const handleMouseMove = (e: MouseEvent): void => {
      const rect = timelineRef.current!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = Math.max(0, Math.min(duration, x / pixelsPerSecond))

      if (dragType === 'start') {
        const newStart = Math.max(0, Math.min(time, trimEnd - 0.1))
        onTrimChange(newStart, trimEnd)
      } else if (dragType === 'end') {
        const newEnd = Math.max(trimStart + 0.1, Math.min(duration, time))
        onTrimChange(trimStart, newEnd)
      }
    }

    const handleMouseUp = (): void => {
      setIsDraggingTrim(false)
      setDragType(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingTrim, dragType, duration, trimStart, trimEnd, pixelsPerSecond, onTrimChange])

  // Handle playhead dragging
  useEffect(() => {
    if (!isDraggingPlayhead || !timelineRef.current) return

    const handleMouseMove = (e: MouseEvent): void => {
      const rect = timelineRef.current!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = Math.max(0, Math.min(duration, x / pixelsPerSecond))

      // Constrain playhead to trimmed region
      const relativeTime = Math.max(0, Math.min(trimEnd - trimStart, time - trimStart))
      onPlayheadChange(relativeTime)
    }

    const handleMouseUp = (): void => {
      setIsDraggingPlayhead(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingPlayhead, duration, trimStart, trimEnd, pixelsPerSecond, onPlayheadChange])

  return (
    <div className="timeline-panel">
      <div ref={timelineRef} className="timeline-container" style={{ width: `${timelineWidth}px` }}>
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
          {/* Clip Visualization */}
          <div
            className="timeline-clip"
            style={{
              transform: `translateX(${trimStart * pixelsPerSecond}px)`,
              width: `${(trimEnd - trimStart) * pixelsPerSecond}px`,
              top: '15px'
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Video Clip
            </span>

            {/* Trim Handles */}
            <div
              className="trim-handle trim-handle-left"
              onMouseDown={(e) => handleTrimDragStart(e, 'start')}
            />
            <div
              className="trim-handle trim-handle-right"
              onMouseDown={(e) => handleTrimDragStart(e, 'end')}
            />
          </div>

          {/* Playhead */}
          <div
            className="playhead"
            style={{
              transform: `translateX(${(trimStart + playheadPosition) * pixelsPerSecond}px)`
            }}
            onMouseDown={handlePlayheadDragStart}
          />
        </div>
      </div>
    </div>
  )
}

export default Timeline
