const { fitBoxWithinBounds, mapBox, readNumber } = require('../geometry')
const { persistImageForElement } = require('../media')
const { baseElement, placeholder, scaleLength } = require('./utils-base')
const { plainText } = require('./utils-text')
const { pushMediaWarning } = require('./media-warning')

async function mapImage(element, context) {
  context.signal?.throwIfAborted?.()
  const media = await persistImageForElement(element, context.mediaIndex, context.uploadsDir, { signal: context.signal })
  pushMediaWarning(context, media.warning)
  const src = media.url
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
    if (typeof f.brightness === 'number' && f.brightness !== 100000) img.filterBrightness = Math.round(f.brightness / 1000)
    if (typeof f.contrast === 'number' && f.contrast !== 100000) img.filterContrast = Math.round(f.contrast / 1000)
    if (typeof f.saturation === 'number' && f.saturation !== 100000) {
      if (f.saturation === 0) img.filterGrayscale = 100
      else if (f.saturation < 50000) img.filterGrayscale = Math.round((1 - f.saturation / 100000) * 100)
    }
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
}
