const { correctNativeHtml } = require('../ooxml-native-text-style-html')
const { textContent, isNode, A_URIS } = require('../ooxml-text-run-xml')
const { drawingChildren } = require('./table-source-structure')

function tableSourceParagraphs(xml, cell) {
  const bodies = drawingChildren(cell, 'txBody')
  if (bodies.length !== 1) return null
  const body = bodies[0]
  if (body.children.some((node) => !A_URIS.has(node.uri) || !['bodyPr', 'lstStyle', 'p'].includes(node.local))) return null
  const paragraphs = drawingChildren(body, 'p')
  if (!paragraphs.length) return null
  return paragraphs.map((paragraph) => {
    const runs = []
    let unsupported = false
    for (const child of paragraph.children) {
      if (!A_URIS.has(child.uri)) { unsupported = true; continue }
      if (['pPr', 'endParaRPr'].includes(child.local)) continue
      if (child.local === 'br') { runs.push({ kind: 'break', text: '', style: {} }); continue }
      if (!['r', 'fld'].includes(child.local)) { unsupported = true; continue }
      const texts = drawingChildren(child, 't')
      if (texts.length !== 1 || texts[0].children.length || child.children.some((node) =>
        !isNode(node, A_URIS, 't') && !isNode(node, A_URIS, 'rPr') && !(child.local === 'fld' && isNode(node, A_URIS, 'pPr')))) {
        unsupported = true
        continue
      }
      runs.push({ kind: 'text', text: textContent(xml, texts[0]), style: {} })
    }
    return { runs, style: {}, unsupported }
  })
}

function restoreTableCellText(cell, source) {
  const key = typeof cell.text === 'string' ? 'text' : typeof cell.content === 'string' ? 'content' : null
  if (!key || !source.paragraphs) return cell
  const restored = correctNativeHtml(cell[key], source.paragraphs)
  return restored === cell[key] ? cell : { ...cell, [key]: restored }
}

module.exports = { tableSourceParagraphs, restoreTableCellText }
