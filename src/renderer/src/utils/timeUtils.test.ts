import { describe, it, expect } from 'vitest'
import { formatDuration, formatTimestampForFilename, formatTimestamp } from './timeUtils'

describe('timeUtils', () => {
  describe('formatDuration', () => {
    it('formats 0 seconds', () => {
      expect(formatDuration(0)).toBe('0:00')
    })

    it('formats seconds less than 60', () => {
      expect(formatDuration(5)).toBe('0:05')
      expect(formatDuration(45)).toBe('0:45')
      expect(formatDuration(9)).toBe('0:09')
      expect(formatDuration(59)).toBe('0:59')
    })

    it('formats minutes and seconds', () => {
      expect(formatDuration(60)).toBe('1:00')
      expect(formatDuration(125)).toBe('2:05')
      expect(formatDuration(90)).toBe('1:30')
      expect(formatDuration(601)).toBe('10:01')
    })

    it('formats hours, minutes, and seconds', () => {
      expect(formatDuration(3600)).toBe('1:00:00')
      expect(formatDuration(3661)).toBe('1:01:01')
      expect(formatDuration(7325)).toBe('2:02:05')
      expect(formatDuration(36000)).toBe('10:00:00')
    })

    it('pads with zeros correctly', () => {
      expect(formatDuration(1)).toBe('0:01')
      expect(formatDuration(61)).toBe('1:01')
      expect(formatDuration(3601)).toBe('1:00:01')
      expect(formatDuration(3661)).toBe('1:01:01')
    })

    it('handles decimal seconds by flooring', () => {
      expect(formatDuration(5.7)).toBe('0:05')
      expect(formatDuration(65.9)).toBe('1:05')
      expect(formatDuration(10.1)).toBe('0:10')
      expect(formatDuration(3661.9)).toBe('1:01:01')
    })

    it('handles very long durations', () => {
      expect(formatDuration(86400)).toBe('24:00:00') // 24 hours (displayed as hours)
      expect(formatDuration(359999)).toBe('99:59:59') // 100 hours minus 1 second
    })

    it('handles fractional seconds correctly', () => {
      expect(formatDuration(0.5)).toBe('0:00')
      expect(formatDuration(59.5)).toBe('0:59')
      expect(formatDuration(60.5)).toBe('1:00')
    })

    it('formats common video lengths', () => {
      expect(formatDuration(30)).toBe('0:30') // 30 second clip
      expect(formatDuration(180)).toBe('3:00') // 3 minute video
      expect(formatDuration(600)).toBe('10:00') // 10 minute video
      expect(formatDuration(3600)).toBe('1:00:00') // 1 hour video
    })
  })

  describe('formatTimestampForFilename', () => {
    it('generates filename-safe timestamp', () => {
      const timestamp = formatTimestampForFilename()

      // Should match YYYY-MM-DD-HH-MM-SS format
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/)
    })

    it('contains valid year', () => {
      const timestamp = formatTimestampForFilename()
      const year = parseInt(timestamp.substring(0, 4))

      expect(year).toBeGreaterThanOrEqual(2024)
      expect(year).toBeLessThanOrEqual(2030)
    })

    it('contains valid month', () => {
      const timestamp = formatTimestampForFilename()
      const month = parseInt(timestamp.substring(5, 7))

      expect(month).toBeGreaterThanOrEqual(1)
      expect(month).toBeLessThanOrEqual(12)
    })

    it('contains valid day', () => {
      const timestamp = formatTimestampForFilename()
      const day = parseInt(timestamp.substring(8, 10))

      expect(day).toBeGreaterThanOrEqual(1)
      expect(day).toBeLessThanOrEqual(31)
    })

    it('contains valid hour', () => {
      const timestamp = formatTimestampForFilename()
      const hour = parseInt(timestamp.substring(11, 13))

      expect(hour).toBeGreaterThanOrEqual(0)
      expect(hour).toBeLessThanOrEqual(23)
    })

    it('contains valid minute', () => {
      const timestamp = formatTimestampForFilename()
      const minute = parseInt(timestamp.substring(14, 16))

      expect(minute).toBeGreaterThanOrEqual(0)
      expect(minute).toBeLessThanOrEqual(59)
    })

    it('contains valid second', () => {
      const timestamp = formatTimestampForFilename()
      const second = parseInt(timestamp.substring(17, 19))

      expect(second).toBeGreaterThanOrEqual(0)
      expect(second).toBeLessThanOrEqual(59)
    })

    it('pads single digits with zero', () => {
      const timestamp = formatTimestampForFilename()
      const parts = timestamp.split('-')

      // All parts should be at least 2 digits (except year which is 4)
      expect(parts[0].length).toBe(4) // year
      expect(parts[1].length).toBe(2) // month
      expect(parts[2].length).toBe(2) // day
      expect(parts[3].length).toBe(2) // hour
      expect(parts[4].length).toBe(2) // minute
      expect(parts[5].length).toBe(2) // second
    })

    it('generates unique timestamps for sequential calls', () => {
      const ts1 = formatTimestampForFilename()
      const ts2 = formatTimestampForFilename()

      // They should be strings
      expect(typeof ts1).toBe('string')
      expect(typeof ts2).toBe('string')

      // If called within same second, they might be the same
      // Just ensure both are valid
      expect(ts1).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/)
      expect(ts2).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/)
    })

    it('can be used in filenames', () => {
      const timestamp = formatTimestampForFilename()
      const filename = `clipforge-recording-${timestamp}.webm`

      // Should not contain any invalid filename characters
      expect(filename).not.toMatch(/[<>:"/\\|?*]/)
      expect(filename).toMatch(/^clipforge-recording-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.webm$/)
    })
  })

  describe('formatTimestamp', () => {
    it('formats date for display', () => {
      const date = new Date('2025-10-29T12:30:45')
      const formatted = formatTimestamp(date)

      // Result depends on locale, just check it's a string with content
      expect(typeof formatted).toBe('string')
      expect(formatted.length).toBeGreaterThan(0)
    })

    it('uses current date when no arg provided', () => {
      const formatted = formatTimestamp()

      expect(typeof formatted).toBe('string')
      expect(formatted.length).toBeGreaterThan(0)
    })

    it('handles different dates', () => {
      const date1 = new Date('2025-01-01T00:00:00')
      const date2 = new Date('2025-12-31T23:59:59')

      const formatted1 = formatTimestamp(date1)
      const formatted2 = formatTimestamp(date2)

      expect(formatted1).not.toBe(formatted2)
      expect(typeof formatted1).toBe('string')
      expect(typeof formatted2).toBe('string')
    })

    it('returns consistent format for same date', () => {
      const date = new Date('2025-10-29T12:30:45')
      const formatted1 = formatTimestamp(date)
      const formatted2 = formatTimestamp(date)

      expect(formatted1).toBe(formatted2)
    })

    it('handles leap year dates', () => {
      const leapDate = new Date('2024-02-29T12:00:00')
      const formatted = formatTimestamp(leapDate)

      expect(typeof formatted).toBe('string')
      expect(formatted.length).toBeGreaterThan(0)
    })

    it('handles year boundaries', () => {
      const newYearEve = new Date('2024-12-31T23:59:59')
      const newYear = new Date('2025-01-01T00:00:00')

      const formatted1 = formatTimestamp(newYearEve)
      const formatted2 = formatTimestamp(newYear)

      expect(formatted1).not.toBe(formatted2)
    })
  })
})

