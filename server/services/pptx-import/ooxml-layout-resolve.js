/**
 * Resolve placeholders from slideLayout XML when slide is empty (Phase 08a).
 */
const { parseSpTree } = require('./ooxml-scene-graph/parse-sptree')

async function readZipText(zip, entry) {
  const file = zip?.file?.(entry)
  if (!file) return ''
  try {
    return await file.async('string')
  } catch {
    return ''
  }
}

/**
 * Find layout path for a slide via rels (slideLayout relationship).
 */
async function findSlideLayoutPath(zip, slideIndex) {
  const relPath = `ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`
  const relXml = await readZipText(zip, relPath)
  const m = String(relXml).match(
    /Type="[^"]*slideLayout"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*slideLayout"/i
  )
  if (!m) {
    // fallback first layout
    const layouts = Object.keys(zip?.files || {})
      .map((e) => e.replace(/\\/g, '/'))
      .filter((e) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(e))
      .sort()
    return layouts[0] || null
  }
  const target = (m[1] || m[2] || '').replace(/\\/g, '/')
  if (!target) return null
  // resolve relative to ppt/slides/
  if (target.startsWith('../')) return `ppt/${target.replace(/^\.\.\//, '')}`
  if (target.startsWith('ppt/')) return target
  return `ppt/slides/${target}`
}

/**
 * Build placeholder text elements from layout when slide has no text.
 * Applies theme major font to title, minor to body when provided.
 */
async function resolveLayoutFromZip(slide, zip, options = {}) {
  const elements = [...(slide?.elements || [])]
  const hasText = elements.some(
    (el) =>
      (el?.type === 'text' || el?.type === 'shape') &&
      String(el?.content || el?.text || '')
        .replace(/<[^>]+>/g, '')
        .trim().length > 0
  )
  if (hasText || !zip) return { elements, injected: 0, layoutPath: null }

  const slideIndex = options.slideIndex ?? 0
  const layoutPath = await findSlideLayoutPath(zip, slideIndex)
  if (!layoutPath) return { elements, injected: 0, layoutPath: null }

  const layoutXml = await readZipText(zip, layoutPath)
  if (!layoutXml) return { elements, injected: 0, layoutPath }

  const nodes = parseSpTree(layoutXml)
  const fonts = options.fonts || {}
  let injected = 0
  for (const node of nodes) {
    const phType = String(node.ph?.type || '').toLowerCase()
    if (!phType || !/title|body|^obj$/i.test(phType)) continue
    const isTitle = phType.includes('title')
    const label = isTitle ? 'Click to edit title' : 'Click to edit text'
    const fontFamily = isTitle ? fonts.major : fonts.minor
    const fontSize = isTitle ? 36 : 18
    elements.push({
      id: `layout-xml-ph-${node.id || injected}`,
      type: 'text',
      x: Number(node.xfrm?.x) || 80,
      y: Number(node.xfrm?.y) || (isTitle ? 80 : 200),
      width: Number(node.xfrm?.cx) || 800,
      height: Number(node.xfrm?.cy) || 80,
      zIndex: elements.length + 1,
      content: `<p>${label}</p>`,
      fontSize,
      ...(fontFamily ? { fontFamily } : {}),
      textColor: options.scheme?.dk1 || '#111111',
      _pptxSource: {
        nodeId: String(node.id || `layout-${injected}`),
        kind: node.kind || 'shape',
        slideIndex,
        fromLayoutPlaceholder: true,
        fromLayoutXml: true,
        phType,
        layoutPath,
      },
      _pptxImportMeta: { layoutPlaceholder: true, phType, layoutPath },
    })
    injected += 1
  }
  return { elements, injected, layoutPath }
}

module.exports = {
  findSlideLayoutPath,
  resolveLayoutFromZip,
}
