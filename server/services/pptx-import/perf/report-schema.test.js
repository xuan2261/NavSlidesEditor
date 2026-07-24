import { describe, expect, it } from 'vitest'
import schema from './report-schema.js'

const {
  REPORT_SCHEMA_VERSION,
  SKIP_REASONS,
  assertValidPerfReport,
  createPerfReport,
  createSkippedReport,
} = schema

describe('perf report schema (P3)', () => {
  it('accepts skipped ladder report with structured reason', () => {
    const report = createSkippedReport({
      reason: SKIP_REASONS.ENV,
      mode: 'full',
      detail: 'Set PPTX_PERF=1 to run heavy ladder',
    })
    expect(assertValidPerfReport(report)).toMatchObject({
      schemaVersion: REPORT_SCHEMA_VERSION,
      skipped: true,
      reason: SKIP_REASONS.ENV,
    })
  })

  it('accepts tiny completed report shape', () => {
    const report = createPerfReport({
      mode: 'tiny',
      runs: [
        {
          id: 'tiny-baseline',
          dimension: 'tiny',
          ok: true,
          wallMs: 12,
          stages: { parse: { durationMs: 5 }, map: { durationMs: 7 } },
        },
      ],
      wallSummary: { count: 1, p50: 12, p95: 12, min: 12, max: 12 },
      archiveReuse: {
        status: 'deferred',
        residualCost: 'double-decompress validate + loadPptxArchive',
      },
    })
    expect(assertValidPerfReport(report).skipped).toBe(false)
    expect(report.runs).toHaveLength(1)
  })

  it('rejects missing reason on skipped reports', () => {
    expect(() => createSkippedReport({ reason: '' })).toThrow(/reason/)
    expect(() =>
      assertValidPerfReport({ schemaVersion: REPORT_SCHEMA_VERSION, skipped: true })
    ).toThrow(/reason/)
  })
})
