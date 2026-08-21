/**
 * Attach _pptxSource.nodeId to mapped Nav elements from scene-graph leaves.
 * Best-effort sequential assign by document order (parser flatten ≈ leaf walk).
 */

function leafNodes(nodes = []) {
  return (nodes || []).filter((n) => n && n.kind !== 'grpSp')
}

const OLE_GRAPHIC_URI = 'http://schemas.openxmlformats.org/presentationml/2006/ole'

function isPreservedOpaqueNode(node) {
  return node?.kind === 'graphicFrame' && node?.graphicUri === OLE_GRAPHIC_URI
}

function strictLeafNodes(nodes = []) {
  return leafNodes(nodes).filter((node) => !isPreservedOpaqueNode(node))
}

function navKindHint(element) {
  const t = String(element?.type || '').toLowerCase()
  if (t === 'image') return 'pic'
  if (t === 'chart') return 'graphicFrame'
  if (t === 'diagram') return 'graphicFrame'
  if (t === 'table') return 'graphicFrame'
  if (t === 'line') return 'cxnSp'
  if (t === 'shape' || t === 'text') return 'shape'
  if (element?.importPlaceholderType) return 'shape'
  return t || 'shape'
}

function navKindHints(element) {
  const primary = navKindHint(element)
  if (String(element?.type || '').toLowerCase() === 'line') return ['cxnSp', 'shape']
  if (String(element?.type || '').toLowerCase() === 'svg') return ['shape']
  return [primary]
}

/** Composite key: OOXML cNvPr ids are per-slide, not deck-wide. */
function sourceKey(slideIndex, nodeId) {
  return `${Number(slideIndex)}:${String(nodeId)}`
}

function uniqueUnusedNode(leaves, predicate) {
  const matches = leaves.filter((node) => !node._used && predicate(node))
  return matches.length === 1 ? matches[0] : null
}

function geometryBox(element, source = false) {
  const values = source
    ? [element?.xfrm?.x, element?.xfrm?.y, element?.xfrm?.cx, element?.xfrm?.cy]
    : [element?.x, element?.y, element?.width, element?.height]
  if (values.some((value) => value == null || value === '')) return null
  const numbers = values.map(Number)
  return numbers.every(Number.isFinite) ? numbers : null
}

function geometryMatches(element, node, tolerance = 1.1) {
  const mapped = geometryBox(element)
  const source = geometryBox(node, true)
  return Boolean(mapped && source
    && mapped.every((value, index) => Math.abs(value - source[index]) <= tolerance))
}

/**
 * Prefer matching leaf kind when available; otherwise take next unused leaf.
 * Preserves existing _pptxSource (e.g. layout placeholder inject).
 * @returns {{ elements: object[], assigned: number, unassignedLeaves: object[] }}
 */
function attachSourceNodes(elements, graphNodes, slideIndex) {
  const leaves = leafNodes(graphNodes).map((n) => ({ ...n, _used: false }))
  const list = Array.isArray(elements) ? elements : []
  const mappableLeaves = leaves.filter((node) => !isPreservedOpaqueNode(node))
  let assigned = 0

  // Mark leaves already claimed by pre-stamped elements. OLE frames are
  // package-preserved opaque parts, never authoritative editable mappings.
  for (const el of list) {
    const existingId = el?._pptxSource?.nodeId
    if (existingId == null || existingId === '') continue
    const node = leaves.find((n) => !n._used && String(n.id) === String(existingId))
    if (!node) continue
    if (isPreservedOpaqueNode(node)) {
      el._pptxSource = {
        ...el._pptxSource,
        nodeId: String(existingId),
        slideIndex: el._pptxSource.slideIndex ?? slideIndex,
        kind: el._pptxSource.kind || node.kind,
        authoritative: false,
      }
      continue
    }
    node._used = true
    assigned += 1
    el._pptxSource = {
      ...el._pptxSource,
      nodeId: String(existingId),
      slideIndex: el._pptxSource.slideIndex ?? slideIndex,
      kind: el._pptxSource.kind || node.kind,
      authoritative: el._pptxSource.authoritative !== false,
    }
  }

  function assign(el, node, matchedBy, authoritative) {
    node._used = true
    assigned += 1
    el._pptxSource = {
      ...(el._pptxSource || {}),
      nodeId: String(node.id),
      kind: node.kind,
      slideIndex,
      ...(node.graphicKind ? { graphicKind: node.graphicKind } : {}),
      ...(node.name ? { name: node.name } : {}),
      matchedBy,
      authoritative,
    }
  }

  // Reserve identity matches before any heuristic can consume their nodes.
  for (const el of list) {
    if (!el || typeof el !== 'object') continue
    if (el._pptxSource?.nodeId != null && el._pptxSource.nodeId !== '') continue
    const elName = el.name || el._pptxSource?.name || null
    const elSrcId = el.sourceId || el.ooxmlId || el.shapeId || null
    let node = null
    let matchedBy = null
    if (elSrcId != null) {
      node = uniqueUnusedNode(mappableLeaves, (candidate) => String(candidate.id) === String(elSrcId))
      if (node) matchedBy = 'sourceId'
    }
    if (!node && elName) {
      node = uniqueUnusedNode(mappableLeaves, (candidate) =>
        candidate.name && String(candidate.name) === String(elName))
      if (node) matchedBy = 'name'
    }
    if (node) assign(el, node, matchedBy, true)
  }

  // Geometry is authoritative only when one unused same-kind node is within rounding tolerance.
  for (const el of list) {
    if (!el || typeof el !== 'object') continue
    if (el._pptxSource?.nodeId != null && el._pptxSource.nodeId !== '') continue
    const hint = navKindHint(el)
    const node = uniqueUnusedNode(mappableLeaves, (candidate) =>
      candidate.kind === hint && geometryMatches(el, candidate))
    if (node) assign(el, node, 'geometry', true)
  }

  // Preserve deterministic parser order for diagnostics without claiming identity.
  for (const el of list) {
    if (!el || typeof el !== 'object') continue
    if (el._pptxSource?.nodeId != null && el._pptxSource.nodeId !== '') continue
    const hint = navKindHint(el)
    let node = mappableLeaves.find((candidate) => !candidate._used && candidate.kind === hint)
    let matchedBy = 'kind'
    if (!node) {
      node = mappableLeaves.find((candidate) => !candidate._used)
      matchedBy = 'order'
    }
    if (node) assign(el, node, matchedBy, false)
  }

  // A complete named-node bijection validates the parser's documented leaf order.
  const covered = new Map()
  let validCoverage = mappableLeaves.length > 0 && mappableLeaves.every((node) => node.id && node.name)
  for (const el of list) {
    const nodeId = el?._pptxSource?.nodeId
    if (nodeId == null || nodeId === '') continue
    const node = mappableLeaves.find((candidate) => String(candidate.id) === String(nodeId))
    if (!node) continue
    const explicitId = el.sourceId || el.ooxmlId || el.shapeId || null
    if (explicitId != null && String(explicitId) !== String(node.id)) {
      validCoverage = false
      break
    }
    if (covered.has(String(node.id)) || !navKindHints(el).includes(node.kind)) {
      validCoverage = false
      break
    }
    covered.set(String(node.id), el)
  }
  if (validCoverage && covered.size === mappableLeaves.length) {
    for (const [nodeId, el] of covered) {
      if (el._pptxSource.authoritative !== false) continue
      el._pptxSource = {
        ...el._pptxSource,
        nodeId,
        matchedBy: 'documentOrder',
        authoritative: true,
      }
    }
  }

  const unassignedLeaves = leaves.filter((n) => !n._used).map(({ _used, ...rest }) => rest)
  return { elements: list, assigned, unassignedLeaves }
}

/** @returns {Set<string>} keys of form "slideIndex:nodeId" */
function collectMappedNodeIds(presentation) {
  const ids = new Set()
  for (const [slideIndex, slide] of (presentation?.slides || []).entries()) {
    for (const el of slide.elements || []) {
      const id = el?._pptxSource?.nodeId
      if (id == null || id === '') continue
      if (el._pptxSource.authoritative === false) continue
      const si = el._pptxSource.slideIndex != null ? el._pptxSource.slideIndex : slideIndex
      ids.add(sourceKey(si, id))
    }
  }
  return ids
}

module.exports = {
  leafNodes,
  strictLeafNodes,
  isPreservedOpaqueNode,
  navKindHint,
  attachSourceNodes,
  collectMappedNodeIds,
  sourceKey,
}
