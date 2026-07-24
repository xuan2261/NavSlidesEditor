const path = require('node:path')

const unique = (values) => [...new Set(values)].sort()
const fileName = (slide) => path.posix.basename(slide?.path || '')

function deckMap(manifest) {
  const decks = Array.isArray(manifest?.decks) ? manifest.decks : []
  const mapped = new Map()
  for (const deck of decks) {
    const name = deck?.source?.fileName
    if (typeof name !== 'string' || !name || mapped.has(name)) return null
    mapped.set(name, deck)
  }
  return mapped
}

function validateComparisonDeck(comparisonDeck, goldenDeck, actualDeck, reasons) {
  const expectedCount = goldenDeck.source.ooxmlSlideCount
  const goldenSlides = goldenDeck.slides
  const actualSlides = actualDeck.slides
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 1 || comparisonDeck?.ok !== true ||
    !Array.isArray(comparisonDeck?.slides) || !Array.isArray(goldenSlides) || !Array.isArray(actualSlides) ||
    goldenSlides.length !== expectedCount || actualSlides.length !== expectedCount ||
    comparisonDeck.slides.length !== expectedCount) {
    reasons.push('comparison-slide-inventory-mismatch')
    return
  }
  for (let index = 0; index < expectedCount; index += 1) {
    const slide = comparisonDeck.slides[index]
    if (slide?.index !== index || slide.golden !== fileName(goldenSlides[index]) ||
      slide.actual !== fileName(actualSlides[index]) || !Number.isFinite(slide.ssim) ||
      slide.ssim < 0 || slide.ssim > 1) reasons.push('comparison-slide-inventory-mismatch')
  }
}

function validateComparisonInventory({ comparison, goldenManifest, actualManifest } = {}) {
  const goldenByFile = deckMap(goldenManifest)
  const actualByFile = deckMap(actualManifest)
  const comparisonDecks = Array.isArray(comparison?.decks) ? comparison.decks : []
  const reasons = []
  if (!goldenByFile || !actualByFile || goldenByFile.size === 0 || !Number.isSafeInteger(comparison?.deckCount) ||
    comparison.deckCount !== goldenByFile.size || actualByFile.size !== goldenByFile.size ||
    comparisonDecks.length !== goldenByFile.size) reasons.push('comparison-deck-inventory-mismatch')
  const comparisonByFile = new Map()
  for (const deck of comparisonDecks) {
    if (typeof deck?.file !== 'string' || !deck.file || comparisonByFile.has(deck.file)) {
      reasons.push('comparison-deck-inventory-mismatch')
      continue
    }
    comparisonByFile.set(deck.file, deck)
  }
  for (const [file, goldenDeck] of goldenByFile || []) {
    const actualDeck = actualByFile?.get(file)
    const comparisonDeck = comparisonByFile.get(file)
    if (!actualDeck || !comparisonDeck) {
      reasons.push('comparison-deck-inventory-mismatch')
      continue
    }
    validateComparisonDeck(comparisonDeck, goldenDeck, actualDeck, reasons)
  }
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

module.exports = { validateComparisonInventory }
