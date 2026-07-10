export function summarizePptxImportWarnings(result) {
  const warnings = Array.isArray(result?.warnings) ? result.warnings : []
  const stats = result?.stats || {}
  if (!warnings.length && !stats.placeholderCount) return null

  const failedTypes = new Set([
    'media-missing',
    'media-ref-missing',
    'parse-failed',
    'import-failed',
    'schema-unusable',
  ])
  const placeholderTypes = new Set([
    'grouped-complex',
    'table-unusable',
    'chart-unsupported',
    'unknown-object',
    'diagram-empty',
  ])
  const approximatedTypes = new Set([
    'fallback-inspector',
    'geometry-clamped',
    'crop-converted',
    'line-endpoint-normalized',
    'group-transform-normalized',
    'diagram-truncated',
  ])

  const groups = { approximated: 0, placeholder: 0, failed: 0, other: 0 }
  const byType = new Map()

  for (const warning of warnings) {
    const type = String(warning?.type || '')
    byType.set(type || 'unknown', (byType.get(type || 'unknown') || 0) + 1)
    if (failedTypes.has(type)) groups.failed += 1
    else if (placeholderTypes.has(type) || type.includes('placeholder')) groups.placeholder += 1
    else if (approximatedTypes.has(type)) groups.approximated += 1
    else groups.other += 1
  }

  const statFields = [
    ['slideCount', 'slides'],
    ['textCount', 'text'],
    ['imageCount', 'images'],
    ['shapeCount', 'shapes'],
    ['tableCount', 'tables'],
    ['chartCount', 'charts'],
    ['diagramCount', 'diagrams'],
    ['placeholderCount', 'placeholders'],
  ]
  const statSummary = statFields
    .filter(([key]) => Number.isFinite(Number(stats[key])))
    .map(([key, label]) => `${label} ${Number(stats[key])}`)
    .join(', ')
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
