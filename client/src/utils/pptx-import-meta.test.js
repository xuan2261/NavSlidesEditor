import { describe, expect, it } from 'vitest'
import { invalidatePptxFitMetaForUpdates } from './pptx-import-meta'

describe('pptx import meta lifecycle', () => {
  const imported = {
    _pptxImportMeta: {
      version: 1,
      textFit: 'wrap',
      fitFontSizePx: 8,
      sourceFontSizePx: 24,
      textLength: 1,
      textInsets: { left: 2 },
      textInsetsUnit: 'px',
    },
  }

  it('invalidates stale fit metadata when imported text style changes', () => {
    const updates = invalidatePptxFitMetaForUpdates(imported, { fontSize: 32 })
    expect(updates._pptxImportMeta).toEqual({
      version: 1,
      textFit: 'wrap',
      textInsets: { left: 2 },
      textInsetsUnit: 'px',
    })
  })

  it('keeps metadata unchanged for geometry-neutral updates', () => {
    expect(invalidatePptxFitMetaForUpdates(imported, { x: 10 })).toEqual({ x: 10 })
  })
})
