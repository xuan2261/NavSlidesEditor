/**
 * Parse OOXML ppt/diagrams/data*.xml into editable node model (Phase 06).
 * Prefers drawing positions when drawing.xml provided; else linear layout.
 */

function extractTextFromPt(ptXml) {
  const texts = []
  for (const m of String(ptXml || '').matchAll(/<(?:[a-z0-9]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-z0-9]+:)?t>/gi)) {
    const t = m[1].replace(/<[^>]+>/g, '').trim()
    if (t) texts.push(t)
  }
  return texts.join(' ').trim()
}

function attrsOf(tag) {
  const attrs = {}
  for (const attr of String(tag || '').matchAll(/([A-Za-z_:][\w:.-]*)=(["'])(.*?)\2/g)) {
    const key = attr[1].includes(':') ? attr[1].split(':').pop() : attr[1]
    attrs[key.toLowerCase()] = attr[3]
  }
  return attrs
}

/**
 * @param {string} dataXml
 * @returns {{ nodes: Array<{ id: string, text: string, type: string }>, connections: Array<{ src: string, dest: string }> }}
 */
function parseOoxmlDiagramData(dataXml) {
  const nodes = []
  const connections = []
  if (!dataXml) return { nodes, connections }

  // Points: <dgm:pt ... type="node|doc|...">
  const ptRe = /<(?:[a-z0-9]+:)?pt\b([^>]*)>([\s\S]*?)<\/(?:[a-z0-9]+:)?pt>/gi
  let m
  while ((m = ptRe.exec(String(dataXml)))) {
    const attrs = attrsOf(m[0])
    const type = String(attrs.type || 'node').toLowerCase()
    if (type === 'doc' || type === 'partrans' || type === 'sibtrans') continue
    const id = attrs.modelid || attrs.id || `node-${nodes.length + 1}`
    const text = extractTextFromPt(m[2])
    if (type === 'node' || text) {
      nodes.push({ id: String(id), text, type: type || 'node' })
    }
  }

  const cxnRe = /<(?:[a-z0-9]+:)?cxn\b([^>]*)\/?>/gi
  while ((m = cxnRe.exec(String(dataXml)))) {
    const attrs = attrsOf(m[0])
    if (attrs.srcid && attrs.destid) {
      connections.push({ src: String(attrs.srcid), dest: String(attrs.destid) })
    }
  }

  return { nodes, connections }
}

/**
 * Layout nodes horizontally when no drawing positions available.
 */
function layoutNodesLinear(nodes, box = { x: 80, y: 160, width: 800, height: 200 }) {
  const n = Math.max(1, nodes.length)
  const gap = 16
  const nodeW = Math.max(80, (box.width - gap * (n - 1)) / n)
  const nodeH = Math.min(120, box.height)
  return nodes.map((node, i) => ({
    ...node,
    x: box.x + i * (nodeW + gap),
    y: box.y,
    width: nodeW,
    height: nodeH,
  }))
}

async function readZipText(zip, entry) {
  const file = zip?.file?.(entry)
  if (!file) return ''
  try {
    return await file.async('string')
  } catch {
    return ''
  }
}

function scaleAxis(scale) {
  if (!scale || typeof scale !== 'object') return { x: 1, y: 1 }
  const x = Number(scale.x)
  const y = Number(scale.y)
  return {
    x: Number.isFinite(x) && x > 0 ? x : 1,
    y: Number.isFinite(y) && y > 0 ? y : 1,
  }
}

/**
 * Inject editable shape nodes for scene-graph diagram frames missing mapped diagram content.
 * Attaches shared `_pptxDiagram` model for re-edit of node text.
 */
async function injectDiagramsFromSceneGraph({
  elements,
  graphSlide,
  zip,
  slideIndex = 0,
  stats = {},
  warnings = [],
  scale = { x: 1, y: 1 },
}) {
  const list = Array.isArray(elements) ? [...elements] : []
  if (!zip || !graphSlide) return list

  const diagramNodes = (graphSlide.nodes || []).filter(
    (n) => n.graphicKind === 'diagram' || n.rels?.diagramTarget
  )
  if (!diagramNodes.length) return list

  // If parser already produced diagram-derived shapes with _pptxDiagram, skip inject for that model
  const hasDiagramModel = list.some((el) => el?._pptxDiagram?.nodes?.length)
  if (hasDiagramModel) return list

  const s = scaleAxis(scale)

  for (const node of diagramNodes) {
    const dataPath = node.rels?.diagramTarget
    if (!dataPath) {
      warnings.push({
        slideIndex,
        type: 'native-smartart-degraded',
        message: `Diagram node ${node.id} has no diagram data relationship`,
      })
      continue
    }

    const xml = await readZipText(zip, dataPath)
    const parsed = parseOoxmlDiagramData(xml)
    if (!parsed.nodes.length) {
      warnings.push({
        slideIndex,
        type: 'native-smartart-degraded',
        message: `Diagram ${dataPath} has no text nodes`,
      })
      continue
    }

    const box = {
      x: Number(node.xfrm?.x) || 80,
      y: Number(node.xfrm?.y) || 120,
      width: Number(node.xfrm?.cx) || 800,
      height: Number(node.xfrm?.cy) || 200,
    }
    const laidOut = layoutNodesLinear(parsed.nodes, box)
    const model = {
      source: 'ooxml-diagram-parser',
      dataPath,
      graphicNodeId: String(node.id),
      slideIndex,
      nodes: laidOut.map((n) => ({ id: n.id, text: n.text, type: n.type })),
      connections: parsed.connections,
    }

    for (const [i, n] of laidOut.entries()) {
      list.push({
        id: `diagram-ooxml-${node.id}-${i}`,
        type: 'shape',
        shape: 'rounded-rect',
        x: Math.round(n.x * s.x * 10) / 10,
        y: Math.round(n.y * s.y * 10) / 10,
        width: Math.max(1, Math.round(n.width * s.x * 10) / 10),
        height: Math.max(1, Math.round(n.height * s.y * 10) / 10),
        zIndex: list.length + 1,
        fill: '#e0e7ff',
        stroke: '#6366f1',
        strokeWidth: 1,
        text: n.text || `Node ${i + 1}`,
        textColor: '#111827',
        fontSize: 16,
        content: n.text ? `<p>${n.text}</p>` : `<p>Node ${i + 1}</p>`,
        _pptxSource: {
          nodeId: String(node.id),
          kind: 'graphicFrame',
          graphicKind: 'diagram',
          slideIndex,
          diagramNodeId: n.id,
        },
        _pptxDiagram: model,
        _pptxDiagramNode: { id: n.id, index: i },
      })
    }
    stats.diagramCount = (stats.diagramCount || 0) + 1
    stats.nativeSmartArtImportedCount = (stats.nativeSmartArtImportedCount || 0) + 1
  }

  return list
}

/**
 * Attach shared editable diagram model onto shapes produced by parser flatten.
 */
function stampDiagramModelOnFlattened(elements, sourceElement, slideIndex = 0) {
  const list = Array.isArray(elements) ? elements : []
  if (!list.length) return list
  const textNodes = list
    .filter((el) => el.type === 'shape' || el.type === 'text')
    .map((el, index) => ({
      id: el.id || `n-${index}`,
      text: String(el.text || el.content || '')
        .replace(/<[^>]+>/g, '')
        .trim(),
      type: 'node',
    }))
  const model = {
    source: 'parser-flatten',
    slideIndex,
    nodes: textNodes,
    connections: [],
    originalType: sourceElement?.diagramType || sourceElement?.type || 'diagram',
  }
  for (const el of list) {
    if (el.type === 'shape' || el.type === 'text') {
      el._pptxDiagram = model
    }
  }
  return list
}

module.exports = {
  parseOoxmlDiagramData,
  layoutNodesLinear,
  injectDiagramsFromSceneGraph,
  stampDiagramModelOnFlattened,
  extractTextFromPt,
}
