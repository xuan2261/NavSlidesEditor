import { recordPptxExportWarning } from './export-pptx-core'
import { resolveClientPptxPoster } from './export-pptx-media'
import { addTimelineElement } from './export-pptx-basic-renderers'
import { parseUploadSource } from 'revealjs-shared'
import {
  buildPptxPlaceholderLabel,
  getPlaceholderTheme,
  renderElementFallbackDataUri,
} from './export-pptx-raster'

function addPlaceholder(slide, bounds, element, warning) {
  const theme = getPlaceholderTheme()
  slide.addShape('rect', {
    ...bounds,
    fill: { color: theme.fill, transparency: 12 },
    line: { color: theme.line, width: 1 },
    rotate: element.rotation || 0,
  })
  slide.addText(buildPptxPlaceholderLabel(element), {
    ...bounds,
    margin: 0.08,
    color: theme.text,
    fontSize: 11,
    align: 'center',
    valign: 'mid',
    fit: 'shrink',
    rotate: element.rotation || 0,
  })
  warning()
}

export async function addFallbackElement(
  slide,
  element,
  bounds,
  warnings,
  slideNumber,
  designTokens,
  options = {}
) {
  if (element.type === 'timeline') {
    addTimelineElement(slide, element, bounds, designTokens)
    return
  }
  const coverData = element.type === 'video' ? await resolveClientPptxPoster(element.poster) : null
  if (coverData) {
    slide.addImage({ data: coverData, ...bounds, rotate: element.rotation || 0 })
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: `Slide ${slideNumber}: used media cover fallback for ${element.type}`,
      fallback: 'media-cover',
    })
    return
  }
  if (
    element.type === 'video' &&
    (/^data:image\//i.test(element.poster || '') ||
      parseUploadSource(element.poster)?.extension === 'svg')
  ) {
    throw new Error(`Failed to decode authored video poster "${element.id || ''}"`)
  }

  const fallbackData = await renderElementFallbackDataUri(element, designTokens, options)
  if (fallbackData) {
    slide.addImage({ data: fallbackData, ...bounds, rotate: element.rotation || 0 })
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: `Slide ${slideNumber}: rasterized ${element.type} for PPTX export`,
      fallback: 'client-raster',
    })
    return
  }
  if (element.type === 'game' || element.type === 'svg')
    throw new Error(
      `Failed to capture authored ${element.type} "${element.id || element.gameType || ''}"`
    )

  addPlaceholder(slide, bounds, element, () => {
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: `Slide ${slideNumber}: inserted placeholder for ${element.type}`,
      fallback: 'placeholder',
    })
  })
}
