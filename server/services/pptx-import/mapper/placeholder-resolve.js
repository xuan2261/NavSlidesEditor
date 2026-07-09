/**
 * Minimal layout placeholder inheritance (Phase 04).
 * When a slide has no title/body text, inject text from slideLayout placeholders if present in scene graph.
 */

function graphPlaceholderNodes(graphSlide) {
  return (graphSlide?.nodes || []).filter((n) => n.ph?.type)
}

/**
 * @param {object} slide - mapped Nav slide { elements, ... }
 * @param {object} graphSlide - scene graph slide
 * @param {{ slideIndex?: number }} [options]
 * @returns {{ elements: object[], injected: number }}
 */
function resolveLayoutPlaceholders(slide, graphSlide, options = {}) {
  const elements = [...(slide?.elements || [])]
  const hasText = elements.some(
    (el) =>
      (el?.type === 'text' || el?.type === 'shape') &&
      String(el?.content || el?.text || '')
        .replace(/<[^>]+>/g, '')
        .trim().length > 0
  )
  if (hasText) return { elements, injected: 0 }

  const placeholders = graphPlaceholderNodes(graphSlide)
  let injected = 0
  for (const ph of placeholders) {
    const phType = String(ph.ph?.type || '').toLowerCase()
    // title / body family only (minimal Phase 04)
    if (!/title|body|^obj$/i.test(phType)) continue
    const label =
      phType.includes('title') || phType === 'ctrtitle'
        ? 'Click to edit title'
        : 'Click to edit text'
    const x = Number(ph.xfrm?.x) || 80
    const y = Number(ph.xfrm?.y) || (phType.includes('title') ? 80 : 200)
    const width = Number(ph.xfrm?.cx) || 800
    const height = Number(ph.xfrm?.cy) || 80
    elements.push({
      id: `layout-ph-${ph.id || injected}`,
      type: 'text',
      x,
      y,
      width,
      height,
      zIndex: elements.length + 1,
      content: `<p>${label}</p>`,
      fontSize: phType.includes('title') ? 36 : 18,
      textColor: '#111111',
      _pptxSource: {
        nodeId: String(ph.id),
        kind: ph.kind || 'shape',
        slideIndex: options.slideIndex ?? 0,
        fromLayoutPlaceholder: true,
        phType,
      },
      _pptxImportMeta: { layoutPlaceholder: true, phType },
    })
    injected += 1
  }
  return { elements, injected }
}

module.exports = {
  graphPlaceholderNodes,
  resolveLayoutPlaceholders,
}
