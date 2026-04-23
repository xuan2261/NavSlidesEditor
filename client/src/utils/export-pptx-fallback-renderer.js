import { normalizeImageSource } from './export-pptx-core'
import {
  buildPptxPlaceholderLabel,
  getMediaCoverSource,
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

export async function addFallbackElement(slide, element, bounds, warnings, slideNumber) {
  const coverSource = getMediaCoverSource(element)
  const normalizedCover = normalizeImageSource(coverSource)
  if (normalizedCover) {
    slide.addImage({ ...normalizedCover, ...bounds, rotate: element.rotation || 0 })
    warnings.push(`Slide ${slideNumber}: used media cover fallback for ${element.type}`)
    return
  }

  const fallbackData = await renderElementFallbackDataUri(element)
  if (fallbackData) {
    slide.addImage({ data: fallbackData, ...bounds, rotate: element.rotation || 0 })
    warnings.push(`Slide ${slideNumber}: rasterized ${element.type} for PPTX export`)
    return
  }

  addPlaceholder(slide, bounds, element, () => {
    warnings.push(`Slide ${slideNumber}: inserted placeholder for ${element.type}`)
  })
}
