#!/usr/bin/env node
/**
 * PPTX visual oracle CLI (Phase 02).
 *
 * Primary CI path: SSIM of Nav present captures vs committed golden PNGs under
 * oracle/goldens/{deckStem}/slide-N.png. LibreOffice optional for refresh only.
 *
 * Exit codes:
 *   0 — pass (or local skip with PPTX_ORACLE=off in non-CI)
 *   1 — metric fail / missing goldens
 *   2 — oracle binary missing when LO required
 */
const fs = require('fs-extra')
const path = require('node:path')
const { computeSsim, roundSsim } = require('./ssim')
const { getMilestone } = require('../sla-contract')
const { findLibreOfficeBinary, renderPptxWithLibreOffice } = require('./render-libreoffice')
const { compareCorpusToGoldens, listCorpusPptx, deckStem } = require('./compare-goldens')
const { encodePngRgba } = require('./png-rgba')
const { capturePresentSlides } = require('./capture-present')

const DEFAULT_GOLDENS = path.join('server', 'services', 'pptx-import', 'oracle', 'goldens')
const DEFAULT_BASELINE = path.join('server', 'services', 'pptx-import', 'oracle', 'baseline-ssim.json')

function parseArgs(argv) {
  const args = {
    corpus: path.join('server', 'data', 'test-corpus'),
    goldensDir: DEFAULT_GOLDENS,
    actualsDir: null,
    baselineOut: null,
    baselineIn: DEFAULT_BASELINE,
    reportDir: path.join('plans', 'reports', 'pptx-oracle-runs'),
    milestone: 'phase02',
    meanThreshold: null,
    minThreshold: null,
    forceThreshold: null,
    pairA: null,
    pairB: null,
    width: 32,
    height: 32,
    mode: 'golden', // golden | baseline | seed-goldens | capture-present
    requireActuals: true,
    debtRecord: false,
    requireLo: false,
    maxDecks: null,
    help: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--corpus') args.corpus = argv[++i]
    else if (a === '--goldens-dir') args.goldensDir = argv[++i]
    else if (a === '--actuals-dir') args.actualsDir = argv[++i]
    else if (a === '--max-decks') args.maxDecks = Number(argv[++i])
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
    else if (a === '--mode') args.mode = argv[++i]
    else if (a === '--require-actuals') args.requireActuals = true
    else if (a === '--debt-record') {
      args.debtRecord = true
      args.requireActuals = false
    }
    else if (a === '--require-lo') args.requireLo = true
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

function buildReport({ decks, meanSsim, skipped, reason, extra = {} }) {
  return {
    generatedAt: new Date().toISOString(),
    skipped: Boolean(skipped),
    reason: reason || null,
    meanSsim: meanSsim == null ? null : roundSsim(meanSsim),
    decks: decks || [],
    ...extra,
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

/**
 * Seed minimal placeholder goldens (8×8 solid) per corpus deck when missing.
 * Maintainer replaces with LO/PP goldens offline.
 */
async function seedPlaceholderGoldens(args) {
  const files = await listCorpusPptx(args.corpus)
  const rgba = Buffer.alloc(8 * 8 * 4, 128)
  for (let i = 0; i < 8 * 8; i += 1) rgba[i * 4 + 3] = 255
  const png = encodePngRgba(8, 8, rgba)
  for (const file of files) {
    const dir = path.join(args.goldensDir, deckStem(file))
    await fs.ensureDir(dir)
    const slide0 = path.join(dir, 'slide-0.png')
    if (!(await fs.pathExists(slide0))) await fs.writeFile(slide0, png)
  }
  return files.length
}

/**
 * Import corpus decks and capture present-mode actual PNGs (Playwright).
 */
async function capturePresentActuals(args) {
  const { importPptxFile } = require('../importer')
  let files = await listCorpusPptx(args.corpus)
  if (args.maxDecks && Number.isFinite(args.maxDecks)) files = files.slice(0, args.maxDecks)
  const actualsDir = args.actualsDir || path.join(args.reportDir, 'actuals')
  await fs.ensureDir(actualsDir)
  const results = []
  for (const file of files) {
    const pptxPath = path.join(args.corpus, file)
    try {
      const imported = await importPptxFile(pptxPath, { originalName: file })
      const capture = await capturePresentSlides(imported.presentation, {
        outDir: actualsDir,
        deckStem: deckStem(file),
      })
      results.push({
        file,
        ok: capture.ok,
        files: capture.files?.length || 0,
        error: capture.error || null,
      })
    } catch (err) {
      results.push({ file, ok: false, files: 0, error: err.message })
    }
  }
  return { actualsDir, results, deckCount: files.length }
}

async function runGoldenMode(args) {
  const comparison = await compareCorpusToGoldens({
    corpusDir: args.corpus,
    goldensDir: args.goldensDir,
    actualsDir: args.actualsDir,
    requireAllGoldens: true,
    debtRecord: args.debtRecord,
  })
  return buildReport({
    decks: comparison.decks,
    meanSsim: comparison.meanSsim,
    reason: comparison.failed ? 'golden-evidence-invalid' : 'golden-compare',
    extra: {
      missingGoldens: comparison.missingGoldens,
      deckCount: comparison.deckCount,
      failed: comparison.failed,
      debt: args.debtRecord,
      claim: args.debtRecord
        ? 'debt-record-only-no-numeric-evidence'
        : 'Nav present vs golden SSIM numeric evidence',
    },
  })
}

async function writeBaseline(args, report) {
  const out = args.baselineOut || args.baselineIn
  await fs.ensureDir(path.dirname(out))
  const slideScores = (report.decks || []).flatMap((deck) =>
    (deck.slides || []).map((slide) => slide.ssim).filter(Number.isFinite)
  )
  const baseline = {
    generatedAt: report.generatedAt,
    milestone: report.milestone,
    meanSsim: report.meanSsim,
    minSsim: slideScores.length ? Math.min(...slideScores) : null,
    debt: report.debt !== false,
    claim: report.claim,
    deckCount: report.deckCount || report.decks?.length || 0,
    decks: (report.decks || []).map((d) => ({
      file: d.file,
      meanSsim: d.meanSsim,
      slideCount: d.slides?.length || 0,
      goldenCount: d.goldenCount,
      error: d.error || null,
    })),
  }
  await fs.writeJson(out, baseline, { spaces: 2 })
  report.baselinePath = out
  return report
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
      [
        'Usage: pptx-oracle-cli [options]',
        '  --mode golden|seed-goldens|capture-present   (default golden)',
        '  --corpus dir --goldens-dir dir --actuals-dir dir --max-decks N',
        '  --baseline-out path --force-threshold n --debt-record',
        '  --pair-a|--pair-b raw buffers + --width --height',
        '',
      ].join('\n')
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

  if (args.mode === 'seed-goldens') {
    const n = await seedPlaceholderGoldens(args)
    process.stdout.write(JSON.stringify({ seeded: n, goldensDir: args.goldensDir }) + '\n')
    return 0
  }

  if (args.mode === 'capture-present') {
    const capture = await capturePresentActuals(args)
    process.stdout.write(`${JSON.stringify(capture, null, 2)}\n`)
    const failed = capture.results.some((r) => !r.ok)
    return failed ? 1 : 0
  }

  const loBinary = findLibreOfficeBinary()
  if ((args.requireLo || process.env.PPTX_ORACLE_LO === '1') && !loBinary) {
    process.stderr.write('LibreOffice required but not found (exit 2)\n')
    return 2
  }

  let report
  if (args.pairA && args.pairB) {
    report = await compareRawPair(args)
  } else {
    report = await runGoldenMode(args)
  }

  const { mean, min, milestoneId } = resolveThresholds(args)
  report.milestone = milestoneId
  report.thresholds = { mean, min }
  report.libreOffice = loBinary

  if (args.baselineOut || args.mode === 'baseline') {
    await writeBaseline(args, report)
  }

  // Optional LO probe when PPTX_ORACLE_LO=1 (maintainer tooling; not required)
  if (process.env.PPTX_ORACLE_LO === '1' && report.libreOffice) {
    report.loAvailable = true
  }

  const reportPath = await writeTimestampedReport(args.reportDir, report)
  report.reportPath = reportPath
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

  if (report.skipped && !args.forceThreshold) return 0
  if (report.failed) return 1

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
  seedPlaceholderGoldens,
  capturePresentActuals,
  renderPptxWithLibreOffice,
}
