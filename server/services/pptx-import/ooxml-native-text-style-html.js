const { parseHtmlTree } = require('revealjs-shared')
const { coverage, sourceCoverage, restoreRuns } = require('./ooxml-native-text-style-whitespace')

const TAGS = new Set(['p', 'li', 'ul', 'ol', 'span', 'a', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup'])
function visit(node, predicate, result = []) {
  for (const item of node.children || []) { if (predicate(item)) result.push(item); visit(item, predicate, result) }
  return result
}
function setStyle(node, properties) {
  const keys = new Set(Object.keys(properties))
  const kept = String(node.attrs.style || '').split(';').filter((declaration) =>
    declaration.trim() && !keys.has(declaration.split(':', 1)[0].trim().toLowerCase()))
  node.attrs.style = [...kept, ...Object.entries(properties).map(([key, val]) => `${key}: ${val}`)].join(';') + ';'
}
function serialize(node) {
  if (node.type === 'text') return node.text
  if (node.type === 'root') return node.children.map(serialize).join('')
  const attrs = Object.entries(node.attrs).map(([key, val]) => ` ${key}="${String(val).replaceAll('"', '&quot;')}"`).join('')
  return node.tag === 'br' ? `<br${attrs}>` : `<${node.tag}${attrs}>${node.children.map(serialize).join('')}</${node.tag}>`
}


function correctNativeHtml(content, paragraphs) {
  if (content.includes('<!--')) return content
  const tree = parseHtmlTree(content)
  if (visit(tree, (node) => node.type === 'element' && !TAGS.has(node.tag)).length) return content
  const blocks = visit(tree, (node) => node.type === 'element' && (node.tag === 'p' || node.tag === 'li'))
  if (blocks.length !== paragraphs.length) return content
  // Parser spans may merge differently from source runs. Require exact paragraph
  // text coverage, then split only text leaves; links, lists, fields and breaks stay.
  if (!blocks.every((block, index) => {
    const paragraph = paragraphs[index]
    if (paragraph.unsupported) return false
    const source = sourceCoverage(paragraph.runs)
    const actual = coverage(block)
    return actual === source || (!source && !actual.trim())
  })) return content
  blocks.forEach((block, index) => {
    setStyle(block, paragraphs[index].style)
    restoreRuns(block, paragraphs[index].runs, Boolean(paragraphs[index].style['--pptx-tab-stops']))
  })
  return serialize(tree)
}

module.exports = { correctNativeHtml }
