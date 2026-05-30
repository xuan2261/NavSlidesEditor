import { describe, it, expect, beforeAll } from 'vitest'
import { buildInventory } from './build-inventory.mjs'
import { ELEMENT_DEFAULTS } from '../../client/src/data/element-defaults.js'

describe('feature inventory generator', () => {
  let inv
  beforeAll(async () => {
    inv = await buildInventory()
  })

  it('returns an array of capabilities', () => {
    expect(Array.isArray(inv)).toBe(true)
    expect(inv.length).toBeGreaterThan(0)
  })

  it('auto-sources element.chart and element.timeline from ELEMENT_DEFAULTS', () => {
    const ids = inv.map((e) => e.id)
    expect(ids).toContain('element.chart')
    expect(ids).toContain('element.timeline')
  })

  it('element.* count equals Object.keys(ELEMENT_DEFAULTS).length', () => {
    const elementCount = inv.filter((e) => e.category === 'element').length
    expect(elementCount).toBe(Object.keys(ELEMENT_DEFAULTS).length)
  })

  it('every capability carries id/category/source/risk/tiers/scope', () => {
    for (const e of inv) {
      expect(e).toHaveProperty('id')
      expect(e).toHaveProperty('category')
      expect(e).toHaveProperty('source')
      expect(e).toHaveProperty('risk')
      expect(Array.isArray(e.tiers)).toBe(true)
      expect(e).toHaveProperty('scope')
    }
  })

  it('auto-sources all 44 shortcut.* including shortcut.group', () => {
    const shortcuts = inv.filter((e) => e.category === 'shortcut')
    expect(shortcuts.length).toBe(44)
    expect(shortcuts.map((s) => s.id)).toContain('shortcut.group')
  })

  it('marks element.game as out-of-editor-core scope', () => {
    const game = inv.find((e) => e.id === 'element.game')
    expect(game).toBeTruthy()
    expect(game.scope).toBe('game')
  })

  it('includes manifest canvas.rotate-snap as high-risk smoke+deep', () => {
    const cap = inv.find((e) => e.id === 'canvas.rotate-snap')
    expect(cap).toBeTruthy()
    expect(cap.risk).toBe('high')
    expect(cap.tiers).toEqual(expect.arrayContaining(['smoke', 'deep']))
    expect(cap.source).toBe('manifest')
  })

  it('includes manifest control.format.bold', () => {
    expect(inv.map((e) => e.id)).toContain('control.format.bold')
  })

  it('includes the 9 EditorPage commands incl. command.insertSlide', () => {
    const commands = inv.filter((e) => e.category === 'command')
    expect(commands.length).toBe(9)
    expect(commands.map((c) => c.id)).toContain('command.insertSlide')
  })

  it('high-risk element.table/chart/timeline carry tier:deep', () => {
    for (const id of ['element.table', 'element.chart', 'element.timeline']) {
      const cap = inv.find((e) => e.id === id)
      expect(cap.risk).toBe('high')
      expect(cap.tiers).toContain('deep')
    }
  })

  it('is deterministically sorted by id', () => {
    const ids = inv.map((e) => e.id)
    const sorted = [...ids].sort((a, b) => a.localeCompare(b))
    expect(ids).toEqual(sorted)
  })

  it('has no duplicate ids', () => {
    const ids = inv.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
