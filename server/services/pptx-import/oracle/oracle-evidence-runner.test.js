import { describe, expect, it } from 'vitest'
import canonicalManifest from '../../../data/test-corpus/importer-qualification-manifest.json'
import corpusManifest from '../evidence/corpus-manifest.js'
import runner from './oracle-evidence-runner.js'

const { manifestDigest } = corpusManifest
const { actualIdentitySummary, validateCanonicalQualificationManifest, validateResultArtifact } = runner

function fixture() {
  const actualManifest = {
    decks: [{
      jobId: 'job-1', source: { fileName: 'deck-a.pptx', sha256: 'a'.repeat(64), byteLength: 10, ooxmlSlideCount: 1 },
      presentation: {
        id: 'presentation-1', packageRevisionId: 'r0', packageHeadHash: 'b'.repeat(64),
        aggregateGeneration: 3, originalSha256: 'a'.repeat(64), originalByteLength: 10,
      },
      slides: [{ index: 0, path: 'deck-a/slide-0.png', sha256: 'c'.repeat(64), byteLength: 20, width: 16, height: 9 }],
    }],
  }
  const comparison = {
    failed: false, deckCount: 1, meanSsim: 0.99, minSsim: 0.98,
    decks: [{ file: 'deck-a.pptx', ok: true, slides: [{ index: 0, ssim: 0.98 }] }],
  }
  return { actualManifest, comparison }
}

describe('signed visual result artifact', () => {
  it('requires the comparison and every package-backed actual identity', () => {
    const { actualManifest, comparison } = fixture()
    const result = { schemaVersion: 1, comparison, actuals: actualIdentitySummary(actualManifest) }
    expect(validateResultArtifact(result, comparison, actualManifest)).toEqual({ valid: true, reasons: [] })
  })

  it('rejects a score artifact with swapped package or PNG identity', () => {
    const { actualManifest, comparison } = fixture()
    const result = { schemaVersion: 1, comparison, actuals: actualIdentitySummary(actualManifest) }
    result.actuals[0].presentation.packageHeadHash = 'd'.repeat(64)
    expect(validateResultArtifact(result, comparison, actualManifest)).toEqual(expect.objectContaining({
      valid: false, reasons: expect.arrayContaining(['visual-result-actual-identity-mismatch']),
    }))
    result.actuals = actualIdentitySummary(actualManifest)
    result.actuals[0].slides[0].sha256 = 'e'.repeat(64)
    expect(validateResultArtifact(result, comparison, actualManifest).reasons)
      .toContain('visual-result-actual-identity-mismatch')
    result.actuals = actualIdentitySummary(actualManifest)
    result.actuals[0].presentation.originalByteLength = 11
    expect(validateResultArtifact(result, comparison, actualManifest).reasons)
      .toContain('visual-result-actual-identity-mismatch')
  })
})

describe('canonical qualification corpus binding', () => {
  it('rejects a self-consistent manifest that differs from the checked-in canonical order', () => {
    const corpus = {
      ...canonicalManifest,
      decks: [...canonicalManifest.decks].reverse(),
    }
    corpus.manifestDigest = manifestDigest(corpus)
    const inventory = { decks: canonicalManifest.decks }

    expect(validateCanonicalQualificationManifest({
      corpus, canonical: canonicalManifest, inventory,
    })).toEqual(expect.objectContaining({
      valid: false,
      reasons: expect.arrayContaining(['noncanonical-qualification-manifest']),
    }))
  })
})
