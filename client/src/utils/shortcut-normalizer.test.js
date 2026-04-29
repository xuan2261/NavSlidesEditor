/**
 * Unit tests for shortcut-normalizer.js
 *
 * Test strategy:
 * - Test normalizeKey() for all chord combinations
 * - Test isReservedChord() for browser-reserved shortcuts
 * - Test isModifierKey() for standalone modifier detection
 * - No React context needed — pure functions
 */
import { describe, it, expect } from 'vitest'
import { normalizeKey, isReservedChord, isModifierKey } from './shortcut-normalizer'

describe('normalizeKey', () => {
  it('normalizes Ctrl+C', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'c' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+C')
  })

  it('normalizes Ctrl+Shift+C', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: 'C' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+Shift+C')
  })

  it('normalizes Ctrl+Alt+C', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: true, key: 'c' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+Alt+C')
  })

  it('normalizes Ctrl+Shift+Alt+C', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: true, altKey: true, key: 'c' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+Shift+Alt+C')
  })

  it('normalizes Ctrl (no key) to just Ctrl', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'Control' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl')
  })

  it('normalizes Escape key', () => {
    const mockEvent = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: 'Escape' }
    expect(normalizeKey(mockEvent)).toBe('Escape')
  })

  it('normalizes Delete key', () => {
    const mockEvent = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: 'Delete' }
    expect(normalizeKey(mockEvent)).toBe('Delete')
  })

  it('normalizes arrow keys', () => {
    expect(normalizeKey({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: 'ArrowUp' }))
      .toBe('ArrowUp')
    expect(normalizeKey({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: 'ArrowDown' }))
      .toBe('ArrowDown')
  })

  it('uppercases single-letter keys', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'a' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+A')
  })

  it('preserves case for multi-char keys like Enter, Tab', () => {
    expect(normalizeKey({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: 'Enter' }))
      .toBe('Enter')
    expect(normalizeKey({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: 'Tab' }))
      .toBe('Tab')
  })

  it('normalizes Ctrl+Z (undo)', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'z' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+Z')
  })

  it('normalizes Ctrl+Y (redo)', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'y' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+Y')
  })

  it('normalizes Ctrl+D (duplicate)', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'd' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+D')
  })

  it('normalizes Ctrl+F (find)', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'f' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+F')
  })

  it('normalizes Ctrl+A (select all)', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'a' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+A')
  })

  it('normalizes Ctrl+V (paste)', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'v' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+V')
  })

  it('normalizes Ctrl+X (cut)', () => {
    const mockEvent = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'x' }
    expect(normalizeKey(mockEvent)).toBe('Ctrl+X')
  })

  it('normalizes plain letter without modifiers', () => {
    const mockEvent = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: 's' }
    expect(normalizeKey(mockEvent)).toBe('S')
  })
})

describe('isReservedChord', () => {
  it('marks Ctrl+W as reserved', () => {
    expect(isReservedChord('Ctrl+W')).toBe(true)
  })

  it('marks Ctrl+T as reserved', () => {
    expect(isReservedChord('Ctrl+T')).toBe(true)
  })

  it('marks Ctrl+N as reserved', () => {
    expect(isReservedChord('Ctrl+N')).toBe(true)
  })

  it('marks Ctrl+P as reserved', () => {
    expect(isReservedChord('Ctrl+P')).toBe(true)
  })

  it('marks Ctrl+Shift+T as reserved', () => {
    expect(isReservedChord('Ctrl+Shift+T')).toBe(true)
  })

  it('marks Ctrl+Shift+N as reserved', () => {
    expect(isReservedChord('Ctrl+Shift+N')).toBe(true)
  })

  it('allows Ctrl+C (not reserved)', () => {
    expect(isReservedChord('Ctrl+C')).toBe(false)
  })

  it('allows Ctrl+D (not reserved)', () => {
    expect(isReservedChord('Ctrl+D')).toBe(false)
  })

  it('allows Escape (not reserved)', () => {
    expect(isReservedChord('Escape')).toBe(false)
  })

  it('allows Delete (not reserved)', () => {
    expect(isReservedChord('Delete')).toBe(false)
  })

  it('allows Ctrl+Z (undo is allowed)', () => {
    expect(isReservedChord('Ctrl+Z')).toBe(false)
  })
})

describe('isModifierKey', () => {
  it('returns true for Ctrl alone', () => {
    expect(isModifierKey({ ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'Control' })).toBe(true)
  })

  it('returns true for Shift alone', () => {
    expect(isModifierKey({ ctrlKey: false, metaKey: false, shiftKey: true, altKey: false, key: 'Shift' })).toBe(true)
  })

  it('returns true for Alt alone', () => {
    expect(isModifierKey({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: true, key: 'Alt' })).toBe(true)
  })

  it('returns false for Ctrl+C', () => {
    expect(isModifierKey({ ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'c' })).toBe(false)
  })

  it('returns false for Escape', () => {
    expect(isModifierKey({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: 'Escape' })).toBe(false)
  })
})
