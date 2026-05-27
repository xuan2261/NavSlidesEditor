const FIT_INVALIDATING_KEYS = new Set([
  'content',
  'text',
  'textHtml',
  'fontSize',
  'fontFamily',
  'textColor',
  'lineHeight',
  'width',
  'height',
])

export function invalidatePptxFitMetaForUpdates(element, updates) {
  if (!element?._pptxImportMeta || !updates || updates._pptxImportMeta) return updates
  if (!Object.keys(updates).some((key) => FIT_INVALIDATING_KEYS.has(key))) return updates
  const meta = { ...element._pptxImportMeta }
  delete meta.fitFontSizePx
  delete meta.sourceFontSizePx
  delete meta.textLength
  return { ...updates, _pptxImportMeta: meta }
}
