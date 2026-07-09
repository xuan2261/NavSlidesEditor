const TABLE_STYLE_KEYS = [
  'textColors',
  'bgColors',
  'isBold',
  'fontSizes',
  'fontFamilies',
  'aligns',
  'vAligns',
  'borders',
]

export function syncTableStyleMatrices(cellStyles = {}, rows, cols) {
  return Object.fromEntries(TABLE_STYLE_KEYS.map((key) => [
    key,
    Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: cols }, (_, colIndex) => cellStyles[key]?.[rowIndex]?.[colIndex] ?? null)
    ),
  ]))
}

/**
 * Keep merges that still fit entirely inside the new table bounds.
 * Drop OOB / degenerate merges — do not wipe all merges on every shape change.
 */
export function preserveValidMerges(mergedCells, rows, cols) {
  const list = Array.isArray(mergedCells) ? mergedCells : []
  const safeRows = Math.max(1, Number(rows) || 1)
  const safeCols = Math.max(1, Number(cols) || 1)
  const next = []
  for (const merge of list) {
    const row = Number(merge?.row)
    const col = Number(merge?.col)
    if (!Number.isFinite(row) || !Number.isFinite(col) || row < 0 || col < 0) continue
    const rowSpan = Math.max(1, Number(merge?.rowSpan) || 1)
    const colSpan = Math.max(1, Number(merge?.colSpan) || 1)
    if (row + rowSpan > safeRows || col + colSpan > safeCols) continue
    next.push({ row, col, rowSpan, colSpan })
  }
  return next
}

export function normalizeTableShape(update, current) {
  const data = update.data || current.data || [['']]
  const rows = data.length
  const cols = Math.max(1, ...data.map((row) => (row || []).length))
  const average = (values) => {
    const valid = values.filter((value) => Number.isFinite(Number(value)) && Number(value) > 0)
    if (!valid.length) return null
    return Math.round(valid.reduce((sum, value) => sum + Number(value), 0) / valid.length)
  }
  const colFallback = Array.isArray(current.colWidths) ? average(current.colWidths) : null
  const rowFallback = Array.isArray(current.rowHeights) ? average(current.rowHeights) : null
  return {
    ...update,
    cellStyles: syncTableStyleMatrices(current.cellStyles, rows, cols),
    ...(Array.isArray(current.colWidths) && {
      colWidths: Array.from({ length: cols }, (_, index) => current.colWidths[index] ?? colFallback),
    }),
    ...(Array.isArray(current.rowHeights) && {
      rowHeights: Array.from({ length: rows }, (_, index) => current.rowHeights[index] ?? rowFallback),
    }),
    mergedCells: preserveValidMerges(current.mergedCells, rows, cols),
  }
}

export function clampTableCell(cell, data = [['']]) {
  const rowCount = Math.max(1, data.length)
  const row = Math.min(Math.max(Number(cell?.row) || 0, 0), rowCount - 1)
  const colCount = Math.max(1, (data[row] || []).length)
  const col = Math.min(Math.max(Number(cell?.col) || 0, 0), colCount - 1)
  return { row, col }
}
