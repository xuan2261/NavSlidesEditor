const { normalizeTextProperties } = require('../../../shared/src/pptx-text-document')
const { validateTableProperties } = require('../../../shared/src/pptx-table-properties')
const { textContent } = require('./ooxml-text-run-xml')

function readTableColor(node, source) {
  source.children(node, ['tint', 'shade', 'lumMod', 'lumOff', 'alpha', 'alphaMod', 'alphaOff'],
    ['tint', 'shade', 'lumMod', 'lumOff', 'alpha', 'alphaMod', 'alphaOff'])
  const attributes = source.attrs(node, node.local === 'sysClr' ? ['val', 'lastClr'] : ['val'])
  let kind, value
  if (node.local === 'sysClr') {
    if (!attributes.lastClr || !/^[\da-fA-F]{6}$/.test(attributes.lastClr))
      source.fail(node, 'unresolved system color')
    kind = 'srgb'
    value = attributes.lastClr.toLowerCase()
  } else {
    kind = { srgbClr: 'srgb', schemeClr: 'scheme', prstClr: 'preset' }[node.local]
    if (!kind) source.fail(node, 'unsupported color')
    value = attributes.val
  }
  const color = { kind, value }
  if (node.children.length) color.transforms = node.children.map((item) => {
    source.children(item)
    return { kind: item.local, value: source.number(item, source.attrs(item, ['val']).val, -100000, 1000000) }
  })
  return source.checked(node, () => normalizeTextProperties({ color }, 'run').color)
}
function readTableFill(node, source) {
  source.attrs(node)
  source.children(node, node.local === 'noFill' ? [] : ['srgbClr', 'schemeClr', 'prstClr', 'sysClr'])
  if (node.local === 'noFill') return { color: { kind: 'none' } }
  if (node.children.length !== 1) source.fail(node, 'missing/duplicate fill color')
  return { color: readTableColor(node.children[0], source) }
}
function readTableBorder(node, source) {
  const attributes = source.attrs(node, ['w', 'cap', 'cmpd', 'algn']), result = {}
  source.children(node, ['noFill', 'solidFill', 'prstDash', 'round', 'bevel', 'miter', 'headEnd', 'tailEnd'])
  if (attributes.w !== undefined) result.width = source.number(node, attributes.w, 0, 20116800)
  for (const [native, key] of [['cap', 'cap'], ['cmpd', 'compound'], ['algn', 'alignment']])
    if (attributes[native] !== undefined) result[key] = attributes[native]
  for (const child of node.children) {
    if (['noFill', 'solidFill'].includes(child.local)) {
      if (result.color) source.fail(child, 'conflicting line fill')
      result.color = readTableFill(child, source).color
    } else if (child.local === 'prstDash') {
      source.children(child)
      result.dash = { kind: 'preset', value: source.attrs(child, ['val']).val }
    } else if (child.local === 'headEnd' || child.local === 'tailEnd') {
      source.children(child)
      result[child.local] = source.attrs(child, ['type', 'w', 'len'])
    } else {
      if (result.join) source.fail(child, 'conflicting line join')
      source.children(child)
      const props = source.attrs(child, child.local === 'miter' ? ['lim'] : [])
      result.join = { kind: child.local, ...(props.lim !== undefined ?
        { limit: source.number(child, props.lim, 0) } : {}) }
    }
  }
  source.checked(node, () => validateTableProperties({ borders: { left: result } }, undefined, true))
  return result
}
function readTableProperties(node, source, cell = false) {
  const flags = ['rtl', 'firstRow', 'lastRow', 'firstCol', 'lastCol', 'bandRow', 'bandCol']
  const fields = { marL: 'marginLeftEmu', marR: 'marginRightEmu', marT: 'marginTopEmu', marB: 'marginBottomEmu',
    anchor: 'verticalAlign', anchorCtr: 'anchorCenter', vert: 'verticalText', horzOverflow: 'horzOverflow' }
  const sides = { lnL: 'left', lnR: 'right', lnT: 'top', lnB: 'bottom',
    lnTlToBr: 'topLeftToBottomRight', lnBlToTr: 'bottomLeftToTopRight' }
  const attributes = source.attrs(node, cell ? Object.keys(fields) : flags), result = {}
  source.children(node, ['noFill', 'solidFill', ...(cell ? Object.keys(sides) : ['tableStyleId'])])
  for (const [key, value] of Object.entries(attributes)) {
    result[cell ? fields[key] : key] = !cell || key === 'anchorCtr' ? source.boolean(node, value) :
      key.startsWith('mar') ? source.number(node, value, 0) : value
  }
  for (const child of node.children) {
    if (child.local === 'tableStyleId') {
      source.attrs(child)
      if (child.children.length) source.fail(child, 'invalid table style reference')
      result.tableStyleId = textContent(source.xml, child).trim()
      if (!/^\{[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}$/i.test(result.tableStyleId))
        source.fail(child, 'invalid table style identity')
      continue
    }
    if (sides[child.local]) {
      result.borders ??= {}
      result.borders[sides[child.local]] = readTableBorder(child, source)
    } else {
      if (result.fill) source.fail(child, 'conflicting fill')
      result.fill = readTableFill(child, source)
    }
  }
  source.checked(node, () => validateTableProperties(result, undefined, cell))
  return result
}
module.exports = { readTableColor, readTableProperties }
