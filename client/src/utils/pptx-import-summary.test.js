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
        { type: 'future-warning' },
        { type: 'future-warning' },
      ],
      stats: { slideCount: 2, textCount: 5, shapeCount: 3, placeholderCount: 3 },
    })
    expect(summary).toContain('Import stats: slides 2, text 5, shapes 3, placeholders 3.')
    expect(summary).toContain('Warning groups: approximated 0, placeholder 1, failed 2, other 2.')
    expect(summary).toContain('future-warning (2)')
    expect(summary).not.toContain('exact')
  })

  it('does not reserve an approximated warning category for removed fallback inspection', () => {
    const summary = summarizePptxImportWarnings({
      warnings: [{ type: 'fallback-inspector' }],
      stats: {},
    })

    expect(summary).toContain('Warning groups: approximated 0, placeholder 0, failed 0, other 1.')
  })

  it('prefers durable reportSummary with caps and omittedCount', () => {
    const summary = summarizePptxImportWarnings({
      presentationId: 'pres-1',
      reportSummary: {
        schemaVersion: 1,
        warningCount: 120,
        byType: { 'media-missing': 100, 'geometry-clamped': 20 },
        unsupportedFeatureCount: 0,
        omittedCount: 20,
        statsDigest: { slideCount: 4, shapeCount: 12 },
      },
    })
    expect(summary).toContain('Import stats: slides 4, shapes 12.')
    expect(summary).toContain('warnings 120')
    expect(summary).toContain('omitted 20')
    expect(summary).toContain('media-missing (100)')
    expect(summary).toContain('geometry-clamped (20)')
  })

  it('falls back to presentation _pptxImportReport after job result is lost', () => {
    const summary = summarizePptxImportWarnings({
      _pptxImportReport: {
        schemaVersion: 1,
        jobId: 'job-1',
        summary: {
          warningCount: 5,
          byType: { 'grouped-complex': 5 },
          unsupportedFeatureCount: 0,
          omittedCount: 0,
        },
        diagnostics: [],
        statsDigest: { slideCount: 1 },
      },
    })
    expect(summary).toContain('warnings 5')
    expect(summary).toContain('grouped-complex (5)')
    expect(summary).toContain('omitted 0')
  })
})
