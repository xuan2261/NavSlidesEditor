const { resolveNativeParts } = require('./native-layout-layers')
const { parseXml, descendants, attr, decodeXml, isNode, A_URIS } = require('../ooxml-text-run-xml')
const { drawingChildren, sourceTableNodes, sourceRows } = require('./table-source-structure')
const { tableSourceParagraphs, restoreTableCellText } = require('./table-source-text')
const { readStylesPart, selectedTableStyle, sourceCellFill } = require('./table-source-fill')

const MARGINS = { left: ['marL', 91440], right: ['marR', 91440], top: ['marT', 45720], bottom: ['marB', 45720] }

function tableProperties(sourceXml, sourceTable = null, styles = null) {
  const tables = sourceTable ? [sourceTable] : descendants({ children: parseXml(sourceXml) }, (node) => isNode(node, A_URIS, 'tbl'))
  if (tables.length !== 1) return null
  const rows = sourceRows(tables[0])
  if (!rows) return null
  const style = selectedTableStyle(tables[0], styles, sourceXml)
  return rows.map((row, ri) => row.map((cell, ci) => {
    const properties = drawingChildren(cell, 'tcPr')[0]
    const insets = {}
    for (const [side, [name, fallback]] of Object.entries(MARGINS)) {
      const raw = properties ? attr(properties, name) : null
      const value = raw == null ? fallback : Number(raw)
      if (Number.isFinite(value) && value >= 0) insets[side] = value / 12700
    }
    const anchor = properties && attr(properties, 'anchor')
    const vAlign = { t: 'top', ctr: 'middle', b: 'bottom' }[anchor]
    const fillColor = sourceCellFill(tables[0], cell, style, ri, ci, rows.length, row.length)
    return { insets, paragraphs: tableSourceParagraphs(sourceXml, cell),
      ...(typeof fillColor === 'string' ? { fillColor } : {}), ...(vAlign ? { vAlign } : {}) }
  }))
}

function sameGeometry(element, node) {
  return node.xfrm && [
    [element.left ?? element.x, node.xfrm.x], [element.top ?? element.y, node.xfrm.y],
    [element.width, node.xfrm.cx], [element.height, node.xfrm.cy],
  ].every(([raw, source]) => raw != null && source != null &&
    Number.isFinite(Number(raw)) && Math.abs(Number(raw) - source) <= 0.00011)
}

function tableElements(elements, result = []) {
  for (const element of elements || []) {
    if (element?.type === 'table') result.push(element)
    else if (element?.type === 'group') tableElements(element.elements, result)
  }
  return result
}

function matchTables(elements, nodes) {
  const matched = new Map()
  const used = new Set()
  const assignUnique = (element, predicate) => {
    const candidates = nodes.filter((node) => !used.has(node) && predicate(node))
    if (candidates.length !== 1) return false
    matched.set(element, candidates[0]); used.add(candidates[0])
    return true
  }
  for (const element of elements) {
    const sourceId = element._pptxNativeSource?.nodeId ?? element.sourceId ?? element.ooxmlId ??
      element.shapeId ?? element._pptxSource?.nodeId
    if (sourceId != null) {
      assignUnique(element, (node) => String(node.id) === String(sourceId))
      continue
    }
    if (element.name != null) assignUnique(element, (node) => decodeXml(node.name || '') === element.name)
  }
  for (const element of elements) {
    const explicitId = element._pptxNativeSource?.nodeId ?? element.sourceId ?? element.ooxmlId ??
      element.shapeId ?? element._pptxSource?.nodeId
    if (!matched.has(element) && explicitId == null) assignUnique(element, (node) => sameGeometry(element, node))
  }
  // Identical geometry needs a complete, geometrically proven document-order bijection.
  const remaining = elements.filter((element) => !matched.has(element))
  const candidates = nodes.filter((node) => !used.has(node))
  if (remaining.length === candidates.length && remaining.every((element, index) =>
    element._pptxNativeSource?.nodeId == null && element.sourceId == null && element.ooxmlId == null &&
    element.shapeId == null && element._pptxSource?.nodeId == null && sameGeometry(element, candidates[index]))) {
    remaining.forEach((element, index) => matched.set(element, candidates[index]))
  }
  return matched
}

function supplementCells(element, node, styles) {
  const sourceRows = tableProperties(node.sourcePartXml, node.sourceTable, styles)
  if (!sourceRows || !Array.isArray(element.data) || sourceRows.length !== element.data.length ||
    element.data.some((row, index) => !Array.isArray(row) || row.length !== sourceRows[index].length)) return element
  return { ...element, data: element.data.map((row, ri) => row.map((cell, ci) => {
    if (!cell || typeof cell !== 'object') return cell
    const source = sourceRows[ri][ci]
    const insets = { ...source.insets }
    for (const [side, aliases] of Object.entries({
      left: ['insetLeft', 'marginLeft', 'lIns', 'insetL'], right: ['insetRight', 'marginRight', 'rIns', 'insetR'],
      top: ['insetTop', 'marginTop', 'tIns', 'insetT'], bottom: ['insetBottom', 'marginBottom', 'bIns', 'insetB'],
    })) {
      if (aliases.some((key) => cell[key] != null)) delete insets[side]
    }
    return { ...restoreTableCellText(cell, source), insets: { ...insets, ...cell.insets },
      ...(source.fillColor != null ? { fillColor: source.fillColor } : {}),
      ...(cell.vAlign == null && source.vAlign ? { vAlign: source.vAlign } : {}) }
  })) }
}

/** Supplement only exact source tables; parser cells remain the typography authority. */
async function applyTableSourceProperties({ slide, zip, slideIndex }) {
  if (!zip || !tableElements(slide?.elements).length) return slide
  const parts = await resolveNativeParts(zip, slideIndex)
  const styles = await readStylesPart(zip)
  const byPart = new Map()
  for (const element of tableElements(slide.elements)) {
    const part = element._pptxNativePartUri || parts.slidePath
    if (!part) continue
    if (!byPart.has(part)) byPart.set(part, [])
    byPart.get(part).push(element)
  }
  const replacements = new Map()
  for (const [part, elements] of byPart) {
    const entry = zip.file(part)
    if (!entry) continue
    let xml
    try { xml = await entry.async('string') } catch (cause) {
      throw new Error(`Unable to read table source part ${part}`, { cause })
    }
    const nodes = sourceTableNodes(xml)
    const ordered = [...elements].sort((left, right) => {
      if (left.order == null || right.order == null) return 0
      return Number(left.order) - Number(right.order)
    })
    for (const [element, node] of matchTables(ordered, nodes)) replacements.set(element, supplementCells(element, node, styles))
  }
  const replace = (elements) => elements.map((element) => replacements.get(element) ||
    (element?.type === 'group' ? { ...element, elements: replace(element.elements || []) } : element))
  return { ...slide, elements: replace(slide.elements) }
}

module.exports = { applyTableSourceProperties, tableProperties }
