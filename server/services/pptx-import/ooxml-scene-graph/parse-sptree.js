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

/**
 * Walk slide XML and collect nodes under p:spTree (depth-limited groups).
 * @param {string} slideXml
 * @param {{ maxDepth?: number }} [options]
 */
function parseSpTree(slideXml, options = {}) {
  const maxDepth = options.maxDepth ?? 8
  const nodes = []
  const xml = String(slideXml || '')

  // Find spTree body
  const treeMatch = xml.match(/<(?:[a-z0-9]+:)?spTree\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9]+:)?spTree>/i)
  const body = treeMatch ? treeMatch[1] : xml

  function walk(fragment, depth, parentId) {
    if (depth > maxDepth) return
    // Match top-level shape-like elements in this fragment (non-greedy balanced-ish by tag name)
    const re = /<(?:[a-z0-9]+:)?(sp|pic|cxnSp|grpSp|graphicFrame|contentPart)\b([^>]*)>([\s\S]*?)<\/(?:[a-z0-9]+:)?\1\s*>/gi
    let m
    while ((m = re.exec(fragment))) {
      const tag = m[1]
      const kind = kindFromTag(tag.toLowerCase())
      if (!kind) continue
      const chunk = m[0]
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
      }
      if (kind === 'pic') {
        const embed = extractBlipEmbed(chunk)
        if (embed) node.rels.blipEmbed = embed
      }
      if (kind === 'graphicFrame') {
        const uri = extractGraphicUri(chunk)
        if (uri) node.graphicUri = uri
        if (/chart/i.test(uri || '') || /charts\/chart/i.test(chunk)) node.graphicKind = 'chart'
        else if (/diagram|smartart|dm/i.test(uri || '') || /diagrams\//i.test(chunk)) node.graphicKind = 'diagram'
        else if (/table/i.test(uri || '') || /<a:tbl\b/i.test(chunk)) node.graphicKind = 'table'
        else node.graphicKind = 'unknown'
      }
      nodes.push(node)
      if (kind === 'grpSp') {
        // children live inside grpSp after grpSpPr / nvGrpSpPr
        walk(m[3], depth + 1, node.id)
      }
    }
  }

  walk(body, 0, null)
  return nodes
}

module.exports = {
  parseSpTree,
  parseXfrm,
  kindFromTag,
  localName,
}
