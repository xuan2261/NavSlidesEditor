const crypto = require('node:crypto')
const fs = require('fs-extra')
const path = require('node:path')
const { decodePng } = require('./png-rgba')

const ENVIRONMENT_DIGESTS = Object.freeze([
  'fontSetDigest', 'localeDigest', 'dpiScaleDigest', 'viewportDigest',
  'cropLetterboxPolicyDigest', 'resamplingPolicyDigest',
])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
}

function isPositiveInt(value) {
  return Number.isSafeInteger(value) && value > 0
}

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function unique(reasons) {
  return [...new Set(reasons)].sort()
}

function deckStem(fileName) {
  return String(fileName).replace(/\.pptx$/i, '')
}

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.posix.isAbsolute(value)) return false
  const normalized = path.posix.normalize(value)
  return normalized === value && !normalized.startsWith('../') && !normalized.includes('/../')
}

function validateCorpus(corpusManifest, reasons, requiredDeckCount) {
  if (!isRecord(corpusManifest) || !isSha256(corpusManifest.manifestDigest)) {
    reasons.push('invalid-corpus-manifest')
    return []
  }
  const decks = Array.isArray(corpusManifest.decks) ? corpusManifest.decks : []
  if (decks.length === 0 || (requiredDeckCount != null && decks.length !== requiredDeckCount)) {
    reasons.push('invalid-corpus-deck-count')
  }
  const ids = new Set()
  for (const deck of decks) {
    if (!isRecord(deck) || typeof deck.id !== 'string' || !deck.id || !isSha256(deck.sha256)) {
      reasons.push('invalid-corpus-deck')
      continue
    }
    if (ids.has(deck.id)) reasons.push('duplicate-corpus-deck')
    ids.add(deck.id)
  }
  return decks
}

function validateSlide(slide, index, source, reasons) {
  if (!isRecord(slide) || slide.index !== index || !isSha256(slide.sha256) ||
    !isPositiveInt(slide.byteLength) || !isPositiveInt(slide.width) || !isPositiveInt(slide.height)) {
    reasons.push('invalid-golden-slide')
    return
  }
  if (!isSafeRelativePath(slide.path)) reasons.push('unsafe-golden-image-path')
  if (slide.path !== `${deckStem(source.fileName)}/slide-${index}.png`) {
    reasons.push('golden-slide-inventory-mismatch')
  }
}

function validateGoldenEvidence({ corpusManifest, goldenManifest, requiredDeckCount = null } = {}) {
  const reasons = []
  const corpusDecks = validateCorpus(corpusManifest, reasons, requiredDeckCount)
  if (!isRecord(goldenManifest) || goldenManifest.schemaVersion !== 1) reasons.push('invalid-golden-manifest')
  if (goldenManifest?.authority !== 'Microsoft PowerPoint' || goldenManifest?.renderer?.name !== 'Microsoft PowerPoint') {
    reasons.push('golden-renderer-not-powerpoint')
  }
  if (typeof goldenManifest?.renderer?.officeVersion !== 'string' || !goldenManifest.renderer.officeVersion ||
    typeof goldenManifest?.renderer?.officeBuild !== 'string' || !goldenManifest.renderer.officeBuild ||
    !isSha256(goldenManifest?.renderer?.officeDigest) || !isSha256(goldenManifest?.renderer?.windowsDigest)) {
    reasons.push('invalid-powerpoint-renderer-metadata')
  }
  for (const key of ENVIRONMENT_DIGESTS) {
    if (!isSha256(goldenManifest?.captureEnvironment?.[key])) reasons.push('invalid-golden-capture-environment')
  }
  if (goldenManifest?.corpusManifestDigest !== corpusManifest?.manifestDigest) reasons.push('golden-corpus-manifest-mismatch')

  const goldenDecks = Array.isArray(goldenManifest?.decks) ? goldenManifest.decks : []
  const corpusById = new Map(corpusDecks.map((deck) => [deck.id, deck]))
  if (goldenDecks.length !== corpusById.size) reasons.push('golden-deck-inventory-mismatch')
  const seen = new Set()
  for (const goldenDeck of goldenDecks) {
    const source = goldenDeck?.source
    const corpusDeck = corpusById.get(source?.fileName)
    if (!isRecord(source) || !corpusDeck || !isSha256(source.sha256) ||
      !isPositiveInt(source.byteLength) || !isPositiveInt(source.ooxmlSlideCount)) {
      reasons.push('invalid-golden-source')
      continue
    }
    if (seen.has(source.fileName)) reasons.push('duplicate-golden-deck')
    seen.add(source.fileName)
    if (source.sha256 !== corpusDeck.sha256) reasons.push('golden-source-hash-mismatch')
    const slides = Array.isArray(goldenDeck.slides) ? goldenDeck.slides : []
    if (slides.length !== source.ooxmlSlideCount) reasons.push('golden-slide-inventory-mismatch')
    slides.forEach((slide, index) => validateSlide(slide, index, source, reasons))
  }
  for (const id of corpusById) if (!seen.has(id[0])) reasons.push('missing-golden-deck')
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

function safeFilePath(root, relativePath) {
  if (!isSafeRelativePath(relativePath)) return null
  const base = path.resolve(root)
  const candidate = path.resolve(base, ...relativePath.split('/'))
  return candidate.startsWith(`${base}${path.sep}`) ? candidate : null
}

async function verifyGoldenInventory(goldensDir, decks) {
  const reasons = []
  let entries
  try { entries = await fs.readdir(goldensDir) } catch { return ['missing-golden-image'] }
  const expectedDecks = new Set(decks.map((deck) => deckStem(deck.source.fileName)))
  if (entries.some((entry) => !expectedDecks.has(entry))) reasons.push('golden-image-inventory-mismatch')
  for (const deck of decks) {
    const directory = deckStem(deck.source.fileName)
    let names
    try { names = await fs.readdir(path.join(goldensDir, directory)) } catch { reasons.push('missing-golden-image'); continue }
    const expected = new Set(deck.slides.map((slide) => path.posix.basename(slide.path)))
    if (names.length !== expected.size || names.some((name) => !expected.has(name))) reasons.push('golden-image-inventory-mismatch')
  }
  return reasons
}

async function verifyGoldenImageFiles({ corpusManifest, goldenManifest, goldensDir, requiredDeckCount = null } = {}) {
  const structural = validateGoldenEvidence({ corpusManifest, goldenManifest, requiredDeckCount })
  if (!structural.valid) return structural
  const reasons = await verifyGoldenInventory(goldensDir, goldenManifest.decks)
  for (const deck of goldenManifest.decks) {
    for (const slide of deck.slides) {
      const filePath = safeFilePath(goldensDir, slide.path)
      let bytes
      try {
        if (!filePath) throw new Error('unsafe path')
        bytes = await fs.readFile(filePath)
      } catch {
        reasons.push('missing-golden-image')
        continue
      }
      if (hash(bytes) !== slide.sha256) {
        reasons.push('golden-image-hash-mismatch')
        continue
      }
      if (bytes.length !== slide.byteLength) {
        reasons.push('golden-image-length-mismatch')
        continue
      }
      let decoded
      try {
        decoded = decodePng(bytes)
      } catch {
        reasons.push('invalid-golden-image')
        continue
      }
      if (decoded.width !== slide.width || decoded.height !== slide.height) reasons.push('golden-image-dimension-mismatch')
      if (decoded.width <= 8 && decoded.height <= 8) reasons.push('placeholder-golden-image')
    }
  }
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

module.exports = { deckStem, isSafeRelativePath, validateGoldenEvidence, verifyGoldenImageFiles }
