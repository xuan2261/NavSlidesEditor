import { describe, expect, it } from 'vitest'
import { findLibreOfficeBinary, renderPptxWithLibreOffice } from './render-libreoffice.js'

const hasLo = Boolean(findLibreOfficeBinary())

describe('render-libreoffice (T2.5)', () => {
  it('detects LO binary or returns null', () => {
    const bin = findLibreOfficeBinary()
    expect(bin === null || typeof bin === 'string').toBe(true)
  })

  it('handles LO present or absent gracefully', async () => {
    if (hasLo) {
      const result = await renderPptxWithLibreOffice('__does_not_exist__.pptx', { timeoutMs: 5000 })
      expect(result).toHaveProperty('ok')
      expect(typeof result.ok).toBe('boolean')
    } else {
      const result = await renderPptxWithLibreOffice('x.pptx')
      expect(result.ok).toBe(false)
      expect(result.code).toBe('LO_MISSING')
    }
  })

  it('when LO absent (explicitly configured null): returns libreoffice-missing', async () => {
    const result = await renderPptxWithLibreOffice('x.pptx', { binary: null })
    expect(result.ok).toBe(false)
    expect(result.code).toBe('LO_MISSING')
  })
})
