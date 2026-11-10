const { cloneTextData, normalizeTextDocument } = require('./pptx-text-document')
const { normalizeTableDocument } = require('./pptx-table-document')
const { tableFailure, record, integer, validateTableProperties } = require('./pptx-table-properties')

// A derived occurrence projection, never a mutation or replacement of source
// authority. Component locators/provenance belong to the caller's source graph.
// Each command either returns a fully validated frozen table or throws.
function applyTableOperation(input, operation) {
  const document = cloneTextData(normalizeTableDocument(input))
  const command = cloneTextData(operation)
  const fields = {
    replaceCellText: ['cellId', 'textDocument'],
    setCellProperties: ['cellId', 'properties'],
    setRowHeight: ['rowId', 'heightEmu'],
    setColumnWidth: ['columnId', 'widthEmu'],
    mergeCells: ['startRow', 'startColumn', 'rowSpan', 'columnSpan'],
    unmergeCell: ['cellId'],
    insertRow: ['afterRowId', 'row'],
    deleteRow: ['rowId'],
    insertColumn: ['afterColumnId', 'column', 'cells'],
    deleteColumn: ['columnId'],
  }
  record(command, ['type', ...Object.values(fields).flat()], ['type'])
  if (typeof command.type !== 'string' || !Object.hasOwn(fields, command.type))
    tableFailure('unknown operation')
  const keys = ['type', ...fields[command.type]]
  record(command, keys, keys)

  if (command.type === 'setRowHeight' || command.type === 'setColumnWidth') {
    const row = command.type === 'setRowHeight'
    const id = command[row ? 'rowId' : 'columnId']
    const target = document[row ? 'rows' : 'columns'].find((item) => item.componentId === id)
    if (!target) tableFailure('unknown dimension target', id)
    const key = row ? 'heightEmu' : 'widthEmu'
    integer(command[key], 0, 27273042316900, id)
    target[key] = command[key]
  } else if (command.type === 'mergeCells') {
    const { startRow, startColumn, rowSpan, columnSpan } = command
    integer(startRow, 0, document.rows.length - 1)
    integer(startColumn, 0, document.columns.length - 1)
    integer(rowSpan, 1, document.rows.length - startRow)
    integer(columnSpan, 1, document.columns.length - startColumn)
    if (rowSpan === 1 && columnSpan === 1) tableFailure('merge requires multiple cells')
    const anchor = document.rows[startRow].cells[startColumn]
    // Do not implicitly split, expand or absorb an existing merged region.
    for (let r = startRow; r < startRow + rowSpan; r++) {
      for (let c = startColumn; c < startColumn + columnSpan; c++) {
        const cell = document.rows[r].cells[c]
        if (
          cell.anchorCellId !== cell.componentId ||
          (cell.merge.gridSpan ?? 1) !== 1 ||
          (cell.merge.rowSpan ?? 1) !== 1
        )
          tableFailure('merge overlaps existing merged cell', cell.componentId)
      }
    }
    for (let r = startRow; r < startRow + rowSpan; r++) {
      for (let c = startColumn; c < startColumn + columnSpan; c++) {
        const cell = document.rows[r].cells[c]
        cell.merge = {}
        cell.anchorCellId = anchor.componentId
        if (r === startRow && c === startColumn) {
          if (columnSpan > 1) cell.merge.gridSpan = columnSpan
          if (rowSpan > 1) cell.merge.rowSpan = rowSpan
        } else {
          if (c > startColumn) cell.merge.hMerge = true
          if (r > startRow) cell.merge.vMerge = true
        }
        // Covered cells retain their own canonical text and style, so unmerge
        // is non-lossy. No concatenation, blanking or physical cell deletion.
      }
    }
  } else if (command.type === 'insertRow') {
    const { afterRowId, row } = command
    if (!row || typeof row !== 'object' || Array.isArray(row)) tableFailure('invalid row')
    let insertIdx = 0
    if (afterRowId !== null) {
      const idx = document.rows.findIndex((r) => r.componentId === afterRowId)
      if (idx === -1) tableFailure('unknown row target', afterRowId)
      insertIdx = idx + 1
    }
    // Cannot split an active multi-row vertical merge
    if (insertIdx > 0 && insertIdx < document.rows.length) {
      for (let c = 0; c < document.columns.length; c++) {
        const above = document.rows[insertIdx - 1].cells[c]
        const below = document.rows[insertIdx].cells[c]
        if (above.anchorCellId === below.anchorCellId && above.anchorCellId !== undefined) {
          tableFailure('cannot insert row inside active merge span', above.anchorCellId)
        }
      }
    }
    document.rows.splice(insertIdx, 0, row)
  } else if (command.type === 'deleteRow') {
    const { rowId } = command
    if (document.rows.length <= 1) tableFailure('cannot delete last row')
    const idx = document.rows.findIndex((r) => r.componentId === rowId)
    if (idx === -1) tableFailure('unknown row target', rowId)
    const targetRow = document.rows[idx]
    for (const cell of targetRow.cells) {
      if ((cell.merge.rowSpan ?? 1) > 1 || cell.merge.vMerge) {
        tableFailure('cannot delete row with active vertical merge', cell.componentId)
      }
    }
    document.rows.splice(idx, 1)
  } else if (command.type === 'insertColumn') {
    const { afterColumnId, column, cells } = command
    if (!column || typeof column !== 'object' || Array.isArray(column)) tableFailure('invalid column')
    if (!Array.isArray(cells) || cells.length !== document.rows.length) tableFailure('invalid cells for column')
    let insertIdx = 0
    if (afterColumnId !== null) {
      const idx = document.columns.findIndex((c) => c.componentId === afterColumnId)
      if (idx === -1) tableFailure('unknown column target', afterColumnId)
      insertIdx = idx + 1
    }
    // Cannot split an active multi-column horizontal merge
    if (insertIdx > 0 && insertIdx < document.columns.length) {
      for (let r = 0; r < document.rows.length; r++) {
        const left = document.rows[r].cells[insertIdx - 1]
        const right = document.rows[r].cells[insertIdx]
        if (left.anchorCellId === right.anchorCellId && left.anchorCellId !== undefined) {
          tableFailure('cannot insert column inside active merge span', left.anchorCellId)
        }
      }
    }
    document.columns.splice(insertIdx, 0, column)
    for (let r = 0; r < document.rows.length; r++) {
      document.rows[r].cells.splice(insertIdx, 0, cells[r])
    }
  } else if (command.type === 'deleteColumn') {
    const { columnId } = command
    if (document.columns.length <= 1) tableFailure('cannot delete last column')
    const idx = document.columns.findIndex((c) => c.componentId === columnId)
    if (idx === -1) tableFailure('unknown column target', columnId)
    for (const row of document.rows) {
      const cell = row.cells[idx]
      if ((cell.merge.gridSpan ?? 1) > 1 || cell.merge.hMerge) {
        tableFailure('cannot delete column with active horizontal merge', cell.componentId)
      }
    }
    document.columns.splice(idx, 1)
    for (const row of document.rows) {
      row.cells.splice(idx, 1)
    }
  } else {
    const cell = document.rows
      .flatMap((row) => row.cells)
      .find((item) => item.componentId === command.cellId)
    if (!cell) tableFailure('unknown cell target', command.cellId)
    if (cell.anchorCellId !== cell.componentId)
      tableFailure('target must be a merge anchor', cell.componentId)
    if (command.type === 'setCellProperties') {
      validateTableProperties(command.properties, cell.componentId, true)
      const borders = command.properties.borders
      cell.properties = { ...cell.properties, ...command.properties,
        ...(borders ? { borders: { ...cell.properties.borders, ...borders } } : {}) }
    } else if (command.type === 'replaceCellText') {
      const text = normalizeTextDocument(command.textDocument)
      if (text.componentId !== cell.textDocument.componentId)
        tableFailure('text body identity must remain unchanged', cell.componentId)
      cell.textDocument = text
    } else {
      const width = cell.merge.gridSpan ?? 1,
        height = cell.merge.rowSpan ?? 1
      if (width === 1 && height === 1) tableFailure('target is not merged', cell.componentId)
      for (const row of document.rows) {
        for (const covered of row.cells) {
          if (covered.anchorCellId !== cell.componentId) continue
          covered.anchorCellId = covered.componentId
          covered.merge = {}
        }
      }
    }
  }
  // Includes cross-cell rich component identity and exact continuation checks.
  return normalizeTableDocument(document)
}

module.exports = { applyTableOperation }
