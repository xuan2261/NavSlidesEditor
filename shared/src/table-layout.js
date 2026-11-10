const { resolveMergedCells } = require('./table-merge-resolver.js')
const { toPptFontSize } = require('./shared-pptx-core.js')

/** Scale positive table dimension weights to the available authored extent. */
function resolveTableDimensions(values, extent) {
  if (!Array.isArray(values) || !values.length || !Number.isFinite(extent) || extent <= 0)
    return undefined
  let total = 0
  for (const value of values) {
    const weight = Number(value)
    if (!Number.isFinite(weight) || weight <= 0) return undefined
    total += weight
  }
  if (!Number.isFinite(total) || total <= 0) return undefined
  return values.map((value) => (Number(value) / total) * extent)
}

/** Per-cell canvas-pixel insets, with missing/invalid sides inheriting uniform padding. */
function resolveTableInsets(value, fallback = 8) {
  const number = (raw, otherwise) => (typeof raw === 'number' || typeof raw === 'string') && raw !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0
    ? Number(raw) : otherwise
  const padding = number(fallback, 8)
  return Object.fromEntries(['top', 'right', 'bottom', 'left'].map((side) =>
    [side, number(value?.[side], padding)]))
}

/** Collapsed borders consume half of the perimeter on each side of the grid. */
function resolveTableBorderInsets(element) {
  const data = Array.isArray(element.data) ? element.data : []
  const rows = data.length
  const cols = Math.max(0, ...data.map((row) => Array.isArray(row) ? row.length : 0))
  const { spans, covered } = resolveMergedCells(element.mergedCells, { rowCount: rows, colCount: cols })
  const result = { top: 0, right: 0, bottom: 0, left: 0 }
  const borderWidth = (border) => {
    const style = border?.style ?? element.borderStyle
    if (style === 'none') return 0
    const raw = border?.width ?? element.borderWidth ?? 1
    const width = Number(raw)
    return Number.isFinite(width) && width >= 0 ? width : 1
  }
  data.forEach((row, ri) => {
    if (!Array.isArray(row)) return
    row.forEach((_cell, ci) => {
      if (covered.has(`${ri}:${ci}`)) return
      const span = spans.get(`${ri}:${ci}`)
      const sides = { top: ri === 0, left: ci === 0,
        bottom: ri + (span?.rowSpan || 1) === rows, right: ci + (span?.colSpan || 1) === cols }
      for (const side of Object.keys(result)) {
        if (sides[side]) result[side] = Math.max(result[side], borderWidth(element.cellStyles?.borders?.[ri]?.[ci]?.[side]) / 2)
      }
    })
  })
  return result
}

function resolveTableContentExtent(element) {
  const insets = resolveTableBorderInsets(element)
  return { width: Math.max(0, Number(element.width) - insets.left - insets.right),
    height: Math.max(0, Number(element.height) - insets.top - insets.bottom) }
}

/** PptxGenJS chooses units for the whole margin array from its top value. */
function resolveTablePptxMargins(value, fallback) {
  const insets = resolveTableInsets(value, fallback)
  const points = ['top', 'right', 'bottom', 'left'].map((side) =>
    insets[side] > 0 ? toPptFontSize(insets[side]) : 0)
  return points[0] >= 1 ? points : points.map((value) => value / 72)
}

module.exports = { resolveTableDimensions, resolveTableInsets, resolveTableBorderInsets, resolveTableContentExtent, resolveTablePptxMargins }
