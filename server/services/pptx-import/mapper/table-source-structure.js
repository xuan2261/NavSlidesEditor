const { parseSpTree } = require('../ooxml-scene-graph/parse-sptree')
const { parseXml, descendants, isNode, attr, A_URIS, P_URIS, TABLE_GRAPHIC_DATA_URIS } = require('../ooxml-text-run-xml')

const drawingChildren = (node, name) => node.children.filter((child) => isNode(child, A_URIS, name))

/** Keep namespace context from the complete part, not the detached frame XML. */
function sourceTableNodes(xml) {
  const frames = descendants({ children: parseXml(xml) }, (node) => isNode(node, P_URIS, 'graphicFrame'))
  const byXml = new Map()
  for (const frame of frames) {
    const graphics = drawingChildren(frame, 'graphic')
    const data = graphics.length === 1 ? drawingChildren(graphics[0], 'graphicData') : []
    if (data.length !== 1 || !TABLE_GRAPHIC_DATA_URIS.has(attr(data[0], 'uri'))) continue
    const tables = drawingChildren(data[0], 'tbl')
    const identities = descendants(frame, (node) => isNode(node, P_URIS, 'cNvPr'))
    if (tables.length !== 1 || identities.length !== 1) continue
    const sourceXml = xml.slice(frame.start, frame.closeEnd + 1)
    byXml.set(sourceXml, { table: tables[0], id: attr(identities[0], 'id') })
  }
  return parseSpTree(xml).filter((node) => node.graphicKind === 'table').flatMap((node) => {
    const source = byXml.get(node.sourceXml)
    return source && source.id === node.id ? [{ ...node, sourceTable: source.table, sourcePartXml: xml }] : []
  })
}

function sourceRows(table) {
  const rows = drawingChildren(table, 'tr').map((row) => drawingChildren(row, 'tc'))
  const grids = drawingChildren(table, 'tblGrid')
  if (!rows.length || grids.length > 1) return null
  if (grids.length) {
    const columns = drawingChildren(grids[0], 'gridCol')
    if (!columns.length || rows.some((row) => row.length !== columns.length)) return null
  }
  return rows
}

module.exports = { drawingChildren, sourceTableNodes, sourceRows }
