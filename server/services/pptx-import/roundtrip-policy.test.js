import { describe, expect, it } from 'vitest'
import policy from './roundtrip-policy.js'

const { resolveExportStrategy, shouldPreferOriginalPackage } = policy

describe('roundtrip-policy (Phase 08 scaffold)', () => {
  it('prefers original bytes when unedited and package bound', () => {
    const pres = { pptxOriginal: { id: 'u', sha256: 'a'.repeat(64) } }
    expect(shouldPreferOriginalPackage(pres)).toBe(true)
    expect(resolveExportStrategy(pres).mode).toBe('original-bytes')
  })

  it('uses hybrid when edited or missing original', () => {
    expect(resolveExportStrategy({}).mode).toBe('hybrid-export')
    expect(
      resolveExportStrategy({ pptxOriginal: { id: 'u', sha256: 'a'.repeat(64) }, _pptxEdited: true })
        .mode
    ).toBe('hybrid-export')
  })
})
