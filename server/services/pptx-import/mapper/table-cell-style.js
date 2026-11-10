const { extractTextMetadata } = require('./utils-text')
const { mergeInlineStyle, parseHtmlTree } = require('revealjs-shared')

function uniformBold(html) {
  let seen = false
  let bold = true
  const walk = (node, inherited) => {
    if (node.type === 'text') {
      if (String(node.text || '').trim()) { seen = true; bold = bold && inherited.bold === true }
      return
    }
    const style = node.type === 'element' ? mergeInlineStyle(inherited, node) : inherited
    for (const child of node.children || []) walk(child, style)
  }
  walk(parseHtmlTree(html), {})
  return seen && bold
}
function cellTextStyle(cell, html, scale) {
  const metadata = extractTextMetadata(html, cell, scale)
  return {
    textColor: cell.fontColor ?? metadata.textColor ?? null,
    fontSize: metadata.fontSize ?? null,
    fontFamily: metadata.fontFamily ?? null,
    bold: cell.fontBold != null ? Boolean(cell.fontBold) : uniformBold(html),
    align: cell.align ?? cell.paragraphAlign ?? metadata.textAlign ?? 'left',
  }
}

function cellInsets(cell, scale) {
  const result = {}
  for (const [side, aliases, axis] of [
    ['top', ['insetTop', 'marginTop', 'tIns', 'insetT'], 'y'],
    ['right', ['insetRight', 'marginRight', 'rIns', 'insetR'], 'x'],
    ['bottom', ['insetBottom', 'marginBottom', 'bIns', 'insetB'], 'y'],
    ['left', ['insetLeft', 'marginLeft', 'lIns', 'insetL'], 'x'],
  ]) {
    const raw = cell.insets?.[side] ?? aliases.map((key) => cell[key]).find((value) => value != null)
    if ((typeof raw !== 'number' && typeof raw !== 'string') || raw === '') continue
    const value = Number(raw)
    if (Number.isFinite(value) && value >= 0) result[side] = value * scale[axis]
  }
  return Object.keys(result).length ? result : null
}

function cellVerticalAlign(value) {
  const aliases = { up: 'top', ctr: 'middle', mid: 'middle', center: 'middle', down: 'bottom' }
  const align = aliases[value] || value
  return ['top', 'middle', 'bottom'].includes(align) ? align : 'middle'
}

module.exports = { cellTextStyle, cellInsets, cellVerticalAlign }
