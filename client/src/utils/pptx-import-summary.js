const STAT_FIELDS = [
  ['slideCount', 'slides'],
  ['textCount', 'text'],
  ['imageCount', 'images'],
  ['shapeCount', 'shapes'],
  ['tableCount', 'tables'],
  ['chartCount', 'charts'],
  ['diagramCount', 'diagrams'],
  ['placeholderCount', 'placeholders'],
]

const FAILED_TYPES = new Set([
  'media-missing',
  'media-ref-missing',
  'parse-failed',
  'import-failed',
  'schema-unusable',
])
const PLACEHOLDER_TYPES = new Set([
  'grouped-complex',
  'table-unusable',
  'chart-unsupported',
  'unknown-object',
  'diagram-empty',
])
const APPROXIMATED_TYPES = new Set([
  'geometry-clamped',
  'crop-converted',
  'line-endpoint-normalized',
  'group-transform-normalized',
  'diagram-truncated',
])

function formatStatSummary(stats) {
  if (!stats || typeof stats !== 'object') return ''
  return STAT_FIELDS
    .filter(([key]) => Number.isFinite(Number(stats[key])))
    .map(([key, label]) => `${label} ${Number(stats[key])}`)
    .join(', ')
}

function formatByType(byType) {
  if (!byType || typeof byType !== 'object') return ''
  return Object.entries(byType)
    .map(([type, count]) => `${type} (${count})`)
    .join(', ')
}

function summarizeFromReportShape(reportLike) {
  const summary = reportLike?.summary && typeof reportLike.summary === 'object'
    ? reportLike.summary
    : reportLike
  if (!summary || typeof summary !== 'object') return null
  const warningCount = Number(summary.warningCount)
  const byType = summary.byType && typeof summary.byType === 'object' ? summary.byType : null
  const omittedCount = Number(summary.omittedCount)
  const statsDigest = reportLike?.statsDigest || summary.statsDigest
  const hasSignal =
    (Number.isFinite(warningCount) && warningCount > 0) ||
    (byType && Object.keys(byType).length > 0) ||
    (Number.isFinite(omittedCount) && omittedCount > 0) ||
    formatStatSummary(statsDigest)

  if (!hasSignal) return null

  const statSummary = formatStatSummary(statsDigest)
  const typeSummary = formatByType(byType)
  const warningLabel = Number.isFinite(warningCount) ? `warnings ${warningCount}` : ''
  const omittedLabel = Number.isFinite(omittedCount) ? `omitted ${omittedCount}` : ''
  const capBits = [warningLabel, omittedLabel].filter(Boolean).join(', ')

  return [
    statSummary ? `Import stats: ${statSummary}.` : '',
    capBits ? `Import report: ${capBits}.` : '',
    typeSummary ? `Warning types: ${typeSummary}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function summarizePptxImportWarnings(result) {
  // Prefer durable job reportSummary, then presentation-owned report, then live warnings.
  if (result?.reportSummary) {
    const fromSummary = summarizeFromReportShape(result.reportSummary)
    if (fromSummary) return fromSummary
  }
  if (result?._pptxImportReport) {
    const fromReport = summarizeFromReportShape(result._pptxImportReport)
    if (fromReport) return fromReport
  }

  const warnings = Array.isArray(result?.warnings) ? result.warnings : []
  const stats = result?.stats || {}
  if (!warnings.length && !stats.placeholderCount) return null

  const groups = { approximated: 0, placeholder: 0, failed: 0, other: 0 }
  const byType = new Map()

  for (const warning of warnings) {
    const type = String(warning?.type || '')
    byType.set(type || 'unknown', (byType.get(type || 'unknown') || 0) + 1)
    if (FAILED_TYPES.has(type)) groups.failed += 1
    else if (PLACEHOLDER_TYPES.has(type) || type.includes('placeholder')) groups.placeholder += 1
    else if (APPROXIMATED_TYPES.has(type)) groups.approximated += 1
    else groups.other += 1
  }

  const statSummary = formatStatSummary(stats)
  const typeSummary = [...byType.entries()]
    .map(([type, count]) => `${type} (${count})`)
    .join(', ')

  return [
    statSummary ? `Import stats: ${statSummary}.` : '',
    `Warning groups: approximated ${groups.approximated}, placeholder ${groups.placeholder}, failed ${groups.failed}, other ${groups.other}.`,
    typeSummary ? `Warning types: ${typeSummary}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}
