import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  AI_SLIDE_CONTRACT_VERSION,
  validateAiSlides,
} = require('./ai-slide-contract')

function validSlide(overrides = {}) {
  return {
    elements: [
      { type: 'text', x: 0, y: 0, width: 100, height: 50, content: '<p>hi</p>' },
    ],
    notes: '',
    ...overrides,
  }
}

describe('validateAiSlides', () => {
  it('accepts a well-formed payload at the current contract version', () => {
    const out = validateAiSlides({
      contractVersion: AI_SLIDE_CONTRACT_VERSION,
      slides: [validSlide()],
    })
    expect(Array.isArray(out)).toBe(true)
    expect(out).toHaveLength(1)
    expect(out[0].elements[0].type).toBe('text')
  })

  it('throws on a missing or mismatched contractVersion', () => {
    expect(() => validateAiSlides({ slides: [validSlide()] })).toThrow()
    expect(() =>
      validateAiSlides({ contractVersion: 999, slides: [validSlide()] })
    ).toThrow()
  })

  it('throws when payload is not an object or slides is not an array', () => {
    expect(() => validateAiSlides(null)).toThrow()
    expect(() =>
      validateAiSlides({ contractVersion: AI_SLIDE_CONTRACT_VERSION, slides: 'nope' })
    ).toThrow()
  })

  it('SECURITY: rejects html/code/svg element types (not on the safe allowlist)', () => {
    for (const badType of ['html', 'code', 'svg']) {
      expect(() =>
        validateAiSlides({
          contractVersion: AI_SLIDE_CONTRACT_VERSION,
          slides: [validSlide({ elements: [{ type: badType, content: 'x' }] })],
        })
      ).toThrow()
    }
  })

  it('SECURITY: sanitizes element content (script/onerror neutralized)', () => {
    const out = validateAiSlides({
      contractVersion: AI_SLIDE_CONTRACT_VERSION,
      slides: [
        validSlide({
          elements: [
            { type: 'text', content: '<p onclick="evil()">x</p><script>alert(1)</script>' },
          ],
        }),
      ],
    })
    const content = out[0].elements[0].content
    expect(content).not.toContain('<script>')
    expect(content).not.toContain('onclick')
  })

  it('throws on an unknown element type (allowlist is strict)', () => {
    expect(() =>
      validateAiSlides({
        contractVersion: AI_SLIDE_CONTRACT_VERSION,
        slides: [validSlide({ elements: [{ type: 'totally-made-up', content: 'x' }] })],
      })
    ).toThrow()
  })
})
