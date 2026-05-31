import { describe, it, expect } from 'vitest'
import { buildBaselineGapReport, renderBaselineGapMarkdown } from './baseline-gap-report.mjs'

describe('baseline gap report', () => {
  it('exports every gate-valid gap row with debt routing metadata', () => {
    const report = buildBaselineGapReport({
      generatedAt: '2026-05-31T00:00:00.000Z',
      matrix: {
        meta: { stale: false },
        summary: { total: 3, verified: 1, PASS: 1, ALLOWED: 1, TAGGED: 1 },
        rows: [
          { id: 'canvas.move', status: 'ALLOWED', risk: 'low', layer: null, tests: [] },
          { id: 'flow.autosave', status: 'ALLOWED', risk: 'high', layer: 'unit', tests: ['x.test.js'] },
          { id: 'flow.clipboard', status: 'PASS', risk: 'high', layer: 'unit', tests: ['y.test.js'] },
        ],
        orphans: [],
      },
      allowlist: {
        entries: [
          {
            id: 'canvas.move',
            reason: 'deferred',
            owner: 'qa',
            added: '2026-05-30',
            targetLayer: 'unit',
            resolutionPhase: 2,
            debtAllowedUntil: '2026-06-30',
          },
          {
            id: 'flow.autosave',
            reason: 'needs component coverage',
            owner: 'qa',
            added: '2026-05-30',
            targetLayer: 'component',
            resolutionPhase: 2,
            debtAllowedUntil: '2026-06-30',
          },
        ],
      },
    })

    expect(report.editorCoreBaselineTotal).toBe(3)
    expect(report.gaps.map((gap) => gap.capId)).toEqual([
      'canvas.move',
      'flow.autosave',
    ])
    expect(report.gaps.find((gap) => gap.capId === 'canvas.move')).toMatchObject({
      currentStatus: 'ALLOWED',
      targetLayer: 'unit',
      debtAllowedUntil: '2026-06-30',
    })
    expect(report.gaps.find((gap) => gap.capId === 'flow.autosave')).toMatchObject({
      currentStatus: 'ALLOWED',
      risk: 'P1',
      targetLayer: 'component',
    })
  })

  it('rejects stale matrix input before writing an authoritative baseline', () => {
    expect(() =>
      buildBaselineGapReport({
        generatedAt: '2026-05-31T00:00:00.000Z',
        matrix: { meta: { stale: true }, summary: { total: 1 }, rows: [], orphans: [] },
        allowlist: { entries: [] },
      })
    ).toThrow(/stale/)
  })

  it('rejects matrix gaps when allowlist metadata would fail the coverage gate', () => {
    expect(() =>
      buildBaselineGapReport({
        generatedAt: '2026-05-31T00:00:00.000Z',
        matrix: {
          meta: { stale: false },
          summary: { total: 1 },
          rows: [{ id: 'flow.autosave', status: 'ALLOWED', risk: 'high', layer: null, tests: [] }],
          orphans: [],
        },
        allowlist: { entries: [{ id: 'flow.autosave', reason: 'missing metadata', added: '2026-05-30' }] },
      })
    ).toThrow(/coverage gate failed/)
  })

  it('rejects orphan tags because the coverage gate must be fixed first', () => {
    expect(() =>
      buildBaselineGapReport({
        generatedAt: '2026-05-31T00:00:00.000Z',
        matrix: { meta: { stale: false }, summary: { total: 1 }, rows: [], orphans: ['element.unknown'] },
        allowlist: { entries: [] },
      })
    ).toThrow(/ORPHAN-TAG/)
  })

  it('renders a concise markdown summary from the JSON report', () => {
    const markdown = renderBaselineGapMarkdown({
      generatedAt: '2026-05-31T00:00:00.000Z',
      editorCoreBaselineTotal: 1,
      summary: { verified: 0 },
      gaps: [
        {
          capId: 'flow.autosave',
          currentStatus: 'ALLOWED',
          risk: 'P1',
          targetLayer: 'component',
          blockingReason: 'deferred',
          debtAllowedUntil: '2026-06-30',
        },
      ],
    })

    expect(markdown).toContain('# Baseline Gap Report')
    expect(markdown).toContain('| flow.autosave | ALLOWED | P1 | component | deferred | 2026-06-30 |')
  })
})
