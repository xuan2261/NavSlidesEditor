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
    mergedCells: [],
  }
}
