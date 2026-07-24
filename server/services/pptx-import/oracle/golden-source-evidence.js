const crypto = require('node:crypto')
const fs = require('fs-extra')
const path = require('node:path')
const { inspectPresentationStructure } = require('../presentation-structure')
const { validateGoldenEvidence } = require('./golden-evidence')

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function unique(reasons) {
  return [...new Set(reasons)].sort()
}

function safeSourceName(name) {
  return typeof name === 'string' && name.toLowerCase().endsWith('.pptx') &&
    path.basename(name) === name && !name.includes('..')
}

function sourceSlideCount(structure) {
  return Array.isArray(structure?.slides) ? structure.slides.length : null
}

async function verifyGoldenSourceFiles({
  corpusManifest, goldenManifest, corpusDir, inspectSource = inspectPresentationStructure, requiredDeckCount = null,
} = {}) {
  const structural = validateGoldenEvidence({ corpusManifest, goldenManifest, requiredDeckCount })
  if (!structural.valid) return structural
  const reasons = []
  let corpusNames
  try {
    corpusNames = (await fs.readdir(corpusDir)).filter((name) => name.toLowerCase().endsWith('.pptx')).sort()
  } catch {
    return { valid: false, reasons: ['missing-corpus-directory'] }
  }
  const expectedNames = corpusManifest.decks.map((deck) => deck.id).sort()
  if (corpusNames.length !== expectedNames.length || corpusNames.some((name, index) => name !== expectedNames[index])) {
    const expected = new Set(expectedNames)
    if (corpusNames.some((name) => !expected.has(name))) reasons.push('extra-corpus-deck')
    if (expectedNames.some((name) => !corpusNames.includes(name))) reasons.push('missing-corpus-deck')
  }
  for (const deck of goldenManifest.decks) {
    const source = deck.source
    if (!safeSourceName(source.fileName)) {
      reasons.push('unsafe-golden-source-name')
      continue
    }
    let bytes
    try {
      bytes = await fs.readFile(path.join(corpusDir, source.fileName))
    } catch {
      reasons.push('missing-golden-source-file')
      continue
    }
    if (hash(bytes) !== source.sha256) {
      reasons.push('golden-source-file-hash-mismatch')
      continue
    }
    if (bytes.length !== source.byteLength) {
      reasons.push('golden-source-byte-length-mismatch')
      continue
    }
    try {
      if (sourceSlideCount(await inspectSource(bytes)) !== source.ooxmlSlideCount) {
        reasons.push('golden-source-slide-count-mismatch')
      }
    } catch {
      reasons.push('golden-source-ooxml-inspection-failed')
    }
  }
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

module.exports = { verifyGoldenSourceFiles }
