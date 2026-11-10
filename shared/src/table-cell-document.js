const { parseFragment, serialize } = require('parse5')
const { sanitizeRichTextHtml } = require('./content-safety.js')

const BLOCKS = new Set(['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote'])
const EXCLUDED = new Set(['img', 'table', 'hr'])

function parseCellDocument(html) {
  const root = parseFragment(sanitizeRichTextHtml(html))
  function prune(parent) {
    parent.childNodes = (parent.childNodes || []).filter(node => !EXCLUDED.has(node.tagName))
    for (const node of parent.childNodes) prune(node)
  }
  prune(root)
  return root
}

// Text offsets belong to decoded characters, never serialized HTML/entity bytes.
function cellDocumentEntries(root) {
  const entries = []
  let offset = 0
  function push(node, text, previous) {
    entries.push({ node, text, start: offset, end: offset + text.length, previous })
    offset += text.length
  }
  function walk(parent) {
    let previous
    for (const node of parent.childNodes || []) {
      if (previous && (BLOCKS.has(previous.tagName) || BLOCKS.has(node.tagName))) push(node, '\n', previous)
      if (node.nodeName === '#text') push(node, node.value)
      else if (node.tagName === 'br') push(node, '\n')
      else walk(node)
      previous = node
    }
  }
  walk(root)
  return entries
}

function removeNode(node) {
  const siblings = node.parentNode.childNodes
  siblings.splice(siblings.indexOf(node), 1)
}

function replaceCellDocumentRange(root, start, end, value) {
  const entries = cellDocumentEntries(root)
  let target = entries.find(entry => !entry.previous && entry.node.nodeName === '#text' && entry.start <= start && entry.end >= start)
  if (!target) {
    const boundary = entries.find(entry => (entry.previous || entry.node.tagName === 'br') && entry.start <= start && entry.end >= start)
    let parent, index
    if (boundary?.previous) {
      parent = start === boundary.start ? boundary.previous : boundary.node
      if (BLOCKS.has(parent.tagName)) index = start === boundary.start ? parent.childNodes.length : 0
      else { parent = boundary.node.parentNode; index = parent.childNodes.indexOf(boundary.node) }
    } else if (boundary) {
      parent = boundary.node.parentNode
      index = parent.childNodes.indexOf(boundary.node) + (start === boundary.end ? 1 : 0)
    } else {
      parent = root.childNodes.find(node => BLOCKS.has(node.tagName)) || root
      index = parent.childNodes.length
    }
    // Anchor the owning empty gap before deletion can merge its paragraph.
    const node = { nodeName: '#text', value: '', parentNode: parent }
    parent.childNodes.splice(index, 0, node)
    target = { node, start }
  }
  const targetOffset = start - target.start
  // Delete from the end; paragraph joins retain both sides' rich descendants.
  for (const entry of [...entries].reverse()) {
    const left = Math.max(start, entry.start), right = Math.min(end, entry.end)
    if (right <= left) continue
    if (entry.previous) {
      const { previous, node } = entry
      if (BLOCKS.has(previous.tagName) && BLOCKS.has(node.tagName)) {
        for (const child of node.childNodes || []) { child.parentNode = previous; previous.childNodes.push(child) }
        removeNode(node)
      }
    } else if (entry.node.tagName === 'br') removeNode(entry.node)
    else entry.node.value = entry.node.value.slice(0, left - entry.start) + entry.node.value.slice(right - entry.start)
  }
  const offset = Math.min(targetOffset, target.node.value.length)
  target.node.value = target.node.value.slice(0, offset) + value + target.node.value.slice(offset)
}

function serializeCellDocument(root) {
  return serialize(root)
}

module.exports = { parseCellDocument, cellDocumentEntries, replaceCellDocumentRange, serializeCellDocument }
