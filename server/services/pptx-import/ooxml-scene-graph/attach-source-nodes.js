/**
 * Attach _pptxSource.nodeId to mapped Nav elements from scene-graph leaves.
 * Best-effort sequential assign by document order (parser flatten ≈ leaf walk).
 */

function leafNodes(nodes = []) {
  return (nodes || []).filter((n) => n && n.kind !== 'grpSp')
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

/** Composite key: OOXML cNvPr ids are per-slide, not deck-wide. */
function sourceKey(slideIndex, nodeId) {
  return `${Number(slideIndex)}:${String(nodeId)}`
}

/**
 * Prefer matching leaf kind when available; otherwise take next unused leaf.
 * Preserves existing _pptxSource (e.g. layout placeholder inject).
 * @returns {{ elements: object[], assigned: number, unassignedLeaves: object[] }}
 */
function attachSourceNodes(elements, graphNodes, slideIndex) {
  const leaves = leafNodes(graphNodes).map((n) => ({ ...n, _used: false }))
  const list = Array.isArray(elements) ? elements : []
  let assigned = 0

  // Mark leaves already claimed by pre-stamped elements
  for (const el of list) {
    const existingId = el?._pptxSource?.nodeId
    if (existingId == null || existingId === '') continue
    const node = leaves.find((n) => !n._used && String(n.id) === String(existingId))
    if (node) {
      node._used = true
      assigned += 1
      el._pptxSource = {
        ...el._pptxSource,
        nodeId: String(existingId),
        slideIndex: el._pptxSource.slideIndex ?? slideIndex,
        kind: el._pptxSource.kind || node.kind,
      }
    }
  }

  for (const el of list) {
    if (!el || typeof el !== 'object') continue
    if (el._pptxSource?.nodeId != null && el._pptxSource.nodeId !== '') continue
    const hint = navKindHint(el)
    // Prefer cNvPr-aligned identity: parser name / id match graph node
    const elName = el.name || el._pptxSource?.name || null
    const elSrcId = el.sourceId || el.ooxmlId || el.shapeId || null
    let node =
      (elSrcId != null && leaves.find((n) => !n._used && String(n.id) === String(elSrcId))) ||
      (elName && leaves.find((n) => !n._used && n.name && String(n.name) === String(elName))) ||
      leaves.find((n) => !n._used && n.kind === hint) ||
      leaves.find((n) => !n._used)
    if (!node) continue
    node._used = true
    assigned += 1
    el._pptxSource = {
      ...(el._pptxSource || {}),
      nodeId: String(node.id),
      kind: node.kind,
      slideIndex,
      ...(node.graphicKind ? { graphicKind: node.graphicKind } : {}),
      ...(node.name ? { name: node.name } : {}),
      ...(elSrcId != null ? { matchedBy: 'sourceId' } : elName ? { matchedBy: 'name' } : { matchedBy: 'order' }),
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
      const si = el._pptxSource.slideIndex != null ? el._pptxSource.slideIndex : slideIndex
      ids.add(sourceKey(si, id))
    }
  }
  return ids
}

module.exports = {
  leafNodes,
  navKindHint,
  attachSourceNodes,
  collectMappedNodeIds,
  sourceKey,
}
