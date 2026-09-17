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
function colorFromXml(xml, fallback = null, scheme = {}) {
  const source = String(xml || '')
  const rgb = source.match(/<a:solidFill>[\s\S]*?<a:srgbClr[^>]*\bval="([0-9a-f]{6,8})"/i)?.[1]
  if (rgb) return `#${rgb.slice(0, 6).toUpperCase()}`
  const schemeKey = source.match(/<a:solidFill>[\s\S]*?<a:schemeClr[^>]*\bval="([^"]+)"/i)?.[1]
  return schemeKey && scheme[schemeKey] ? scheme[schemeKey] : fallback
}

function layoutDecoration(node, zIndex, context = {}) {
  if (node?.ph || node?.kind !== 'shape' || !node.xfrm) return null
  const scheme = context.scheme || {}
  const xml = String(node.sourceXml || '')
  if ([...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)].some((match) => match[1].trim())) return null
  const preset = xml.match(/<a:prstGeom[^>]*\bprst="([^"]+)"/i)?.[1]?.toLowerCase()
  const x = Number(node.xfrm.x) || 0
  const y = Number(node.xfrm.y) || 0
  const width = Math.max(1, Number(node.xfrm.cx) || 1)
  const height = Math.max(1, Number(node.xfrm.cy) || 1)
  const base = {
    id: `layout-decoration-${node.id || zIndex}`,
    x,
    y,
    width,
    height,
    zIndex,
    locked: true,
    _pptxSource: {
      nodeId: `layout:${context.layoutPath || 'unknown'}:${node.id || zIndex}`,
      kind: node.kind,
      slideIndex: context.slideIndex ?? 0,
      fromLayoutDecoration: true,
      authoritative: false,
    },
  }
  if (preset === 'rect') {
    const fill = colorFromXml(xml, null, scheme)
    if (!fill) return null
    return {
      ...base,
      type: 'shape',
      shape: 'rect',
      fill,
      stroke: 'transparent',
      strokeWidth: 0,
    }
  }
  if (preset === 'line') {
    const stroke = colorFromXml(xml, null, scheme)
    if (!stroke) return null
    const lineWidthEmu = Number(xml.match(/<a:ln[^>]*\bw="(\d+)"/i)?.[1])
    return {
      ...base,
      type: 'line',
      stroke,
      strokeWidth: Number.isFinite(lineWidthEmu) ? Math.max(1, lineWidthEmu / 12700) : 1,
    }
  }
  return null
}

function sameDecoration(left, right) {
  const close = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) <= 1
  return left.type === right.type && close(left.x, right.x) && close(left.y, right.y) &&
    close(left.width, right.width) && close(left.height, right.height)
}

async function resolveLayoutFromZip(slide, zip, options = {}) {
  const elements = [...(slide?.elements || [])]
  if (!zip) return { elements, injected: 0, decorativeInjected: 0, layoutPath: null }

  const slideIndex = options.slideIndex ?? 0
  const layoutPath = await findSlideLayoutPath(zip, slideIndex)
  if (!layoutPath) return { elements, injected: 0, decorativeInjected: 0, layoutPath: null }

  const layoutXml = await readZipText(zip, layoutPath)
  if (!layoutXml) return { elements, injected: 0, decorativeInjected: 0, layoutPath }

  const nodes = parseSpTree(layoutXml)
  const decorations = nodes
    .map((node, index) => layoutDecoration(node, index + 1, {
      scheme: options.scheme,
      slideIndex,
      layoutPath,
    }))
    .filter(Boolean)
    .filter((candidate) => !elements.some((element) => sameDecoration(element, candidate)))
  if (decorations.length) elements.unshift(...decorations)

  const hasText = elements.some(
    (el) =>
      (el?.type === 'text' || el?.type === 'shape') &&
      String(el?.content || el?.text || '')
        .replace(/<[^>]+>/g, '')
        .trim().length > 0
  )
  if (hasText) {
    return { elements, injected: 0, decorativeInjected: decorations.length, layoutPath }
  }

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
  return { elements, injected, decorativeInjected: decorations.length, layoutPath }
}

module.exports = {
  findSlideLayoutPath,
  resolveLayoutFromZip,
}
