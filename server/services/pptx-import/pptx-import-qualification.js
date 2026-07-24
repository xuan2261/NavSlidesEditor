const fs = require('fs-extra')
const { sanitizeDiagnostic } = require('./diagnostics')
const { importPptxFile } = require('./importer')
const { createSourceSnapshot, runSnapshotPass } = require('./pptx-import-qualification-source')
const { buildCorpusInventory, hashFile, verifyCorpusManifest } = require('./evidence/corpus-manifest')
const EVIDENCE_FIELDS = Object.freeze(['sceneGraphMappedNodes', 'sceneGraphUnmapped', 'chartCoverageGapCount', 'smartArtCoverageGapCount', 'permanentPlaceholderCount'])
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function errorDetail(error, type = 'import-failed') {
  return { type: typeof error?.type === 'string' ? error.type : type, message: sanitizeDiagnostic(error) }
}

function importerOptionSets(importerOptions = {}) {
  if (!isPlainObject(importerOptions)) throw new TypeError('importer options must be a plain object')
  return { bestEffort: { ...importerOptions, strict: undefined }, strict: { ...importerOptions, strict: true } }
}

function compactOptions(options) {
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined))
}

function evidenceFromImport(imported) {
  const stats = imported?.stats || {}
  const coverage = stats.nativeObjectCoverage || {}
  const evidence = {
    sceneGraphMappedNodes: stats.sceneGraphMappedNodes,
    sceneGraphUnmapped: stats.sceneGraphUnmapped,
    chartCoverageGapCount: coverage.chartCoverageGapCount,
    smartArtCoverageGapCount: coverage.smartArtCoverageGapCount,
    permanentPlaceholderCount: stats.primitivePlaceholderCount,
  }
  const missing = EVIDENCE_FIELDS.filter((field) => !Number.isFinite(evidence[field]))
  const invalid = EVIDENCE_FIELDS.filter((field) => Number.isFinite(evidence[field]) && (!Number.isSafeInteger(evidence[field]) || evidence[field] < 0))
  const blockers = [...missing.map((field) => `missing-or-non-finite-${field}`), ...invalid.map((field) => `invalid-count-${field}`)]
  for (const field of ['sceneGraphUnmapped', 'chartCoverageGapCount', 'smartArtCoverageGapCount', 'permanentPlaceholderCount']) {
    if (!invalid.includes(field) && Number.isFinite(evidence[field]) && evidence[field] !== 0) blockers.push(`non-zero-${field}`)
  }
  return { available: missing.length === 0 && invalid.length === 0, ...Object.fromEntries(EVIDENCE_FIELDS.map((field) => [field, Number.isFinite(evidence[field]) ? evidence[field] : null])), blockers }
}

async function qualifyDeck({
  deck,
  corpusDir,
  importer = importPptxFile,
  importerOptions = {},
  hash = hashFile,
}) {
  if (!deck?.id || !deck?.sha256) throw new TypeError('qualification deck requires id and sha256')
  if (typeof importer !== 'function') throw new TypeError('qualification importer must be a function')
  const options = importerOptionSets(importerOptions)
  const sourceHashes = { bestEffort: null, strict: null }
  const blockers = []
  const errorDetails = []
  let evidence = null
  let strictOutcome = { status: 'not-run', type: null, message: null }
  const emptyEvidence = () => ({ available: false, ...Object.fromEntries(EVIDENCE_FIELDS.map((field) => [field, null])), blockers: ['best-effort-evidence-unavailable'] })
  const snapshot = await createSourceSnapshot({ corpusDir, deck, hash })
  const recordVerification = (pass, verified, suffix = '') => {
    sourceHashes[pass] = verified.sourceSha256
    if (!verified.ok) {
      blockers.push(`${verified.blocker}-${pass}${suffix}`)
      errorDetails.push(...verified.errorDetails)
    }
    return verified.ok
  }

  if (!snapshot.ok) {
    if (snapshot.blocker === 'source-hash-unavailable') {
      blockers.push('source-hash-unavailable-bestEffort', 'source-hash-unavailable-strict')
    } else {
      blockers.push(snapshot.blocker)
    }
    errorDetails.push(...snapshot.errorDetails)
  } else {
    try {
      const bestEffort = await runSnapshotPass(snapshot, importer, compactOptions(options.bestEffort))
      if (recordVerification('bestEffort', bestEffort.before)) {
        const preserved = recordVerification('bestEffort', bestEffort.after, '-post')
        if (bestEffort.error) {
          const detail = errorDetail(bestEffort.error)
          errorDetails.push(detail)
          evidence = { ...emptyEvidence(), errorDetails: [detail] }
          blockers.push(...evidence.blockers)
        } else if (preserved) {
          evidence = evidenceFromImport(bestEffort.imported)
          blockers.push(...evidence.blockers)
        } else {
          evidence = emptyEvidence()
          blockers.push(...evidence.blockers)
        }
      }
      const strict = await runSnapshotPass(snapshot, importer, compactOptions(options.strict))
      if (recordVerification('strict', strict.before)) {
        if (!recordVerification('strict', strict.after, '-post')) {
          const detail = strict.after.errorDetails[0] || { type: strict.after.blocker, message: 'Qualification source snapshot changed during strict import.' }
          strictOutcome = { status: 'rejected', ...detail }
          blockers.push('strict-source-invalid')
        } else if (strict.error) {
          const detail = errorDetail(strict.error)
          strictOutcome = { status: 'rejected', ...detail }
          errorDetails.push(detail)
          blockers.push('strict-rejected')
        } else {
          strictOutcome = { status: 'passed', type: null, message: null }
        }
      }
    } finally {
      const cleanupError = await snapshot.cleanup()
      if (cleanupError) {
        blockers.push('snapshot-cleanup-failed')
        errorDetails.push(cleanupError)
      }
    }
  }

  if (!evidence) {
    evidence = emptyEvidence()
    blockers.push(...evidence.blockers)
  }
  if (strictOutcome.status === 'not-run') blockers.push('strict-not-run')
  return {
    deck: deck.id,
    sourceSha256: deck.sha256,
    sourceHashes,
    importerOptions: { bestEffort: compactOptions(options.bestEffort), strict: compactOptions(options.strict) },
    evidence,
    strictOutcome,
    errorDetails,
    blockers: [...new Set(blockers)].sort(),
    passed: blockers.length === 0,
  }
}

function blockedReport({ corpusDir, manifestDigest = null, importerOptions, errors, errorDetails = [] }) {
  return {
    mode: 'importer-qualification',
    corpusDir,
    manifestDigest,
    importerOptions,
    sourceHashes: {},
    results: [],
    errors: [...new Set(errors)].sort(),
    errorDetails,
    exitCode: 1,
  }
}

async function runImporterQualification({
  corpusDir,
  manifestPath,
  importer = importPptxFile,
  importerOptions = {},
} = {}) {
  const options = importerOptionSets(importerOptions)
  if (typeof manifestPath !== 'string' || manifestPath.length === 0) {
    return blockedReport({ corpusDir, importerOptions: { bestEffort: compactOptions(options.bestEffort), strict: compactOptions(options.strict) }, errors: ['missing-manifest-in'] })
  }

  let manifest
  try {
    manifest = await fs.readJson(manifestPath)
  } catch (error) {
    return blockedReport({ corpusDir, importerOptions: { bestEffort: compactOptions(options.bestEffort), strict: compactOptions(options.strict) }, errors: ['manifest-read-failed'], errorDetails: [errorDetail(error, 'manifest-read-failed')] })
  }

  let inventory
  try {
    inventory = await buildCorpusInventory(corpusDir)
  } catch (error) {
    return blockedReport({ corpusDir, manifestDigest: manifest?.manifestDigest || null, importerOptions: { bestEffort: compactOptions(options.bestEffort), strict: compactOptions(options.strict) }, errors: ['corpus-inventory-unavailable'], errorDetails: [errorDetail(error, 'corpus-inventory-unavailable')] })
  }

  const verification = verifyCorpusManifest(manifest, inventory)
  if (!verification.ok) {
    return blockedReport({ corpusDir, manifestDigest: verification.manifestDigest, importerOptions: { bestEffort: compactOptions(options.bestEffort), strict: compactOptions(options.strict) }, errors: verification.errors })
  }

  const results = []
  for (const deck of manifest.decks) {
    results.push(await qualifyDeck({ deck, corpusDir, importer, importerOptions }))
  }
  const sourceHashes = Object.fromEntries(results.map((result) => [result.deck, result.sourceSha256]))
  const errors = results.filter((result) => !result.passed).map((result) => `deck-blocked:${result.deck}`)
  return {
    mode: 'importer-qualification',
    corpusDir,
    manifestDigest: verification.manifestDigest,
    importerOptions: { bestEffort: compactOptions(options.bestEffort), strict: compactOptions(options.strict) },
    sourceHashes,
    results,
    errors,
    errorDetails: [],
    exitCode: errors.length ? 1 : 0,
  }
}

module.exports = { EVIDENCE_FIELDS, evidenceFromImport, qualifyDeck, runImporterQualification }
