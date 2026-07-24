#!/usr/bin/env node
/**
 * CLI: PPTX import perf matrix
 *
 *   node scripts/pptx-import-perf-matrix.js --tiny
 *   PPTX_PERF=1 node scripts/pptx-import-perf-matrix.js --full
 *
 * Heavy ladder without PPTX_PERF=1 writes structured skip JSON (exit 0).
 */
const path = require('path')
const {
  runFullMatrix,
  runTinyMatrix,
  writeReport,
  DEFAULT_REPORT_DIR,
} = require('../server/services/pptx-import/perf/run-matrix')
const { assertValidPerfReport } = require('../server/services/pptx-import/perf/report-schema')

function parseArgs(argv) {
  const args = { mode: 'tiny', out: DEFAULT_REPORT_DIR, jsonStdout: false }
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--tiny') args.mode = 'tiny'
    else if (arg === '--full') args.mode = 'full'
    else if (arg === '--out') args.out = path.resolve(argv[(i += 1)])
    else if (arg === '--stdout') args.jsonStdout = true
    else if (arg === '--help' || arg === '-h') args.help = true
  }
  return args
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/pptx-import-perf-matrix.js [--tiny|--full] [--out dir] [--stdout]',
      '',
      '  --tiny   Always-on small fixture matrix (default)',
      '  --full   Heavy size/entry ladder; requires PPTX_PERF=1',
      '  --out    Report directory (default: plans/reports)',
      '  --stdout Also print JSON report to stdout',
      '',
    ].join('\n')
  )
}

async function main(argv = process.argv) {
  const args = parseArgs(argv)
  if (args.help) {
    printHelp()
    return 0
  }

  const report =
    args.mode === 'full' ? await runFullMatrix() : await runTinyMatrix()
  assertValidPerfReport(report)

  const stamp = new Date().toISOString().slice(0, 10)
  const fileName =
    args.mode === 'full'
      ? `${stamp}-pptx-import-perf-matrix-full.json`
      : `${stamp}-pptx-import-perf-matrix.json`

  const outPath = await writeReport(report, {
    reportDir: args.out,
    fileName,
  })

  if (args.jsonStdout) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else if (report.skipped) {
    process.stdout.write(
      `skipped reason=${report.reason} detail=${report.detail || ''} report=${outPath}\n`
    )
  } else {
    process.stdout.write(
      `ok mode=${report.mode} runs=${report.runs.length} report=${outPath}\n`
    )
  }
  return 0
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`${err?.stack || err}\n`)
      process.exit(1)
    }
  )
}

module.exports = { main, parseArgs }
