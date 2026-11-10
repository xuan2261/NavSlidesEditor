import { describe, expect, it } from 'vitest'
import normalization from './presentation-normalization.js'

const { hasLegacyPptxResolution, normalizePptxImportedPresentationForRead } = normalization

describe('presentation normalization', () => {
  it('normalizes legacy pptx-imported read payloads to canvas resolution', () => {
    const legacy = {
      id: 'legacy-4x3',
      resolution: { width: 720, height: 540 },
      _pptxMeta: { originalSize: { width: 720, height: 540 } },
      slides: [{ elements: [{ x: 480, y: 270, width: 133, height: 50 }] }],
    }

    const normalized = normalizePptxImportedPresentationForRead(legacy)

    expect(hasLegacyPptxResolution(legacy)).toBe(true)
    expect(normalized).not.toBe(legacy)
    expect(normalized.resolution).toEqual({ width: 960, height: 540 })
    expect(normalized._pptxMeta.originalSize).toEqual({ width: 720, height: 540 })
    expect(normalized.slides).toBe(legacy.slides)
  })

  it.each([
    { width: 720, height: 540 },
    { width: 405, height: 540 },
    { width: 960, height: 540 },
  ])('preserves marked import resolution and unchanged source geometry: %j', (resolution) => {
    const presentation = {
      resolution,
      _pptxMeta: {
        originalSize: { width: 960, height: 720 },
        geometryPolicy: 'native-aspect-v1',
      },
      slides: [{ elements: [{ x: 360, y: 270, width: 72, height: 72 }] }],
    }
    const before = structuredClone(presentation)

    expect(hasLegacyPptxResolution(presentation)).toBe(false)
    expect(normalizePptxImportedPresentationForRead(presentation)).toBe(presentation)
    expect(presentation).toEqual(before)
  })

  it.each(['native-aspect-v2', '', true, { policy: 'native-aspect-v1' }])(
    'does not opt unknown geometry policies out of legacy normalization: %j', (geometryPolicy) => {
      const presentation = {
        resolution: { width: 720, height: 540 },
        _pptxMeta: { originalSize: { width: 720, height: 540 }, geometryPolicy },
        slides: [{ elements: [{ x: 480, y: 270 }] }],
      }
      const before = structuredClone(presentation)
      const normalized = normalizePptxImportedPresentationForRead(presentation)

      expect(normalized.resolution).toEqual({ width: 960, height: 540 })
      expect(normalized.slides).toBe(presentation.slides)
      expect(presentation).toEqual(before)
    }
  )

  it('leaves native or already-normalized presentations unchanged', () => {
    const nativeDeck = { id: 'native', resolution: { width: 720, height: 540 }, slides: [] }
    const importedDeck = {
      id: 'imported',
      resolution: { width: 960, height: 540 },
      _pptxMeta: { originalSize: { width: 720, height: 540 } },
    }

    expect(normalizePptxImportedPresentationForRead(nativeDeck)).toBe(nativeDeck)
    expect(normalizePptxImportedPresentationForRead(importedDeck)).toBe(importedDeck)
  })
})
