/**
 * Pure merged-cell resolver shared by all three table render paths (reveal HTML,
 * canvas React, pptx export) so merge semantics never drift. Given the element's
 * `mergedCells` array, returns the anchor spans keyed by "row:col" and the set of
 * covered (skip) cells keyed the same way. Supplying table dimensions enables
 * strict validation for native PPTX exports; omitting them preserves legacy
 * canvas and reveal behavior.
 *
 * @param {Array<{row:number,col:number,rowSpan?:number,colSpan?:number}>} mergedCells
 * @param {{rowCount:number,colCount:number}|number} [dimensions]
 * @param {number} [columnCount]
 * @returns {{ spans: Map<string,{rowSpan:number,colSpan:number}>, covered: Set<string> }}
 */
function resolveMergedCells(mergedCells, dimensions, columnCount) {
  const spans = new Map()
  const covered = new Set()
  const list = Array.isArray(mergedCells) ? mergedCells : []
  const bounds = resolveDimensions(dimensions, columnCount)

  list.forEach((merge) => {
    if (!merge || typeof merge !== 'object') return
    if (bounds) {
      addValidatedMerge(merge, bounds, spans, covered)
      return
    }

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

function resolveDimensions(dimensions, columnCount) {
  const rowCount = typeof dimensions === 'object' ? dimensions?.rowCount : dimensions
  const colCount = typeof dimensions === 'object' ? dimensions?.colCount : columnCount
  if (
    !Number.isInteger(rowCount) ||
    !Number.isInteger(colCount) ||
    rowCount < 0 ||
    colCount < 0
  ) {
    return null
  }
  return { rowCount, colCount }
}

function addValidatedMerge(merge, bounds, spans, covered) {
  const rowSpan = merge.rowSpan ?? 1
  const colSpan = merge.colSpan ?? 1
  if (
    !Number.isInteger(merge.row) ||
    !Number.isInteger(merge.col) ||
    !Number.isInteger(rowSpan) ||
    !Number.isInteger(colSpan) ||
    merge.row < 0 ||
    merge.col < 0 ||
    rowSpan < 1 ||
    colSpan < 1 ||
    merge.row + rowSpan > bounds.rowCount ||
    merge.col + colSpan > bounds.colCount
  ) {
    return
  }

  const occupied = []
  for (let row = merge.row; row < merge.row + rowSpan; row++) {
    for (let col = merge.col; col < merge.col + colSpan; col++) {
      const key = `${row}:${col}`
      if (spans.has(key) || covered.has(key)) return
      occupied.push(key)
    }
  }

  const anchor = `${merge.row}:${merge.col}`
  spans.set(anchor, { rowSpan, colSpan })
  occupied.forEach((key) => {
    if (key !== anchor) covered.add(key)
  })
}

module.exports = { resolveMergedCells }
