/**
 * Pure merged-cell resolver shared by all three table render paths (reveal HTML,
 * canvas React, pptx export) so merge semantics never drift. Given the element's
 * `mergedCells` array, returns the anchor spans keyed by "row:col" and the set of
 * covered (skip) cells keyed the same way.
 *
 * @param {Array<{row:number,col:number,rowSpan?:number,colSpan?:number}>} mergedCells
 * @returns {{ spans: Map<string,{rowSpan:number,colSpan:number}>, covered: Set<string> }}
 */
function resolveMergedCells(mergedCells) {
  const spans = new Map()
  const covered = new Set()
  const list = Array.isArray(mergedCells) ? mergedCells : []
  list.forEach((merge) => {
    const row = Number(merge.row) || 0
    const col = Number(merge.col) || 0
    const rowSpan = Math.max(1, Number(merge.rowSpan) || 1)
    const colSpan = Math.max(1, Number(merge.colSpan) || 1)
    spans.set(`${row}:${col}`, { rowSpan, colSpan })
    for (let ri = row; ri < row + rowSpan; ri++) {
      for (let ci = col; ci < col + colSpan; ci++) {
        if (ri !== row || ci !== col) covered.add(`${ri}:${ci}`)
      }
    }
  })
  return { spans, covered }
}

module.exports = { resolveMergedCells }
