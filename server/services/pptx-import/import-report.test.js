import { describe, expect, it } from 'vitest'
import {
  MAX_DIAGNOSTICS,
  MAX_SERIALIZED_BYTES,
  buildBoundedImportReport,
  sanitizeImportReport,
  toReportSummary,
} from './import-report.js'

function makeWarnings(count, { message = 'warn', typePrefix = 'type' } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    type: `${typePrefix}-${i % 7}`,
    message: `${message}-${i}`,
    slideIndex: i % 3,
  }))
}

describe('buildBoundedImportReport', () => {
  it('caps diagnostics at 100 and sets omittedCount (R1)', () => {
    const warnings = makeWarnings(200)
    const report = buildBoundedImportReport(warnings, { slideCount: 4 }, {
      jobId: 'job-1',
      createdAt: '2026-07-24T00:00:00.000Z',
    })

    expect(report.schemaVersion).toBe(1)
    expect(report.jobId).toBe('job-1')
    expect(report.createdAt).toBe('2026-07-24T00:00:00.000Z')
    expect(report.diagnostics.length).toBeLessThanOrEqual(MAX_DIAGNOSTICS)
    expect(report.diagnostics.length).toBe(100)
    expect(report.summary.warningCount).toBe(200)
    expect(report.summary.omittedCount).toBe(100)
    expect(report.statsDigest).toMatchObject({ slideCount: 4 })
  })

  it('keeps serialized size under 64 KiB with oversized messages (R2)', () => {
    const huge = 'x'.repeat(8 * 1024)
    const warnings = Array.from({ length: 200 }, (_, i) => ({
      type: `big-${i % 5}`,
      message: `${huge}-${i}`,
    }))
    const report = buildBoundedImportReport(warnings, { slideCount: 1 }, { jobId: 'j' })
    const bytes = Buffer.byteLength(JSON.stringify(report), 'utf8')
    expect(bytes).toBeLessThanOrEqual(MAX_SERIALIZED_BYTES)
    expect(report.summary.omittedCount).toBeGreaterThan(0)
    expect(report.summary.warningCount).toBe(200)
  })

  it('keeps byType complete when diagnostics are capped (R3)', () => {
    const warnings = [
      ...makeWarnings(80, { typePrefix: 'alpha' }),
      ...makeWarnings(80, { typePrefix: 'beta' }),
      ...makeWarnings(40, { typePrefix: 'gamma' }),
    ]
    const report = buildBoundedImportReport(warnings, {}, { jobId: 'j' })
    const expectedTypes = new Set(warnings.map((w) => w.type))
    expect(Object.keys(report.summary.byType).sort()).toEqual([...expectedTypes].sort())
    const totalByType = Object.values(report.summary.byType).reduce((a, b) => a + b, 0)
    expect(totalByType).toBe(200)
    expect(report.diagnostics.length).toBeLessThanOrEqual(MAX_DIAGNOSTICS)
  })

  it('returns empty diagnostics and zero counts for empty warnings (R6)', () => {
    const report = buildBoundedImportReport([], { slideCount: 2 }, { jobId: 'empty' })
    expect(report.summary).toMatchObject({
      warningCount: 0,
      byType: {},
      omittedCount: 0,
    })
    expect(report.diagnostics).toEqual([])
    expect(report.statsDigest).toMatchObject({ slideCount: 2 })
  })

  it('folds accumulate-time omittedCount into warning honesty totals', () => {
    const warnings = makeWarnings(50)
    const report = buildBoundedImportReport(warnings, {}, {
      jobId: 'acc',
      accumulateOmittedCount: 9500,
    })
    expect(report.summary.warningCount).toBe(9550)
    expect(report.summary.omittedCount).toBeGreaterThanOrEqual(9500)
    expect(report.summary.byType['budget-omitted']).toBe(9500)
    expect(report.diagnostics.length).toBeLessThanOrEqual(MAX_DIAGNOSTICS)
  })

  it('toReportSummary is thin and excludes diagnostics', () => {
    const report = buildBoundedImportReport(makeWarnings(5), { slideCount: 1 }, { jobId: 'j' })
    const summary = toReportSummary(report)
    expect(summary).toMatchObject({
      schemaVersion: 1,
      warningCount: 5,
      omittedCount: 0,
    })
    expect(summary.byType).toEqual(report.summary.byType)
    expect(summary).not.toHaveProperty('diagnostics')
    expect(summary.statsDigest).toMatchObject({ slideCount: 1 })
  })
})

describe('sanitizeImportReport', () => {
  it('re-bounds a valid report and rejects non-objects', () => {
    expect(sanitizeImportReport(null)).toBeNull()
    expect(sanitizeImportReport('x')).toBeNull()
    const report = buildBoundedImportReport(makeWarnings(3), { slideCount: 1 }, { jobId: 'j' })
    const sanitized = sanitizeImportReport(report)
    expect(sanitized).toMatchObject({
      schemaVersion: 1,
      jobId: 'j',
      summary: { warningCount: 3, omittedCount: 0 },
    })
    expect(sanitized.diagnostics).toHaveLength(3)
  })

  it('caps injected oversized diagnostics arrays', () => {
    const malicious = {
      schemaVersion: 1,
      jobId: 'evil',
      createdAt: '2026-01-01T00:00:00.000Z',
      summary: {
        warningCount: 500,
        byType: { flood: 500 },
        unsupportedFeatureCount: 0,
        omittedCount: 0,
      },
      diagnostics: makeWarnings(500),
    }
    const sanitized = sanitizeImportReport(malicious)
    expect(sanitized.diagnostics.length).toBeLessThanOrEqual(MAX_DIAGNOSTICS)
    expect(Buffer.byteLength(JSON.stringify(sanitized), 'utf8')).toBeLessThanOrEqual(MAX_SERIALIZED_BYTES)
  })
})
