/** Bounded, server-owned PPTX import report (presentation projection metadata). */

const MAX_DIAGNOSTICS = 100
const MAX_SERIALIZED_BYTES = 64 * 1024
const MAX_MESSAGE_LENGTH = 240
const STAT_DIGEST_KEYS = Object.freeze([
  'slideCount',
  'textCount',
  'imageCount',
  'shapeCount',
  'tableCount',
  'chartCount',
  'diagramCount',
  'placeholderCount',
  'sceneGraphMappedNodes',
  'sceneGraphUnmapped',
])

function finiteCount(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

function sanitizeMessage(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH)
}

function toDiagnostic(warning) {
  const type = String(warning?.type || 'unknown') || 'unknown'
  const diagnostic = { type, message: sanitizeMessage(warning?.message || warning?.error || type) }
  if (Number.isFinite(Number(warning?.slideIndex))) {
    diagnostic.slideIndex = Math.floor(Number(warning.slideIndex))
  }
  return diagnostic
}

function buildByType(warnings) {
  const byType = {}
  for (const warning of warnings) {
    const type = String(warning?.type || 'unknown') || 'unknown'
    byType[type] = (byType[type] || 0) + 1
  }
  return byType
}

function buildStatsDigest(stats) {
  if (!stats || typeof stats !== 'object') return undefined
  const digest = {}
  for (const key of STAT_DIGEST_KEYS) {
    if (Number.isFinite(Number(stats[key]))) digest[key] = Number(stats[key])
  }
  return Object.keys(digest).length ? digest : undefined
}

function unsupportedFeatureCount(byType) {
  let count = 0
  for (const [type, n] of Object.entries(byType)) {
    if (/unsupported|unknown-object|grouped-complex|placeholder/i.test(type)) count += n
  }
  return count
}

function serializedBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

function fitByteBudget(report, fullWarningCount) {
  while (serializedBytes(report) > MAX_SERIALIZED_BYTES && report.diagnostics.length) {
    report.diagnostics.pop()
    report.summary.omittedCount = Math.max(0, fullWarningCount - report.diagnostics.length)
  }
  if (serializedBytes(report) > MAX_SERIALIZED_BYTES && report.statsDigest) {
    delete report.statsDigest
  }
  if (serializedBytes(report) > MAX_SERIALIZED_BYTES) {
    report.diagnostics = []
    report.summary.omittedCount = fullWarningCount
  }
  return report
}

/**
 * Build a presentation-owned import report with hard caps on diagnostics count
 * and serialized size. byType reflects stored warnings; accumulateOmittedCount
 * (mid-map budget drops) is folded into warningCount + omittedCount.
 */
function buildBoundedImportReport(warnings, stats, { jobId, createdAt, accumulateOmittedCount = 0 } = {}) {
  const list = Array.isArray(warnings) ? warnings : []
  const accumulateOmitted = finiteCount(
    accumulateOmittedCount !== undefined && accumulateOmittedCount !== null
      ? accumulateOmittedCount
      : warnings?.omittedCount
  )
  const byType = buildByType(list)
  if (accumulateOmitted > 0) {
    byType['budget-omitted'] = (byType['budget-omitted'] || 0) + accumulateOmitted
  }
  const diagnostics = list.slice(0, MAX_DIAGNOSTICS).map(toDiagnostic)
  const durableOmitted = Math.max(0, list.length - diagnostics.length)
  const fullCount = list.length + accumulateOmitted
  const report = {
    schemaVersion: 1,
    ...(typeof jobId === 'string' && jobId ? { jobId } : {}),
    createdAt: typeof createdAt === 'string' && createdAt ? createdAt : new Date().toISOString(),
    summary: {
      warningCount: fullCount,
      byType,
      unsupportedFeatureCount: unsupportedFeatureCount(byType),
      omittedCount: durableOmitted + accumulateOmitted,
    },
    diagnostics,
  }
  const statsDigest = buildStatsDigest(stats)
  if (statsDigest) report.statsDigest = statsDigest
  const fitted = fitByteBudget(report, fullCount)
  // Preserve accumulate-time omissions after durable byte/count fit.
  fitted.summary.omittedCount = Math.max(
    0,
    fullCount - fitted.diagnostics.length
  )
  fitted.summary.warningCount = fullCount
  return fitted
}

function toReportSummary(report) {
  if (!report || typeof report !== 'object') return null
  const summary = report.summary && typeof report.summary === 'object' ? report.summary : null
  if (!summary) return null
  const byType = summary.byType && typeof summary.byType === 'object' && !Array.isArray(summary.byType)
    ? Object.fromEntries(
      Object.entries(summary.byType)
        .filter(([, count]) => Number.isFinite(Number(count)))
        .map(([type, count]) => [String(type), finiteCount(count)])
    )
    : {}
  const result = {
    schemaVersion: 1,
    warningCount: finiteCount(summary.warningCount),
    byType,
    unsupportedFeatureCount: finiteCount(summary.unsupportedFeatureCount),
    omittedCount: finiteCount(summary.omittedCount),
  }
  const statsDigest = buildStatsDigest(report.statsDigest || summary.statsDigest)
  if (statsDigest) result.statsDigest = statsDigest
  return result
}

/**
 * Re-validate/bound a stored or untrusted report for DTO exposure.
 * Returns null when the value is not a usable report object.
 */
function sanitizeImportReport(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const diagnosticsInput = Array.isArray(value.diagnostics) ? value.diagnostics : []
  const summaryInput = value.summary && typeof value.summary === 'object' ? value.summary : {}
  const byType = summaryInput.byType && typeof summaryInput.byType === 'object' && !Array.isArray(summaryInput.byType)
    ? Object.fromEntries(
      Object.entries(summaryInput.byType)
        .filter(([, count]) => Number.isFinite(Number(count)))
        .map(([type, count]) => [String(type), finiteCount(count)])
    )
    : buildByType(diagnosticsInput)
  const warningCount = finiteCount(
    summaryInput.warningCount !== undefined ? summaryInput.warningCount : diagnosticsInput.length
  )
  const diagnostics = diagnosticsInput.slice(0, MAX_DIAGNOSTICS).map(toDiagnostic)
  const report = {
    schemaVersion: 1,
    ...(typeof value.jobId === 'string' && value.jobId ? { jobId: value.jobId } : {}),
    createdAt: typeof value.createdAt === 'string' && value.createdAt
      ? value.createdAt
      : new Date().toISOString(),
    summary: {
      warningCount,
      byType,
      unsupportedFeatureCount: finiteCount(
        summaryInput.unsupportedFeatureCount !== undefined
          ? summaryInput.unsupportedFeatureCount
          : unsupportedFeatureCount(byType)
      ),
      omittedCount: Math.max(
        0,
        finiteCount(summaryInput.omittedCount !== undefined
          ? summaryInput.omittedCount
          : warningCount - diagnostics.length)
      ),
    },
    diagnostics,
  }
  const statsDigest = buildStatsDigest(value.statsDigest)
  if (statsDigest) report.statsDigest = statsDigest
  // Prefer summary.omittedCount derived from cap after fit
  const fitted = fitByteBudget(report, warningCount)
  fitted.summary.omittedCount = Math.max(0, warningCount - fitted.diagnostics.length)
  return fitted
}

module.exports = {
  MAX_DIAGNOSTICS,
  MAX_SERIALIZED_BYTES,
  buildBoundedImportReport,
  sanitizeImportReport,
  toReportSummary,
}
