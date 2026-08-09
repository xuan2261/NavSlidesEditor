const { normalizeCssColor } = require('./shared-color-utils')

const SAFE_IMAGE_DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]*$/i
const IMAGE_FILTER_DEFAULTS = {
  filterBrightness: 100,
  filterContrast: 100,
  filterGrayscale: 0,
  filterSaturate: 100,
}

function hasPptxImageVisualEffects(element) {
  if (element?.type !== 'image') return false

  if (Number(element.borderRadius) > 0) return true
  return Object.entries(IMAGE_FILTER_DEFAULTS).some(([field, defaultValue]) => {
    const rawValue = element[field]
    const value = Number(rawValue)
    return rawValue != null && Number.isFinite(value) && value !== defaultValue
  })
}

function isPptxRasterSafeImageSource(src) {
  const raw = String(src || '').trim()
  if (SAFE_IMAGE_DATA_URL.test(raw)) return true
  if (!raw.startsWith('/uploads/')) return false

  const relativePath = raw.slice('/uploads/'.length)
  if (!relativePath) return false
  try {
    const decodedPath = decodeURIComponent(relativePath)
    return !decodedPath.split(/[\\/]/).some((segment) => segment === '.' || segment === '..')
  } catch {
    return false
  }
}

function buildPptxImageOptions(source, element, bounds, resolution, layout) {
  const imageOptions = {
    ...source,
    ...bounds,
    rotate: element.rotation || 0,
  }

  if (element.opacity != null && element.opacity !== 1) {
    imageOptions.transparency = Math.round((1 - element.opacity) * 100)
  }
  if (element.flipH) imageOptions.flipH = true
  if (element.flipV) imageOptions.flipV = true
  if (element.alt || element.altText) imageOptions.altText = element.alt || element.altText

  if (element.cropData) {
    const crop = element.cropData || {}
    const left = Number(crop.left) || 0
    const right = Number(crop.right) || 0
    const top = Number(crop.top) || 0
    const bottom = Number(crop.bottom) || 0
    const visibleW = Math.max(0.01, 1 - left - right)
    const visibleH = Math.max(0.01, 1 - top - bottom)
    imageOptions.sizing = {
      type: 'crop',
      x: bounds.x - (bounds.w * left) / visibleW,
      y: bounds.y - (bounds.h * top) / visibleH,
      w: bounds.w / visibleW,
      h: bounds.h / visibleH,
    }
  } else if (element.imageW != null && element.imageH != null) {
    imageOptions.sizing = {
      type: 'crop',
      x: Math.max(0, (-(element.imageOffsetX || 0) * layout.width) / resolution.width),
      y: Math.max(0, (-(element.imageOffsetY || 0) * layout.height) / resolution.height),
      w: Math.max(bounds.w, (element.imageW * layout.width) / resolution.width),
      h: Math.max(bounds.h, (element.imageH * layout.height) / resolution.height),
    }
  } else if (element.objectFit) {
    imageOptions.sizing = {
      type: element.objectFit === 'cover' ? 'cover' : 'contain',
      w: bounds.w,
      h: bounds.h,
    }
  }

  return imageOptions
}

function buildPptxRasterImageOptions(data, element, bounds) {
  const imageOptions = {
    data,
    ...bounds,
    rotate: element.rotation || 0,
  }

  if (element.opacity != null && element.opacity !== 1) {
    imageOptions.transparency = Math.round((1 - element.opacity) * 100)
  }
  if (element.alt || element.altText) imageOptions.altText = element.alt || element.altText

  return imageOptions
}

function buildPptxImageBorderOverlayOptions(element, bounds) {
  if (!element.borderColor || !element.borderWidth) return null

  const border = normalizeCssColor(element.borderColor)
  return {
    ...bounds,
    fill: { color: 'FFFFFF', transparency: 100 },
    line: { color: border.color, transparency: border.transparency, width: element.borderWidth },
    rotate: element.rotation || 0,
  }
}

module.exports = {
  buildPptxImageBorderOverlayOptions,
  buildPptxImageOptions,
  buildPptxRasterImageOptions,
  hasPptxImageVisualEffects,
  isPptxRasterSafeImageSource,
}
