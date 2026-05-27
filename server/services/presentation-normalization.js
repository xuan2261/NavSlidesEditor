const { CANVAS_SIZE } = require('./pptx-import/constants')

function hasLegacyPptxResolution(presentation) {
  const originalSize = presentation && presentation._pptxMeta && presentation._pptxMeta.originalSize
  const width = Number(originalSize && originalSize.width)
  const height = Number(originalSize && originalSize.height)
  if (!(width > 0 && height > 0)) return false

  const resolution = presentation.resolution || {}
  return Number(resolution.width) !== CANVAS_SIZE.width || Number(resolution.height) !== CANVAS_SIZE.height
}

function normalizePptxImportedPresentationForRead(presentation) {
  if (!hasLegacyPptxResolution(presentation)) return presentation
  return {
    ...presentation,
    resolution: { width: CANVAS_SIZE.width, height: CANVAS_SIZE.height },
    _pptxMeta: {
      ...presentation._pptxMeta,
      originalSize: { ...presentation._pptxMeta.originalSize },
    },
  }
}

module.exports = {
  hasLegacyPptxResolution,
  normalizePptxImportedPresentationForRead,
}
