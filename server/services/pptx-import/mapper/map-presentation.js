const uuidv4 = () => require('node:crypto').randomUUID()
const { createMediaIndex } = require('../media')
const { sanitizeHtml } = require('../sanitize')
const { mapChart } = require('../chart-output-to-navslides-mapper')
const { colorValue, gradientBackground } = require('./utils-color')
const { buildPptxTextImportMeta, extractTextInsets, extractTextMetadata, normalizeImportedRichTextHtml } = require('./utils-text')
const { baseElement, extractShadow, placeholder } = require('./utils-base')
const { mapShape } = require('./map-shape')
const { mapImage } = require('./map-image')
const { mapTable } = require('./map-table')
const { mapAudio, mapMath, mapVideo, gateBackgroundImageSrc } = require('./map-media')
const { flattenGroupElement } = require('./map-group')
const { flattenDiagramElement } = require('./map-diagram')
const { fitBoxWithinBounds, normalizeSourceSize } = require('../geometry')
const { CANVAS_SIZE } = require('../constants')

async function mapElement(element, context) {
  if (element.type === 'group') return flattenGroupElement(element, context, mapElement)
  if (element.type === 'image') return mapImage(element, context)
  if (element.type === 'table') return mapTable(element, context)
  if (element.type === 'video') return mapVideo(element, context)
  if (element.type === 'audio') return mapAudio(element, context)
  if (element.type === 'shape') return mapShape(element, context)
  if (element.type === 'diagram') return flattenDiagramElement(element, context)
  if (element.type === 'chart') return mapChartElement(element, context)
  if (element.type === 'math') return mapMath(element, context)
  if (element.type === 'text' || element.content) return mapText(element, context)
  return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'unknown-object', 'Unsupported PPTX object locked as placeholder')]
}

function mapChartElement(element, context) {
  const chartEl = mapChart(element)
  if (chartEl) {
    context.stats.chartCount = (context.stats.chartCount || 0) + 1
    return [{ ...baseElement(element, context.scale, context.zIndex), ...chartEl }]
  }
  return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'chart-unsupported', 'Chart type unsupported')]
}

function mapText(element, context) {
  context.stats.textCount += 1
  const sanitizedContent = sanitizeHtml(element.content)
  const content = normalizeImportedRichTextHtml(sanitizedContent)
  const box = baseElement(element, context.scale, context.zIndex)
  const fittedBox = fitBoxWithinBounds(box)
  const text = {
    ...box,
    ...fittedBox,
    type: 'text',
    content,
    ...extractTextMetadata(sanitizedContent, element, context.scale),
  }
  const textInsets = extractTextInsets(element, context.scale, fittedBox)
  const textLength = String(text.content || '').replace(/<[^>]+>/g, '').trim().length
  text._pptxImportMeta = buildPptxTextImportMeta(fittedBox, text, {
    textLength,
    ...(textInsets ? { textInsets, textInsetsUnit: 'px' } : {}),
  })
  const textShadow = extractShadow(element, context.scale)
  if (textShadow) {
    text.shadowX = textShadow.shadowX
    text.shadowY = textShadow.shadowY
    text.shadowBlur = textShadow.shadowBlur
    text.shadowColor = textShadow.shadowColor
  }
  return [text]
}

function sortSlideElements(slide) {
  return [...(slide.elements || [])].sort((a, b) => {
    const aOrder = a?.order
    const bOrder = b?.order
    const aDefined = aOrder != null && Number.isFinite(Number(aOrder))
    const bDefined = bOrder != null && Number.isFinite(Number(bOrder))
    if (aDefined && !bDefined) return -1
    if (!aDefined && bDefined) return 1
    if (!aDefined && !bDefined) return 0
    return Number(aOrder) - Number(bOrder)
  })
}

async function mapSlideElements(slide, baseContext) {
  const allResults = []
  let pass1Index = 0

  for (const element of sortSlideElements(slide)) {
    if (element.type === 'group') {
      const groupOrder = Number(element.order) || 0
      const children = await withContextZIndex(baseContext, groupOrder, () => flattenGroupElement(element, baseContext, mapElement))
      for (const result of children) pushOrderedResult(allResults, result, baseContext.stats, groupOrder, Number(result.order) || 0)
      continue
    }
    const results = await withContextZIndex(baseContext, pass1Index + 1, () => mapElement(element, baseContext))
    for (const result of results) pushOrderedResult(allResults, result, baseContext.stats, Number(result.order) || 0, 0)
    pass1Index += 1
  }

  allResults.sort((a, b) => a.effectiveOrder !== b.effectiveOrder
    ? a.effectiveOrder - b.effectiveOrder
    : a.childOrder - b.childOrder)

  return allResults.map(({ result }, index) => {
    result.zIndex = index + 1
    return result
  })
}

async function withContextZIndex(context, zIndex, callback) {
  const previousZIndex = context.zIndex
  context.zIndex = zIndex
  try {
    return await callback()
  } finally {
    context.zIndex = previousZIndex
  }
}

function pushOrderedResult(allResults, result, stats, effectiveOrder, childOrder) {
  if (result.importPlaceholderType) stats.placeholderCount += 1
  allResults.push({ result, effectiveOrder, childOrder })
}

function mapSlideBackground(slide, context) {
  if (slide.fill?.type === 'gradient') return gradientBackground(slide.fill)
  if (slide.fill?.type === 'image') {
    const rawImage = slide.fill.value?.base64 || slide.fill.value?.src || ''
    const image = gateBackgroundImageSrc(rawImage, context) || ''
    if (!image) return { type: 'color', color: colorValue(slide.fill, '#ffffff') }
    return { type: 'image', src: image, image }
  }
  return { type: 'color', color: colorValue(slide.fill, '#ffffff') }
}

function mapSlideTransition(slide) {
  if (!slide.transition) return {}
  const transitionType = String(slide.transition?.type || slide.transition || '').toLowerCase()
  const transition = transitionType === 'none'
    ? 'none'
    : ['fade', 'dissolve', 'flash', 'cube', 'doors', 'flip', 'zoom'].includes(transitionType) ? 'fade' : 'slide'
  const transitionDuration = slide.transition.duration || null
  const transitionDirection = slide.transition.direction || null
  return {
    transition,
    ...(transitionDuration != null && { transitionDuration }),
    ...(transitionDirection && { transitionDirection }),
  }
}

async function mapPptxOutput({ output, zip, originalName, uploadsDir, onProgress, signal }) {
  signal?.throwIfAborted?.()
  const sourceSize = normalizeSourceSize(output.size)
  const scale = sourceSize.scale
  const mediaIndex = createMediaIndex(zip)
  const warnings = []
  const stats = { textCount: 0, imageCount: 0, shapeCount: 0, tableCount: 0, chartCount: 0, placeholderCount: 0, videoCount: 0, audioCount: 0, mathCount: 0 }
  const slides = []
  const totalSlides = Math.max(1, (output.slides || []).length)
  for (const [slideIndex, slide] of (output.slides || []).entries()) {
    signal?.throwIfAborted?.()
    onProgress?.({ stage: 'mapping', percent: 80 + Math.round((slideIndex / totalSlides) * 15), message: `Processing slide ${slideIndex + 1} of ${totalSlides}` })
    const elements = await mapSlideElements(slide, { mediaIndex, scale, slideIndex, warnings, stats, uploadsDir, signal })
    signal?.throwIfAborted?.()
    slides.push({
      id: uuidv4(),
      background: mapSlideBackground(slide, { slideIndex, warnings }),
      elements,
      notes: slide.note ? sanitizeHtml(slide.note) : '',
      ...mapSlideTransition(slide),
    })
  }

  return {
    presentation: {
      title: String(originalName || 'Imported PPTX').replace(/\.pptx$/i, ''),
      theme: 'white',
      transition: 'slide',
      slides,
      resolution: { width: CANVAS_SIZE.width, height: CANVAS_SIZE.height },
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

module.exports = { mapElement, mapPptxOutput }
