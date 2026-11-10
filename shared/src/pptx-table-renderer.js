const { normalizeTableDocument } = require('./pptx-table-document')
const { escapePlainText } = require('./content-safety')
const { unsupported, fillRect } = require('./pptx-table-render-paint')
const { cellText } = require('./pptx-table-render-text')
const { tableEdges } = require('./pptx-table-render-edges')
const { TABLE_CELL_DEFAULTS } = require('./pptx-table-properties')

// Synchronous derived SVG only. Caller owns exact loaded output fonts, matching
// fontProfile/rendererProfile/measurement, and inherited textDefaults declarations.
// Native row/column sizes are never fitted to the graphic frame.
function renderSemanticTable(input, options = {}) {
  const document = normalizeTableDocument(input)
  if (document.properties.tableStyleId !== undefined)
    unsupported(document.componentId, 'properties.tableStyleId', 'source table style resolution')
  if (document.properties.rtl)
    unsupported(document.componentId, 'properties.rtl', 'RTL table layout')
  const columns = [0],
    rows = [0]
  for (const column of document.columns) columns.push(columns.at(-1) + column.widthEmu)
  for (const row of document.rows) rows.push(rows.at(-1) + row.heightEmu)
  const width = columns.at(-1) / 9525,
    height = rows.at(-1) / 9525
  if (!width || !height) unsupported(document.componentId, 'extent', 'zero table extent')
  const edges = tableEdges(document, columns, rows, options)
  let markup = fillRect(document.properties.fill, width, height, options, document.componentId)
  for (const [r, row] of document.rows.entries()) {
    for (const [c, cell] of row.cells.entries()) {
      if (cell.anchorCellId !== cell.componentId) continue
      const widthEmu = columns[c + (cell.merge.gridSpan ?? 1)] - columns[c]
      const heightEmu = rows[r + (cell.merge.rowSpan ?? 1)] - rows[r]
      if (!widthEmu || !heightEmu) unsupported(cell.componentId, 'extent', 'zero cell extent')
      if (widthEmu > 2147483647 || heightEmu > 2147483647)
        unsupported(cell.componentId, 'extent', 'cell extent exceeds text-layout budget')
      const w = widthEmu / 9525,
        h = heightEmu / 9525
      markup +=
        `<g data-pptx-table-cell="${escapePlainText(cell.componentId)}"` +
        ` transform="translate(${columns[c] / 9525} ${rows[r] / 9525})">` +
        fillRect(cell.properties.fill, w, h, options, cell.componentId) +
        cellText(
          { ...cell, properties: { ...TABLE_CELL_DEFAULTS, ...cell.properties } },
          widthEmu,
          heightEmu,
          options
        ) +
        '</g>'
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" data-pptx-table="${escapePlainText(document.componentId)}"` +
    ` width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible">` +
    markup +
    edges +
    '</svg>'
  )
}
module.exports = { renderSemanticTable }
