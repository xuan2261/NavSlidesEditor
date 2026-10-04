import { describe, expect, it } from 'vitest'
import release from '../../shared/src/education/release-capabilities.js'
import { loadRequiredCells } from './education-release-policy.mjs'
const { cellKey, buildRequiredCells } = release
describe('canonical release requirements', () => {
  it('requires every canonical type, subtype, typed quiz and eligible live without runtime downgrade', async () => {
    const cells = await loadRequiredCells()
    expect(
      new Set(cells.filter((c) => !c.gameType && !c.presetId).map((c) => c.element)).size
    ).toBe(19)
    expect(new Set(cells.filter((c) => c.gameType).map((c) => c.gameType)).size).toBe(19)
    expect(
      new Set(
        cells
          .filter((c) => c.gameType === 'quiz' && c.surface === 'file')
          .map((c) => c.questionKind)
      ).size
    ).toBe(7)
    expect(cells.some((c) => c.gameType === 'jeopardy' && c.mode === 'live')).toBe(true)
    expect(cells.some((c) => c.gameType === 'memory' && c.mode === 'live')).toBe(false)
    expect(new Set(cells.map(cellKey)).size).toBe(cells.length)
  })
  it('refuses a narrowed registry rather than shrinking acceptance', () => {
    expect(() => buildRequiredCells({ elementDefaults: { text: {} } })).toThrow()
  })
})
