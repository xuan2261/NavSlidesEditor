import { describe, expect, it } from 'vitest'
import gate from './oracle-gate.js'

const { evaluateVisualGate, gateExitCode } = gate

function input(overrides = {}) {
  return {
    oracleDisabled: false,
    envelope: { valid: true, reasons: [] }, golden: { valid: true, reasons: [] },
    source: { valid: true, reasons: [] }, actual: { valid: true, reasons: [] },
    comparison: {
      failed: false, deckCount: 1, meanSsim: 0.98, minSsim: 0.98,
      decks: [{ file: 'deck-a.pptx', ok: true, slides: [{ index: 0, ssim: 0.98 }] }],
    },
    ...overrides,
  }
}

describe('PowerPoint visual release gate', () => {
  it('passes integrity but fails qualification for trusted finite below-policy scores', () => {
    const result = evaluateVisualGate(input())
    expect(result.integrity).toEqual({ verdict: 'passed', reasons: [] })
    expect(result.qualification).toEqual(expect.objectContaining({
      verdict: 'failed', reasons: expect.arrayContaining(['mean-ssim-below-phase08-full-policy']),
    }))
    expect(gateExitCode(result, 'integrity')).toBe(0)
    expect(gateExitCode(result, 'qualification')).toBe(1)
  })

  it('fails just below the fixed boundaries without display rounding', () => {
    const scores = [0.96996, 1, 0.99992]
    const result = evaluateVisualGate(input({ comparison: {
      failed: false, deckCount: 1, meanSsim: scores.reduce((sum, score) => sum + score, 0) / scores.length, minSsim: 0.96996,
      decks: [{ file: 'deck-a.pptx', ok: true, slides: scores.map((ssim, index) => ({ index, ssim })) }],
    } }))
    expect(result.integrity.verdict).toBe('passed')
    expect(result.qualification).toEqual(expect.objectContaining({
      verdict: 'failed', reasons: expect.arrayContaining([
        'mean-ssim-below-phase08-full-policy', 'slide-ssim-below-phase08-full-policy',
      ]),
    }))
  })

  it('passes exactly at the fixed phase08_full 0.99/0.97 boundaries', () => {
    const scores = [0.97, 1, 1]
    const result = evaluateVisualGate(input({ comparison: {
      failed: false, deckCount: 1, meanSsim: scores.reduce((sum, score) => sum + score, 0) / scores.length, minSsim: 0.97,
      decks: [{ file: 'deck-a.pptx', ok: true, slides: scores.map((ssim, index) => ({ index, ssim })) }],
    } }))
    expect(result.policy).toEqual({ id: 'phase08_full', meanSsim: 0.99, minSsim: 0.97 })
    expect(result.integrity.verdict).toBe('passed')
    expect(result.qualification).toEqual({ verdict: 'passed', reasons: [] })
  })

  it('rejects forged aggregate scores and omitted comparison decks', () => {
    const forgedSummary = evaluateVisualGate(input({ comparison: {
      failed: false, deckCount: 1, meanSsim: 1, minSsim: 1,
      decks: [{ file: 'deck-a.pptx', ok: true, slides: [{ index: 0, ssim: 0 }] }],
    } }))
    expect(forgedSummary.integrity).toEqual(expect.objectContaining({
      verdict: 'failed', reasons: expect.arrayContaining(['comparison-summary-mismatch']),
    }))

    const omittedDeck = evaluateVisualGate(input({ comparison: {
      failed: false, deckCount: 2, meanSsim: 1, minSsim: 1,
      decks: [{ file: 'deck-a.pptx', ok: true, slides: [{ index: 0, ssim: 1 }] }],
    } }))
    expect(omittedDeck.integrity).toEqual(expect.objectContaining({
      verdict: 'failed', reasons: expect.arrayContaining(['comparison-deck-inventory-mismatch']),
    }))

    const duplicateDeck = evaluateVisualGate(input({ comparison: {
      failed: false, deckCount: 2, meanSsim: 1, minSsim: 1,
      decks: Array.from({ length: 2 }, () => ({ file: 'deck-a.pptx', ok: true, slides: [{ index: 0, ssim: 1 }] })),
    } }))
    expect(duplicateDeck.integrity.reasons).toContain('comparison-deck-inventory-mismatch')
  })

  it.each([
    ['disabled oracle', input({ oracleDisabled: true }), 'pptx-oracle-disabled'],
    ['missing PowerPoint receipts', input({ envelope: { valid: false, reasons: ['missing-powerpoint-role-receipts'] } }), 'missing-powerpoint-role-receipts'],
    ['missing physical goldens', input({ golden: { valid: false, reasons: ['missing-golden-image'] } }), 'missing-golden-image'],
    ['unavailable canonical corpus manifest', input({ golden: { valid: false, reasons: ['canonical-qualification-manifest-unavailable'] } }), 'canonical-qualification-manifest-unavailable'],
  ])('returns a blocked result for %s rather than a claim pass', (_name, options, reason) => {
    const result = evaluateVisualGate(options)
    expect(result.integrity).toEqual(expect.objectContaining({ verdict: 'blocked', reasons: expect.arrayContaining([reason]) }))
    expect(result.qualification.verdict).toBe('blocked')
    expect(gateExitCode(result, 'integrity')).toBe(1)
  })

  it('fails integrity for tampered or non-finite evidence', () => {
    const tampered = evaluateVisualGate(input({ actual: { valid: false, reasons: ['actual-image-hash-mismatch'] } }))
    expect(tampered.integrity.verdict).toBe('failed')
    const nonFinite = evaluateVisualGate(input({ comparison: {
      failed: false, deckCount: 1, meanSsim: null, minSsim: null, decks: [{ file: 'deck-a.pptx', ok: true, slides: [{ index: 0, ssim: Number.NaN }] }],
    } }))
    expect(nonFinite.integrity).toEqual(expect.objectContaining({
      verdict: 'failed', reasons: expect.arrayContaining(['non-finite-visual-scores']),
    }))
  })
})
