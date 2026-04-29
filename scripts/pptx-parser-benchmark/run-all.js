#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { fork } = require('child_process')
const { ensureDir, readJson, writeJson } = require('./json-utils')
const {
  FAILURE_TYPES,
  PARSERS,
  createDiagnosticBuffer,
  getPackageMetadata,
  getSandboxRoot,
  sanitizeDiagnostic,
} = require('./package-utils')
const { assertInsidePlanResearch } = require('./pptx-guards')
const { writeBenchmarkReports } = require('./report-writer')

const RUN_TIMEOUT_MS = 60000
const KILL_GRACE_MS = 2000

function parseArgs(argv) {
  const args = { input: 'PPTX', out: 'plans/20260424-1508-pptx-parser-benchmark-hard/research' }
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = argv[(i += 1)]
    else if (argv[i] === '--out') args.out = argv[(i += 1)]
  }
  return args
}

function getDecks(inputDir) {
  return fs.readdirSync(inputDir)
    .filter((file) => file.toLowerCase().endsWith('.pptx'))
    .sort()
    .map((file) => ({ deck: file, inputPath: path.join(inputDir, file) }))
}

function getInventoryMap(researchRoot) {
  const summary = readJson(path.join(researchRoot, 'corpus-inventory', 'summary.json'), { decks: [] })
  return new Map(summary.decks.map((deck) => [`${deck.deck}.pptx`, deck]))
}

function validateFailureType(result) {
  if (result.ok) return
  if (!FAILURE_TYPES.includes(result.error.type)) result.error.type = 'parse-failed'
}

function createFailedResult({ parser, deck, researchRoot, sandboxRoot, error }) {
  const metadata = getPackageMetadata(sandboxRoot, parser)
  const result = {
    parser,
    deck,
    ok: false,
    durationMs: 0,
    peakMemoryMb: null,
    rawOutputPath: null,
    rawOutputSizeMb: 0,
    summary: null,
    warnings: [],
    error: null,
    packageVersion: metadata.packageVersion,
    packageModifiedDate: metadata.packageModifiedDate,
  }
  result.error = error
  validateFailureType(result)
  writeJson(path.join(researchRoot, 'parser-summary', parser, `${path.basename(deck, '.pptx')}.json`), result)
  return result
}

function runOne({
  parser,
  deck,
  inputPath,
  researchRoot,
  sandboxRoot,
  inventory,
  childPath = path.join(__dirname, 'run-parser-child.js'),
  forkImpl = fork,
  timeoutMs = RUN_TIMEOUT_MS,
  killGraceMs = KILL_GRACE_MS,
}) {
  return new Promise((resolve) => {
    const child = forkImpl(childPath, [
      '--parser', parser,
      '--deck', deck,
      '--input', inputPath,
      '--research-root', researchRoot,
      '--sandbox-root', sandboxRoot,
      '--inventory', path.join(researchRoot, 'corpus-inventory', `${inventory.deck}.json`),
    ], { silent: true })
    let completed = false
    let timedOut = false
    let killTimer = null
    function finish(result) {
      if (completed) return
      completed = true
      clearTimeout(timeout)
      if (killTimer) clearTimeout(killTimer)
      resolve(result)
    }
    const stderr = createDiagnosticBuffer()
    const stdout = createDiagnosticBuffer()
    const timeout = setTimeout(() => {
      if (completed) return
      timedOut = true
      child.kill()
      killTimer = setTimeout(() => {
        if (completed) return
        child.kill('SIGKILL')
        finish(createFailedResult({
          parser,
          deck,
          researchRoot,
          sandboxRoot,
          error: {
            type: 'parse-failed',
            message: sanitizeDiagnostic(
              `${stderr.toString()}\n${stdout.toString()}`.trim(),
              `Parser child timed out after ${timeoutMs}ms and did not exit after ${killGraceMs}ms grace.`
            ),
          },
        }))
      }, killGraceMs)
    }, timeoutMs)

    child.stderr?.on('data', (chunk) => stderr.append(chunk))
    child.stdout?.on('data', (chunk) => stdout.append(chunk))
    child.on('message', (message) => {
      if (message.type !== 'result' && message.type !== 'fatal') return
      if (timedOut) return
      if (message.type === 'result') {
        validateFailureType(message.result)
        finish(message.result)
        return
      }
      if (message.type === 'fatal') {
        finish(createFailedResult({
          parser,
          deck,
          researchRoot,
          sandboxRoot,
          error: message.error || { type: 'parse-failed', message: 'Parser child failed.' },
        }))
      }
    })
    child.on('exit', () => {
      if (completed) return
      finish(createFailedResult({
        parser,
        deck,
        researchRoot,
        sandboxRoot,
        error: {
          type: 'parse-failed',
          message: sanitizeDiagnostic(
            `${stderr.toString()}\n${stdout.toString()}`.trim(),
            timedOut
              ? `Parser child timed out after ${timeoutMs}ms.`
              : 'Parser child exited before returning a result.'
          ),
        },
      }))
    })
  })
}

async function main() {
  const args = parseArgs(process.argv)
  const inputDir = path.resolve(args.input)
  const researchRoot = assertInsidePlanResearch(args.out)
  const planDir = path.dirname(researchRoot)
  const sandboxRoot = getSandboxRoot(researchRoot)
  const reportsDir = path.join(planDir, 'reports')
  const inventoryMap = getInventoryMap(researchRoot)
  const results = []

  ensureDir(path.join(researchRoot, 'parser-summary'))
  for (const parser of PARSERS) {
    for (const { deck, inputPath } of getDecks(inputDir)) {
      const inventory = inventoryMap.get(deck) || null
      if (!inventory) {
        results.push(createFailedResult({
          parser,
          deck,
          researchRoot,
          sandboxRoot,
          error: { type: 'parse-failed', message: `Missing corpus inventory for ${deck}.` },
        }))
        continue
      }
      results.push(await runOne({ parser, deck, inputPath, researchRoot, sandboxRoot, inventory }))
    }
  }

  writeJson(path.join(researchRoot, 'parser-summary', 'all-results.json'), {
    generatedAt: new Date().toISOString(),
    results,
  })
  writeBenchmarkReports({ reportsDir, results })
  console.log(`Wrote ${results.length} parser run summaries.`)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = {
  createFailedResult,
  runOne,
  validateFailureType,
}
