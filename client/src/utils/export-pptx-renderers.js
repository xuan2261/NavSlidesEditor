import {
  addCalloutElement,
  addChartElement,
  addCodeElement,
  addImageElement,
  addLineElement,
  addShapeElement,
  addTableElement,
  addTextElement,
} from './export-pptx-basic-renderers'
import { scaleElementBounds } from './export-pptx-core'
import { addFallbackElement } from './export-pptx-fallback-renderer'

export async function addElementToPptxSlide({
  slide,
  element,
  resolution,
  layout,
  pptx,
  warnings,
  slideNumber,
  rasterOverrides = {},
}) {
  const bounds = scaleElementBounds(element, resolution, layout)
  const rasterData = element?.id ? rasterOverrides[element.id] : null

  if (rasterData) {
    slide.addImage({ data: rasterData, ...bounds, rotate: element.rotation || 0 })
    warnings.push(`Slide ${slideNumber}: rasterized ${element.type} with server renderer`)
    return
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
        await addFallbackElement(slide, element, bounds, warnings, slideNumber)
        break
    }
  } catch (error) {
    warnings.push(`Slide ${slideNumber}: ${element.type} export failed (${error.message})`)
    await addFallbackElement(slide, element, bounds, warnings, slideNumber)
  }
}
