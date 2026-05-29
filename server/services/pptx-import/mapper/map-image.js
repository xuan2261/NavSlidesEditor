const { fitBoxWithinBounds, mapBox, readNumber } = require('../geometry')
const { persistImageForElement } = require('../media')
const { baseElement, placeholder, scaleLength } = require('./utils-base')
const { plainText } = require('./utils-text')
const { pushMediaWarning } = require('./media-warning')

// pptxtojson@2.0.2 emits PowerPoint color corrections as parseInt(@val)/1e5
// fractions: brightness/contrast are OFFSETS (neutral 0, range −1..+1) and
// saturation is a MULTIPLIER (neutral 1.0). The 0.x mapper assumed raw 100000
// values divided by 1000, which collapsed every correction to ~0 and forced
// normal images to black/gray. Convert to the CSS-percent fields the renderer
// consumes, guarding each neutral value so an unchanged image emits no filter.
function mapImageFilters(filters) {
  const out = {}
  if (!filters || typeof filters !== 'object') return out
  const { brightness, contrast, saturation } = filters
  if (typeof brightness === 'number' && brightness !== 0) {
    out.filterBrightness = Math.max(0, Math.round((1 + brightness) * 100))
  }
  if (typeof contrast === 'number' && contrast !== 0) {
    out.filterContrast = Math.max(0, Math.round((1 + contrast) * 100))
  }
  if (typeof saturation === 'number' && saturation !== 1) {
    if (saturation <= 0) out.filterGrayscale = 100
    else if (saturation < 1) out.filterGrayscale = Math.max(0, Math.round((1 - saturation) * 100))
    else out.filterSaturate = Math.round(saturation * 100)
  }
  return out
}

async function mapImage(element, context) {
  context.signal?.throwIfAborted?.()
  const media = await persistImageForElement(element, context.mediaIndex, context.uploadsDir, { signal: context.signal })
  pushMediaWarning(context, media.warning)
  const src = media.url
  if (media.unsupportedBrowserImage) {
    // EMF/WMF are vector formats the browser cannot render. Persisting their URL
    // produces a broken <img>; render a labelled placeholder instead so layout
    // is preserved and the loss is surfaced. Rasterization is a future plan.
    return [placeholder(
      element,
      context.scale,
      context.zIndex,
      context.slideIndex,
      context.warnings,
      'unsupported-image',
      'EMF/WMF not supported'
    )]
  }
  if (!src) {
    return [placeholder(
      element,
      context.scale,
      context.zIndex,
      context.slideIndex,
      context.warnings,
      'media-missing',
      'Image media unavailable'
    )]
  }
  context.stats.imageCount += 1
  const box = fitBoxWithinBounds(mapBox(element, context.scale))
  const img = { ...baseElement(element, context.scale, context.zIndex, box), type: 'image', src }
  const fillMode = typeof element.fill === 'string' ? element.fill : element.fill?.mode || element.fill?.fit
  if (element.geom === 'picture' || fillMode === 'cover') img.objectFit = 'cover'
  else if (fillMode === 'contain') img.objectFit = 'contain'
  else if (fillMode === 'stretch' || fillMode === 'fill') img.objectFit = 'fill'
  else img.objectFit = 'contain'
  const altText = element.alt || element.title || element.descr || element.description
  if (altText) img.alt = plainText(altText)
  if (element.isFlipH) img.flipH = true
  if (element.isFlipV) img.flipV = true
  if (element.borderColor) img.borderColor = element.borderColor
  if (readNumber(element.borderWidth, 0) > 0) {
    img.borderWidth = scaleLength(element.borderWidth, context.scale.x)
  }
  if (element.filters) {
    const f = element.filters
    Object.assign(img, mapImageFilters(f))
    if (typeof f.sharpen === 'number' && f.sharpen > 0) img._pptxImportMeta = { ...(img._pptxImportMeta || {}), _pptxSharpen: f.sharpen }
    if (typeof f.colorTemperature === 'number') img._pptxImportMeta = { ...(img._pptxImportMeta || {}), _pptxColorTemp: f.colorTemperature }
  }
  if (element.rect) {
    const rawL = readNumber(element.rect.l, 0)
    const rawR = readNumber(element.rect.r, 0)
    const rawT = readNumber(element.rect.t, 0)
    const rawB = readNumber(element.rect.b, 0)
    const maxVal = Math.max(Math.abs(rawL), Math.abs(rawR), Math.abs(rawT), Math.abs(rawB))
    const divisor = maxVal > 100 ? 1000 : maxVal >= 1 ? 100 : 1
    const left = Math.min(1, Math.max(0, rawL / divisor))
    const right = Math.min(1, Math.max(0, rawR / divisor))
    const top = Math.min(1, Math.max(0, rawT / divisor))
    const bottom = Math.min(1, Math.max(0, rawB / divisor))
    const visibleW = Math.max(0.01, 1 - left - right)
    const visibleH = Math.max(0.01, 1 - top - bottom)
    const imageW = Math.max(1, Math.round(box.width / visibleW))
    const imageH = Math.max(1, Math.round(box.height / visibleH))
    img.imageW = imageW
    img.imageH = imageH
    img.imageOffsetX = -Math.round(imageW * left)
    img.imageOffsetY = -Math.round(imageH * top)
    img._pptxImportMeta = { ...(img._pptxImportMeta || {}), sourceCrop: true, cropData: { top, bottom, left, right } }
  }
  return [img]
}

module.exports = {
  mapImage,
  mapImageFilters,
}
