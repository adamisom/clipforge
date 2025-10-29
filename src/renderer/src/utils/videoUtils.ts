/**
 * Format seconds as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Validate trim range is within bounds and valid
 */
export function validateTrimRange(trimStart: number, trimEnd: number, duration: number): boolean {
  if (trimStart < 0 || trimEnd > duration) return false
  if (trimStart >= trimEnd) return false
  return true
}

/**
 * Clamp playhead position within trimmed region
 */
export function clampPlayhead(position: number, trimStart: number, trimEnd: number): number {
  const max = trimEnd - trimStart
  return Math.max(0, Math.min(position, max))
}
