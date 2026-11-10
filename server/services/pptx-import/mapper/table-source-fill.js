const { parseXml, descendants, isNode, attr, textContent, A_URIS } = require('../ooxml-text-run-xml')
const { resolveRelationshipTarget } = require('../ooxml-scene-graph/parse-rels')
const { drawingChildren } = require('./table-source-structure')

const REL_URIS = new Set(['http://schemas.openxmlformats.org/package/2006/relationships', 'http://purl.oclc.org/ooxml/package/relationships'])
const enabled = (properties, name) => ['1', 'true'].includes(properties && attr(properties, name))

async function readStylesPart(zip) {
  const relPath = 'ppt/_rels/presentation.xml.rels'
  const entry = zip.file(relPath)
  if (!entry) return null
  let relXml
  try { relXml = await entry.async('string') } catch (cause) {
    throw new Error('Unable to read presentation table style relationships', { cause })
  }
  const relationships = descendants({ children: parseXml(relXml) }, (node) =>
    isNode(node, REL_URIS, 'Relationship') && /\/tableStyles$/.test(attr(node, 'Type') || '') && attr(node, 'TargetMode') !== 'External')
  if (relationships.length !== 1) return null
  const target = resolveRelationshipTarget(relPath, attr(relationships[0], 'Target'))
  const styleEntry = target && zip.file(target)
  if (!styleEntry) return null
  try { return parseXml(await styleEntry.async('string')) } catch (cause) {
    throw new Error(`Unable to read table styles part ${target}`, { cause })
  }
}

// undefined means absent; null means present but unsupported, never a fallback.
function explicitFill(node) {
  if (!node) return undefined
  const fills = node.children.filter((child) => A_URIS.has(child.uri) && /^(?:noFill|solidFill|gradFill|blipFill|pattFill|grpFill|fillRef)$/.test(child.local))
  if (!fills.length) return undefined
  if (fills.length !== 1) return null
  const fill = fills[0]
  if (fill.local === 'noFill' && !fill.children.length) return 'transparent'
  if (fill.local !== 'solidFill' || fill.children.length !== 1) return null
  const color = fill.children[0]
  const value = attr(color, 'val')
  return isNode(color, A_URIS, 'srgbClr') && !color.children.length && /^[\da-f]{6}$/i.test(value || '') ? `#${value}` : null
}

function regionFill(style, name) {
  const regions = drawingChildren(style, name)
  if (!regions.length) return undefined
  if (regions.length !== 1) return null
  const cells = drawingChildren(regions[0], 'tcStyle')
  if (!cells.length) return undefined
  if (cells.length !== 1) return null
  const direct = explicitFill(cells[0])
  if (direct !== undefined) return direct
  const wrappers = drawingChildren(cells[0], 'fill')
  return wrappers.length > 1 ? null : explicitFill(wrappers[0])
}

function selectedTableStyle(table, styles, sourceXml) {
  if (!styles) return null
  const properties = drawingChildren(table, 'tblPr')
  const ids = properties.length === 1 ? drawingChildren(properties[0], 'tableStyleId') : []
  if (ids.length !== 1) return null
  // tableStyleId is text, not a name and not the tableStyles default style.
  const id = textContent(sourceXml, ids[0]).trim()
  const candidates = descendants({ children: styles }, (node) => isNode(node, A_URIS, 'tblStyle') && attr(node, 'styleId') === id)
  return candidates.length === 1 ? candidates[0] : null
}


function conditionalRegions(properties, row, col, rows, cols) {
  const regions = ['wholeTbl']
  if (enabled(properties, 'bandRow')) {
    const offset = enabled(properties, 'firstRow') ? 1 : 0
    if (row >= offset && !(row === rows - 1 && enabled(properties, 'lastRow'))) regions.push((row - offset) % 2 ? 'band2H' : 'band1H')
  }
  if (enabled(properties, 'bandCol')) {
    const offset = enabled(properties, 'firstCol') ? 1 : 0
    if (col >= offset && !(col === cols - 1 && enabled(properties, 'lastCol'))) regions.push((col - offset) % 2 ? 'band2V' : 'band1V')
  }
  if (!col && enabled(properties, 'firstCol')) regions.push('firstCol')
  if (col === cols - 1 && enabled(properties, 'lastCol')) regions.push('lastCol')
  if (!row && enabled(properties, 'firstRow')) regions.push('firstRow')
  if (row === rows - 1 && enabled(properties, 'lastRow')) regions.push('lastRow')
  if (!row && enabled(properties, 'firstRow')) {
    if (!col && enabled(properties, 'firstCol')) regions.push('nwCell')
    if (col === cols - 1 && enabled(properties, 'lastCol')) regions.push('neCell')
  }
  if (row === rows - 1 && enabled(properties, 'lastRow')) {
    if (!col && enabled(properties, 'firstCol')) regions.push('swCell')
    if (col === cols - 1 && enabled(properties, 'lastCol')) regions.push('seCell')
  }
  return regions
}

function sourceCellFill(table, cell, style, row, col, rows, cols) {
  const properties = drawingChildren(cell, 'tcPr')
  const direct = properties.length > 1 ? null : explicitFill(properties[0])
  if (direct !== undefined) return direct
  if (!style) return undefined
  const tablePr = drawingChildren(table, 'tblPr')[0]
  let result
  for (const name of conditionalRegions(tablePr, row, col, rows, cols)) {
    const fill = regionFill(style, name)
    if (fill !== undefined) result = fill
  }
  return result
}

module.exports = { readStylesPart, selectedTableStyle, sourceCellFill }
