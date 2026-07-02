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
import { recordPptxExportWarning, scaleElementBounds } from './export-pptx-core'
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
  designTokens,
}) {
  const bounds = scaleElementBounds(element, resolution, layout)
  const rasterData = element?.id ? rasterOverrides[element.id] : null

  if (rasterData) {
    slide.addImage({ data: rasterData, ...bounds, rotate: element.rotation || 0 })
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: `Slide ${slideNumber}: rasterized ${element.type} with server renderer`,
      fallback: 'server-raster',
    })
    return
  }

  try {
    switch (element.type) {
      case 'text':
        addTextElement(slide, element, bounds, designTokens)
        break
      case 'image':
        addImageElement(slide, element, bounds, resolution, layout)
        break
      case 'shape':
        addShapeElement(slide, element, bounds, designTokens)
        break
      case 'line':
        addLineElement(slide, element, bounds, resolution, layout, designTokens)
        break
      case 'callout':
        addCalloutElement(slide, element, bounds, designTokens)
        break
      case 'table':
        addTableElement(slide, element, bounds, designTokens)
        break
      case 'code':
        if (Array.isArray(element.walkthroughSteps) && element.walkthroughSteps.length > 0) {
          recordPptxExportWarning(warnings, {
            element,
            slideNumber,
            message: `Slide ${slideNumber}: code walkthrough steps exported as static readable code`,
            fallback: 'static-code',
          })
        }
        addCodeElement(slide, element, bounds)
        break
      case 'chart':
        addChartElement(slide, element, bounds, pptx)
        break
      default:
        await addFallbackElement(slide, element, bounds, warnings, slideNumber, designTokens)
        break
    }
  } catch (error) {
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: `Slide ${slideNumber}: ${element.type} export failed (${error.message})`,
      fallback: 'export-error',
      severity: 'error',
    })
    await addFallbackElement(slide, element, bounds, warnings, slideNumber, designTokens)
  }
}
