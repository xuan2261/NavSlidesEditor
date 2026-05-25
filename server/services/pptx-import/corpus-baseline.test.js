import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import tester from './pptx-import-semantic-and-roundtrip-fidelity-tester.js'
import baseline from './corpus-baseline.json'

const { applyStrictPerTypeGates, evaluateCapture, runCorpusTests } = tester
const STRICT_CLASS_DROP_TYPES = ['image', 'shape', 'table', 'text', 'chart', 'group', 'diagram', 'line', 'other']

describe('pptx corpus baseline', () => {
  it('scores math-to-latex capture with math-specific criteria', () => {
    const capture = evaluateCapture(
      { type: 'math', left: 10, top: 20, width: 100, height: 50, latex: '\\frac{a}{b}' },
      { type: 'latex', x: 10, y: 20, width: 100, height: 50, latex: '\\frac{a}{b}', fontSize: 24 }
    )

    expect(capture.score).toBe(1)
    expect(capture.gaps).toEqual([])
  })

  it.skipIf(!fs.existsSync('./PPTX'))('does not drift below the checked-in corpus baseline', async () => {
    const { results, summary } = await runCorpusTests('./PPTX', { skipRoundTrip: true })

    expect(summary.avgSemanticFidelity).toBeGreaterThanOrEqual(baseline.summary.avgSemanticFidelity)

    for (const result of results) {
      const expected = baseline.perDeck[result.file]
      if (!expected) continue
      expect(result.semanticFidelity).toBeGreaterThanOrEqual(expected.semanticFidelity - 0.01)
    }
  }, 120000)

  it('fails strict gate when a deck is below the semantic floor', () => {
    const errors = applyStrictPerTypeGates({
      file: 'low-semantic.pptx',
      semanticFidelity: 0.94,
      propertyCoverage: { byType: {} },
      geometryDrift: { byType: {} },
      elementCount: { sourceByType: {}, navByType: {} },
    })

    expect(errors).toContain('Strict semantic gate failed for low-semantic.pptx: 94.0% < 95.0%')
  })

  it('fails strict gate when an element class drops more than 15%', () => {
    const errors = applyStrictPerTypeGates({
      file: 'image-drop.pptx',
      semanticFidelity: 1,
      propertyCoverage: { byType: {} },
      geometryDrift: { byType: {} },
      elementCount: {
        sourceByType: { image: 10 },
        navByType: { image: 8 },
      },
    })

    expect(errors).toContain('Strict element-count gate failed for image: drop 20.0% > 15.0%')
  })

  it.skipIf(!fs.existsSync('./server/data/test-corpus'))('runs against test-corpus by default', async () => {
    const { summary } = await runCorpusTests(undefined, { skipRoundTrip: true })

    expect(summary.corpusDir.replace(/\\/g, '/')).toContain('server/data/test-corpus')
    expect(summary.totalFiles).toBeGreaterThanOrEqual(10)
  }, 120000)

  it('locks aggregate acceptance floors in the corpus baseline', () => {
    expect(baseline.summary.totalFiles).toBeGreaterThanOrEqual(10)
    expect(baseline.summary.avgSemanticFidelity).toBeGreaterThanOrEqual(0.98)
    expect(baseline.summary.avgRoundTripStability).toBeGreaterThanOrEqual(0.99)
    expect(baseline.gates.perDeckMinSemantic).toBe(0.95)
    expect(baseline.gates.maxClassDrop).toBe(0.15)
  })

  it('locks per-deck semantic and element-class retention floors in the baseline', () => {
    for (const [deck, metrics] of Object.entries(baseline.perDeck)) {
      expect(metrics.semanticFidelity, deck).toBeGreaterThanOrEqual(baseline.gates.perDeckMinSemantic)

      for (const type of STRICT_CLASS_DROP_TYPES) {
        const sourceCount = metrics.elementCount?.sourceByType?.[type] || 0
        if (sourceCount <= 0) continue
        const navCount = metrics.elementCount?.navByType?.[type] || 0
        const drop = Math.max(0, sourceCount - navCount) / sourceCount
        expect(drop, `${deck}:${type}`).toBeLessThanOrEqual(baseline.gates.maxClassDrop)
      }
    }
  })
})
