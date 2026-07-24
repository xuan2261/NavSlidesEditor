/**
 * Stable JSON schema for PPTX import perf matrix reports.
 * Heavy ladder may emit { skipped: true, reason } instead of failing the shell.
 */

const REPORT_SCHEMA_VERSION = 1
const SKIP_REASONS = Object.freeze({
  RESOURCE: 'SKIPPED_RESOURCE',
  ENV: 'SKIPPED_ENV',
  MODE: 'SKIPPED_MODE',
})

function createSkippedReport({ reason, mode = 'full', detail = null } = {}) {
  if (!reason || typeof reason !== 'string') {
    throw new TypeError('skipped report requires reason string')
  }
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    skipped: true,
    reason,
    mode,
    detail,
    generatedAt: new Date().toISOString(),
  }
}

function createPerfReport({
  mode = 'tiny',
  runs = [],
  wallSummary = null,
  stageSummaries = null,
  archiveReuse = null,
  doublePass = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    skipped: false,
    mode,
    generatedAt,
    runs,
    summary: {
      wall: wallSummary,
      stages: stageSummaries,
    },
    doublePass,
    archiveReuse,
  }
}

function assertValidPerfReport(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('perf report must be an object')
  }
  if (report.schemaVersion !== REPORT_SCHEMA_VERSION) {
    throw new Error(`unsupported schemaVersion: ${report.schemaVersion}`)
  }
  if (typeof report.skipped !== 'boolean') {
    throw new Error('perf report.skipped must be boolean')
  }
  if (report.skipped) {
    if (typeof report.reason !== 'string' || !report.reason) {
      throw new Error('skipped report requires non-empty reason')
    }
    return report
  }
  if (!Array.isArray(report.runs)) {
    throw new Error('perf report.runs must be an array')
  }
  if (!report.summary || typeof report.summary !== 'object') {
    throw new Error('perf report.summary must be an object')
  }
  return report
}

module.exports = {
  REPORT_SCHEMA_VERSION,
  SKIP_REASONS,
  assertValidPerfReport,
  createPerfReport,
  createSkippedReport,
}
