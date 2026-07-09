import { describe, expect, it } from 'vitest'
import {
  assertNoPrimitivePlaceholders,
  countPrimitivePlaceholders,
  PRIMITIVE_PLACEHOLDER_TYPES,
} from '../acceptance-criteria.js'

describe('Phase 04 primitive placeholder ban', () => {
  it('lists table-unusable among banned types', () => {
    expect(PRIMITIVE_PLACEHOLDER_TYPES).toContain('table-unusable')
    expect(PRIMITIVE_PLACEHOLDER_TYPES).toContain('unknown-object')
    expect(PRIMITIVE_PLACEHOLDER_TYPES).toContain('media-missing')
  })

  it('counts and rejects banned placeholders', () => {
    const presentation = {
      slides: [
        {
          elements: [
            { type: 'shape', importPlaceholderType: 'table-unusable' },
            { type: 'chart', chartType: 'bar' },
            { type: 'shape', importPlaceholderType: 'chart-unsupported' },
          ],
        },
      ],
    }
    const hits = countPrimitivePlaceholders(presentation)
    expect(hits).toHaveLength(1)
    expect(hits[0].type).toBe('table-unusable')
    expect(() => assertNoPrimitivePlaceholders(presentation)).toThrow(/table-unusable/)
  })

  it('allows clean primitive decks', () => {
    expect(() =>
      assertNoPrimitivePlaceholders({
        slides: [
          {
            elements: [
              { type: 'text', content: '<p>Hi</p>' },
              { type: 'shape', shape: 'rect' },
              { type: 'table', rows: 2, cols: 2 },
            ],
          },
        ],
      })
    ).not.toThrow()
  })
})
