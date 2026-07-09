/**
 * Phase 05: Chart.js support matrix for native editable import.
 * Types listed as unsupported must fail strict SLA (not permanent raster).
 */

const NATIVE_EDITABLE = Object.freeze([
  'bar',
  'line',
  'pie',
  'doughnut',
  'radar',
  'polarArea',
])

const COERCED = Object.freeze({
  area: 'line',
  scatter: 'line',
  bubble: 'bar',
  stock: 'line',
  surface: 'bar',
  stacked: 'bar',
})

const UNSUPPORTED_STRICT = Object.freeze(['combo', 'ofPie', 'map'])

function isNativeEditableChartType(type) {
  return NATIVE_EDITABLE.includes(String(type || '').toLowerCase())
}

function supportRow(pptxType) {
  const t = String(pptxType || '').toLowerCase()
  if (UNSUPPORTED_STRICT.some((u) => t.includes(u.toLowerCase()))) {
    return { status: 'unsupported-strict', navType: null }
  }
  for (const [from, to] of Object.entries(COERCED)) {
    if (t.includes(from)) return { status: 'coerced', navType: to, from }
  }
  for (const nav of NATIVE_EDITABLE) {
    if (t.includes(nav.toLowerCase()) || (nav === 'polarArea' && t.includes('polar'))) {
      return { status: 'native', navType: nav }
    }
  }
  if (t.includes('bar') || t.includes('col')) return { status: 'native', navType: 'bar' }
  return { status: 'fallback-bar', navType: 'bar' }
}

module.exports = {
  NATIVE_EDITABLE,
  COERCED,
  UNSUPPORTED_STRICT,
  isNativeEditableChartType,
  supportRow,
}
