const { DEFAULT_BACKGROUND_COLOR, normalizeCssColor } = require('revealjs-shared')
const { normalizeServerImageSource } = require('./server-image-source')
const { rasterizeBackground } = require('./server-background-raster')

async function applySlideBackground(slide, sourceSlide, resolution, options = {}) {
  const { warnings = [], slideNumber = 0, baseUrl = '', strictRaster = true, allowFallback = false } = options
  const bg = sourceSlide && sourceSlide.background

  if (!bg || bg.type === 'none') {
    slide.background = { color: DEFAULT_BACKGROUND_COLOR }
    return
  }

  if (bg.type === 'color') {
    slide.background = {
      color: normalizeCssColor(bg.color || '#1e1e2e', DEFAULT_BACKGROUND_COLOR).color,
    }
    return
  }

  if (bg.type === 'image') {
    const image = normalizeServerImageSource(bg.image || bg.src)
    if (image) {
      slide.background = image
      return
    }

    if (strictRaster && !allowFallback) {
      throw new Error('Background image source missing in strict mode')
    }

    slide.background = { color: DEFAULT_BACKGROUND_COLOR }
    warnings.push(`Slide ${slideNumber}: image background fallback used`)
    return
  }

  if (bg.type === 'gradient') {
    try {
      const data = await rasterizeBackground(bg, resolution, { baseUrl })
      if (data) {
        slide.background = { data }
        warnings.push(`Slide ${slideNumber}: rasterized gradient background`)
        return
      }
    } catch (error) {
      warnings.push(`Slide ${slideNumber}: gradient rasterization error (${error.message})`)
    }

    if (strictRaster && !allowFallback) {
      throw new Error('Gradient background rasterization failed in strict mode')
    }

    slide.background = { color: DEFAULT_BACKGROUND_COLOR }
    warnings.push(`Slide ${slideNumber}: gradient background fallback used`)
    return
  }

  slide.background = { color: DEFAULT_BACKGROUND_COLOR }
}

module.exports = {
  applySlideBackground,
}
