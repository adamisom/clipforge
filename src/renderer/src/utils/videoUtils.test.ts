import { describe, it, expect } from 'vitest'
import { formatTime, validateTrimRange, clampPlayhead } from './videoUtils'

describe('formatTime', () => {
  it('formats 0 seconds correctly', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('formats seconds less than 60', () => {
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(45)).toBe('0:45')
    expect(formatTime(9)).toBe('0:09')
  })

  it('formats minutes correctly', () => {
    expect(formatTime(60)).toBe('1:00')
    expect(formatTime(125)).toBe('2:05')
    expect(formatTime(90)).toBe('1:30')
  })

  it('handles large durations', () => {
    expect(formatTime(3661)).toBe('61:01')
    expect(formatTime(7200)).toBe('120:00')
  })

  it('handles decimal seconds by flooring', () => {
    expect(formatTime(5.7)).toBe('0:05')
    expect(formatTime(65.9)).toBe('1:05')
    expect(formatTime(10.1)).toBe('0:10')
  })

  it('pads single digit seconds with zero', () => {
    expect(formatTime(1)).toBe('0:01')
    expect(formatTime(61)).toBe('1:01')
  })
})

describe('validateTrimRange', () => {
  it('accepts valid trim range', () => {
    expect(validateTrimRange(0, 10, 20)).toBe(true)
    expect(validateTrimRange(5, 15, 20)).toBe(true)
    expect(validateTrimRange(0, 20, 20)).toBe(true)
  })

  it('rejects trimStart >= trimEnd', () => {
    expect(validateTrimRange(10, 10, 20)).toBe(false)
    expect(validateTrimRange(15, 10, 20)).toBe(false)
  })

  it('rejects trimStart < 0', () => {
    expect(validateTrimRange(-1, 10, 20)).toBe(false)
    expect(validateTrimRange(-5, 10, 20)).toBe(false)
  })

  it('rejects trimEnd > duration', () => {
    expect(validateTrimRange(0, 25, 20)).toBe(false)
    expect(validateTrimRange(10, 30, 20)).toBe(false)
  })

  it('handles very short valid trim', () => {
    expect(validateTrimRange(0.1, 0.2, 10)).toBe(true)
    expect(validateTrimRange(5, 5.1, 10)).toBe(true)
  })

  it('handles full duration trim', () => {
    expect(validateTrimRange(0, 100, 100)).toBe(true)
  })
})

describe('clampPlayhead', () => {
  it('returns position when within valid range', () => {
    expect(clampPlayhead(5, 0, 10)).toBe(5)
    expect(clampPlayhead(3, 0, 10)).toBe(3)
  })

  it('clamps negative values to 0', () => {
    expect(clampPlayhead(-5, 0, 10)).toBe(0)
    expect(clampPlayhead(-1, 0, 10)).toBe(0)
  })

  it('clamps values exceeding trimmed duration', () => {
    expect(clampPlayhead(15, 0, 10)).toBe(10)
    expect(clampPlayhead(100, 0, 10)).toBe(10)
  })

  it('handles trim offset correctly', () => {
    // trimStart=5, trimEnd=15, so max playhead = 10 (duration of trimmed section)
    expect(clampPlayhead(12, 5, 15)).toBe(10)
    expect(clampPlayhead(5, 5, 15)).toBe(5)
    expect(clampPlayhead(0, 5, 15)).toBe(0)
  })

  it('handles playhead at exact boundaries', () => {
    expect(clampPlayhead(0, 0, 10)).toBe(0)
    expect(clampPlayhead(10, 0, 10)).toBe(10)
  })

  it('handles very short trim ranges', () => {
    expect(clampPlayhead(0.5, 0, 1)).toBe(0.5)
    expect(clampPlayhead(2, 0, 1)).toBe(1)
  })
})
