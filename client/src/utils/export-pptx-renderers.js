import { getCurvedLineRasterGeometry } from 'revealjs-shared/src/curved-line-raster.js'
import { staticRasterTargetId } from 'revealjs-shared/src/education/static-raster-targets.js'
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
import { resolveClientPptxMedia } from './export-pptx-media'
import {
  buildPptxRasterImageOptions,
  getPptxMediaSemanticWarning,
  getPptxImageSemanticWarning,
  getPptxElementExportStrategy,
  hasPptxImageVisualEffects,
  recordPptxTableRotationWarning,
  normalizeElementAction,
} from 'revealjs-shared'

const NATIVE_RENDERERS = {
  text: (slide, element, bounds, { designTokens }) =>
    addTextElement(slide, element, bounds, designTokens),
  image: (slide, element, bounds, { resolution, layout, warnings, slideNumber }) => {
    const warning = getPptxImageSemanticWarning(element, slideNumber)
    if (warning)
      recordPptxExportWarning(warnings, {
        element,
        slideNumber,
        message: warning,
        fallback: 'native-image-accessibility-limit',
      })
    addImageElement(slide, element, bounds, resolution, layout)
  },
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

async function addLocalMedia(slide, element, bounds, warnings, slideNumber) {
  const media = await resolveClientPptxMedia(element)
  const semanticWarning = getPptxMediaSemanticWarning(element, slideNumber)
  if (semanticWarning) {
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: semanticWarning,
      fallback: 'browser-only-media-semantics',
    })
  }
  if (!media.embedded) {
    if (media.embeddable) {
      recordPptxExportWarning(warnings, {
        element,
        slideNumber,
        message: `Slide ${slideNumber}: validated local ${element.type} could not be embedded; used a static fallback`,
        fallback: 'static-media',
      })
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
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: `Slide ${slideNumber}: video poster was not a validated local PNG; used the default PowerPoint media cover`,
      fallback: 'default-media-cover',
    })
  }
  return true
}

export async function addElementToPptxSlide({
  slide,
  element,
  resolution,
  layout,
  pptx,
  warnings,
  slideNumber,
  effectiveSlideId,
  rasterOverrides = {},
  designTokens,
  options = {},
}) {
  const bounds = scaleElementBounds(
    getCurvedLineRasterGeometry(element)?.element || element,
    resolution,
    layout
  )
  const { action } = normalizeElementAction(element.action)
  if (action) {
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: `Slide ${slideNumber}: ${element.type} action (${action.kind}) is not supported in PPTX and was omitted`,
      fallback: 'browser-only-element-action',
    })
  }
  if (element.type === 'game') {
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: `Slide ${slideNumber}: ${element.gameType} exported as an authored static snapshot; game interaction and scoring are browser-only.`,
      fallback: 'browser-only-game-interactivity',
    })
  }
  const rasterData = element?.id
    ? rasterOverrides[staticRasterTargetId(element, effectiveSlideId)]
    : null

  if (rasterData) {
    const imageOptions =
      element.type === 'image'
        ? buildPptxRasterImageOptions(rasterData, element, bounds)
        : { data: rasterData, ...bounds, rotate: element.rotation || 0 }
    slide.addImage(imageOptions)
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: hasPptxImageVisualEffects(element)
        ? `Slide ${slideNumber}: rasterized image to preserve CSS filters or rounded corners`
        : `Slide ${slideNumber}: rasterized ${element.type} with server renderer`,
      fallback: 'server-raster',
    })
    return
  }
  const policy = getPptxElementExportStrategy(element)
  if (element.type === 'line' && policy.failure === 'error') {
    throw new Error(
      `Slide ${slideNumber}: curved line "${element.id}" requires a successful server raster capture`
    )
  }

  try {
    if (element.type === 'image' && hasPptxImageVisualEffects(element)) {
      addImageElement(slide, element, bounds, resolution, layout)
      recordPptxExportWarning(warnings, {
        element,
        slideNumber,
        message: `Slide ${slideNumber}: image CSS filters or rounded corners could not be rasterized; exported as a native image`,
        fallback: 'native-image-effect-limit',
      })
      return
    }

    if (element.type === 'audio' || element.type === 'video') {
      if (await addLocalMedia(slide, element, bounds, warnings, slideNumber)) return
      await addFallbackElement(slide, element, bounds, warnings, slideNumber, designTokens, options)
      return
    }

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
      await addFallbackElement(slide, element, bounds, warnings, slideNumber, designTokens, options)
    }
  } catch (error) {
    if (element.type === 'game')
      throw new Error(
        `Slide ${slideNumber}: authored ${element.gameType} snapshot failed (${error.message})`,
        { cause: error }
      )
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: `Slide ${slideNumber}: ${element.type} export failed (${error.message})`,
      fallback: 'export-error',
      severity: 'error',
    })
    await addFallbackElement(slide, element, bounds, warnings, slideNumber, designTokens, options)
  }
}
