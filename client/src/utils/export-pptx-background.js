import {
  DEFAULT_BACKGROUND_COLOR,
  getBackgroundImageUrl,
  normalizeCssColor,
  normalizeImageSource,
} from './export-pptx-core'
import { renderGradientBackgroundDataUri } from './export-pptx-raster'

export async function applySlideBackground(slide, background, resolution, layout, warnings, slideNumber) {
  if (!background || background.type === 'none') {
    slide.background = { color: DEFAULT_BACKGROUND_COLOR }
    return
  }

  if (background.type === 'color') {
    slide.background = { color: normalizeCssColor(background.color || '#1e1e2e', DEFAULT_BACKGROUND_COLOR).color }
    return
  }

  if (background.type === 'image') {
    const imageSource = normalizeImageSource(getBackgroundImageUrl(background))
    if (imageSource) {
      slide.background = imageSource
      return
    }
  }

  if (background.type === 'gradient') {
    const data = await renderGradientBackgroundDataUri(background, resolution.width, resolution.height)
    if (data) {
      slide.background = { data }
      warnings.push(`Slide ${slideNumber}: rasterized gradient background for PPTX export`)
      return
    }
  }

  slide.background = { color: DEFAULT_BACKGROUND_COLOR }
  warnings.push(`Slide ${slideNumber}: background fallback used during PPTX export`)
}
