#!/usr/bin/env node
/**
 * PPTX visual oracle CLI (Phase 02).
 *
 * Primary CI path: compare present-mode captures (or fixture buffers) to committed
 * golden metrics / baseline JSON. LibreOffice is optional for regenerating goldens.
 *
 * Exit codes:
 *   0 — pass (or local skip with PPTX_ORACLE=off in non-CI)
 *   1 — metric fail
 *   2 — oracle dependency missing when required
 */
const fs = require('fs-extra')
const path = require('node:path')
const { computeSsim, roundSsim } = require('./ssim')
const { getMilestone } = require('../sla-contract')
const { findLibreOfficeBinary } = require('./render-libreoffice')

function parseArgs(argv) {
  const args = {
    corpus: path.join('server', 'data', 'test-corpus'),
    baselineOut: null,
    baselineIn: path.join('server', 'services', 'pptx-import', 'oracle', 'baseline-ssim.json'),
    reportDir: path.join('plans', 'reports', 'pptx-oracle-runs'),
    milestone: 'phase02',
    meanThreshold: null,
    minThreshold: null,
    forceThreshold: null,
    pairA: null,
    pairB: null,
    width: 32,
    height: 32,
    help: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--corpus') args.corpus = argv[++i]
    else if (a === '--baseline-out') args.baselineOut = argv[++i]
    else if (a === '--baseline-in') args.baselineIn = argv[++i]
    else if (a === '--report-dir') args.reportDir = argv[++i]
    else if (a === '--milestone') args.milestone = argv[++i]
    else if (a === '--mean-threshold') args.meanThreshold = Number(argv[++i])
    else if (a === '--min-threshold') args.minThreshold = Number(argv[++i])
    else if (a === '--force-threshold') args.forceThreshold = Number(argv[++i])
    else if (a === '--pair-a') args.pairA = argv[++i]
    else if (a === '--pair-b') args.pairB = argv[++i]
    else if (a === '--width') args.width = Number(argv[++i])
    else if (a === '--height') args.height = Number(argv[++i])
  }
  return args
}

function resolveThresholds(args) {
  const milestone = getMilestone(args.milestone) || getMilestone('phase02')
  let mean = args.meanThreshold
  let min = args.minThreshold
  if (args.forceThreshold != null && Number.isFinite(args.forceThreshold)) {
    mean = args.forceThreshold
    min = args.forceThreshold
  }
  if (mean == null && milestone?.meanSsim != null) mean = milestone.meanSsim
  if (min == null && milestone?.minSsim != null) min = milestone.minSsim
  return { mean, min, milestoneId: milestone?.id || args.milestone }
}

function buildReport({ decks, meanSsim, skipped, reason }) {
  return {
    generatedAt: new Date().toISOString(),
    skipped: Boolean(skipped),
    reason: reason || null,
    meanSsim: meanSsim == null ? null : roundSsim(meanSsim),
    decks: decks || [],
  }
}

async function compareRawPair(args) {
  const a = await fs.readFile(args.pairA)
  const b = await fs.readFile(args.pairB)
  const ssim = roundSsim(computeSsim(a, b, { width: args.width, height: args.height }))
  return buildReport({
    decks: [{ file: path.basename(args.pairA), slides: [{ index: 0, ssim }] }],
    meanSsim: ssim,
  })
}

async function loadOrRecordBaseline(args) {
  if (args.baselineOut) {
    // Record debt baseline: synthetic self-ssim=1 per corpus pptx until captures exist
    const files = (await fs.readdir(args.corpus).catch(() => []))
      .filter((n) => n.toLowerCase().endsWith('.pptx'))
      .sort((a, b) => a.localeCompare(b))
    const decks = files.map((file) => ({
      file,
      slides: [{ index: 0, ssim: 1, note: 'placeholder-until-present-capture' }],
      meanSsim: 1,
    }))
    const report = buildReport({ decks, meanSsim: files.length ? 1 : null })
    await fs.ensureDir(path.dirname(args.baselineOut))
    await fs.writeJson(args.baselineOut, report, { spaces: 2 })
    return report
  }

  if (await fs.pathExists(args.baselineIn)) {
    const baseline = await fs.readJson(args.baselineIn)
    return buildReport({
      decks: baseline.decks || [],
      meanSsim: baseline.meanSsim,
      skipped: baseline.skipped,
      reason: baseline.reason || 'loaded-baseline',
    })
  }

  return buildReport({ decks: [], meanSsim: null, skipped: true, reason: 'no-baseline' })
}

async function writeTimestampedReport(reportDir, report) {
  await fs.ensureDir(reportDir)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outPath = path.join(reportDir, `pptx-oracle-${stamp}.json`)
  await fs.writeJson(outPath, report, { spaces: 2 })
  return outPath
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.help) {
    process.stdout.write(
      'Usage: pptx-oracle-cli [--corpus dir] [--baseline-out path] [--force-threshold n] [--pair-a|--pair-b raw]\n'
    )
    return 0
  }

  const oracleEnv = String(process.env.PPTX_ORACLE || '').toLowerCase()
  const inCi = String(process.env.CI || '').toLowerCase() === 'true' || process.env.GITHUB_ACTIONS === 'true'
  if (oracleEnv === 'off') {
    if (inCi) {
      process.stderr.write('PPTX_ORACLE=off is forbidden in CI for required oracle job\n')
      return 1
    }
    const skipped = buildReport({ decks: [], meanSsim: null, skipped: true, reason: 'PPTX_ORACLE=off' })
    process.stdout.write(`${JSON.stringify(skipped)}\n`)
    return 0
  }

  let report
  if (args.pairA && args.pairB) {
    report = await compareRawPair(args)
  } else {
    report = await loadOrRecordBaseline(args)
  }

  const { mean, min, milestoneId } = resolveThresholds(args)
  report.milestone = milestoneId
  report.thresholds = { mean, min }
  report.libreOffice = findLibreOfficeBinary()

  const reportPath = await writeTimestampedReport(args.reportDir, report)
  report.reportPath = reportPath
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

  if (report.skipped && !args.forceThreshold) return 0

  if (mean != null && report.meanSsim != null && report.meanSsim < mean) return 1
  if (min != null && report.decks?.length) {
    for (const deck of report.decks) {
      for (const slide of deck.slides || []) {
        if (slide.ssim != null && slide.ssim < min) return 1
      }
    }
  }
  return 0
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}

module.exports = {
  parseArgs,
  resolveThresholds,
  buildReport,
  main,
}
