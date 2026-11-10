const { escapePlainText } = require('./content-safety.js')
const { mergeInlineStyle, cssPxToPptPt, normalizeAlign } = require('./shared-html-parser.js')
const { normalizeCssColor } = require('./shared-color-utils.js')
const { parseCellDocument, cellDocumentEntries, replaceCellDocumentRange, serializeCellDocument } = require('./table-cell-document.js')

function isRichTableCell(cell) {
  return Boolean(cell && typeof cell === 'object' && !Array.isArray(cell) && typeof cell.html === 'string')
}
function createRichTableCell(html) {
  return { html: serializeCellDocument(parseCellDocument(String(html ?? ''))) }
}
function tableCellText(cell) {
  return isRichTableCell(cell)
    ? cellDocumentEntries(parseCellDocument(cell.html)).map(entry => entry.text).join('')
    : String(cell ?? '')
}
function tableCellHtml(cell) {
  return isRichTableCell(cell) ? createRichTableCell(cell.html).html : escapePlainText(String(cell ?? ''))
}
function updateTableCellText(cell, value) {
  const next = String(value ?? '')
  if (!isRichTableCell(cell)) return next
  const previous = tableCellText(cell)
  if (previous === next) return cell
  let start = 0, suffix = 0
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++
  while (suffix < previous.length - start && suffix < next.length - start && previous[previous.length - suffix - 1] === next[next.length - suffix - 1]) suffix++
  const root = parseCellDocument(cell.html)
  replaceCellDocumentRange(root, start, previous.length - suffix, next.slice(start, next.length - suffix))
  return { html: serializeCellDocument(root) }
}
function replaceTableCellText(cell, regex, replacement, options = {}) {
  const text = tableCellText(cell), start = options.start ?? 0
  const source = text.slice(start)
  const flags = regex.flags.replace(/g|y/g, '')
  const matcher = new RegExp(regex.source, `${flags}g`)
  const changes = []
  source.replace(matcher, (...args) => {
    const named = typeof args[args.length - 1] === 'object'
    const index = args[args.length - (named ? 3 : 2)]
    if (options.global !== false || !changes.length) {
      // Native replacement expansion handles $$, $&, capture groups and surrounding text.
      const exact = new RegExp(regex.source, flags + 'y')
      exact.lastIndex = index
      const replaced = source.replace(exact, replacement)
      const value = replaced.slice(index, replaced.length - (source.length - index - args[0].length))
      changes.push({ start: start + index, end: start + index + args[0].length, value })
    }
    return args[0]
  })
  if (!changes.length) return cell
  if (!isRichTableCell(cell)) {
    let result = text
    for (const change of changes.reverse()) result = result.slice(0, change.start) + change.value + result.slice(change.end)
    return result
  }
  const root = parseCellDocument(cell.html)
  for (const change of changes.reverse()) replaceCellDocumentRange(root, change.start, change.end, change.value)
  return { html: serializeCellDocument(root) }
}

function tableCellPptxRuns(cell, baseStyle = {}) {
  if (!isRichTableCell(cell)) return tableCellText(cell)
  const root = parseCellDocument(cell.html)
  const entries = cellDocumentEntries(root)
  const styles = new Map()
  function walk(node, inherited) {
    const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]))
    const style = mergeInlineStyle(inherited, { type: 'element', tag: node.tagName, attrs })
    const css = attrs.style || ''
    for (const [property, key, normal] of [['font-weight', 'bold', 'normal|[1-5]00'], ['font-style', 'italic', 'normal']]) {
      if (new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*(?:${normal})\\s*(?:;|$)`, 'i').test(css)) style[key] = false
    }
    if (node.tagName === 'a' && attrs.href) style.link = attrs.href
    styles.set(node, style)
    for (const child of node.childNodes || []) walk(child, style)
  }
  walk(root, baseStyle)
  const runs = entries.filter(entry => entry.text.length).map(entry => {
    if (entry.previous || entry.node.tagName === 'br') return { text: '', options: { breakLine: true } }
    const style = styles.get(entry.node), options = { bold: Boolean(style.bold), italic: Boolean(style.italic) }
    for (const key of ['underline', 'strike', 'subscript', 'superscript', 'fontFace']) if (style[key]) options[key] = style[key]
    if (style.fontSize) options.fontSize = cssPxToPptPt(style.fontSize)
    if (style.charSpacing) options.charSpacing = cssPxToPptPt(style.charSpacing)
    if (normalizeAlign(style.align)) options.align = style.align
    if (style.link) options.hyperlink = { url: style.link }
    if (style.color) Object.assign(options, normalizeCssColor(style.color))
    return { text: entry.text, options }
  })
  // PptxGenJS only starts the paragraph after a break when another run follows.
  if (runs.at(-1)?.options.breakLine) runs.push({ text: '', options: {} })
  return runs
}
module.exports = { isRichTableCell, createRichTableCell, tableCellText, tableCellHtml, updateTableCellText, replaceTableCellText, tableCellPptxRuns }
