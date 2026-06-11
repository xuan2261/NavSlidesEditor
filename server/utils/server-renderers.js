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
const { scaleElementBounds } = require('revealjs-shared')

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
    switch (element.type) {
      case 'text':
        addTextElement(slide, element, bounds)
        break
      case 'image':
        addImageElement(slide, element, bounds, resolution, layout)
        break
      case 'shape':
        addShapeElement(slide, element, bounds)
        break
      case 'line':
        addLineElement(slide, element, bounds, resolution, layout)
        break
      case 'callout':
        addCalloutElement(slide, element, bounds)
        break
      case 'table':
        addTableElement(slide, element, bounds)
        break
      case 'code':
        addCodeElement(slide, element, bounds)
        break
      case 'chart':
        addChartElement(slide, element, bounds, pptx)
        break
      default:
        await addFallbackElement(slide, element, bounds, warnings, slideNumber, fallbackOptions)
        break
    }
  } catch (error) {
    warnings.push(`Slide ${slideNumber}: ${element.type} export failed (${error.message})`)
    await addFallbackElement(slide, element, bounds, warnings, slideNumber, fallbackOptions)
  }
}

module.exports = {
  addElementToPptxSlide,
}
