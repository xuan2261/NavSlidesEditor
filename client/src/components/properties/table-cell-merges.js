import { resolveMergedCells } from 'revealjs-shared'
import { clampTableCell } from './table-properties-utils'

function mergeState(element, selectedCell) {
  const data = element.data || [['']]
  const cols = Math.max(1, ...data.map((row) => (row || []).length))
  const { spans, covered } = resolveMergedCells(element.mergedCells, {
    rowCount: data.length,
    colCount: cols,
  })
  const cell = clampTableCell(selectedCell, data)
  let anchor = cell
  if (covered.has(`${cell.row}:${cell.col}`)) {
    for (const [key, span] of spans) {
      const [row, col] = key.split(':').map(Number)
      if (
        cell.row >= row &&
        cell.row < row + span.rowSpan &&
        cell.col >= col &&
        cell.col < col + span.colSpan
      ) {
        anchor = { row, col }
        break
      }
    }
  }
  const key = `${anchor.row}:${anchor.col}`
  return { data, spans, covered, anchor, key, span: spans.get(key) || { rowSpan: 1, colSpan: 1 } }
}

export function mergeTableCellRight(element, selectedCell) {
  const { data, spans, covered, anchor, key, span } = mergeState(element, selectedCell)
  const right = anchor.col + span.colSpan
  for (let row = anchor.row; row < anchor.row + span.rowSpan; row++) {
    if (
      right >= (data[row] || []).length ||
      covered.has(`${row}:${right}`) ||
      spans.has(`${row}:${right}`)
    )
      return null
  }
  const mergedCells = [...spans]
    .filter(([start]) => start !== key)
    .map(([start, value]) => {
      const [row, col] = start.split(':').map(Number)
      return { row, col, ...value }
    })
  mergedCells.push({ ...anchor, ...span, colSpan: span.colSpan + 1 })
  return { mergedCells }
}

export function unmergeTableCell(element, selectedCell) {
  const { spans, key } = mergeState(element, selectedCell)
  if (!spans.has(key)) return null
  return {
    mergedCells: (element.mergedCells || []).filter(
      (merge) => `${merge?.row}:${merge?.col}` !== key
    ),
  }
}
