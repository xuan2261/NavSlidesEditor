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
const { inspectOoxmlCoverage } = require('../ooxml-inspection')
const { attachSourceNodes } = require('../ooxml-scene-graph/attach-source-nodes')
const { resolveLayoutPlaceholders } = require('./placeholder-resolve')
const { injectChartsFromSceneGraph } = require('../ooxml-chart-parser')
const { injectDiagramsFromSceneGraph } = require('../ooxml-diagram-parser')
const { supportRow } = require('../chart-support-matrix')

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
  const row = supportRow(element?.chartType)
  if (row.status === 'unsupported-strict' && (context.strict || process.env.PPTX_SLA_STRICT === '1')) {
    context.warnings.push({
      slideIndex: context.slideIndex,
      type: 'chart-unsupported-strict',
      message: `Chart type ${element.chartType} is unsupported under PPTX_SLA_STRICT`,
    })
    return []
  }
  const chartEl = mapChart(element)
  if (chartEl) {
    if (row.navType) chartEl.chartType = row.navType
    context.stats.chartCount = (context.stats.chartCount || 0) + 1
    return [{ ...baseElement(element, context.scale, context.zIndex), ...chartEl }]
  }
  return [
    placeholder(
      element,
      context.scale,
      context.zIndex,
      context.slideIndex,
      context.warnings,
      'chart-unsupported',
      'Chart type unsupported'
    ),
  ]
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

async function mapPptxOutput({
  output,
  zip,
  originalName,
  uploadsDir,
  onProgress,
  signal,
  sceneGraph = null,
  strict = false,
}) {
  signal?.throwIfAborted?.()
  const sourceSize = normalizeSourceSize(output.size)
  const scale = sourceSize.scale
  const mediaIndex = createMediaIndex(zip)
  const warnings = []
  const ooxml = await inspectOoxmlCoverage(zip)
  const isStrict = strict === true || process.env.PPTX_SLA_STRICT === '1'
  const stats = { textCount: 0, imageCount: 0, shapeCount: 0, tableCount: 0, chartCount: 0, diagramCount: 0, placeholderCount: 0, videoCount: 0, audioCount: 0, mathCount: 0, layoutPlaceholderInjected: 0 }
  const slides = []
  const nativeObjectSlides = []
  const totalSlides = Math.max(1, (output.slides || []).length)
  const graphByIndex = Object.fromEntries((sceneGraph?.slides || []).map((s) => [s.index, s]))
  for (const [slideIndex, slide] of (output.slides || []).entries()) {
    signal?.throwIfAborted?.()
    onProgress?.({ stage: 'mapping', percent: 80 + Math.round((slideIndex / totalSlides) * 15), message: `Processing slide ${slideIndex + 1} of ${totalSlides}` })
    let elements = await mapSlideElements(slide, {
      mediaIndex,
      scale,
      slideIndex,
      warnings,
      stats,
      uploadsDir,
      signal,
      strict: isStrict,
    })
    signal?.throwIfAborted?.()
    const graphSlide = graphByIndex[slideIndex]
    if (graphSlide) {
      const resolved = resolveLayoutPlaceholders({ elements }, graphSlide, { slideIndex })
      elements = resolved.elements
      stats.layoutPlaceholderInjected += resolved.injected
      // OOXML-first charts when parser omitted type:chart but package has chart parts
      elements = await injectChartsFromSceneGraph({
        elements,
        graphSlide,
        zip,
        slideIndex,
        stats,
        warnings,
        strict: isStrict,
        scale,
      })
      elements = await injectDiagramsFromSceneGraph({
        elements,
        graphSlide,
        zip,
        slideIndex,
        stats,
        warnings,
        scale,
      })
      attachSourceNodes(elements, graphSlide.nodes, slideIndex)
    }
    const evidence = ooxml.slidesByIndex[slideIndex] || { chartEntries: [], smartArtEntries: [] }
    const mappedNativeChartCount = elements.filter((element) => element?.type === 'chart').length
    // Count unique SmartArt graphic instances (diagram type or shapes with _pptxDiagram model)
    const mappedNativeDiagramCount = new Set(
      elements
        .filter((element) => element?.type === 'diagram' || element?._pptxDiagram?.nodes?.length)
        .map(
          (element) =>
            element._pptxSource?.nodeId ||
            element._pptxDiagram?.graphicNodeId ||
            element.id ||
            'diagram'
        )
    ).size
    // Prefer package chart evidence; also count scene-graph chart nodes when present
    const graphChartCount = graphSlide
      ? (graphSlide.nodes || []).filter((n) => n.graphicKind === 'chart' || n.rels?.chartTarget).length
      : 0
    const graphDiagramCount = graphSlide
      ? (graphSlide.nodes || []).filter((n) => n.graphicKind === 'diagram' || n.rels?.diagramTarget).length
      : 0
    const chartEvidenceCount = Math.max(evidence.chartEntries.length, graphChartCount)
    const smartArtEvidenceCount = Math.max(evidence.smartArtEntries.length, graphDiagramCount)
    const chartCoverageGapCount = Math.max(0, chartEvidenceCount - mappedNativeChartCount)
    const smartArtCoverageGapCount = Math.max(0, smartArtEvidenceCount - mappedNativeDiagramCount)
    if (chartEvidenceCount || smartArtEvidenceCount || mappedNativeChartCount || mappedNativeDiagramCount) {
      nativeObjectSlides.push({
        slideIndex,
        chartEvidenceCount,
        smartArtEvidenceCount,
        mappedNativeChartCount,
        mappedNativeDiagramCount,
        chartCoverageGapCount,
        smartArtCoverageGapCount,
      })
    }
    if (chartCoverageGapCount > 0) {
      warnings.push({
        slideIndex,
        type: 'native-chart-degraded',
        message: `${chartEvidenceCount} native chart evidence item(s) found in OOXML slide ${slideIndex + 1}; ${mappedNativeChartCount} imported as native chart element(s).`,
      })
    }
    if (smartArtCoverageGapCount > 0) {
      warnings.push({
        slideIndex,
        type: 'native-smartart-degraded',
        message: `${smartArtEvidenceCount} native SmartArt evidence item(s) found in OOXML slide ${slideIndex + 1}; ${mappedNativeDiagramCount} imported as native diagram element(s).`,
      })
    }
    slides.push({
      id: uuidv4(),
      background: mapSlideBackground(slide, { slideIndex, warnings }),
      elements,
      notes: slide.note ? sanitizeHtml(slide.note) : '',
      ...mapSlideTransition(slide),
    })
  }

  const nativeChartImportedCount = nativeObjectSlides.reduce((sum, slide) => sum + slide.mappedNativeChartCount, 0)
  const nativeSmartArtImportedCount = nativeObjectSlides.reduce((sum, slide) => sum + slide.mappedNativeDiagramCount, 0)
  const nativeObjectCoverage = {
    chartEvidenceCount: ooxml.nativeChartCount,
    smartArtEvidenceCount: ooxml.nativeSmartArtCount,
    mappedNativeChartCount: nativeChartImportedCount,
    mappedNativeDiagramCount: nativeSmartArtImportedCount,
    chartCoverageGapCount: nativeObjectSlides.reduce((sum, slide) => sum + slide.chartCoverageGapCount, 0),
    smartArtCoverageGapCount: nativeObjectSlides.reduce((sum, slide) => sum + slide.smartArtCoverageGapCount, 0),
    slides: nativeObjectSlides,
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
    stats: {
      ...stats,
      nativeChartCount: ooxml.nativeChartCount,
      nativeSmartArtCount: ooxml.nativeSmartArtCount,
      nativeChartImportedCount,
      nativeSmartArtImportedCount,
      nativeObjectCoverage,
      ooxml,
      slideCount: slides.length,
    },
    warnings,
  }
}

module.exports = { mapElement, mapPptxOutput }
