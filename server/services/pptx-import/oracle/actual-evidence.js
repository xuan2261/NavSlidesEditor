const crypto = require('node:crypto')
const fs = require('fs-extra')
const path = require('node:path')
const { decodePng } = require('./png-rgba')
const { isSafeRelativePath } = require('./golden-evidence')
const { inspectPresentationStructure } = require('../presentation-structure')

const isSha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
const isPositiveInt = (value) => Number.isSafeInteger(value) && value > 0
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const unique = (reasons) => [...new Set(reasons)].sort()
const stem = (name) => String(name).replace(/\.pptx$/i, '')

function validateActualSlide(slide, index, source, reasons) {
  if (!slide || slide.index !== index || !isSha256(slide.sha256) || !isPositiveInt(slide.byteLength) ||
    !isPositiveInt(slide.width) || !isPositiveInt(slide.height)) reasons.push('invalid-actual-slide')
  if (!isSafeRelativePath(slide?.path) || slide?.path !== `${stem(source.fileName)}/slide-${index}.png`) {
    reasons.push('actual-slide-inventory-mismatch')
  }
}

function validateActualEvidence({ corpusManifest, actualManifest, requiredDeckCount = null } = {}) {
  const reasons = []
  const corpus = Array.isArray(corpusManifest?.decks) ? corpusManifest.decks : []
  if (!isSha256(corpusManifest?.manifestDigest) || !corpus.length ||
    (requiredDeckCount != null && corpus.length !== requiredDeckCount)) reasons.push('invalid-corpus-manifest')
  const corpusById = new Map()
  for (const deck of corpus) {
    if (!deck?.id || !isSha256(deck.sha256) || corpusById.has(deck.id)) reasons.push('invalid-corpus-manifest')
    else corpusById.set(deck.id, deck)
  }
  if (actualManifest?.schemaVersion !== 1 || actualManifest?.authority !== 'package-backed-http' ||
    actualManifest?.corpusManifestDigest !== corpusManifest?.manifestDigest) reasons.push('invalid-actual-manifest')
  const actuals = Array.isArray(actualManifest?.decks) ? actualManifest.decks : []
  if (actuals.length !== corpusById.size) reasons.push('actual-deck-inventory-mismatch')
  const seen = new Set()
  for (const actual of actuals) {
    const source = actual?.source
    const corpusDeck = corpusById.get(source?.fileName)
    if (!corpusDeck || !source || !isSha256(source.sha256) || !isPositiveInt(source.byteLength) ||
      !isPositiveInt(source.ooxmlSlideCount)) {
      reasons.push('invalid-actual-source')
      continue
    }
    if (seen.has(source.fileName)) reasons.push('duplicate-actual-deck')
    seen.add(source.fileName)
    if (source.sha256 !== corpusDeck.sha256) reasons.push('actual-source-hash-mismatch')
    if (actual.authority !== 'package-backed-http') reasons.push('actual-not-package-backed-http')
    if (typeof actual.jobId !== 'string' || !actual.jobId) reasons.push('missing-actual-import-job')
    const presentation = actual.presentation
    if (!presentation?.id || typeof presentation.packageRevisionId !== 'string' || !presentation.packageRevisionId ||
      !isSha256(presentation.packageHeadHash) || !isPositiveInt(presentation.aggregateGeneration) ||
      !isSha256(presentation.originalSha256) || !isPositiveInt(presentation.originalByteLength)) {
      reasons.push('invalid-actual-package-identity')
    }
    if (presentation?.originalSha256 !== source.sha256) reasons.push('actual-original-hash-mismatch')
    if (presentation?.originalByteLength !== source.byteLength) reasons.push('actual-original-byte-length-mismatch')
    const slides = Array.isArray(actual.slides) ? actual.slides : []
    if (slides.length !== source.ooxmlSlideCount) reasons.push('actual-slide-inventory-mismatch')
    slides.forEach((slide, index) => validateActualSlide(slide, index, source, reasons))
  }
  for (const id of corpusById.keys()) if (!seen.has(id)) reasons.push('missing-actual-deck')
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

async function verifyActualSourceFiles({
  corpusManifest, actualManifest, corpusDir, inspectSource = inspectPresentationStructure, requiredDeckCount = null,
} = {}) {
  const structural = validateActualEvidence({ corpusManifest, actualManifest, requiredDeckCount })
  if (!structural.valid) return structural
  const reasons = []
  for (const actual of actualManifest.decks) {
    const source = actual.source
    if (path.basename(source.fileName) !== source.fileName) {
      reasons.push('unsafe-actual-source-name')
      continue
    }
    let bytes
    try { bytes = await fs.readFile(path.join(corpusDir, source.fileName)) } catch {
      reasons.push('missing-actual-source-file')
      continue
    }
    if (hash(bytes) !== source.sha256) reasons.push('actual-source-file-hash-mismatch')
    if (bytes.length !== source.byteLength) reasons.push('actual-source-byte-length-mismatch')
    try {
      const structure = await inspectSource(bytes)
      if (!Array.isArray(structure?.slides) || structure.slides.length !== source.ooxmlSlideCount) {
        reasons.push('actual-source-slide-count-mismatch')
      }
    } catch {
      reasons.push('actual-source-ooxml-inspection-failed')
    }
  }
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

function safeFilePath(root, relativePath) {
  if (!isSafeRelativePath(relativePath)) return null
  const base = path.resolve(root)
  const filePath = path.resolve(base, ...relativePath.split('/'))
  return filePath.startsWith(`${base}${path.sep}`) ? filePath : null
}

async function verifyActualInventory(actualsDir, decks) {
  const reasons = []
  let entries
  try { entries = await fs.readdir(actualsDir) } catch { return ['missing-actual-image'] }
  const expectedDecks = new Set(decks.map((deck) => stem(deck.source.fileName)))
  const allowedMetadata = new Set(['actual-manifest.json'])
  if (entries.some((entry) => !expectedDecks.has(entry) && !allowedMetadata.has(entry))) {
    reasons.push('actual-image-inventory-mismatch')
  }
  for (const deck of decks) {
    const directory = stem(deck.source.fileName)
    let names
    try { names = await fs.readdir(path.join(actualsDir, directory)) } catch { reasons.push('missing-actual-image'); continue }
    const expected = new Set(deck.slides.map((slide) => path.posix.basename(slide.path)))
    if (names.length !== expected.size || names.some((name) => !expected.has(name))) reasons.push('actual-image-inventory-mismatch')
  }
  return reasons
}

async function verifyActualImageFiles({ corpusManifest, actualManifest, actualsDir, requiredDeckCount = null } = {}) {
  const structural = validateActualEvidence({ corpusManifest, actualManifest, requiredDeckCount })
  if (!structural.valid) return structural
  const reasons = await verifyActualInventory(actualsDir, actualManifest.decks)
  for (const actual of actualManifest.decks) {
    for (const slide of actual.slides) {
      const filePath = safeFilePath(actualsDir, slide.path)
      let bytes
      try { bytes = await fs.readFile(filePath) } catch { reasons.push('missing-actual-image'); continue }
      if (hash(bytes) !== slide.sha256) { reasons.push('actual-image-hash-mismatch'); continue }
      if (bytes.length !== slide.byteLength) { reasons.push('actual-image-length-mismatch'); continue }
      let decoded
      try { decoded = decodePng(bytes) } catch { reasons.push('invalid-actual-image'); continue }
      if (decoded.width !== slide.width || decoded.height !== slide.height) reasons.push('actual-image-dimension-mismatch')
      if (decoded.width <= 8 && decoded.height <= 8) reasons.push('placeholder-actual-image')
    }
  }
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

module.exports = { validateActualEvidence, verifyActualImageFiles, verifyActualSourceFiles }
