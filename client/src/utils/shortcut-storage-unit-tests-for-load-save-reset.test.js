/**
 * Unit tests for shortcut-storage.js
 *
 * Test strategy:
 * - Test load/save/reset with localStorage mocking
 * - Test conflict detection
 * - Test data validation
 * - No React context needed — pure functions with localStorage side effects
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadOverrides, saveOverride, resetOverride, resetAll, detectConflict } from './shortcut-local-storage-persistence'

const STORAGE_KEY = 'navslides-shortcuts'

// Mock localStorage
const store = {}
vi.stubGlobal('localStorage', {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value) },
  removeItem: (key) => { delete store[key] },
})

describe('loadOverrides', () => {
  beforeEach(() => {
    delete store[STORAGE_KEY]
  })

  it('returns empty object when no overrides stored', () => {
    const result = loadOverrides()
    expect(result).toEqual({})
  })

  it('loads stored overrides', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ duplicate: 'Ctrl+Shift+D' }))
    const result = loadOverrides()
    expect(result).toEqual({ duplicate: 'Ctrl+Shift+D' })
  })

  it('returns empty object on invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid json')
    const result = loadOverrides()
    expect(result).toEqual({})
  })

  it('returns empty object on empty string', () => {
    localStorage.setItem(STORAGE_KEY, '')
    const result = loadOverrides()
    expect(result).toEqual({})
  })

  it('returns empty object on null', () => {
    localStorage.setItem(STORAGE_KEY, 'null')
    const result = loadOverrides()
    expect(result).toEqual({})
  })
})

describe('saveOverride', () => {
  beforeEach(() => {
    delete store[STORAGE_KEY]
  })

  it('saves a single override', () => {
    saveOverride('duplicate', 'Ctrl+Shift+D')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toEqual({ duplicate: 'Ctrl+Shift+D' })
  })

  it('adds to existing overrides', () => {
    saveOverride('copy', 'Ctrl+Alt+C')
    saveOverride('paste', 'Ctrl+Alt+V')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toEqual({
      copy: 'Ctrl+Alt+C',
      paste: 'Ctrl+Alt+V',
    })
  })

  it('overwrites existing override for same id', () => {
    saveOverride('duplicate', 'Ctrl+Shift+D')
    saveOverride('duplicate', 'Ctrl+Alt+D')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toEqual({ duplicate: 'Ctrl+Alt+D' })
  })
})

describe('resetOverride', () => {
  beforeEach(() => {
    delete store[STORAGE_KEY]
  })

  it('removes specific override', () => {
    saveOverride('copy', 'Ctrl+Alt+C')
    saveOverride('paste', 'Ctrl+Alt+V')
    resetOverride('copy')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toEqual({ paste: 'Ctrl+Alt+V' })
  })

  it('is idempotent when shortcut not in storage', () => {
    saveOverride('copy', 'Ctrl+Alt+C')
    resetOverride('paste') // doesn't exist
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toEqual({ copy: 'Ctrl+Alt+C' })
  })
})

describe('resetAll', () => {
  beforeEach(() => {
    delete store[STORAGE_KEY]
  })

  it('removes all overrides', () => {
    saveOverride('copy', 'Ctrl+Alt+C')
    saveOverride('paste', 'Ctrl+Alt+V')
    saveOverride('duplicate', 'Ctrl+Shift+D')
    resetAll()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('is idempotent when storage is already empty', () => {
    resetAll()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('detectConflict', () => {
  const makeShortcuts = (overrides = {}) =>
    [
      { id: 'copy', label: 'Copy', category: 'clipboard', defaultKey: 'Ctrl+C', scopes: ['canvas'], activeKey: overrides.copy || 'Ctrl+C' },
      { id: 'paste', label: 'Paste', category: 'clipboard', defaultKey: 'Ctrl+V', scopes: ['canvas'], activeKey: overrides.paste || 'Ctrl+V' },
      { id: 'duplicate', label: 'Duplicate', category: 'clipboard', defaultKey: 'Ctrl+D', scopes: ['canvas'], activeKey: overrides.duplicate || 'Ctrl+D' },
    ]

  it('returns false when no conflict', () => {
    const shortcuts = makeShortcuts()
    expect(detectConflict('copy', 'Ctrl+Alt+C', shortcuts)).toBe(false)
  })

  it('detects conflict with another shortcut', () => {
    const shortcuts = makeShortcuts({ paste: 'Ctrl+Alt+C' })
    expect(detectConflict('copy', 'Ctrl+Alt+C', shortcuts)).toBe(true)
  })

  it('ignores same shortcut (no self-conflict)', () => {
    const shortcuts = makeShortcuts({ copy: 'Ctrl+Alt+C' })
    expect(detectConflict('copy', 'Ctrl+Alt+C', shortcuts)).toBe(false)
  })

  it('detects conflict when shortcut would duplicate existing binding', () => {
    const shortcuts = makeShortcuts()
    // If user tries to set Ctrl+C for duplicate (which is already bound to copy)
    expect(detectConflict('duplicate', 'Ctrl+C', shortcuts)).toBe(true)
  })

  it('returns false when shortcut is already Ctrl+C for copy', () => {
    const shortcuts = makeShortcuts()
    expect(detectConflict('copy', 'Ctrl+C', shortcuts)).toBe(false)
  })
})
