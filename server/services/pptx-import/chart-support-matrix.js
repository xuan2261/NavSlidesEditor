/**
 * Phase 05: Chart.js support matrix for native editable import.
 * Types listed as unsupported must fail strict SLA (not permanent raster).
 */

const NATIVE_EDITABLE = Object.freeze(['bar'])
const COERCED = Object.freeze({})
const UNSUPPORTED_STRICT = Object.freeze([])

function isNativeEditableChartType(type) {
  return NATIVE_EDITABLE.includes(String(type || '').toLowerCase())
}

function supportRow(pptxType) {
  const t = String(pptxType || '').toLowerCase()
  if (t === 'bar' || t === 'barchart') {
    return { status: 'conditional', navType: 'bar', capability: 'embedded-literal-workbook' }
  }
  if (t.includes('line')) {
    return { status: 'preserve-only', navType: 'line', nativeType: pptxType || 'unknown' }
  }
  return { status: 'preserve-only', navType: null, nativeType: pptxType || 'unknown' }
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
  if (strict && row.status === 'preserve-only' && context?.requireEditable) {
    throw unsupportedChartError(chartType, context)
  }
  return row
}

module.exports = {
  NATIVE_EDITABLE,
  COERCED,
  UNSUPPORTED_STRICT,
  isNativeEditableChartType,
  supportRow,
  assertStrictChartSupport,
  unsupportedChartError,
}
