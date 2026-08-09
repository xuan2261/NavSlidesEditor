import { recordPptxExportWarning } from './export-pptx-core'
import { resolveClientPptxPoster } from './export-pptx-media'
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

export async function addFallbackElement(slide, element, bounds, warnings, slideNumber, designTokens) {
  const coverData =
    element.type === 'video' ? await resolveClientPptxPoster(element.poster) : null
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

  const fallbackData = await renderElementFallbackDataUri(element, designTokens)
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

  addPlaceholder(slide, bounds, element, () => {
    recordPptxExportWarning(warnings, {
      element,
      slideNumber,
      message: `Slide ${slideNumber}: inserted placeholder for ${element.type}`,
      fallback: 'placeholder',
    })
  })
}
