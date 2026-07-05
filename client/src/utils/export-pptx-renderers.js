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
import { getPptxElementExportPolicy } from 'revealjs-shared'

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
  code: (slide, element, bounds, { warnings, slideNumber }) => {
    if (Array.isArray(element.walkthroughSteps) && element.walkthroughSteps.length > 0) {
      recordPptxExportWarning(warnings, {
        element,
        slideNumber,
        message: `Slide ${slideNumber}: code walkthrough steps exported as static readable code`,
        fallback: 'static-code',
      })
    }
    addCodeElement(slide, element, bounds)
  },
  chart: (slide, element, bounds, { pptx }) => addChartElement(slide, element, bounds, pptx),
}

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
    const policy = getPptxElementExportPolicy(element.type)
    const nativeRenderer = policy.mode === 'native' ? NATIVE_RENDERERS[element.type] : null
    if (nativeRenderer) {
      nativeRenderer(slide, element, bounds, {
        resolution,
        layout,
        pptx,
        warnings,
        slideNumber,
        designTokens,
      })
    } else {
      await addFallbackElement(slide, element, bounds, warnings, slideNumber, designTokens)
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
