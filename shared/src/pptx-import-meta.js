const PPTX_FIT_INVALIDATING_KEYS = Object.freeze([
  'content', 'text', 'textHtml', 'fontSize', 'fontFamily',
  'textColor', 'lineHeight', 'width', 'height',
])

function prunePptxFitMetadata(metadata) {
  const pruned = { ...metadata }
  delete pruned.fitFontSizePx
  delete pruned.sourceFontSizePx
  delete pruned.textLength
  return pruned
}

module.exports = { PPTX_FIT_INVALIDATING_KEYS, prunePptxFitMetadata }
