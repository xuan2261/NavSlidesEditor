import { describe, expect, it } from 'vitest'
import comparisonEvidence from './comparison-evidence.js'

const { validateComparisonInventory } = comparisonEvidence

function fixture() {
  const goldenManifest = {
    decks: [{
      source: { fileName: 'deck-a.pptx', ooxmlSlideCount: 2 },
      slides: [
        { index: 0, path: 'deck-a/slide-0.png' },
        { index: 1, path: 'deck-a/slide-1.png' },
      ],
    }],
  }
  const actualManifest = {
    decks: [{
      source: { fileName: 'deck-a.pptx' },
      slides: [
        { index: 0, path: 'deck-a/slide-0.png' },
        { index: 1, path: 'deck-a/slide-1.png' },
      ],
    }],
  }
  const comparison = {
    failed: false, deckCount: 1,
    decks: [{
      file: 'deck-a.pptx', ok: true,
      slides: [
        { index: 0, golden: 'slide-0.png', actual: 'slide-0.png', ssim: 1 },
        { index: 1, golden: 'slide-1.png', actual: 'slide-1.png', ssim: 0.99 },
      ],
    }],
  }
  return { goldenManifest, actualManifest, comparison }
}

describe('visual comparison inventory', () => {
  it('requires every golden and package-backed actual slide exactly once', () => {
    const input = fixture()
    expect(validateComparisonInventory(input)).toEqual({ valid: true, reasons: [] })
  })

  it('rejects omitted decks, slides, or mismatched slide aliases', () => {
    const omittedDeck = fixture()
    omittedDeck.comparison.deckCount = 2
    expect(validateComparisonInventory(omittedDeck).reasons).toContain('comparison-deck-inventory-mismatch')

    const omittedSlide = fixture()
    omittedSlide.comparison.decks[0].slides.pop()
    expect(validateComparisonInventory(omittedSlide).reasons).toContain('comparison-slide-inventory-mismatch')

    const swappedAlias = fixture()
    swappedAlias.comparison.decks[0].slides[1].actual = 'slide-0.png'
    expect(validateComparisonInventory(swappedAlias).reasons).toContain('comparison-slide-inventory-mismatch')
  })
})
