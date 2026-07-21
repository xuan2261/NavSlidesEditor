/**
 * Phase 05: Chart.js support matrix for native editable import.
 * Types listed as unsupported must fail strict SLA (not permanent raster).
 */

const { featureMatrixHash, getFeatureRow } = require('./canonical-feature-matrix')

const NATIVE_EDITABLE = Object.freeze(['bar'])
const COERCED = Object.freeze({})
const UNSUPPORTED_STRICT = Object.freeze([])
const MATRIX_HASH = featureMatrixHash()
const CANONICAL_ROWS = Object.freeze({
  bar: 'chart.bar-column.embedded-workbook.literal-range',
  line: 'chart.line.preserved',
  combo: 'chart.combo.preserved',
  bar3d: 'chart.bar-3d.preserved',
  scatter: 'chart.scatter.preserved',
  polar: 'chart.polar.preserved',
  pie: 'chart.pie.preserved',
  area: 'chart.area.preserved',
  unknown: 'chart.unknown.preserved',
})

function isNativeEditableChartType(type) {
  return NATIVE_EDITABLE.includes(String(type || '').toLowerCase())
}

function canonicalSupport(rowId) {
  const row = getFeatureRow(rowId)
  if (!row) return {
    rowId: CANONICAL_ROWS.unknown,
    tier: 'unsupported-blocking',
    claimCeiling: 'original-recovery',
    matrixHash: MATRIX_HASH,
    adapterId: null,
    adapterQualified: false,
    transactionEligible: false,
    level4Promoted: false,
    preservationTier: 'preserve-only',
  }
  return {
    rowId: row.id,
    tier: row.tier,
    claimCeiling: row.claimCeiling,
    matrixHash: MATRIX_HASH,
    adapterId: row.adapterId,
    adapterQualified: row.adapterQualified,
    transactionEligible: row.transactionEligible,
    level4Promoted: row.level4Promoted,
    preservationTier: row.adapterQualified && row.transactionEligible && row.level4Promoted
      ? 'editable' : 'preserve-only',
  }
}

function preserved(rowId, pptxType, navType = null) {
  return {
    ...canonicalSupport(rowId),
    status: 'preserve-only', navType, nativeType: pptxType || 'unknown',
  }
}

function supportRow(pptxType) {
  const t = String(pptxType || '').toLowerCase().replace(/[\s_-]+/gu, '')
  if (['bar', 'barchart', 'column', 'columnchart', 'clusteredbar', 'stackedbar',
    'clusteredcolumn', 'stackedcolumn'].includes(t)) {
    return {
      ...canonicalSupport(CANONICAL_ROWS.bar),
      status: 'conditional', navType: 'bar', capability: 'embedded-literal-workbook',
    }
  }
  if (['bar3d', 'bar3dchart', '3dbar', '3dbarchart'].includes(t)) {
    return preserved(CANONICAL_ROWS.bar3d, pptxType)
  }
  if (['combo', 'combochart'].includes(t)) {
    return preserved(CANONICAL_ROWS.combo, pptxType)
  }
  if (['line3d', 'line3dchart', '3dline', '3dlinechart'].includes(t)) {
    return preserved(CANONICAL_ROWS.unknown, pptxType)
  }
  if (['line', 'linechart'].includes(t)) {
    return preserved(CANONICAL_ROWS.line, pptxType, 'line')
  }
  if (['scatter', 'scatterchart'].includes(t)) {
    return preserved(CANONICAL_ROWS.scatter, pptxType)
  }
  if (['polar', 'polarchart', 'polararea', 'polarareachart'].includes(t)) {
    return preserved(CANONICAL_ROWS.polar, pptxType)
  }
  if (['pie3d', 'pie3dchart', '3dpie', '3dpiechart'].includes(t)) {
    return preserved(CANONICAL_ROWS.unknown, pptxType)
  }
  if (['pie', 'piechart'].includes(t)) {
    return preserved(CANONICAL_ROWS.pie, pptxType)
  }
  if (['area', 'areachart'].includes(t)) {
    return preserved(CANONICAL_ROWS.area, pptxType)
  }
  return preserved(CANONICAL_ROWS.unknown, pptxType)
}

function unsupportedChartError(chartType, context = {}) {
  const err = new Error(`Chart type ${chartType} is unsupported under PPTX_SLA_STRICT`)
  err.type = 'import-failed'
  err.code = 'chart-unsupported-strict'
  err.chartType = String(chartType || 'unknown')
  err.details = {
    chartType: err.chartType,
    supportStatus: 'unsupported-strict',
    ...context,
  }
  return err
}

function assertStrictChartSupport(chartType, strict, context) {
  const row = supportRow(chartType)
  if (strict && row.preservationTier !== 'editable' && context?.requireEditable) {
    throw unsupportedChartError(chartType, context)
  }
  return row
}

module.exports = {
  CANONICAL_ROWS,
  NATIVE_EDITABLE,
  COERCED,
  UNSUPPORTED_STRICT,
  isNativeEditableChartType,
  supportRow,
  assertStrictChartSupport,
  unsupportedChartError,
}
