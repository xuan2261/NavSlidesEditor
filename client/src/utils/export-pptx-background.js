import {
  DEFAULT_BACKGROUND_COLOR,
  getBackgroundImageUrl,
  normalizeCssColor,
  normalizeImageSource,
  recordPptxExportWarning,
} from './export-pptx-core'
import { renderGradientBackgroundDataUri } from './export-pptx-raster'
import { resolveColorForTokens } from 'revealjs-shared'

export async function applySlideBackground(slide, background, resolution, layout, warnings, slideNumber, tokens) {
  const tokenBg = normalizeCssColor(resolveColorForTokens('auto', 'slide', 'bg', tokens) || '#1e1e2e', DEFAULT_BACKGROUND_COLOR).color
  if (!background || background.type === 'none') {
    slide.background = { color: tokenBg }
    return
  }

  if (background.type === 'color') {
    slide.background = { color: normalizeCssColor(background.color || tokenBg, DEFAULT_BACKGROUND_COLOR).color }
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
      recordPptxExportWarning(warnings, {
        element: { id: `slide-${slideNumber}-background`, type: 'slide-background' },
        slideNumber,
        message: `Slide ${slideNumber}: rasterized gradient background for PPTX export`,
        fallback: 'client-raster',
      })
      return
    }
  }

  slide.background = { color: tokenBg }
  recordPptxExportWarning(warnings, {
    element: { id: `slide-${slideNumber}-background`, type: 'slide-background' },
    slideNumber,
    message: `Slide ${slideNumber}: background fallback used during PPTX export`,
    fallback: 'background-color',
  })
}
