import { PPTX_FIT_INVALIDATING_KEYS, prunePptxFitMetadata } from 'revealjs-shared'

const FIT_INVALIDATING_KEYS = new Set(PPTX_FIT_INVALIDATING_KEYS)

export function invalidatePptxFitMetaForUpdates(element, updates) {
  if (!element?._pptxImportMeta || !updates || updates._pptxImportMeta) return updates
  if (!Object.keys(updates).some((key) => FIT_INVALIDATING_KEYS.has(key))) return updates
  return { ...updates, _pptxImportMeta: prunePptxFitMetadata(element._pptxImportMeta) }
}
