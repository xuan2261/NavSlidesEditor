import { describe, expect, it } from 'vitest'
import harnessModule from './pptx-import-semantic-and-roundtrip-fidelity-tester.js'

const { buildFingerprint, computeSemanticFidelity, matchElements } = harnessModule

describe('roundtrip fingerprint matching', () => {
  it('buildFingerprint is stable and includes text prefix for text elements', () => {
    const element = {
      type: 'text',
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      content: '<b>Hello World</b>',
    }

    const fp1 = buildFingerprint(element)
    const fp2 = buildFingerprint(element)
    expect(fp1).toBe(fp2)
    expect(fp1).toContain('text|')
    expect(fp1).toContain('Hello World')
  })

  it('matches duplicate fingerprints to distinct targets without indexOf reuse bugs', () => {
    const sources = [
      { type: 'text', x: 0, y: 0, width: 100, height: 50, content: 'Same' },
      { type: 'text', x: 0, y: 0, width: 100, height: 50, content: 'Same' },
    ]

    const targets = [
      { type: 'text', x: 0, y: 0, width: 100, height: 50, content: 'Same' },
      { type: 'text', x: 10, y: 10, width: 100, height: 50, content: 'Same' },
    ]

    const result = matchElements(sources, targets)
    expect(result.matches.filter((item) => item.method !== 'unmatched')).toHaveLength(2)
    expect(new Set(result.matches.map((item) => item.roundTripIndex)).size).toBe(2)
  })

  it('treats far same-type elements as type-only and not stable', () => {
    const sources = [{ type: 'shape', x: 0, y: 0, width: 100, height: 50 }]
    const targets = [{ type: 'shape', x: 80, y: 80, width: 100, height: 50 }]

    const result = matchElements(sources, targets)
    expect(result.matches[0].method).toBe('type-only')
    expect(result.matches[0].stable).toBe(false)
    expect(result.unmatchedTargets).toHaveLength(1)
  })

  it('does not mark unsupported cross-type swaps as stable', () => {
    const sources = [{ type: 'image', x: 0, y: 0, width: 100, height: 50 }]
    const targets = [{ type: 'shape', x: 0, y: 0, width: 100, height: 50 }]
    const result = matchElements(sources, targets)

    expect(result.matches[0].stable).toBe(false)
    expect(result.matches[0].method).toBe('unmatched')
  })

  it('uses one-to-one semantic matching for duplicate candidates', () => {
    const semantic = computeSemanticFidelity(
      {
        slides: [{ elements: [{ type: 'shape', shapType: 'rect' }, { type: 'shape', shapType: 'rect' }] }],
      },
      {
        slides: [{ elements: [{ type: 'shape', x: 0, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', shape: 'rect' }] }],
      }
    )

    expect(semantic.overall).toBeLessThan(1)
    expect(semantic.diffs.some((diff) => diff.type === 'missing-nav')).toBe(true)
  })

  it('keeps semantic matching type-safe so shapes do not consume image matches', () => {
    const semantic = computeSemanticFidelity(
      {
        slides: [
          {
            elements: [
              { type: 'shape', shapType: 'rect', left: 0, top: 0, width: 100, height: 100 },
              { type: 'image', left: 200, top: 0, width: 100, height: 100 },
            ],
          },
        ],
      },
      {
        slides: [
          {
            elements: [
              { type: 'svg', x: 0, y: 0, width: 100, height: 100 },
              { type: 'image', x: 200, y: 0, width: 100, height: 100, src: '/uploads/test.png' },
            ],
          },
        ],
      }
    )

    expect(semantic.scores.image).toBe(1)
    expect(semantic.diffs.some((diff) => diff.pptxType === 'image' && diff.navType === 'svg')).toBe(false)
  })

  it('evaluates shape elements with text content as shapes instead of text', () => {
    const semantic = computeSemanticFidelity(
      {
        slides: [
          {
            elements: [{ type: 'shape', shapType: 'rect', content: 'Label', left: 10, top: 10, width: 80, height: 30 }],
          },
        ],
      },
      {
        slides: [{ elements: [{ type: 'svg', x: 10, y: 10, width: 80, height: 30 }] }],
      }
    )

    expect(semantic.scores.shape).toBeGreaterThanOrEqual(0.9)
    expect(
      semantic.diffs.some((diff) => Array.isArray(diff.gaps) && diff.gaps.includes('missing-text-content'))
    ).toBe(false)
  })
})
