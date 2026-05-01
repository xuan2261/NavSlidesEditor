const uuidv4 = () => require('node:crypto').randomUUID()
const { CANVAS_SIZE } = require('./constants')
const { createMediaIndex, persistImageForElement, persistZipMediaRef, persistMediaBlob } = require('./media')
const { sanitizeHtml } = require('./sanitize')
const { mapChart } = require('./chart-output-to-navslides-mapper')
const { mergeInlineStyle, normalizeAlign, parseHtmlTree } = require('revealjs-shared')
const {
  applyToPoint,
  clampBox,
  identityMatrix,
  mapBox,
  mapBoxByMatrix,
  mapLineGeometry,
  multiply,
  normalizeSourceSize,
  readCoord,
  readNumber,
  rotateAround,
  scaleAround,
  translate,
} = require('./geometry')

function plainText(html) {
  return sanitizeHtml(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeFontSize(value) {
  const size = parseFloat(value)
  return Number.isFinite(size) && size > 0 ? size : undefined
}

function normalizeFontFamily(value) {
  const family = String(value || '')
    .split(',')[0]
    .replace(/["']/g, '')
    .trim()
  return family || undefined
}

function buildBaseTextStyle(element = {}) {
  const style = {}
  const align = normalizeAlign(String(element.textAlign || element.align || element.paragraphAlign || '').toLowerCase())
  const fontSize = normalizeFontSize(element.fontSize || element.fontSz)
  const fontFamily = normalizeFontFamily(element.fontFamily || element.fontFace || element.font || element.fontName)
  const color = element.textColor || element.fontColor || element.color

  if (align) style.align = align
  if (fontSize) style.fontSize = fontSize
  if (fontFamily) style.fontFace = fontFamily
  if (color) style.color = color
  return style
}

function applyTextStyle(metadata, style) {
  const align = normalizeAlign(String(style.align || '').toLowerCase())
  const fontSize = normalizeFontSize(style.fontSize)
  const fontFamily = normalizeFontFamily(style.fontFace)

  if (!metadata.textAlign && align) metadata.textAlign = align
  if (metadata.fontSize == null && fontSize) metadata.fontSize = fontSize
  if (!metadata.fontFamily && fontFamily) metadata.fontFamily = fontFamily
  if (!metadata.textColor && style.color) metadata.textColor = style.color
}

function extractTextMetadata(html, element = {}) {
  const baseStyle = buildBaseTextStyle(element)
  const fallback = {}
  applyTextStyle(fallback, baseStyle)

  const metadata = {}
  const walk = (node, inheritedStyle) => {
    if (!node) return
    if (node.type === 'text') {
      if (String(node.text || '').replace(/\s+/g, ' ').trim()) {
        applyTextStyle(metadata, inheritedStyle)
      }
      return
    }

    const nextStyle = node.type === 'element' ? mergeInlineStyle(inheritedStyle, node) : inheritedStyle
    for (const child of node.children || []) walk(child, nextStyle)
  }

  walk(parseHtmlTree(html), baseStyle)
  return { ...fallback, ...metadata }
}

function extractTextInsets(element = {}) {
  const left = readNumber(
    element.insetLeft ?? element.marginLeft ?? element.lIns ?? element.insetL,
    null
  )
  const right = readNumber(
    element.insetRight ?? element.marginRight ?? element.rIns ?? element.insetR,
    null
  )
  const top = readNumber(
    element.insetTop ?? element.marginTop ?? element.tIns ?? element.insetT,
    null
  )
  const bottom = readNumber(
    element.insetBottom ?? element.marginBottom ?? element.bIns ?? element.insetB,
    null
  )
  if (![left, right, top, bottom].some((value) => value != null)) return null
  return { left, right, top, bottom }
}

// Phase 2: Enhanced colorValue — handles gradient, none, scheme fills
function colorValue(value, fallback = 'transparent') {
  if (typeof value === 'string' && value) return value
  if (value?.type === 'color' && value.value) return value.value
  if (value?.color) return value.color
  if (value?.type === 'none') return 'none'
  if (value?.type === 'gradient') return 'gradient'
  if (value?.type === 'pattern') return 'transparent'
  return fallback
}

function normalizeGradientStops(fill) {
  const colors = fill?.value?.colors || fill?.colors || fill?.stops || []
  return colors.map((stop, index) => {
    const offsetSource = stop.offset ?? stop.pos ?? (colors.length > 1 ? (index / (colors.length - 1)) * 100 : 0)
    const offset = Number(offsetSource) > 1 ? Number(offsetSource) / 100 : Number(offsetSource)
    return {
      offset: Number.isFinite(offset) ? Math.min(1, Math.max(0, offset)) : 0,
      color: stop.color || stop.value || '#000000',
    }
  })
}

function gradientBackground(fill) {
  const stops = normalizeGradientStops(fill)
  const angle = Number(fill?.value?.rot ?? fill?.angle ?? 0) || 0
  const cssStops = stops.map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`).join(', ')
  return {
    type: 'gradient',
    angle,
    stops,
    gradient: `linear-gradient(${angle}deg, ${cssStops || '#ffffff 0%, #ffffff 100%'})`,
  }
}

function svgAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function arrowMarker(value) {
  const marker = String(value || '').toLowerCase()
  if (!marker || marker === 'none' || marker === 'no') return 'none'
  if (marker.includes('diamond')) return 'diamond'
  if (marker.includes('oval') || marker.includes('circle')) return 'circle'
  if (marker.includes('stealth')) return 'stealth'
  if (marker.includes('triangle') || marker.includes('arrow')) return 'arrow'
  return 'none'
}

function baseElement(element, scale, zIndex, box = null) {
  return {
    id: uuidv4(),
    ...(box || mapBox(element, scale)),
    rotation: readNumber(element?.rotate, 0),
    opacity: typeof element.opacity === 'number' ? element.opacity : 1,
    zIndex,
  }
}

// Phase 2: Expanded to 15+ shape types from pptxtojson
// Uses simple includes() to avoid regex word boundary issues
function shapeName(shapType = '') {
  const s = String(shapType || '').toLowerCase()
  const n = s.replace(/[\s_-]/g, '')

  // circle
  if (n.includes('ellipse') || n.includes('oval') || n.includes('circle')) return 'circle'
  // triangle
  if (n.includes('triangle') || n.includes('isoscelestriangle') || n.includes('righttriangle')) return 'triangle'
  // diamond
  if (n.includes('diamond') || n.includes('rhombus')) return 'diamond'
  // arrow-right — must check before line (rightarrow contains 'line')
  if (n.includes('arrow')) return 'arrow-right'
  // line — pure lines only
  if (n === 'line' || n.includes('line') && !n.includes('arrow') && !n.includes('connector') && !n.includes('straight')) return 'line'
  if (n.includes('straightconnector') || n.includes('straight') && n.includes('connector')) return 'line'
  // rounded-rect
  if (n.includes('round') || n.includes('roundedrect') || n.includes('rounded') || n.includes('corner')) return 'rounded-rect'
  // star
  if (/star/.test(n) && /\d/.test(n)) return 'star'
  if (n.includes('star4') || n.includes('star5') || n.includes('star6') || n.includes('star7') || n.includes('star8') || n.includes('star10') || n.includes('star12')) return 'star'
  // named shapes
  if (n.includes('hexagon')) return 'hexagon'
  if (n.includes('pentagon')) return 'pentagon'
  if (n.includes('cloud')) return 'cloud'
  if (n.includes('cylinder') || n.includes('can')) return 'cylinder'
  if (n.includes('parallelogram')) return 'parallelogram'
  if (n.includes('trapezoid')) return 'trapezoid'
  if (n.includes('bracket') || n.includes('leftbrace') || n.includes('rightbrace') || n.includes('brace')) return 'bracket'
  // rect fallback
  return 'rect'
}

function warning(warnings, slideIndex, type, message) {
  warnings.push({ slideIndex, type, message })
}

function extractShadow(element) {
  const s = element.shadow
  if (!s || typeof s !== 'object') return null
  return {
    shadowX: typeof s.h === 'number' ? s.h : 0,
    shadowY: typeof s.v === 'number' ? s.v : 0,
    shadowBlur: typeof s.blur === 'number' ? s.blur : 0,
    shadowColor: typeof s.color === 'string' ? s.color : '#000000',
  }
}

function placeholder(element, scale, zIndex, slideIndex, warnings, type, label) {
  warning(warnings, slideIndex, type, label)
  return {
    ...baseElement(element, scale, zIndex),
    type: 'shape',
    shape: 'rect',
    fill: '#fff7ed',
    stroke: '#f59e0b',
    strokeWidth: 2,
    locked: true,
    text: label,
    textColor: '#92400e',
    fontSize: 14,
    importPlaceholderType: type,
  }
}

async function mapImage(element, context) {
  const src = await persistImageForElement(element, context.mediaIndex, context.uploadsDir)
  if (!src) {
    return [placeholder(
      element,
      context.scale,
      context.zIndex,
      context.slideIndex,
      context.warnings,
      'media-missing',
      'Image media unavailable'
    )]
  }
  context.stats.imageCount += 1
  const box = mapBox(element, context.scale)
  const img = { ...baseElement(element, context.scale, context.zIndex, box), type: 'image', src }
  // objectFit from fill mode or geometry
  const fillMode = typeof element.fill === 'string' ? element.fill : element.fill?.mode || element.fill?.fit
  if (element.geom === 'picture' || fillMode === 'cover') img.objectFit = 'cover'
  else if (fillMode === 'contain') img.objectFit = 'contain'
  else if (fillMode === 'stretch' || fillMode === 'fill') img.objectFit = 'fill'
  else img.objectFit = 'contain'
  const altText = element.alt || element.title || element.descr || element.description
  if (altText) img.alt = plainText(altText)
  // flip
  if (element.isFlipH) img.flipH = true
  if (element.isFlipV) img.flipV = true
  // border
  if (element.borderColor) img.borderColor = element.borderColor
  if (readNumber(element.borderWidth, 0) > 0) img.borderWidth = readNumber(element.borderWidth, 0)
  // [FIX #3] Extract image filters — pptxtojson uses fixed-point (e.g., 15000 = 150%) → /1000 = CSS percentage
  if (element.filters) {
    const f = element.filters
    if (typeof f.brightness === 'number' && f.brightness !== 100000) {
      img.filterBrightness = Math.round(f.brightness / 1000)
    }
    if (typeof f.contrast === 'number' && f.contrast !== 100000) {
      img.filterContrast = Math.round(f.contrast / 1000)
    }
    if (typeof f.saturation === 'number' && f.saturation !== 100000) {
      if (f.saturation === 0) {
        img.filterGrayscale = 100
      } else if (f.saturation < 50000) {
        img.filterGrayscale = Math.round((1 - f.saturation / 100000) * 100)
      }
    }
    if (typeof f.sharpen === 'number' && f.sharpen > 0) {
      img._pptxImportMeta = { ...(img._pptxImportMeta || {}), _pptxSharpen: f.sharpen }
    }
    if (typeof f.colorTemperature === 'number') {
      img._pptxImportMeta = { ...(img._pptxImportMeta || {}), _pptxColorTemp: f.colorTemperature }
    }
  }
  // Canonical crop model for editor fidelity: imageW/imageH/imageOffset*
  if (element.rect) {
    const rawL = readNumber(element.rect.l, 0)
    const rawR = readNumber(element.rect.r, 0)
    const rawT = readNumber(element.rect.t, 0)
    const rawB = readNumber(element.rect.b, 0)
    const maxVal = Math.max(Math.abs(rawL), Math.abs(rawR), Math.abs(rawT), Math.abs(rawB))
    let left, right, top, bottom
    if (maxVal > 100) {
      left = Math.min(1, Math.max(0, rawL / 1000))
      right = Math.min(1, Math.max(0, rawR / 1000))
      top = Math.min(1, Math.max(0, rawT / 1000))
      bottom = Math.min(1, Math.max(0, rawB / 1000))
    } else if (maxVal >= 1) {
      left = Math.min(1, Math.max(0, rawL / 100))
      right = Math.min(1, Math.max(0, rawR / 100))
      top = Math.min(1, Math.max(0, rawT / 100))
      bottom = Math.min(1, Math.max(0, rawB / 100))
    } else {
      left = Math.min(1, Math.max(0, rawL))
      right = Math.min(1, Math.max(0, rawR))
      top = Math.min(1, Math.max(0, rawT))
      bottom = Math.min(1, Math.max(0, rawB))
    }
    const visibleW = Math.max(0.01, 1 - left - right)
    const visibleH = Math.max(0.01, 1 - top - bottom)
    const imageW = Math.max(1, Math.round(box.width / visibleW))
    const imageH = Math.max(1, Math.round(box.height / visibleH))
    img.imageW = imageW
    img.imageH = imageH
    img.imageOffsetX = -Math.round(imageW * left)
    img.imageOffsetY = -Math.round(imageH * top)
    img._pptxImportMeta = {
      ...(img._pptxImportMeta || {}),
      cropData: { top, bottom, left, right },
    }
  }
  return [img]
}

// Phase 3: Enhanced mapTable — merged cells + per-cell styling
function mapTable(element, context) {
  if (!Array.isArray(element.data) || !element.data.length) {
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'table-unusable', 'Table structure unavailable')]
  }

  const rows = element.data.length
  const cols = Math.max(...element.data.map((row) => (row || []).length))
  const data = []
  const mergedCells = []
  const cellStyles = { textColors: [], bgColors: [], isBold: [], aligns: [], vAligns: [] }

  for (let ri = 0; ri < rows; ri++) {
    const row = element.data[ri] || []
    const dataRow = []
    const cellStylesRow = { textColors: [], bgColors: [], isBold: [], aligns: [], vAligns: [] }

    for (let ci = 0; ci < cols; ci++) {
      const cell = row[ci]
      if (!cell) {
        dataRow.push('')
        cellStylesRow.textColors.push(null)
        cellStylesRow.bgColors.push(null)
        cellStylesRow.isBold.push(false)
        cellStylesRow.aligns.push('left')
        cellStylesRow.vAligns.push('middle')
        continue
      }

      // Skip vMerge continuation cells (rowSpan/colSpan = 0 means continuation)
      if (cell.vMerge === 0 || cell.hMerge === 0) {
        dataRow.push('')
        cellStylesRow.textColors.push(null)
        cellStylesRow.bgColors.push(null)
        cellStylesRow.isBold.push(false)
        cellStylesRow.aligns.push('left')
        cellStylesRow.vAligns.push('middle')
        continue
      }

      // Extract text
      dataRow.push(plainText(cell.text || cell.content || ''))

      // Per-cell styling
      cellStylesRow.textColors.push(cell.fontColor || null)
      cellStylesRow.bgColors.push(cell.fillColor || null)
      cellStylesRow.isBold.push(Boolean(cell.fontBold))

      // Paragraph alignment
      const align = cell.align || cell.paragraphAlign || 'left'
      cellStylesRow.aligns.push(['left', 'center', 'right', 'justify'].includes(align) ? align : 'left')

      // Vertical alignment
      const vAlign = cell.vAlign || 'middle'
      cellStylesRow.vAligns.push(['top', 'middle', 'bottom'].includes(vAlign) ? vAlign : 'middle')

      // Merged cells
      if ((cell.rowSpan && cell.rowSpan > 1) || (cell.colSpan && cell.colSpan > 1)) {
        mergedCells.push({
          row: ri,
          col: ci,
          rowSpan: cell.rowSpan || 1,
          colSpan: cell.colSpan || 1,
        })
      }
    }

    data.push(dataRow)
    cellStyles.textColors.push(cellStylesRow.textColors)
    cellStyles.bgColors.push(cellStylesRow.bgColors)
    cellStyles.isBold.push(cellStylesRow.isBold)
    cellStyles.aligns.push(cellStylesRow.aligns)
    cellStyles.vAligns.push(cellStylesRow.vAligns)
  }

  context.stats.tableCount += 1
  const table = {
    ...baseElement(element, context.scale, context.zIndex),
    type: 'table',
    data,
    rows,
    cols,
    headerRow: true,
    borderColor: '#d1d5db',
    borderWidth: 1,
    textColor: '#111827',
    cellBgColor: 'transparent',
    headerBgColor: 'rgba(99,102,241,0.18)',
    headerTextColor: '#1e40af',
    headerIsBold: true,
    cellStyles,
    mergedCells,
    colWidths: Array.isArray(element.colWidths) ? element.colWidths : [],
    rowHeights: Array.isArray(element.rowHeights) ? element.rowHeights : [],
  }

  // Phase 5: preserve gradient background via colorValue
  // tables may have fill info in element
  if (element.fill && element.fill.type === 'color') {
    table.headerBgColor = element.fill.value || table.headerBgColor
  }

  return [table]
}

async function mapVideo(element, context) {
  const ref = element.ref || ''
  if (/^https?:\/\//i.test(ref)) {
    context.stats.videoCount = (context.stats.videoCount || 0) + 1
    return [{
      ...baseElement(element, context.scale, context.zIndex),
      type: 'video',
      src: ref,
      controls: true,
      autoplay: false,
      loop: false,
      muted: false,
    }]
  }
  const src = await persistMediaBlob(context.mediaIndex, ref, context.uploadsDir)
  if (!src) {
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'video-missing', 'Video media unavailable')]
  }
  context.stats.videoCount = (context.stats.videoCount || 0) + 1
  return [{
    ...baseElement(element, context.scale, context.zIndex),
    type: 'video',
    src,
    controls: true,
    autoplay: false,
    loop: false,
    muted: false,
  }]
}

async function mapAudio(element, context) {
  const ref = element.ref || ''
  if (/^https?:\/\//i.test(ref)) {
    context.stats.audioCount = (context.stats.audioCount || 0) + 1
    return [{
      ...baseElement(element, context.scale, context.zIndex),
      type: 'audio',
      src: ref,
      autoplay: false,
      loop: false,
      muted: false,
    }]
  }
  const src = await persistMediaBlob(context.mediaIndex, ref, context.uploadsDir)
  if (!src) {
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'audio-missing', 'Audio media unavailable')]
  }
  context.stats.audioCount = (context.stats.audioCount || 0) + 1
  return [{
    ...baseElement(element, context.scale, context.zIndex),
    type: 'audio',
    src,
    autoplay: false,
    loop: false,
    muted: false,
  }]
}

function mapShape(element, context) {
  const shape = shapeName(element.shapType)
  if (element.path) {
    context.stats.shapeCount += 1
    const width = Math.max(1, Math.round(readNumber(element.width, 80) * context.scale.x))
    const height = Math.max(1, Math.round(readNumber(element.height, 40) * context.scale.y))
    const fill = colorValue(element.fill, '#e5e7eb')
    const stroke = colorValue(element.borderColor, 'none')
    const strokeWidth = readNumber(element.borderWidth, 0)
    return [{
      ...baseElement(element, context.scale, context.zIndex, mapBox(element, context.scale)),
      type: 'svg',
      content: `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><path d="${svgAttr(element.path)}" fill="${svgAttr(fill)}" stroke="${svgAttr(stroke)}" stroke-width="${strokeWidth}"/></svg>`,
    }]
  }
  if (shape === 'line') {
    context.stats.shapeCount += 1
    const lineGeom = mapLineGeometry(element, context.scale)
    const box = baseElement(
      element,
      context.scale,
      context.zIndex,
      clampBox(lineGeom.box, CANVAS_SIZE)
    )
    const { x1, y1, x2, y2 } = lineGeom.endpoints
    // Arrow detection from explicit fields first, then shapType fallback
    const normType = String(element.shapType || '').toLowerCase()
    const explicitStart = arrowMarker(element.beginArrowType || element.arrowStart || element.startArrowType)
    const explicitEnd = arrowMarker(element.endArrowType || element.arrowEnd || element.arrowType)
    const hasArrowStart = /arrowstart|beginarrow|stealth/i.test(normType)
    const hasArrowEnd = /arrowend|endarrow|arrow|triangle|diamond|oval\b|square|stealth/i.test(normType) && !/\bno\b|\bnone\b/.test(normType)
    return [{
      ...box,
      type: 'line',
      x1,
      y1,
      x2,
      y2,
      stroke: colorValue(element.borderColor, '#111827'),
      strokeWidth: Math.max(1, readNumber(element.borderWidth, 2)),
      dashArray: element.borderStrokeDasharray || element.dashArray || element.lineDash || undefined,
      arrowStart: explicitStart !== 'none' ? explicitStart : hasArrowStart ? 'arrow' : 'none',
      arrowEnd: explicitEnd !== 'none' ? explicitEnd : hasArrowEnd ? 'arrow' : 'none',
    }]
  }
  context.stats.shapeCount += 1
  const textHtml = sanitizeHtml(element.content)
  const textMetadata = extractTextMetadata(textHtml, element)
  const mapped = {
    ...baseElement(element, context.scale, context.zIndex, mapBox(element, context.scale)),
    type: 'shape',
    shape,
    fill: colorValue(element.fill, '#e5e7eb'),
    stroke: colorValue(element.borderColor, 'none'),
    strokeWidth: readNumber(element.borderWidth, 0),
    text: plainText(textHtml),
    textColor: '#111827',
    ...textMetadata,
  }
  if (textHtml) mapped.textHtml = textHtml
  const textInsets = extractTextInsets(element)
  if (textInsets) {
    mapped._pptxImportMeta = {
      ...(mapped._pptxImportMeta || {}),
      textInsets,
    }
  }
  if (element.fill?.type === 'gradient') {
    mapped.fillGradient = gradientBackground(element.fill)
  }
  // [FIX #4] Apply flat shadow fields — renderer reads el.shadowX, el.shadowY, etc.
  const shadow = extractShadow(element)
  if (shadow) {
    mapped.shadowX = shadow.shadowX
    mapped.shadowY = shadow.shadowY
    mapped.shadowBlur = shadow.shadowBlur
    mapped.shadowColor = shadow.shadowColor
  }
  return [mapped]
}

function mapMath(element, context) {
  const latex = element.latex || element.text || ''
  if (!latex) {
    if (element.picBase64) {
      const mathEl = { ...element, type: 'image', base64: element.picBase64 }
      return mapImage(mathEl, context)
    }
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'math', 'Math equation')]
  }
  const cleanLatex = latex.replace(/<[a-z][^>]*>/gi, '').trim()
  if (!cleanLatex) {
    if (element.picBase64) {
      const mathEl = { ...element, type: 'image', base64: element.picBase64 }
      return mapImage(mathEl, context)
    }
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'math', 'Math equation')]
  }
  context.stats.mathCount = (context.stats.mathCount || 0) + 1
  return [{
    ...baseElement(element, context.scale, context.zIndex),
    type: 'latex',
    content: cleanLatex,
    latex: cleanLatex,
    _fallbackSrc: element.picBase64 || null,
  }]
}

async function mapElement(element, context) {
  // Phase 6: Group flattening — replace placeholder with actual flattened children
  if (element.type === 'group') {
    return flattenGroupElement(element, context)
  }
  if (element.type === 'image') return mapImage(element, context)
  if (element.type === 'table') return mapTable(element, context)
  if (element.type === 'video') return mapVideo(element, context)
  if (element.type === 'audio') return mapAudio(element, context)
  if (element.type === 'shape') return mapShape(element, context)
  // Phase 6: SmartArt/Diagram — convert to individual shapes
  if (element.type === 'diagram') {
    return flattenDiagramElement(element, context)
  }
  if (element.type === 'chart') {
    const chartEl = mapChart(element)
    if (chartEl) {
      context.stats.chartCount = (context.stats.chartCount || 0) + 1
      return [{ ...baseElement(element, context.scale, context.zIndex), ...chartEl }]
    }
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'chart-unsupported', 'Chart type unsupported')]
  }
  if (element.type === 'math') return mapMath(element, context)
  if (element.type === 'text' || element.content) {
    context.stats.textCount += 1
    const content = sanitizeHtml(element.content)
    const text = {
      ...baseElement(element, context.scale, context.zIndex),
      type: 'text',
      content,
      ...extractTextMetadata(content, element),
    }
    const textInsets = extractTextInsets(element)
    if (textInsets) {
      text._pptxImportMeta = {
        ...(text._pptxImportMeta || {}),
        textInsets,
      }
    }
    // [FIX #4] Apply flat shadow fields to text elements
    const textShadow = extractShadow(element)
    if (textShadow) {
      text.shadowX = textShadow.shadowX
      text.shadowY = textShadow.shadowY
      text.shadowBlur = textShadow.shadowBlur
      text.shadowColor = textShadow.shadowColor
    }
    return [text]
  }
  return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'unknown-object', 'Unsupported PPTX object locked as placeholder')]
}

const MAX_GROUP_DEPTH = 10

function buildGroupMatrix(group, scale, parentMatrix = identityMatrix()) {
  const left = readCoord(group?.left, group?.x, 0) * scale.x
  const top = readCoord(group?.top, group?.y, 0) * scale.y
  const width = Math.max(1, readNumber(group?.width, 80, 0) * scale.x)
  const height = Math.max(1, readNumber(group?.height, 40, 0) * scale.y)
  const cx = left + width / 2
  const cy = top + height / 2

  let matrix = translate(left, top)
  const rotation = readNumber(group?.rotate, 0)
  if (rotation !== 0) matrix = multiply(rotateAround(rotation, cx, cy), matrix)
  if (group?.isFlipH) matrix = multiply(scaleAround(-1, 1, cx, cy), matrix)
  if (group?.isFlipV) matrix = multiply(scaleAround(1, -1, cx, cy), matrix)

  return multiply(parentMatrix, matrix)
}

// Phase 6/Phase 4 hardening: flatten groups with affine transforms
async function flattenGroupElement(group, context, depth = 0, parentMatrix = identityMatrix(), inheritedRotate = 0) {
  const results = []

  if (depth > MAX_GROUP_DEPTH) {
    context.warnings.push({ slideIndex: context.slideIndex, type: 'group-depth-exceeded', message: `Group depth ${depth} exceeds ${MAX_GROUP_DEPTH}` })
    results.push({ ...placeholder(group, context.scale, context.zIndex, context.slideIndex, context.warnings, 'grouped-complex', 'Deep group locked') })
    return results
  }

  const groupRotation = readNumber(group?.rotate, 0)
  const groupMatrix = buildGroupMatrix(group, context.scale, parentMatrix)
  const children = group.elements || []
  for (const child of children) {
    if (child?.type === 'group') {
      const nested = await flattenGroupElement(
        child,
        {
          ...context,
          zIndex: context.zIndex + results.length,
        },
        depth + 1,
        groupMatrix,
        inheritedRotate + groupRotation
      )
      for (const nestedChild of nested) {
        results.push({
          ...nestedChild,
          zIndex: context.zIndex + results.length,
        })
      }
      continue
    }

    const childBoxLocal = {
      x: readCoord(child?.left, child?.x, 0) * context.scale.x,
      y: readCoord(child?.top, child?.y, 0) * context.scale.y,
      width: Math.max(1, readNumber(child?.width, 80, 0) * context.scale.x),
      height: Math.max(1, readNumber(child?.height, 40, 0) * context.scale.y),
    }
    const mappedBox = mapBoxByMatrix(childBoxLocal, groupMatrix)
    const transformedChild = {
      ...child,
      left: mappedBox.x / context.scale.x,
      top: mappedBox.y / context.scale.y,
      width: mappedBox.width / context.scale.x,
      height: mappedBox.height / context.scale.y,
      rotate: readNumber(child?.rotate, 0) + inheritedRotate + groupRotation,
    }

    if (
      child?.x1 != null &&
      child?.y1 != null &&
      child?.x2 != null &&
      child?.y2 != null
    ) {
      const p1 = applyToPoint(
        groupMatrix,
        childBoxLocal.x + readNumber(child.x1, 0) * context.scale.x,
        childBoxLocal.y + readNumber(child.y1, 0) * context.scale.y
      )
      const p2 = applyToPoint(
        groupMatrix,
        childBoxLocal.x + readNumber(child.x2, 0) * context.scale.x,
        childBoxLocal.y + readNumber(child.y2, 0) * context.scale.y
      )
      transformedChild.x1 = p1.x / context.scale.x
      transformedChild.y1 = p1.y / context.scale.y
      transformedChild.x2 = p2.x / context.scale.x
      transformedChild.y2 = p2.y / context.scale.y
    }

    const childContext = {
      ...context,
      zIndex: context.zIndex + results.length,
    }
    const mappedChildren = await mapElement(transformedChild, childContext)
    for (const mappedChild of mappedChildren) {
      results.push({
        ...mappedChild,
        zIndex: context.zIndex + results.length,
      })
    }
  }

  return results
}

// Phase 6: SmartArt/Diagram — convert to individual shapes
function flattenDiagramElement(element, context) {
  const results = []
  const nodes = element.elements || []
  const textList = element.textList || []

  if (!nodes.length) {
    context.warnings.push({ slideIndex: context.slideIndex, type: 'diagram-empty', message: 'Empty diagram' })
    return []
  }

  const boxWidth = readNumber(element.width, 300, 0)
  const boxHeight = readNumber(element.height, 200, 0)
  const diagramLeft = readCoord(element.left, element.x, 0)
  const diagramTop = readCoord(element.top, element.y, 0)

  const maxNodes = Math.min(nodes.length, 50)
  if (nodes.length > 50) {
    context.warnings.push({ slideIndex: context.slideIndex, type: 'diagram-truncated', message: `Diagram has ${nodes.length} nodes, using first 50` })
  }

  // [FIX #7] Detect connector nodes inside elements[] by shapType — pptxtojson does NOT have connectors[]/arrows[] arrays
  const isConnectorNode = (node) => {
    const s = String(node.shapType || '').toLowerCase()
    return s.includes('line') || s.includes('connector') || s.includes('straight')
  }

  // [FIX #8] Process BOX nodes FIRST (higher z-index), then connectors (lower z-index)
  for (let i = 0; i < maxNodes; i++) {
    const node = nodes[i]
    if (isConnectorNode(node)) continue // skip connectors in this pass

    context.zIndex += 1
    const nodeText = textList[i]?.text || node.text || node.content || ''
    const sanitizedText = plainText(nodeText)
    const nodeX = diagramLeft + readCoord(node.left, node.x, (i * boxWidth) / maxNodes)
    const nodeY = diagramTop + readCoord(node.top, node.y, 0)

    results.push({
      id: uuidv4(),
      x: Math.round(nodeX * context.scale.x),
      y: Math.round(nodeY * context.scale.y),
      width: Math.max(1, Math.round(readNumber(node.width, boxWidth / maxNodes, 0) * context.scale.x)),
      height: Math.max(1, Math.round(readNumber(node.height, boxHeight / 3, 0) * context.scale.y)),
      rotation: readNumber(node.rotate, 0),
      opacity: typeof node.opacity === 'number' ? node.opacity : 1,
      zIndex: context.zIndex,
      type: 'shape',
      shape: shapeName(node.shape || node.shapType || 'rect'),
      fill: colorValue(node.fill, '#e5e7eb'),
      stroke: colorValue(node.borderColor, 'none'),
      strokeWidth: node.borderWidth || 0,
      text: sanitizedText,
      textColor: '#111827',
    })
  }

  // [FIX #7] Process CONNECTOR nodes SECOND — detect line-type shapes inside elements[]
  for (let i = 0; i < maxNodes; i++) {
    const node = nodes[i]
    if (!isConnectorNode(node)) continue // only process connectors here

    context.zIndex += 1

    let cx1 = node.x1 ?? node.left ?? 0
    let cy1 = node.y1 ?? node.top ?? 0
    let cx2 = node.x2 ?? (node.left ?? 0) + (node.width ?? 100)
    let cy2 = node.y2 ?? (node.top ?? 0) + (node.height ?? 10)

    const mappedX1 = Math.round((diagramLeft + cx1) * context.scale.x)
    const mappedY1 = Math.round((diagramTop + cy1) * context.scale.y)
    const mappedX2 = Math.round((diagramLeft + cx2) * context.scale.x)
    const mappedY2 = Math.round((diagramTop + cy2) * context.scale.y)

    // [FIX #17] Reuse arrowMarker() helper from mapper.js:152-160
    const normType = String(node.shapType || '').toLowerCase()
    const arrowEnd = arrowMarker(normType)
    const arrowStart = normType.includes('triangle') || normType.includes('diamond')
      ? arrowMarker(normType.replace(/end|start/gi, ''))
      : 'none'

    results.push({
      id: uuidv4(),
      x1: mappedX1,
      y1: mappedY1,
      x2: mappedX2,
      y2: mappedY2,
      rotation: 0,
      opacity: typeof node.opacity === 'number' ? node.opacity : 1,
      zIndex: context.zIndex,
      type: 'line',
      stroke: colorValue(node.borderColor, '#6b7280'),
      strokeWidth: Math.max(1, readNumber(node.borderWidth, 2)),
      dashArray: node.borderStrokeDasharray || undefined,
      arrowStart,
      arrowEnd,
    })
  }

  return results
}

async function mapPptxOutput({ output, zip, originalName, uploadsDir }) {
  const sourceSize = normalizeSourceSize(output.size)
  const scale = sourceSize.scale
  const mediaIndex = createMediaIndex(zip)
  const warnings = []
  const stats = { textCount: 0, imageCount: 0, shapeCount: 0, tableCount: 0, chartCount: 0, placeholderCount: 0, videoCount: 0, audioCount: 0, mathCount: 0 }

  const slides = []
  for (const [slideIndex, slide] of (output.slides || []).entries()) {
    const elements = []
    let zIndex = 1
    const sorted = [...(slide.elements || [])].sort((a, b) => {
      const aOrder = a?.order
      const bOrder = b?.order
      const aDefined = aOrder != null && Number.isFinite(Number(aOrder))
      const bDefined = bOrder != null && Number.isFinite(Number(bOrder))
      if (aDefined && !bDefined) return -1
      if (!aDefined && bDefined) return 1
      if (!aDefined && !bDefined) return 0
      return Number(aOrder) - Number(bOrder)
    })
    // Phase 8: Two-pass with correct interleaving.
    // Groups can appear anywhere in the PPTX stacking order, not just at the end.
    // All elements are collected with their effective order, then merge-sorted.
    // Effective order: group's order for group children, element's own order for non-groups.
    const allResults = [] // { result, effectiveOrder }
    let pass1Index = 0 // sequential index for non-group zIndex

    for (const element of sorted) {
      if (element.type === 'group') {
        const groupOrder = Number(element.order) || 0
        const children = await flattenGroupElement(element, {
          mediaIndex, scale, slideIndex, warnings, stats,
          zIndex: groupOrder,
          uploadsDir,
        })
        for (const result of children) {
          if (result.importPlaceholderType) stats.placeholderCount += 1
          const childOrder = Number(result.order) || 0
          // All children of a group share the group's order as their effective order
          allResults.push({ result, effectiveOrder: groupOrder, childOrder })
        }
      } else {
        const results = await mapElement(element, {
          mediaIndex, scale, slideIndex, warnings, stats,
          zIndex: pass1Index + 1,
          uploadsDir,
        })
        for (const result of results) {
          if (result.importPlaceholderType) stats.placeholderCount += 1
          const elemOrder = Number(result.order) || 0
          allResults.push({ result, effectiveOrder: elemOrder, childOrder: 0 })
        }
        pass1Index += 1
      }
    }

    // Stable-sort all results: first by effective order, then by child order (for siblings)
    allResults.sort((a, b) => {
      if (a.effectiveOrder !== b.effectiveOrder) return a.effectiveOrder - b.effectiveOrder
      return a.childOrder - b.childOrder
    })

    // Assign sequential zIndex based on final sorted order and populate elements
    let nextZ = 1
    for (const { result } of allResults) {
      result.zIndex = nextZ
      elements.push(result)
      nextZ += 1
    }

    // Phase 5: Handle background — color, gradient, or image
    let background = { type: 'color', color: colorValue(slide.fill, '#ffffff') }
    if (slide.fill?.type === 'gradient') {
      background = gradientBackground(slide.fill)
    } else if (slide.fill?.type === 'image') {
      const image = slide.fill.value?.base64 || slide.fill.value?.src || ''
      background = { type: 'image', src: image, image }
    }

    // Phase 5: Slide transition
    let transition = 'slide'
    let transitionDuration = null
    let transitionDirection = null
    const hasSlideTransition = Boolean(slide.transition)
    if (hasSlideTransition) {
      const t = String(slide.transition?.type || slide.transition || '').toLowerCase()
      if (t === 'none') transition = 'none'
      else if (['fade', 'dissolve', 'flash', 'cube', 'doors', 'flip', 'zoom'].includes(t)) transition = 'fade'
      else if (t === 'push' || t === 'wipe' || t === 'cover' || t === 'uncover' || t === 'blinds' || t === 'checker' || t === 'split' || t === 'ribbon' || t === 'gallery') transition = 'slide'
      else transition = 'slide'
      transitionDuration = slide.transition.duration || null
      transitionDirection = slide.transition.direction || null
    }

    // Phase 5: Speaker notes — preserve as sanitized HTML (Phase 1)
    const notes = slide.note ? sanitizeHtml(slide.note) : ''

    slides.push({
      id: uuidv4(),
      background,
      elements,
      notes,
      ...(hasSlideTransition && { transition }),
      ...(transitionDuration != null && { transitionDuration }),
      ...(transitionDirection && { transitionDirection }),
    })
  }

  return {
    presentation: {
      title: String(originalName || 'Imported PPTX').replace(/\.pptx$/i, ''),
      theme: 'white',
      transition: 'slide',
      slides,
      // Phase 5: Presentation metadata from pptxtojson
      resolution: { width: sourceSize.width, height: sourceSize.height },
      // Phase 5: _pptxMeta sidecar for fidelity
      _pptxMeta: {
        originalSize: { width: sourceSize.width, height: sourceSize.height },
        usedFonts: output.usedFonts || [],
        themeColors: output.themeColors || [],
      },
    },
    stats: { ...stats, slideCount: slides.length },
    warnings,
  }
}

module.exports = {
  mapPptxOutput,
  sanitizeHtml,
  mapVideo,
  mapAudio,
  extractShadow,
  mapMath,
}
