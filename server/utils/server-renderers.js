const {
  addCalloutElement,
  addChartElement,
  addCodeElement,
  addImageElement,
  addLineElement,
  addShapeElement,
  addTableElement,
  addTextElement,
} = require('./server-basic-renderers')
const { addFallbackElement } = require('./server-fallback')
const { getPptxElementExportPolicy, scaleElementBounds } = require('revealjs-shared')

const NATIVE_RENDERERS = {
  text: (slide, element, bounds, { designTokens }) =>
    addTextElement(slide, element, bounds, designTokens),
  image: (slide, element, bounds, { resolution, layout }) =>
    addImageElement(slide, element, bounds, resolution, layout),
  shape: (slide, element, bounds, { designTokens }) =>
    addShapeElement(slide, element, bounds, designTokens),
  line: (slide, element, bounds, { resolution, layout, designTokens }) =>
    addLineElement(slide, element, bounds, resolution, layout, designTokens),
  callout: (slide, element, bounds, { designTokens }) =>
    addCalloutElement(slide, element, bounds, designTokens),
  table: (slide, element, bounds, { designTokens }) =>
    addTableElement(slide, element, bounds, designTokens),
  code: (slide, element, bounds) => addCodeElement(slide, element, bounds),
  chart: (slide, element, bounds, { pptx }) => addChartElement(slide, element, bounds, pptx),
}

async function addElementToPptxSlide({
  slide,
  element,
  resolution,
  layout,
  pptx,
  warnings,
  slideNumber,
  rasterOverrides = {},
  strictRaster = true,
  allowFallback = false,
  baseUrl = '',
  rasterCache,
  rasterizeElement,
  designTokens,
}) {
  const bounds = scaleElementBounds(element, resolution, layout)
  const rasterData = element && element.id ? rasterOverrides[element.id] : null

  if (rasterData) {
    slide.addImage({ data: rasterData, ...bounds, rotate: element.rotation || 0 })
    warnings.push(`Slide ${slideNumber}: rasterized ${element.type} with server renderer`)
    return
  }

  const fallbackOptions = {
    strictRaster,
    allowFallback,
    baseUrl,
    resolution,
    rasterCache,
    ...(rasterizeElement ? { rasterizeElement } : {}),
  }

  try {
    const policy = getPptxElementExportPolicy(element.type)
    const nativeRenderer = policy.mode === 'native' ? NATIVE_RENDERERS[element.type] : null
    if (nativeRenderer) {
      nativeRenderer(slide, element, bounds, {
        resolution,
        layout,
        pptx,
        designTokens,
      })
    } else {
      await addFallbackElement(slide, element, bounds, warnings, slideNumber, fallbackOptions)
    }
  } catch (error) {
    warnings.push(`Slide ${slideNumber}: ${element.type} export failed (${error.message})`)
    await addFallbackElement(slide, element, bounds, warnings, slideNumber, fallbackOptions)
  }
}

module.exports = {
  addElementToPptxSlide,
}
