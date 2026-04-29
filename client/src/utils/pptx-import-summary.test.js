import { describe, expect, it } from 'vitest'
import { summarizePptxImportWarnings } from './pptx-import-summary'

describe('summarizePptxImportWarnings', () => {
  it('returns null when there are no warnings or placeholders', () => {
    expect(summarizePptxImportWarnings({ warnings: [], stats: {} })).toBeNull()
  })

  it('summarizes placeholders, unsupported types, and failed media', () => {
    const summary = summarizePptxImportWarnings({
      warnings: [
        { type: 'grouped-complex' },
        { type: 'media-missing' },
        { type: 'media-missing' },
        { type: 'fallback-inspector' },
      ],
      stats: { placeholderCount: 3 },
    })
    expect(summary).toContain('PPTX import fidelity:')
    expect(summary).toContain('approximated 1')
    expect(summary).toContain('failed 2')
    expect(summary).toContain('Placeholders: 3')
    expect(summary).toContain('grouped-complex')
    expect(summary).toContain('Failed warnings: 2')
  })
})
