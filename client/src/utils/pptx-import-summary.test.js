import { describe, expect, it } from 'vitest'
import { summarizePptxImportWarnings } from './pptx-import-summary'

describe('summarizePptxImportWarnings', () => {
  it('returns null when there are no warnings or placeholders', () => {
    expect(summarizePptxImportWarnings({ warnings: [], stats: {} })).toBeNull()
  })

  it('reports authoritative import stats and grouped warning categories', () => {
    const summary = summarizePptxImportWarnings({
      warnings: [
        { type: 'grouped-complex' },
        { type: 'media-missing' },
        { type: 'media-ref-missing' },
        { type: 'fallback-inspector' },
        { type: 'future-warning' },
        { type: 'future-warning' },
      ],
      stats: { slideCount: 2, textCount: 5, shapeCount: 3, placeholderCount: 3 },
    })
    expect(summary).toContain('Import stats: slides 2, text 5, shapes 3, placeholders 3.')
    expect(summary).toContain('Warning groups: approximated 1, placeholder 1, failed 2, other 2.')
    expect(summary).toContain('future-warning (2)')
    expect(summary).not.toContain('exact')
    expect(summary).not.toContain('approximated 3')
  })
})
