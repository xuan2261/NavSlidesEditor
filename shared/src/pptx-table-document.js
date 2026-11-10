const { cloneTextData, normalizeTextDocument } = require('./pptx-text-document')
const { tableFailure, record, integer, validateTableProperties } = require('./pptx-table-properties')

// Source dimensions and declarations are native EMU/OOXML, never CSS or HTML.
// Every physical tc survives, including rich content in covered merge cells.
function tableAnchors(rows, columnCount) {
  const occupied = rows.map(() => Array(columnCount))
  for (const [r, row] of rows.entries()) {
    if (!Array.isArray(row.cells) || row.cells.length !== columnCount)
      tableFailure('ragged row', row.componentId)
    for (const [c, cell] of row.cells.entries()) {
      const id = cell.componentId, merge = cell.merge
      record(merge, ['gridSpan', 'rowSpan', 'hMerge', 'vMerge'], [], id)
      for (const key of ['gridSpan', 'rowSpan'])
        if (merge[key] !== undefined) integer(merge[key], 1, 65536, id)
      for (const key of ['hMerge', 'vMerge'])
        if (merge[key] !== undefined && typeof merge[key] !== 'boolean') tableFailure('merge boolean', id)
      const width = merge.gridSpan ?? 1, height = merge.rowSpan ?? 1
      if (c + width > columnCount || r + height > rows.length) tableFailure('span outside table', id)
      const owner = occupied[r][c]
      if (owner) {
        if (!!merge.hMerge !== (c > owner.column) || !!merge.vMerge !== (r > owner.row) ||
            (width !== 1 && (c !== owner.column || width !== owner.width)) ||
            (height !== 1 && (r !== owner.row || height !== owner.height)))
          tableFailure('invalid merge continuation or overlap', id)
      } else {
        if (merge.hMerge || merge.vMerge) tableFailure('orphan merge continuation', id)
        const anchor = { id, row: r, column: c, width, height }
        for (let y = r; y < r + height; y++)
          for (let x = c; x < c + width; x++) {
            if (occupied[y][x]) tableFailure('overlapping spans', id)
            occupied[y][x] = anchor
          }
      }
    }
  }
  return occupied.map((row) => row.map((owner) => owner.id))
}

function normalizeTableDocument(input) {
  const document = cloneTextData(input), ids = new Set()
  const identity = (value, maxLen = 256) => {
    if (typeof value !== 'string' || !value.length || value.length > maxLen || ids.has(value))
      tableFailure('duplicate/invalid component identity', value)
    ids.add(value)
  }
  // Fixed DrawingML 2014 colId/rowId provenance. Source admission checks the
  // namespace/wrappers; the bound component retains the exact locator and hash.
  function nativeIdentity(entry, values) {
    if (entry.identity === undefined) return
    const metadata = entry.identity
    record(metadata, ['value', 'componentId'], ['value', 'componentId'], entry.componentId)
    identity(metadata.componentId)
    integer(metadata.value, 0, 4294967295, entry.componentId)
    if (values.has(metadata.value)) tableFailure('duplicate native identity', entry.componentId)
    values.add(metadata.value)
  }
  const columnIdentities = new Set(), rowIdentities = new Set()
  record(document, ['schemaVersion', 'componentId', 'properties', 'columns', 'rows'],
    ['schemaVersion', 'componentId', 'properties', 'columns', 'rows'])
  if (document.schemaVersion !== 1) tableFailure('schema version')
  identity(document.componentId)
  validateTableProperties(document.properties, document.componentId)
  for (const key of ['columns', 'rows'])
    if (!Array.isArray(document[key]) || !document[key].length || document[key].length > 4096)
      tableFailure(`${key} budget`, document.componentId)
  if (document.rows.length * document.columns.length > 65536) tableFailure('cell budget', document.componentId)
  for (const column of document.columns) {
    record(column, ['componentId', 'widthEmu', 'identity'], ['componentId', 'widthEmu'], column.componentId)
    identity(column.componentId)
    integer(column.widthEmu, 0, 27273042316900, column.componentId)
    nativeIdentity(column, columnIdentities)
  }
  for (const row of document.rows) {
    record(row, ['componentId', 'heightEmu', 'cells', 'identity'], ['componentId', 'heightEmu', 'cells'], row.componentId)
    identity(row.componentId)
    integer(row.heightEmu, 0, 27273042316900, row.componentId)
    nativeIdentity(row, rowIdentities)
    if (!Array.isArray(row.cells) || row.cells.length !== document.columns.length)
      tableFailure('ragged row', row.componentId)
    for (const cell of row.cells) {
      record(cell, ['componentId', 'merge', 'anchorCellId', 'properties', 'textDocument'],
        ['componentId', 'merge', 'anchorCellId', 'properties', 'textDocument'], cell.componentId)
      identity(cell.componentId)
      validateTableProperties(cell.properties, cell.componentId, true)
      let text
      try { text = normalizeTextDocument(cell.textDocument) } catch (error) { tableFailure(error.message, cell.componentId) }
      identity(text.componentId)
      for (const paragraph of text.paragraphs) {
        identity(paragraph.componentId)
        for (const run of paragraph.runs) {
          identity(run.componentId)
          if (run.kind === 'equation') {
            const visit = (node) => { identity(node.componentId, 1024); node.children.forEach(visit) }
            visit(run.ommlDocument.root)
          }
        }
      }
    }
  }
  const anchors = tableAnchors(document.rows, document.columns.length)
  document.rows.forEach((row, r) => row.cells.forEach((cell, c) => {
    if (cell.anchorCellId !== anchors[r][c]) tableFailure('wrong merge anchor', cell.componentId)
  }))
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    return value
  }
  return freeze(document)
}
module.exports = { normalizeTableDocument, tableAnchors }
