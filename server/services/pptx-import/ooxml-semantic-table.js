const { P_URIS, A_URIS, TABLE_GRAPHIC_DATA_URIS, attr, decodeXml } = require('./ooxml-text-run-xml')
const { tableSource } = require('./ooxml-semantic-table-source')
const { readTableProperties } = require('./ooxml-semantic-table-properties')
const { readTableText } = require('./ooxml-semantic-table-text')
const { normalizeTableDocument, tableAnchors } = require('../../../shared/src/pptx-table-document')
const A16_URI = 'http://schemas.microsoft.com/office/drawing/2014/main'
const A16_URIS = new Set([A16_URI])
const COLUMN_ID_EXTENSION_URI = '{9D8B030D-6E8A-4147-A177-3AD203B41FA5}'
const ROW_ID_EXTENSION_URI = '{0D108BD9-81ED-4DB2-BD59-A6C34878D82A}'

function validateTableIdentityExtension(source, list, extensionUri, identityName, parentId) {
  source.attrs(list)
  source.children(list, ['ext'])
  if (list.children.length !== 1) source.fail(list, 'invalid identity extension count')
  const extension = list.children[0]
  const declaration = source.attrs(extension, ['uri'])
  if (declaration.uri !== extensionUri) source.fail(extension, 'unsupported identity extension URI')
  source.children(extension, [identityName], [], A16_URIS)
  if (extension.children.length !== 1) source.fail(extension, 'invalid identity extension payload')
  const identity = extension.children[0]
  const properties = source.attrs(identity, ['val'])
  source.children(identity)
  const value = source.number(identity, properties.val, 0, 4294967295)
  return { value, componentId: source.bind(identity, 'unknown-extension', parentId, 'property') }
}

// Called with the real semantic-projector context after relationship inventory.
// This reads only the table payload; the caller still owns frame transform,
// nonvisual metadata, occurrence placement, renderer and admission qualification.
function readSemanticTable(context, source = tableSource(context)) {
  const frame = context.node
  if (context.source.kind !== 'graphic-frame' || !P_URIS.has(frame.uri) || frame.local !== 'graphicFrame')
    source.fail(frame, 'wrong table owner')
  const nonvisual = frame.children.find((entry) => P_URIS.has(entry.uri) && entry.local === 'nvGraphicFramePr')
  const identity = nonvisual?.children.find((entry) => P_URIS.has(entry.uri) && entry.local === 'cNvPr')
  if (!identity || decodeXml(attr(identity, 'id') ?? '') !== context.source.nativeId) source.fail(frame, 'wrong native owner')
  const graphics = frame.children.filter((entry) => A_URIS.has(entry.uri) && entry.local === 'graphic')
  if (graphics.length !== 1) source.fail(frame, 'missing/duplicate graphic')
  const graphic = graphics[0]
  source.attrs(graphic)
  source.children(graphic, ['graphicData'])
  const data = source.required(graphic, 'graphicData'), uri = source.attrs(data, ['uri']).uri
  if (!TABLE_GRAPHIC_DATA_URIS.has(uri))
    source.fail(data, 'wrong graphicData URI')
  source.children(data, ['tbl'])
  const table = source.required(data, 'tbl')
  source.attrs(table)
  source.children(table, ['tblPr', 'tblGrid', 'tr'], ['tr'])
  if (!/^(?:tblPr,)?tblGrid,tr(?:,tr)*$/.test(table.children.map((entry) => entry.local).join(',')))
    source.fail(table, 'invalid table sequence')
  const componentId = source.bind(table, 'table', context.source.id, 'property')
  const grid = source.required(table, 'tblGrid')
  source.attrs(grid)
  source.children(grid, ['gridCol'], ['gridCol'])
  if (!grid.children.length || grid.children.length > 4096) source.fail(grid, 'column budget')
  const columns = grid.children.map((column) => {
    source.children(column, ['extLst'])
    const result = { componentId: source.component(column, 'column'),
      widthEmu: source.number(column, source.attrs(column, ['w']).w, 0, 27273042316900) }
    if (column.children.length)
      result.identity = validateTableIdentityExtension(source, column.children[0], COLUMN_ID_EXTENSION_URI, 'colId', componentId)
    return result
  })
  const rowNodes = table.children.filter((entry) => entry.local === 'tr')
  if (rowNodes.length > 4096 || rowNodes.length * columns.length > 65536) source.fail(table, 'cell budget')
  const rows = rowNodes.map((row) => {
    const attributes = source.attrs(row, ['h'])
    source.children(row, ['tc', 'extLst'], ['tc'])
    const rowExtension = row.children.find((entry) => entry.local === 'extLst')
    let nativeIdentity
    if (rowExtension) {
      if (row.children[row.children.length - 1] !== rowExtension)
        source.fail(rowExtension, 'misplaced row identity extension')
      nativeIdentity = validateTableIdentityExtension(source, rowExtension, ROW_ID_EXTENSION_URI, 'rowId', componentId)
    }
    const cells = row.children.filter((entry) => entry.local === 'tc')
    if (cells.length !== columns.length) source.fail(row, 'ragged row')
    const result = { componentId: source.component(row, 'row'),
      heightEmu: source.number(row, attributes.h, 0, 27273042316900),
      cells: cells.map((cell) => {
        const declarations = source.attrs(cell, ['gridSpan', 'rowSpan', 'hMerge', 'vMerge']), merge = {}
        source.children(cell, ['txBody', 'tcPr'])
        if (!/^txBody(?:,tcPr)?$/.test(cell.children.map((entry) => entry.local).join(',')))
          source.fail(cell, 'invalid cell sequence')
        const cellId = source.bind(cell, 'table-cell', componentId, 'cell')
        for (const [key, value] of Object.entries(declarations))
          merge[key] = key.endsWith('Merge') ? source.boolean(cell, value) : source.number(cell, value, 1, 65536)
        const properties = cell.children.find((entry) => entry.local === 'tcPr')
        return { componentId: cellId, merge, anchorCellId: cellId,
          properties: properties ? readTableProperties(properties, source, true) : {},
          textDocument: readTableText(source.required(cell, 'txBody'), cellId, source) }
      }) }
    if (nativeIdentity) result.identity = nativeIdentity
    return result
  })
  const anchors = source.checked(table, () => tableAnchors(rows, columns.length))
  rows.forEach((row, r) => row.cells.forEach((cell, c) => { cell.anchorCellId = anchors[r][c] }))
  const properties = table.children.find((entry) => entry.local === 'tblPr')
  const tableDocument = source.checked(table, () => normalizeTableDocument({
    schemaVersion: 1, componentId, columns, rows,
    properties: properties ? readTableProperties(properties, source) : {},
  }))
  return { tableDocument, ...source.finish() }
}
module.exports = { readSemanticTable }
