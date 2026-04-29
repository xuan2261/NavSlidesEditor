#!/usr/bin/env node

const path = require('path')
const { performance } = require('perf_hooks')
const { writeJson, writeRawJson } = require('./json-utils')
const {
  PARSERS,
  classifyError,
  getPackageMetadata,
  getSandboxRoot,
  sanitizeError,
} = require('./package-utils')
const { assertInsidePlanResearch, loadPptxWithBudget } = require('./pptx-guards')
const { summarizeParserOutput } = require('./summarize-parser-output')

const RUNNERS = {
  pptxtojson: require('./runners/pptxtojson-runner'),
  pptx2json: require('./runners/pptx2json-runner'),
  'ppt-parser': require('./runners/ppt-parser-runner'),
  'pptx-compose': require('./runners/pptx-compose-runner'),
}

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--parser') args.parser = argv[(i += 1)]
    else if (argv[i] === '--deck') args.deck = argv[(i += 1)]
    else if (argv[i] === '--input') args.inputPath = argv[(i += 1)]
    else if (argv[i] === '--research-root') args.researchRoot = argv[(i += 1)]
    else if (argv[i] === '--sandbox-root') args.sandboxRoot = argv[(i += 1)]
    else if (argv[i] === '--inventory') args.inventoryPath = argv[(i += 1)]
  }
  return args
}

function createResult({ parser, deck, metadata }) {
  return {
    parser,
    deck,
    ok: false,
    durationMs: 0,
    peakMemoryMb: 0,
    rawOutputPath: null,
    rawOutputSizeMb: 0,
    summary: null,
    warnings: [],
    error: null,
    packageVersion: metadata.packageVersion,
    packageModifiedDate: metadata.packageModifiedDate,
  }
}

async function runChild() {
  const args = parseArgs(process.argv)
  if (!PARSERS.includes(args.parser) || !RUNNERS[args.parser]) {
    throw Object.assign(new Error('Unknown parser key.'), { type: 'parse-failed' })
  }
  const researchRoot = assertInsidePlanResearch(args.researchRoot)
  const sandboxRoot = args.sandboxRoot
    ? path.resolve(args.sandboxRoot)
    : getSandboxRoot(researchRoot)
  const metadata = getPackageMetadata(sandboxRoot, args.parser)
  const result = createResult({ parser: args.parser, deck: args.deck, metadata })
  const started = performance.now()
  let peakRss = process.memoryUsage().rss
  const sampler = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss)
  }, 25)
  sampler.unref()

  try {
    if (!metadata.installOk) {
      throw Object.assign(new Error(`${args.parser} is not installed`), { type: 'install-failed' })
    }
    const budget = await loadPptxWithBudget(args.inputPath)
    const inventory = require(path.resolve(args.inventoryPath))
    const { output, warnings } = await RUNNERS[args.parser].runParser({
      inputPath: args.inputPath,
      sandboxRoot,
    })
    const summary = summarizeParserOutput(args.parser, output, inventory)
    const rawPath = path.join(
      researchRoot,
      'parser-raw',
      args.parser,
      `${path.basename(args.deck, '.pptx')}.redacted.json`
    )
    const rawBytes = writeRawJson(rawPath, output)

    result.ok = summary.slideCount > 0 && summary.verdict !== 'fail'
    result.rawOutputPath = path.relative(process.cwd(), rawPath)
    result.rawOutputSizeMb = Number((rawBytes / 1024 / 1024).toFixed(2))
    result.summary = summary
    result.warnings = warnings || []
    result.resourceLimits = {
      entryCount: budget.entryCount,
      uncompressedBytes: budget.uncompressedBytes,
    }
    if (!result.ok) {
      result.error = { type: 'schema-unusable', message: 'Parser output did not expose usable slide data.' }
    }
  } catch (error) {
    error.type = error.type || classifyError(error)
    result.error = sanitizeError(error)
  } finally {
    clearInterval(sampler)
    result.durationMs = Number((performance.now() - started).toFixed(2))
    result.peakMemoryMb = Number((peakRss / 1024 / 1024).toFixed(2))
    writeJson(
      path.join(researchRoot, 'parser-summary', args.parser, `${path.basename(args.deck, '.pptx')}.json`),
      result
    )
    if (process.send) {
      process.send({ type: 'result', result }, () => process.exit(0))
    }
  }
}

runChild().catch((error) => {
  if (process.send) {
    process.send({ type: 'fatal', error: sanitizeError(error) }, () => process.exit(1))
  }
  process.exitCode = 1
})
