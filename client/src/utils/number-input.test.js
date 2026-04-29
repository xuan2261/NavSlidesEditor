import { describe, expect, it } from 'vitest'
import { clampNumber, parseFiniteNumber } from './number-input'

describe('number-input utils', () => {
  it('parses finite numbers and rejects empty/invalid inputs', () => {
    expect(parseFiniteNumber('12')).toBe(12)
    expect(parseFiniteNumber(2.5)).toBe(2.5)
    expect(parseFiniteNumber('')).toBeNull()
    expect(parseFiniteNumber('abc')).toBeNull()
    expect(parseFiniteNumber(Number.NaN)).toBeNull()
    expect(parseFiniteNumber(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('clamps finite numbers and returns fallback for invalid input', () => {
    expect(clampNumber('50', 0, 100)).toBe(50)
    expect(clampNumber('-10', 0, 100)).toBe(0)
    expect(clampNumber('180', 0, 100)).toBe(100)
    expect(clampNumber('', 0, 100, 42)).toBe(42)
  })
})
