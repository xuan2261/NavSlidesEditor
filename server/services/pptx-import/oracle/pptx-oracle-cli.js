#!/usr/bin/env node
const fs = require('fs-extra')
const path = require('node:path')
const { buildCorpusInventory, verifyCorpusManifest } = require('../evidence/corpus-manifest')
const { hashCanonical } = require('../evidence/canonical-hash')
const { capturePackageBackedActuals } = require('./package-backed-actuals')
const { CANONICAL_QUALIFICATION_MANIFEST, evaluateEvidenceRun } = require('./oracle-evidence-runner')
const { evaluateVisualGate, gateExitCode } = require('./oracle-gate')

function parseArgs(argv) {
  const args = {
    mode: 'integrity', corpus: path.join('server', 'data', 'test-corpus'), goldensDir: path.join('server', 'services', 'pptx-import', 'oracle', 'goldens'),
    actualsDir: path.join('plans', 'reports', 'pptx-oracle-runs', 'actuals'), reportDir: path.join('plans', 'reports', 'pptx-oracle-runs'),
    evidenceManifest: null, roleReceipts: null, baseUrl: null, corpusManifest: null, invalid: [], help: false,
  }
  const values = { '--corpus': 'corpus', '--goldens-dir': 'goldensDir', '--actuals-dir': 'actualsDir', '--report-dir': 'reportDir',
    '--evidence-manifest': 'evidenceManifest', '--role-receipts': 'roleReceipts', '--base-url': 'baseUrl',
    '--corpus-manifest': 'corpusManifest' }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') args.help = true
    else if (argument === '--mode') args.mode = argv[++index]
    else if (values[argument]) args[values[argument]] = argv[++index]
    else if (argument === '--actual-manifest-out') {
      index += 1; args.invalid.push('actual-manifest-output-override-forbidden')
    } else if (argument === '--debt-record') args.invalid.push('debt-record-not-eligible')
    else if (['--force-threshold', '--mean-threshold', '--min-threshold'].includes(argument)) {
      index += 1; args.invalid.push('candidate-threshold-override-forbidden')
    } else args.invalid.push(`unknown-argument:${argument}`)
  }
  if (args.mode === 'seed-goldens') args.invalid.push('placeholder-golden-mode-forbidden')
  if (!['integrity', 'qualification', 'qualify', 'capture-present'].includes(args.mode)) args.invalid.push('invalid-oracle-mode')
  return args
}

function buildReport({ mode, gate, comparison = null, validations = null, capture = null, evidence = null, actuals = [] } = {}) {
  return { generatedAt: new Date().toISOString(), mode, gate, comparison, validations, capture, evidence, actuals }
}

async function writeReport(reportDir, report) {
  await fs.ensureDir(reportDir)
  const stamp = report.generatedAt.replace(/[:.]/g, '-')
  const output = path.join(reportDir, `pptx-oracle-${stamp}.json`)
  await fs.writeJson(output, report, { spaces: 2 })
  return output
}

function invalidGate(reasons) {
  const invalid = { valid: false, reasons }
  return evaluateVisualGate({ envelope: invalid, golden: invalid, source: invalid, actual: invalid, comparison: null })
}

async function createCaptureStaging(root) {
  const parent = path.resolve(root)
  await fs.ensureDir(parent)
  return { parent, staging: await fs.mkdtemp(path.join(parent, '.capture-')) }
}

async function publishCaptureStaging(parent, staging) {
  const finalDir = path.join(parent, `run-${Date.now()}-${require('node:crypto').randomUUID()}`)
  await fs.rename(staging, finalDir)
  return finalDir
}

const SAFE_REASON_CODE = /^[a-z][a-z0-9-]{0,127}$/

function safeReasonCode(value, fallback = null) {
  return typeof value === 'string' && SAFE_REASON_CODE.test(value) ? value : fallback
}

function failedCaptureRecord(file, captured) {
  const cleanup = captured?.cleanup
  return {
    file,
    error: safeReasonCode(captured?.error, 'package-backed-capture-failed'),
    jobId: typeof captured?.jobId === 'string'
      ? captured.jobId
      : typeof cleanup?.jobId === 'string' ? cleanup.jobId : null,
    presentationId: typeof cleanup?.presentationId === 'string' ? cleanup.presentationId : null,
    cleanupError: captured?.cleanupError == null
      ? null
      : safeReasonCode(captured.cleanupError, 'capture-cleanup-failed'),
    captureCleanupErrors: Array.isArray(captured?.captureCleanupErrors)
      ? captured.captureCleanupErrors.filter((reason) => safeReasonCode(reason) !== null)
      : [],
    outputCleanupError: captured?.outputCleanupError == null
      ? null
      : safeReasonCode(captured.outputCleanupError, 'actual-output-cleanup-failed'),
  }
}

async function captureCorpusActuals(args, {
  capture = capturePackageBackedActuals, inventoryBuilder = buildCorpusInventory, manifestVerifier = verifyCorpusManifest,
  canonicalReader = (filePath) => fs.readJson(filePath),
} = {}) {
  if (!args.baseUrl || !args.corpusManifest) return { ok: false, error: 'capture-requires-base-url-and-corpus-manifest' }
  let corpusManifest
  let canonicalManifest
  try {
    [corpusManifest, canonicalManifest] = await Promise.all([
      fs.readJson(args.corpusManifest),
      canonicalReader(CANONICAL_QUALIFICATION_MANIFEST),
    ])
  } catch { return { ok: false, error: 'invalid-corpus-manifest' } }
  if (hashCanonical(corpusManifest) !== hashCanonical(canonicalManifest)) {
    return { ok: false, error: 'noncanonical-qualification-manifest' }
  }
  let inventory
  try { inventory = await inventoryBuilder(args.corpus) } catch { return { ok: false, error: 'invalid-corpus-directory' } }
  const manifestCheck = manifestVerifier(corpusManifest, inventory)
  if (!manifestCheck.ok) return { ok: false, error: manifestCheck.errors[0] || 'corpus-manifest-mismatch' }

  let staging = null
  let result
  try {
    const run = await createCaptureStaging(args.actualsDir)
    staging = run.staging
    const decks = []
    for (const file of inventory.decks.map((deck) => deck.id)) {
      const captured = await capture({ baseUrl: args.baseUrl, sourcePath: path.join(args.corpus, file), outDir: staging })
      if (!captured.ok) {
        const failure = failedCaptureRecord(file, captured)
        result = { ok: false, error: failure.error, decks, failures: [failure] }
        break
      }
      decks.push(captured.actual)
    }
    if (!result) {
      const actualManifest = {
        schemaVersion: 1, authority: 'package-backed-http', corpusManifestDigest: corpusManifest.manifestDigest, decks,
      }
      await fs.writeJson(path.join(staging, 'actual-manifest.json'), actualManifest, { spaces: 2 })
      const actualsDir = await publishCaptureStaging(run.parent, staging)
      staging = null
      result = { ok: true, actualsDir, actualManifestPath: path.join(actualsDir, 'actual-manifest.json'), decks: decks.length }
    }
  } catch {
    result = { ok: false, error: 'capture-run-publication-failed' }
  }
  if (staging) {
    try { await fs.remove(staging) } catch { result = { ...result, cleanupError: 'capture-staging-cleanup-failed' } }
  }
  return result
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.help) {
    process.stdout.write('Usage: pptx-oracle-cli --mode integrity|qualification|capture-present [evidence options]\n')
    return 0
  }
  let report
  if (args.invalid.length) {
    report = buildReport({ mode: args.mode, gate: invalidGate(args.invalid) })
  } else if (args.mode === 'capture-present') {
    const capture = await captureCorpusActuals(args)
    report = buildReport({ mode: args.mode, gate: capture.ok ? null : invalidGate([capture.error]), capture })
  } else {
    const run = await evaluateEvidenceRun({
      evidenceManifestPath: args.evidenceManifest, roleReceiptsPath: args.roleReceipts, corpusDir: args.corpus,
      goldensDir: args.goldensDir, actualsDir: args.actualsDir, oracleDisabled: String(process.env.PPTX_ORACLE).toLowerCase() === 'off',
    })
    report = buildReport({
      mode: args.mode,
      gate: run.gate,
      comparison: run.comparison,
      validations: run.validations,
      evidence: run.evidence,
      actuals: run.actuals,
    })
  }
  report.reportPath = await writeReport(args.reportDir, report)
  process.stdout.write(`${JSON.stringify(report)}\n`)
  if (args.mode === 'capture-present') return report.capture?.ok ? 0 : 1
  return gateExitCode(report.gate, args.mode)
}

if (require.main === module) {
  main().then((code) => process.exit(code)).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

module.exports = { buildReport, captureCorpusActuals, main, parseArgs }
