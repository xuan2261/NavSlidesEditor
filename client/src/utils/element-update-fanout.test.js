import { describe, expect, it } from 'vitest'
import { buildSelectionUpdates } from './element-update-fanout'

describe('buildSelectionUpdates', () => {
  it('fans common element controls even when the field is absent from the element', () => {
    const elements = [
      { id: 'a', type: 'shape', x: 10, y: 20, width: 100, height: 80 },
      { id: 'b', type: 'image', x: 30, y: 40, width: 120, height: 90 },
    ]

    expect(
      buildSelectionUpdates(elements, ['a', 'b'], 'a', {
        locked: true,
        shadowX: 6,
        shadowY: 8,
        shadowBlur: 12,
        shadowColor: '#112233',
      })
    ).toEqual([
      { id: 'a', locked: true, shadowX: 6, shadowY: 8, shadowBlur: 12, shadowColor: '#112233' },
      { id: 'b', locked: true, shadowX: 6, shadowY: 8, shadowBlur: 12, shadowColor: '#112233' },
    ])
  })

  it('does not fan shadow controls to element types whose single-select panel hides shadow', () => {
    const elements = [
      { id: 'shape-1', type: 'shape', x: 10, y: 20, width: 100, height: 80 },
      { id: 'html-1', type: 'html', x: 30, y: 40, width: 120, height: 90 },
      { id: 'code-1', type: 'code', x: 50, y: 60, width: 140, height: 100 },
    ]

    expect(
      buildSelectionUpdates(elements, ['shape-1', 'html-1', 'code-1'], 'shape-1', {
        locked: true,
        shadowX: 6,
        shadowY: 8,
        shadowBlur: 12,
        shadowColor: '#112233',
      })
    ).toEqual([
      { id: 'shape-1', locked: true, shadowX: 6, shadowY: 8, shadowBlur: 12, shadowColor: '#112233' },
      { id: 'html-1', locked: true },
      { id: 'code-1', locked: true },
    ])
  })
})
