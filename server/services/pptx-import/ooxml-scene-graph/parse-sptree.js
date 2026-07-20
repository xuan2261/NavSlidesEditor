/**
 * Namespace-tolerant spTree walker for slide XML.
 */

const EMU_PER_PX = 9525 // 96dpi approximation used elsewhere in import geometry

function localName(tag) {
  const m = String(tag || '').match(/^<\/?([A-Za-z0-9]+):?([A-Za-z0-9]+)?/)
  if (!m) return ''
  return (m[2] || m[1] || '').toLowerCase()
}

function attrsOf(openTag) {
  const attrs = {}
  for (const attr of String(openTag || '').matchAll(/([A-Za-z_:][\w:.-]*)=(["'])(.*?)\2/g)) {
    const key = attr[1].includes(':') ? attr[1].split(':').pop() : attr[1]
    attrs[key.toLowerCase()] = attr[3]
  }
  return attrs
}

function emuToPx(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return n / EMU_PER_PX
}

function emuValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseXfrm(chunk) {
  if (!chunk) return null
  const off = chunk.match(/<(?:[a-z0-9]+:)?off\b[^>]*>/i)
  const ext = chunk.match(/<(?:[a-z0-9]+:)?ext\b[^>]*>/i)
  const xfrmOpen = chunk.match(/<(?:[a-z0-9]+:)?xfrm\b[^>]*>/i)
  const offA = off ? attrsOf(off[0]) : {}
  const extA = ext ? attrsOf(ext[0]) : {}
  const xfA = xfrmOpen ? attrsOf(xfrmOpen[0]) : {}
  return {
    x: emuToPx(offA.x),
    y: emuToPx(offA.y),
    cx: emuToPx(extA.cx),
    cy: emuToPx(extA.cy),
    emu: {
      x: emuValue(offA.x),
      y: emuValue(offA.y),
      width: emuValue(extA.cx),
      height: emuValue(extA.cy),
    },
    rot: xfA.rot != null ? Number(xfA.rot) : null,
    flipH: xfA.fliph === '1' || xfA.fliph === 'true',
    flipV: xfA.flipv === '1' || xfA.flipv === 'true',
  }
}

function kindFromTag(name) {
  if (name === 'sp') return 'shape'
  if (name === 'pic') return 'pic'
  if (name === 'cxnsp') return 'cxnSp'
  if (name === 'grpsp') return 'grpSp'
  if (name === 'graphicframe') return 'graphicFrame'
  if (name === 'contentpart') return 'contentPart'
  return null
}

function extractNvName(chunk) {
  const m = String(chunk || '').match(/<(?:[a-z0-9]+:)?cNvPr\b[^>]*>/i)
  if (!m) return { id: null, name: null }
  const a = attrsOf(m[0])
  return { id: a.id || null, name: a.name || null }
}

function extractPlaceholder(chunk) {
  const m = String(chunk || '').match(/<(?:[a-z0-9]+:)?ph\b[^>]*\/?>/i)
  if (!m) return null
  const a = attrsOf(m[0])
  return { type: a.type || null, idx: a.idx || null }
}

function extractBlipEmbed(chunk) {
  const m = String(chunk || '').match(/<(?:[a-z0-9]+:)?blip\b[^>]*>/i)
  if (!m) return null
  const a = attrsOf(m[0])
  return a.embed || a.link || null
}

function extractGraphicUri(chunk) {
  const m = String(chunk || '').match(/<(?:[a-z0-9]+:)?graphicData\b[^>]*>/i)
  if (!m) return null
  return attrsOf(m[0]).uri || null
}

/** Relationship id embedded on chart/diagram/table parts inside a graphicFrame. */
function extractGraphicRelId(chunk) {
  const patterns = [
    /<(?:[a-z0-9]+:)?chart\b[^>]*\b(?:r:)?id=(["'])(.*?)\1/i,
    /<(?:[a-z0-9]+:)?relIds\b[^>]*\b(?:r:)?dm=(["'])(.*?)\1/i,
    /<(?:[a-z0-9]+:)?tbl\b[^>]*\b(?:r:)?id=(["'])(.*?)\1/i,
  ]
  for (const re of patterns) {
    const m = String(chunk || '').match(re)
    if (m) return m[2]
  }
  // Fallback: first r:id / r:embed inside graphicData
  const any = String(chunk || '').match(/\b(?:r:)?(?:id|embed)=(["'])(rId\d+)\1/i)
  return any ? any[2] : null
}

function tokenizeXmlTree(xml) {
  const root = { name: '#document', children: [], start: 0, end: xml.length }
  const stack = [root]
  const tagRe = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<\/?[A-Za-z_][^>]*>/g
  let match
  while ((match = tagRe.exec(xml))) {
    const tag = match[0]
    if (tag.startsWith('<?') || tag.startsWith('<!')) continue
    if (tag.startsWith('</')) {
      const closingName = localName(tag)
      for (let i = stack.length - 1; i > 0; i -= 1) {
        const node = stack.pop()
        node.end = tagRe.lastIndex
        if (node.name === closingName) break
      }
      continue
    }
    const node = {
      name: localName(tag),
      openTag: tag,
      start: match.index,
      end: tagRe.lastIndex,
      children: [],
    }
    stack[stack.length - 1].children.push(node)
    if (!/\/\s*>$/.test(tag)) stack.push(node)
  }
  for (const node of stack.slice(1)) node.end = xml.length
  return root
}

function findFirstNode(root, name) {
  for (const child of root.children || []) {
    if (child.name === name) return child
    const found = findFirstNode(child, name)
    if (found) return found
  }
  return null
}

/**
 * Walk a tokenized slide XML tree and collect direct shape/group descendants.
 * @param {string} slideXml
 * @param {{ maxDepth?: number }} [options]
 */
function parseSpTree(slideXml, options = {}) {
  const maxDepth = options.maxDepth ?? 8
  const nodes = []
  const xml = String(slideXml || '')
  const root = tokenizeXmlTree(xml)
  const tree = findFirstNode(root, 'sptree') || root

  function walk(treeNode, depth, parentId) {
    if (depth > maxDepth) return
    for (const xmlNode of treeNode.children || []) {
      const kind = kindFromTag(xmlNode.name)
      if (!kind) continue
      const chunk = xml.slice(xmlNode.start, xmlNode.end)
      const nv = extractNvName(chunk)
      const node = {
        id: nv.id || `auto-${nodes.length + 1}`,
        name: nv.name,
        kind,
        xfrm: parseXfrm(chunk),
        ph: extractPlaceholder(chunk),
        rels: {},
        parentId: parentId || null,
        depth,
        sourceXml: chunk,
      }
      if (kind === 'pic') {
        const embed = extractBlipEmbed(chunk)
        if (embed) node.rels.blipEmbed = embed
      }
      if (kind === 'graphicFrame') {
        const uri = extractGraphicUri(chunk)
        if (uri) node.graphicUri = uri
        const relId = extractGraphicRelId(chunk)
        if (relId) node.rels.graphicRelId = relId
        if (/chart/i.test(uri || '') || /charts\/chart/i.test(chunk)) node.graphicKind = 'chart'
        else if (/diagram|smartart|dm/i.test(uri || '') || /diagrams\//i.test(chunk)) node.graphicKind = 'diagram'
        else if (/table/i.test(uri || '') || /<a:tbl\b/i.test(chunk)) node.graphicKind = 'table'
        else node.graphicKind = 'unknown'
      }
      nodes.push(node)
      if (kind === 'grpSp') {
        walk(xmlNode, depth + 1, node.id)
      }
    }
  }

  walk(tree, 0, null)
  return nodes
}

module.exports = {
  parseSpTree,
  parseXfrm,
  kindFromTag,
  localName,
  extractGraphicRelId,
  tokenizeXmlTree,
}
