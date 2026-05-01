/**
 * Unit tests for shortcut-registry.js
 *
 * Test strategy:
 * - Test DEFAULT_SHORTCUTS structure and completeness
 * - Test getShortcuts() override merging
 * - Test shortcut lookup by id and key
 * - Test conflict detection
 * - No React context needed — pure functions
 */
import { describe, it, expect } from 'vitest'
import { DEFAULT_SHORTCUTS, getShortcuts, getShortcutById, getShortcutByKey } from './default-keyboard-shortcut-definitions-registry'

describe('DEFAULT_SHORTCUTS', () => {
  it('has required clipboard shortcuts', () => {
    const ids = DEFAULT_SHORTCUTS.map((s) => s.id)
    expect(ids).toContain('copy')
    expect(ids).toContain('cut')
    expect(ids).toContain('paste')
    expect(ids).toContain('duplicate')
    expect(ids).toContain('delete')
  })

  it('has required navigation shortcuts', () => {
    const ids = DEFAULT_SHORTCUTS.map((s) => s.id)
    expect(ids).toContain('undo')
    expect(ids).toContain('redo')
    expect(ids).toContain('selectAll')
    expect(ids).toContain('escape')
  })

  it('has required view shortcuts', () => {
    const ids = DEFAULT_SHORTCUTS.map((s) => s.id)
    expect(ids).toContain('toggleFindReplace')
  })

  it('has required properties on each shortcut', () => {
    for (const shortcut of DEFAULT_SHORTCUTS) {
      expect(shortcut).toHaveProperty('id')
      expect(shortcut).toHaveProperty('label')
      expect(shortcut).toHaveProperty('category')
      expect(shortcut).toHaveProperty('defaultKey')
      expect(shortcut).toHaveProperty('scopes')
      expect(typeof shortcut.id).toBe('string')
      expect(typeof shortcut.label).toBe('string')
      expect(typeof shortcut.category).toBe('string')
      expect(typeof shortcut.defaultKey).toBe('string')
      expect(Array.isArray(shortcut.scopes)).toBe(true)
    }
  })

  it('has unique ids', () => {
    const ids = DEFAULT_SHORTCUTS.map((s) => s.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('has valid categories', () => {
    const valid = ['annotation', 'clipboard', 'editing', 'game', 'navigation', 'slideshow', 'view']
    for (const shortcut of DEFAULT_SHORTCUTS) {
      expect(valid).toContain(shortcut.category)
    }
  })

  it('maps copy to Ctrl+C', () => {
    const copy = DEFAULT_SHORTCUTS.find((s) => s.id === 'copy')
    expect(copy.defaultKey).toBe('Ctrl+C')
  })

  it('maps paste to Ctrl+V', () => {
    const paste = DEFAULT_SHORTCUTS.find((s) => s.id === 'paste')
    expect(paste.defaultKey).toBe('Ctrl+V')
  })

  it('maps undo to Ctrl+Z', () => {
    const undo = DEFAULT_SHORTCUTS.find((s) => s.id === 'undo')
    expect(undo.defaultKey).toBe('Ctrl+Z')
  })

  it('maps redo to Ctrl+Y', () => {
    const redo = DEFAULT_SHORTCUTS.find((s) => s.id === 'redo')
    expect(redo.defaultKey).toBe('Ctrl+Y')
  })

  it('maps duplicate to Ctrl+D', () => {
    const duplicate = DEFAULT_SHORTCUTS.find((s) => s.id === 'duplicate')
    expect(duplicate.defaultKey).toBe('Ctrl+D')
  })

  it('maps toggleFindReplace to Ctrl+F', () => {
    const find = DEFAULT_SHORTCUTS.find((s) => s.id === 'toggleFindReplace')
    expect(find.defaultKey).toBe('Ctrl+F')
  })

  it('maps escape to Escape', () => {
    const esc = DEFAULT_SHORTCUTS.find((s) => s.id === 'escape')
    expect(esc.defaultKey).toBe('Escape')
  })

  it('maps delete to Delete', () => {
    const del = DEFAULT_SHORTCUTS.find((s) => s.id === 'delete')
    expect(del.defaultKey).toBe('Delete')
  })
})

describe('getShortcuts', () => {
  it('returns all shortcuts with defaultKey when no overrides', () => {
    const shortcuts = getShortcuts({})
    expect(shortcuts).toHaveLength(DEFAULT_SHORTCUTS.length)
    for (const shortcut of shortcuts) {
      expect(shortcut.activeKey).toBe(shortcut.defaultKey)
    }
  })

  it('applies single override', () => {
    const shortcuts = getShortcuts({ duplicate: 'Ctrl+Shift+D' })
    const duplicate = shortcuts.find((s) => s.id === 'duplicate')
    expect(duplicate.activeKey).toBe('Ctrl+Shift+D')
  })

  it('applies multiple overrides', () => {
    const shortcuts = getShortcuts({
      copy: 'Ctrl+Alt+C',
      paste: 'Ctrl+Alt+V',
    })
    expect(shortcuts.find((s) => s.id === 'copy').activeKey).toBe('Ctrl+Alt+C')
    expect(shortcuts.find((s) => s.id === 'paste').activeKey).toBe('Ctrl+Alt+V')
  })

  it('does not affect other shortcuts when one is overridden', () => {
    const shortcuts = getShortcuts({ copy: 'Ctrl+Alt+C' })
    expect(shortcuts.find((s) => s.id === 'paste').activeKey).toBe('Ctrl+V')
  })

  it('returns shortcuts with all original properties', () => {
    const shortcuts = getShortcuts({})
    const copy = shortcuts.find((s) => s.id === 'copy')
    expect(copy.id).toBe('copy')
    expect(copy.label).toBe('Copy')
    expect(copy.category).toBe('clipboard')
    expect(copy.scopes).toContain('canvas')
  })

  it('overrides unknown shortcut id is safely ignored', () => {
    const shortcuts = getShortcuts({ unknownCommand: 'Ctrl+U' })
    expect(shortcuts).toHaveLength(DEFAULT_SHORTCUTS.length)
  })
})

describe('getShortcutById', () => {
  it('returns shortcut by id', () => {
    const shortcut = getShortcutById('copy')
    expect(shortcut).toBeDefined()
    expect(shortcut.id).toBe('copy')
  })

  it('returns null for unknown id', () => {
    expect(getShortcutById('unknown')).toBeNull()
  })
})

describe('getShortcutByKey', () => {
  it('returns shortcut by activeKey', () => {
    const shortcut = getShortcutByKey('Ctrl+C')
    expect(shortcut).toBeDefined()
    expect(shortcut.id).toBe('copy')
  })

  it('returns shortcut by overridden activeKey', () => {
    const shortcuts = getShortcuts({ copy: 'Ctrl+Alt+C' })
    const shortcut = getShortcutByKey('Ctrl+Alt+C', shortcuts)
    expect(shortcut).toBeDefined()
    expect(shortcut.id).toBe('copy')
  })

  it('returns null for unknown key', () => {
    expect(getShortcutByKey('Ctrl+Unknown')).toBeNull()
  })
})
