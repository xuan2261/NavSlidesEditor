const crypto = require('node:crypto')
const fs = require('fs-extra')
const path = require('node:path')
const { computeSsim } = require('./ssim')
const { decodePng } = require('./png-rgba')

const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const deckStem = (fileName) => String(fileName).replace(/\.pptx$/i, '')

async function listCorpusPptx(corpusDir) {
  const names = await fs.readdir(corpusDir).catch(() => [])
  return names.filter((name) => name.toLowerCase().endsWith('.pptx')).sort((left, right) => left.localeCompare(right))
}

async function scanSlideInventory(dir) {
  if (!(await fs.pathExists(dir))) return { exists: false, slides: [], valid: false }
  const names = await fs.readdir(dir)
  const byIndex = new Map()
  let valid = true
  for (const name of names) {
    const match = /^slide-(0|[1-9]\d*)\.png$/i.exec(name)
    if (!match || byIndex.has(Number(match?.[1]))) { valid = false; continue }
    byIndex.set(Number(match[1]), name)
  }
  const slides = [...byIndex].sort(([left], [right]) => left - right)
  if (slides.some(([index], ordinal) => index !== ordinal)) valid = false
  return { exists: true, slides, valid }
}

async function listSlidePngs(dir) {
  const inventory = await scanSlideInventory(dir)
  return inventory.valid ? inventory.slides.map(([, name]) => name) : []
}

async function loadImage(filePath, expected, kind) {
  let bytes
  try { bytes = await fs.readFile(filePath) } catch { return { error: `missing-${kind}-image` } }
  if (expected?.sha256 && hash(bytes) !== expected.sha256) return { error: `${kind}-image-hash-mismatch` }
  if (expected?.byteLength != null && bytes.length !== expected.byteLength) return { error: `${kind}-image-length-mismatch` }
  try { return { image: decodePng(bytes) } } catch { return { error: `invalid-${kind}-image` } }
}

function failed(file, error, counts = {}) {
  return { file, ok: false, error, slides: [], meanSsim: null, ...counts }
}

async function compareDeck({
  deckFile, goldensDir, actualsDir, expectedSlideCount = null, expectedGoldenSlides = null, expectedActualSlides = null,
} = {}) {
  const stem = deckStem(deckFile)
  const goldenInventory = await scanSlideInventory(path.join(goldensDir, stem))
  if (!goldenInventory.exists) return failed(deckFile, 'missing-goldens')
  if (!goldenInventory.valid) return failed(deckFile, 'golden-slide-inventory-invalid')
  const actualInventory = await scanSlideInventory(path.join(actualsDir || '', stem))
  if (!actualInventory.exists) return failed(deckFile, 'missing-actuals', { goldenCount: goldenInventory.slides.length, actualCount: 0 })
  if (!actualInventory.valid) return failed(deckFile, 'actual-slide-inventory-invalid')

  const expectedCount = expectedSlideCount ?? goldenInventory.slides.length
  if (actualInventory.slides.length > expectedCount) {
    return failed(deckFile, 'actual-slide-inventory-invalid', {
      goldenCount: goldenInventory.slides.length, actualCount: actualInventory.slides.length,
    })
  }
  if (goldenInventory.slides.length !== expectedCount || actualInventory.slides.length !== expectedCount) {
    return failed(deckFile, 'slide-count-mismatch', {
      goldenCount: goldenInventory.slides.length, actualCount: actualInventory.slides.length,
    })
  }
  const slides = []
  let sum = 0
  for (let index = 0; index < expectedCount; index += 1) {
    const goldenName = goldenInventory.slides[index][1]
    const actualName = actualInventory.slides[index][1]
    const golden = await loadImage(path.join(goldensDir, stem, goldenName), expectedGoldenSlides?.[index], 'golden')
    if (golden.error) return failed(deckFile, golden.error)
    if (golden.image.width <= 8 && golden.image.height <= 8) return failed(deckFile, 'placeholder-goldens')
    const actual = await loadImage(path.join(actualsDir, stem, actualName), expectedActualSlides?.[index], 'actual')
    if (actual.error) return failed(deckFile, actual.error)
    if (golden.image.width !== actual.image.width || golden.image.height !== actual.image.height) {
      return failed(deckFile, 'slide-size-mismatch')
    }
    const ssim = computeSsim(actual.image.data, golden.image.data, {
      width: golden.image.width, height: golden.image.height,
    })
    if (!Number.isFinite(ssim)) return failed(deckFile, 'non-finite-slide-ssim')
    slides.push({ index, ssim, golden: goldenName, actual: actualName })
    sum += ssim
  }
  const meanSsim = sum / expectedCount
  return {
    file: deckFile, ok: Number.isFinite(meanSsim), slides, meanSsim,
    goldenCount: goldenInventory.slides.length, actualCount: actualInventory.slides.length,
  }
}

function matchingDeck(manifest, fileName) {
  return manifest?.decks?.find((deck) => (deck.source?.fileName || deck.file) === fileName) || null
}

async function compareCorpusToGoldens({ corpusDir, goldensDir, actualsDir, goldenManifest = null, actualManifest = null } = {}) {
  const files = await listCorpusPptx(corpusDir)
  const decks = []
  const missingGoldens = []
  for (const file of files) {
    const goldenDeck = matchingDeck(goldenManifest, file)
    const actualDeck = matchingDeck(actualManifest, file)
    const result = await compareDeck({
      deckFile: file, goldensDir, actualsDir, expectedSlideCount: goldenDeck?.source?.ooxmlSlideCount ?? null,
      expectedGoldenSlides: goldenDeck?.slides || null, expectedActualSlides: actualDeck?.slides || null,
    })
    decks.push(result)
    if (result.error === 'missing-goldens') missingGoldens.push(file)
  }
  const scores = decks.flatMap((deck) => deck.slides.map((slide) => slide.ssim))
  const meanSsim = scores.length && scores.every(Number.isFinite)
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : null
  return {
    decks, meanSsim, minSsim: scores.length ? Math.min(...scores) : null, missingGoldens,
    failed: files.length === 0 || decks.some((deck) => !deck.ok) || !Number.isFinite(meanSsim), deckCount: files.length,
  }
}

function sha256FileSync(filePath) {
  return hash(require('node:fs').readFileSync(filePath))
}

module.exports = { compareCorpusToGoldens, compareDeck, deckStem, listCorpusPptx, listSlidePngs, scanSlideInventory, sha256FileSync }
