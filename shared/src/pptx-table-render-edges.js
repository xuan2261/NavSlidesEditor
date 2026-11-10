const { cellBorders, unsupported } = require('./pptx-table-render-paint')

// Resolve only equal visible strokes. Conflicting declarations still need native
// precedence evidence; never choose one from traversal order. Segment at physical
// grid boundaries so a merged side and several unmerged neighbors share keys.
function tableEdges(document, columns, rows, options) {
  const anchors = new Map()
  for (const [r, row] of document.rows.entries())
    for (const [c, cell] of row.cells.entries())
      if (cell.anchorCellId === cell.componentId)
        anchors.set(cell.componentId, { r, c, cell,
          endRow: r + (cell.merge.rowSpan ?? 1), endColumn: c + (cell.merge.gridSpan ?? 1) })
  const edges = new Map(), diagonals = []
  function add(cell, side, border, key, points) {
    const markup = cellBorders({ [side]: border }, 0, 0, options, cell.componentId,
      { [side]: points.map((value) => value / 9525) })
    if (!markup) return
    const signature = markup.replace(/ data-pptx-table-border="[^"]*"/, '')
    const previous = edges.get(key)
    if (previous && previous.signature !== signature)
      unsupported(cell.componentId, `properties.borders.${side}`, 'shared-edge border arbitration')
    if (!previous) edges.set(key, { markup, signature, points })
  }
  for (const [r, row] of document.rows.entries()) {
    for (const [c, cell] of row.cells.entries()) {
      const anchor = anchors.get(cell.anchorCellId), covered = anchor.cell !== cell
      const top = covered ? r : anchor.r, bottom = covered ? r + 1 : anchor.endRow
      const left = covered ? c : anchor.c, right = covered ? c + 1 : anchor.endColumn
      for (const [side, border] of Object.entries(cell.properties.borders ?? {})) {
        if (side === 'top' || side === 'bottom') {
          const edge = side === 'top' ? top : bottom
          if (covered && edge !== (side === 'top' ? anchor.r : anchor.endRow)) continue
          for (let x = left; x < right; x++)
            add(cell, side, border, `h:${edge}:${x}`,
              [columns[x], rows[edge], columns[x + 1], rows[edge]])
        } else if (side === 'left' || side === 'right') {
          const edge = side === 'left' ? left : right
          if (covered && edge !== (side === 'left' ? anchor.c : anchor.endColumn)) continue
          for (let y = top; y < bottom; y++)
            add(cell, side, border, `v:${edge}:${y}`,
              [columns[edge], rows[y], columns[edge], rows[y + 1]])
        } else {
          if (covered) unsupported(cell.componentId, `properties.borders.${side}`, 'covered-cell diagonal')
          const points = side === 'topLeftToBottomRight'
            ? [columns[left], rows[top], columns[right], rows[bottom]]
            : [columns[left], rows[bottom], columns[right], rows[top]]
          diagonals.push(cellBorders({ [side]: border }, 0, 0, options, cell.componentId,
            { [side]: points.map((value) => value / 9525) }))
        }
      }
    }
  }
  // Coalesce adjacent equal segments, avoiding repeated square caps, alpha seams,
  // and restarted dash patterns along a merged perimeter.
  const strokes = new Map()
  for (const [key, edge] of edges) {
    const [axis, fixed, index] = key.split(':')
    const style = edge.signature.replace(/ (?:x1|y1|x2|y2)="[^"]*"/g, '')
    const group = `${axis}:${fixed}:${style}`
    if (!strokes.has(group)) strokes.set(group, [])
    strokes.get(group).push({ ...edge, index: Number(index) })
  }
  let markup = ''
  for (const segments of strokes.values()) {
    segments.sort((a, b) => a.index - b.index)
    let current
    for (const segment of segments) {
      if (current && segment.index === current.index + 1) {
        current.index = segment.index
        current.markup = current.markup
          .replace(/ x2="[^"]*"/, ` x2="${segment.points[2] / 9525}"`)
          .replace(/ y2="[^"]*"/, ` y2="${segment.points[3] / 9525}"`)
      } else {
        if (current) markup += current.markup
        current = { ...segment }
      }
    }
    if (current) markup += current.markup
  }
  return markup + diagonals.join('')
}
module.exports = { tableEdges }
