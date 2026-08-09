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
const { resolveServerPptxMedia } = require('./server-pptx-media')
const {
  buildPptxRasterImageOptions,
  getPptxElementExportStrategy,
  getPptxMediaSemanticWarning,
  hasPptxImageVisualEffects,
  recordPptxTableRotationWarning,
  scaleElementBounds,
} = require('revealjs-shared')

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
  table: (slide, element, bounds, { designTokens, warnings, slideNumber }) => {
    recordPptxTableRotationWarning(warnings, { element, slideNumber })
    addTableElement(slide, element, bounds, designTokens)
  },
  code: (slide, element, bounds) => addCodeElement(slide, element, bounds),
  chart: (slide, element, bounds, { pptx }) => addChartElement(slide, element, bounds, pptx),
}

async function addLocalMedia(slide, element, bounds, warnings, slideNumber) {
  const media = await resolveServerPptxMedia(element)
  const semanticWarning = getPptxMediaSemanticWarning(element, slideNumber)
  if (semanticWarning) warnings.push(semanticWarning)
  if (!media.embedded) {
    if (media.embeddable) {
      warnings.push(
        `Slide ${slideNumber}: validated local ${element.type} could not be embedded; used a static fallback`
      )
    }
    return false
  }

  slide.addMedia({
    type: media.mediaType,
    data: media.data,
    extn: media.extension,
    ...(media.cover ? { cover: media.cover } : {}),
    ...bounds,
  })

  if (element.type === 'video' && element.poster && !media.cover) {
    warnings.push(
      `Slide ${slideNumber}: video poster was not a validated local PNG; used the default PowerPoint media cover`
    )
  }
  return true
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
    const imageOptions =
      element.type === 'image'
        ? buildPptxRasterImageOptions(rasterData, element, bounds)
        : { data: rasterData, ...bounds, rotate: element.rotation || 0 }
    slide.addImage(imageOptions)
    warnings.push(
      hasPptxImageVisualEffects(element)
        ? `Slide ${slideNumber}: rasterized image to preserve CSS filters or rounded corners`
        : `Slide ${slideNumber}: rasterized ${element.type} with server renderer`
    )
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
    if (element.type === 'image' && hasPptxImageVisualEffects(element)) {
      addImageElement(slide, element, bounds, resolution, layout)
      warnings.push(
        `Slide ${slideNumber}: image CSS filters or rounded corners could not be rasterized; exported as a native image`
      )
      return
    }

    if (element.type === 'audio' || element.type === 'video') {
      if (await addLocalMedia(slide, element, bounds, warnings, slideNumber)) return
      await addFallbackElement(slide, element, bounds, warnings, slideNumber, fallbackOptions)
      return
    }

    const policy = getPptxElementExportStrategy(element)
    const nativeRenderer = policy.mode === 'native' ? NATIVE_RENDERERS[element.type] : null
    if (nativeRenderer) {
      nativeRenderer(slide, element, bounds, {
        resolution,
        layout,
        pptx,
        designTokens,
        warnings,
        slideNumber,
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
