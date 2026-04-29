export function summarizePptxImportWarnings(result) {
  const warnings = Array.isArray(result?.warnings) ? result.warnings : []
  const stats = result?.stats || {}
  if (!warnings.length && !stats.placeholderCount) return null

  const failedTypes = new Set(['media-missing', 'parse-failed', 'import-failed', 'schema-unusable'])
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

  let failed = 0
  let placeholder = 0
  let approximated = 0

  for (const warning of warnings) {
    const type = String(warning?.type || '')
    if (failedTypes.has(type)) failed += 1
    else if (placeholderTypes.has(type) || type.includes('placeholder')) placeholder += 1
    else if (approximatedTypes.has(type)) approximated += 1
    else approximated += 1
  }

  const placeholderCount = Math.max(placeholder, Number(stats.placeholderCount) || 0)
  const exact = Math.max(0, warnings.length - approximated - failed - placeholder)
  const unsupportedTypes = [
    ...new Set(warnings.map((warning) => warning.type).filter(Boolean)),
  ].join(', ')

  return [
    `PPTX import fidelity: exact ${exact}, approximated ${approximated}, placeholder ${placeholderCount}, failed ${failed}.`,
    `Warnings: ${warnings.length}.`,
    `Placeholders: ${placeholderCount}.`,
    unsupportedTypes ? `Unsupported/object warnings: ${unsupportedTypes}.` : '',
    failed ? `Failed warnings: ${failed}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}
