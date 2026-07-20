import { describe, expect, it, vi } from 'vitest'
import policy from './complex-object-policy.js'

const { COMPLEX_OBJECT_TIERS, describeComplexObjects } = policy

describe('complex object blocking policy', () => {
  it('defines every Phase 9 complex-object tier explicitly', () => {
    expect(Object.keys(COMPLEX_OBJECT_TIERS).sort()).toEqual([
      '3d', 'activeX', 'comments', 'custom', 'encryption', 'equation',
      'externalMedia', 'icons', 'ink', 'macro', 'ole', 'protection',
      'signature', 'smartArt', 'unknown', 'vector', 'zoom',
    ])
    for (const descriptor of Object.values(COMPLEX_OBJECT_TIERS)) {
      expect(descriptor).toEqual(expect.objectContaining({
        import: expect.any(String),
        editedExport: expect.any(String),
        originalRecovery: 'exact',
      }))
    }
  })

  it('never fetches or executes while preserving external targets as metadata', () => {
    const fetch = vi.fn()
    const spawn = vi.fn()
    const result = describeComplexObjects({
      safetyVerdict: 'safe',
      parts: [],
      relationships: [{
        source: 'ppt/slides/slide1.xml',
        target: 'https://media.example/video.mp4',
        normalizedTarget: 'https://media.example/video.mp4',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/video',
        external: true,
      }],
      securityFlags: [],
    }, { fetch, spawn })
    expect(fetch).not.toHaveBeenCalled()
    expect(spawn).not.toHaveBeenCalled()
    expect(result.objects[0]).toMatchObject({
      kind: 'externalMedia',
      preview: { embeddedFallbackOnly: true, available: false },
      source: { externalTarget: 'https://media.example/video.mp4' },
    })
  })

  it('fails closed before descriptors and blocks unknown relationship impact', () => {
    expect(() => describeComplexObjects({ safetyVerdict: 'blocked' })).toThrow(/safety verdict/i)
    const result = describeComplexObjects({
      safetyVerdict: 'safe',
      parts: [],
      relationships: [{ source: '/', target: 'x', type: 'urn:unknown', external: false }],
      securityFlags: [],
    })
    expect(result).toMatchObject({ editedExport: 'unsupported-blocking', hasUnsafeImpact: true })
  })

  it.each(['macro', 'activeX', 'ole', 'signature', 'encryption', 'protection'])(
    'blocks edited export for %s while retaining exact recovery',
    (kind) => {
      const result = describeComplexObjects({
        safetyVerdict: 'safe',
        parts: [{ path: `ppt/${kind}`, classification: kind }],
        relationships: [],
        securityFlags: [kind],
      })
      expect(result.objects[0]).toMatchObject({
        kind,
        editedExport: 'unsupported-blocking',
        originalRecovery: 'exact',
      })
    }
  )
})
