const fs = require('fs-extra')
const path = require('node:path')
const { hashCanonical } = require('../evidence/canonical-hash')
const { buildCorpusInventory, verifyCorpusManifest } = require('../evidence/corpus-manifest')
const { validateGoldenEvidence, verifyGoldenImageFiles, isSafeRelativePath } = require('./golden-evidence')
const { verifyGoldenSourceFiles } = require('./golden-source-evidence')
const { validateActualEvidence, verifyActualImageFiles, verifyActualSourceFiles } = require('./actual-evidence')
const { validateVisualEvidenceEnvelope, validateVisualGoldenEnvironment } = require('./visual-evidence')
const { compareCorpusToGoldens } = require('./compare-goldens')
const { validateComparisonInventory } = require('./comparison-evidence')
const { evaluateVisualGate } = require('./oracle-gate')

const CANONICAL_QUALIFICATION_MANIFEST = path.resolve(
  __dirname,
  '../../../data/test-corpus/importer-qualification-manifest.json'
)
const unique = (values) => [...new Set(values)].sort()
const invalid = (reason) => ({ valid: false, reasons: [reason] })

function combine(...results) {
  return { valid: results.every((result) => result.valid), reasons: unique(results.flatMap((result) => result.reasons || [])) }
}

function validateCanonicalQualificationManifest({ corpus, canonical, inventory }) {
  const provided = verifyCorpusManifest(corpus, inventory)
  const canonicalCheck = verifyCorpusManifest(canonical, inventory)
  const reasons = [...provided.errors, ...canonicalCheck.errors]
  if (hashCanonical(corpus) !== hashCanonical(canonical)) reasons.push('noncanonical-qualification-manifest')
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

function artifactPath(baseDir, alias) {
  if (!isSafeRelativePath(alias)) return null
  const base = path.resolve(baseDir)
  const resolved = path.resolve(base, ...alias.split('/'))
  return resolved.startsWith(`${base}${path.sep}`) ? resolved : null
}

async function readJson(filePath, reason) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')) } catch { throw Object.assign(new Error(reason), { code: reason }) }
}

async function readEnvelopeArtifacts(evidenceManifestPath) {
  const manifest = await readJson(evidenceManifestPath, 'invalid-evidence-manifest-json')
  const baseDir = path.dirname(path.resolve(evidenceManifestPath))
  const contents = {}
  const aliases = Array.isArray(manifest.artifacts) ? manifest.artifacts.map((artifact) => artifact?.alias) : []
  for (const alias of aliases) {
    const resolved = artifactPath(baseDir, alias)
    if (!resolved) throw Object.assign(new Error('unsafe-evidence-artifact-path'), { code: 'unsafe-evidence-artifact-path' })
    try { contents[alias] = await fs.readFile(resolved) } catch { throw Object.assign(new Error('missing-evidence-artifact'), { code: 'missing-evidence-artifact' }) }
  }
  const visual = manifest?.subject?.visualOracle
  const parsed = {}
  for (const name of ['corpus', 'golden', 'actual', 'result']) {
    const alias = visual?.artifacts?.[name]
    try { parsed[name] = JSON.parse(contents[alias]?.toString('utf8')) } catch {
      throw Object.assign(new Error('invalid-evidence-artifact-json'), { code: 'invalid-evidence-artifact-json' })
    }
  }
  return { manifest, contents, parsed, receiptsPath: path.join(baseDir, 'role-receipts.json') }
}

function actualIdentitySummary(actualManifest) {
  return (actualManifest?.decks || []).map((deck) => ({
    jobId: deck.jobId,
    source: {
      fileName: deck.source?.fileName, sha256: deck.source?.sha256, byteLength: deck.source?.byteLength,
      ooxmlSlideCount: deck.source?.ooxmlSlideCount,
    },
    presentation: {
      id: deck.presentation?.id, packageRevisionId: deck.presentation?.packageRevisionId,
      packageHeadHash: deck.presentation?.packageHeadHash, aggregateGeneration: deck.presentation?.aggregateGeneration,
      originalSha256: deck.presentation?.originalSha256, originalByteLength: deck.presentation?.originalByteLength,
    },
    slides: (deck.slides || []).map((slide) => ({
      index: slide.index, path: slide.path, sha256: slide.sha256, byteLength: slide.byteLength,
      width: slide.width, height: slide.height,
    })),
  }))
}

function visualEvidenceSummary(manifest) {
  const visual = manifest?.subject?.visualOracle || {}
  return {
    subjectHash: manifest?.subjectHash || null,
    corpusManifestDigest: visual.corpusManifestDigest || null,
    goldenManifestDigest: visual.goldenManifestDigest || null,
    actualManifestDigest: visual.actualManifestDigest || null,
    resultDigest: visual.resultDigest || null,
    executionDigest: visual.executionDigest || null,
    authorizationPolicyHash: visual.authorizationPolicyHash || null,
  }
}

function validateResultArtifact(resultArtifact, comparison, actualManifest) {
  const reasons = []
  if (resultArtifact?.schemaVersion !== 1 || !resultArtifact.comparison ||
    hashCanonical(resultArtifact.comparison) !== hashCanonical(comparison)) reasons.push('visual-result-comparison-mismatch')
  if (!Array.isArray(resultArtifact?.actuals) ||
    hashCanonical(resultArtifact.actuals) !== hashCanonical(actualIdentitySummary(actualManifest))) {
    reasons.push('visual-result-actual-identity-mismatch')
  }
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

async function evaluateEvidenceRun({
  evidenceManifestPath, roleReceiptsPath = null, corpusDir, goldensDir, actualsDir, oracleDisabled = false,
} = {}) {
  let loaded
  try {
    if (!evidenceManifestPath) throw Object.assign(new Error('missing-evidence-manifest'), { code: 'missing-evidence-manifest' })
    if (!corpusDir || !goldensDir || !actualsDir) throw Object.assign(new Error('missing-visual-artifact-directory'), { code: 'missing-visual-artifact-directory' })
    loaded = await readEnvelopeArtifacts(evidenceManifestPath)
    const receipts = await readJson(roleReceiptsPath || loaded.receiptsPath, 'missing-powerpoint-role-receipts')
    const envelope = validateVisualEvidenceEnvelope({ manifest: loaded.manifest, contents: loaded.contents, receipts })
    const { corpus, golden, actual, result } = loaded.parsed
    const environmentBinding = validateVisualGoldenEnvironment({ manifest: loaded.manifest, goldenManifest: golden })
    const boundEnvelope = combine(envelope, environmentBinding)
    let corpusBinding
    try {
      const [inventory, canonical] = await Promise.all([
        buildCorpusInventory(corpusDir),
        readJson(CANONICAL_QUALIFICATION_MANIFEST, 'canonical-qualification-manifest-unavailable'),
      ])
      corpusBinding = validateCanonicalQualificationManifest({ corpus, canonical, inventory })
    } catch (error) {
      corpusBinding = invalid(error?.code || 'corpus-inventory-unavailable')
    }
    const goldenResult = combine(
      corpusBinding,
      validateGoldenEvidence({ corpusManifest: corpus, goldenManifest: golden, requiredDeckCount: 11 }),
      await verifyGoldenSourceFiles({ corpusManifest: corpus, goldenManifest: golden, corpusDir, requiredDeckCount: 11 }),
      await verifyGoldenImageFiles({ corpusManifest: corpus, goldenManifest: golden, goldensDir, requiredDeckCount: 11 }),
    )
    const actualResult = combine(
      corpusBinding,
      validateActualEvidence({ corpusManifest: corpus, actualManifest: actual, requiredDeckCount: 11 }),
      await verifyActualSourceFiles({ corpusManifest: corpus, actualManifest: actual, corpusDir, requiredDeckCount: 11 }),
      await verifyActualImageFiles({ corpusManifest: corpus, actualManifest: actual, actualsDir, requiredDeckCount: 11 }),
    )
    const comparison = await compareCorpusToGoldens({
      corpusDir, goldensDir, actualsDir, goldenManifest: golden, actualManifest: actual,
    })
    const comparisonResult = combine(
      validateResultArtifact(result, comparison, actual),
      validateComparisonInventory({ comparison, goldenManifest: golden, actualManifest: actual }),
    )
    const gate = evaluateVisualGate({
      oracleDisabled, envelope: boundEnvelope, golden: goldenResult, source: comparisonResult, actual: actualResult, comparison,
    })
    return {
      gate,
      comparison,
      evidence: visualEvidenceSummary(loaded.manifest),
      actuals: actualIdentitySummary(actual),
      validations: { envelope: boundEnvelope, golden: goldenResult, actual: actualResult, comparison: comparisonResult },
    }
  } catch (error) {
    const reason = error?.code || 'visual-evidence-run-failed'
    const gate = evaluateVisualGate({
      oracleDisabled, envelope: invalid(reason), golden: invalid(reason), source: invalid(reason), actual: invalid(reason), comparison: null,
    })
    return {
      gate,
      comparison: null,
      evidence: null,
      actuals: [],
      validations: { envelope: invalid(reason), golden: invalid(reason), source: invalid(reason), actual: invalid(reason) },
    }
  }
}

module.exports = {
  CANONICAL_QUALIFICATION_MANIFEST,
  actualIdentitySummary,
  evaluateEvidenceRun,
  readEnvelopeArtifacts,
  validateCanonicalQualificationManifest,
  validateResultArtifact,
  visualEvidenceSummary,
}
