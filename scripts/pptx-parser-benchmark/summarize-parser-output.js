const path = require('path')

function emptySummary(parser) {
  return {
    parser,
    slideCount: 0,
    size: { width: null, height: null },
    textCount: 0,
    imageCount: 0,
    shapeCount: 0,
    tableCount: 0,
    chartCount: 0,
    groupCount: 0,
    connectorCount: 0,
    placeholderCount: 0,
    noteCount: 0,
    mediaCount: 0,
    hasThemeColors: false,
    hasFontInfo: false,
    hasLayoutElements: false,
    unsupportedObjects: [],
    verdict: 'fail',
  }
}

function walkElements(elements, summary) {
  for (const element of elements || []) {
    if (!element || typeof element !== 'object') continue
    const type = String(element.type || '').toLowerCase()
    if (type === 'text') summary.textCount += 1
    if (type === 'image') summary.imageCount += 1
    if (type === 'shape') summary.shapeCount += 1
    if (type === 'table') summary.tableCount += 1
    if (type === 'chart') summary.chartCount += 1
    if (type === 'group') summary.groupCount += 1
    if (type === 'connector' || type === 'line') summary.connectorCount += 1
    if (type === 'math') summary.unsupportedObjects.push('equation')
    if (type === 'diagram') summary.unsupportedObjects.push('smart-art')
    if (type === 'video' || type === 'audio') summary.unsupportedObjects.push(type)
    if (element.placeholder || element.fallbackReason) summary.placeholderCount += 1
    if (Array.isArray(element.elements)) walkElements(element.elements, summary)
  }
}

function summarizeSemantic(parser, output) {
  const summary = emptySummary(parser)
  const slides = Array.isArray(output.slides) ? output.slides : []
  summary.slideCount = slides.length
  summary.size = output.size || summary.size
  summary.hasThemeColors = Array.isArray(output.themeColors) && output.themeColors.length > 0
  summary.hasFontInfo = Array.isArray(output.usedFonts) && output.usedFonts.length > 0

  for (const slide of slides) {
    if (slide && slide.note) summary.noteCount += 1
    if (Array.isArray(slide && slide.layoutElements) && slide.layoutElements.length > 0) {
      summary.hasLayoutElements = true
    }
    walkElements(slide && slide.elements, summary)
    walkElements(slide && slide.layoutElements, summary)
  }

  summary.mediaCount = summary.imageCount
  summary.unsupportedObjects = [...new Set(summary.unsupportedObjects)]
  summary.verdict = summary.slideCount > 0 && summary.textCount > 0 ? 'pass' : 'partial'
  return summary
}

function countKey(value, wantedKey) {
  if (!value || Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return 0
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countKey(item, wantedKey), 0)
  if (typeof value !== 'object') return 0

  return Object.entries(value).reduce((sum, [key, child]) => {
    return sum + (key === wantedKey ? 1 : 0) + countKey(child, wantedKey)
  }, 0)
}

function summarizeRaw(parser, output) {
  const summary = emptySummary(parser)
  const keys = Object.keys(output || {})
  const slideKeys = keys.filter((key) => /^ppt\/slides\/slide\d+\.xml$/.test(key))
  summary.slideCount = slideKeys.length
  summary.mediaCount = keys.filter((key) => /^ppt\/media\//.test(key)).length
  summary.chartCount = keys.filter((key) => /^ppt\/charts\//.test(key)).length
  summary.noteCount = keys.filter((key) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(key)).length

  for (const key of slideKeys) {
    const slide = output[key]
    summary.textCount += countKey(slide, 'a:t')
    summary.imageCount += countKey(slide, 'p:pic')
    summary.shapeCount += countKey(slide, 'p:sp')
    summary.tableCount += countKey(slide, 'a:tbl')
    summary.groupCount += countKey(slide, 'p:grpSp')
    summary.connectorCount += countKey(slide, 'p:cxnSp')
    summary.placeholderCount += countKey(slide, 'p:ph')
  }

  summary.hasThemeColors = keys.some((key) => /^ppt\/theme\//.test(key))
  summary.hasLayoutElements = keys.some((key) => /^ppt\/slideLayouts\//.test(key))
  summary.hasFontInfo = keys.some((key) => /font/i.test(path.basename(key)))
  summary.unsupportedObjects = keys.some((key) => /^ppt\/embeddings\//.test(key)) ? ['ole'] : []
  summary.verdict = summary.slideCount > 0 ? 'partial' : 'fail'
  return summary
}

function compareToInventory(summary, inventory) {
  if (!inventory) return null
  return {
    slideCountMatches: summary.slideCount === inventory.slideCount,
    slideCountDelta: summary.slideCount - inventory.slideCount,
    inventorySlideCount: inventory.slideCount,
    inventoryMediaCount: inventory.packageCounts.media,
    inventoryNoteCount: inventory.packageCounts.notesSlides,
  }
}

function summarizeParserOutput(parser, output, inventory) {
  const semanticParsers = new Set(['pptxtojson', 'ppt-parser'])
  const summary = semanticParsers.has(parser)
    ? summarizeSemantic(parser, output || {})
    : summarizeRaw(parser, output || {})

  summary.compare = compareToInventory(summary, inventory)
  if (summary.compare && !summary.compare.slideCountMatches) summary.verdict = 'fail'
  return summary
}

module.exports = {
  summarizeParserOutput,
}
