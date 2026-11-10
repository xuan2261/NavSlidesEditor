/**
 * Resolve placeholders from slideLayout XML when slide is empty (Phase 08a).
 */
const { parseSpTree } = require('./ooxml-scene-graph/parse-sptree')
const { mapBox } = require('./geometry')
const { readSlideOrder, relationshipPart } = require('./slide-order')

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
  const slidePath =
    (await readSlideOrder(zip))[slideIndex] ||
    (!zip?.file?.('ppt/presentation.xml') ? `ppt/slides/slide${slideIndex + 1}.xml` : null)
  if (!slidePath) return null
  const relPath = relationshipPart(slidePath)
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
  if ([...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)].some((match) => match[1].trim()))
    return null
  const preset = xml.match(/<a:prstGeom[^>]*\bprst="([^"]+)"/i)?.[1]?.toLowerCase()
  const scale = context.scale || { x: 1, y: 1 }
  const box = mapBox(
    { left: node.xfrm.x, top: node.xfrm.y, width: node.xfrm.cx, height: node.xfrm.cy },
    scale
  )
  const base = {
    id: `layout-decoration-${node.id || zIndex}`,
    ...box,
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
      strokeWidth: Number.isFinite(lineWidthEmu)
        ? Math.max(1, (lineWidthEmu / 12700) * scale.x)
        : 1,
    }
  }
  return null
}

function sameDecoration(left, right) {
  const close = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) <= 1
  return (
    left.type === right.type &&
    close(left.x, right.x) &&
    close(left.y, right.y) &&
    close(left.width, right.width) &&
    close(left.height, right.height)
  )
}

async function resolveLayoutFromZip(slide, zip, options = {}) {
  const elements = [...(slide?.elements || [])]
  if (!zip) return { elements, injected: 0, decorativeInjected: 0, layoutPath: null }

  const slideIndex = options.slideIndex ?? 0
  const layoutPath = options.layoutPath ?? (await findSlideLayoutPath(zip, slideIndex))
  if (!layoutPath) return { elements, injected: 0, decorativeInjected: 0, layoutPath: null }

  const layoutXml = await readZipText(zip, layoutPath)
  if (!layoutXml) return { elements, injected: 0, decorativeInjected: 0, layoutPath }

  const nodes = parseSpTree(layoutXml)
  const decorations = nodes
    .filter((node) => !options.nativeDecorationNodeIds?.has(String(node.id)))
    .map((node, index) =>
      layoutDecoration(node, index + 1, {
        scheme: options.scheme,
        scale: options.scale,
        slideIndex,
        layoutPath,
      })
    )
    .filter(Boolean)
    .filter(
      (candidate) =>
        options.nativeDecorationNodeIds ||
        !elements.some((element) => sameDecoration(element, candidate))
    )
  if (decorations.length) elements.unshift(...decorations)

  const hasText =
    options.hasSlideText ??
    elements.some(
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
    const scale = options.scale || { x: 1, y: 1 }
    const box = mapBox(
      {
        left: node.xfrm?.x ?? 80,
        top: node.xfrm?.y ?? (isTitle ? 80 : 200),
        width: node.xfrm?.cx ?? 800,
        height: node.xfrm?.cy ?? 80,
      },
      scale
    )
    elements.push({
      id: `layout-xml-ph-${node.id || injected}`,
      type: 'text',
      ...box,
      zIndex: elements.length + 1,
      content: `<p>${label}</p>`,
      fontSize: fontSize * scale.y,
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
