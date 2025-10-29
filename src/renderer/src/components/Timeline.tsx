interface TimelineProps {
  duration: number
  trimStart: number
  trimEnd: number
  playheadPosition: number
}

function Timeline({ duration, trimStart, trimEnd, playheadPosition }: TimelineProps) {
  // Calculate pixels per second - 50px per second as a good starting scale
  const pixelsPerSecond = 50
  const timelineWidth = Math.max(duration * pixelsPerSecond, 800) // Minimum 800px
  
  // Generate time markers every second
  const timeMarkers = []
  for (let i = 0; i <= Math.ceil(duration); i++) {
    timeMarkers.push(i)
  }
  
  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  return (
    <div className="timeline-panel">
      <div className="timeline-container" style={{ width: `${timelineWidth}px` }}>
        {/* Time Ruler */}
        <div className="time-ruler">
          {timeMarkers.map(time => (
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
            <div className="trim-handle trim-handle-left" />
            <div className="trim-handle trim-handle-right" />
          </div>
          
          {/* Playhead */}
          <div
            className="playhead"
            style={{
              transform: `translateX(${(trimStart + playheadPosition) * pixelsPerSecond}px)`
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default Timeline

