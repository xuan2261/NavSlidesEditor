const fs = require('fs-extra')
const {
  DEFAULT_CORPUS,
  DEFAULT_MAX_CLASS_DROP,
  DEFAULT_PER_DECK_MIN_SEMANTIC,
  STRICT_AVG_MIN_ROUND_TRIP,
  STRICT_AVG_MIN_SEMANTIC,
  STRICT_MIN_CORPUS_FILES,
  parsePercentFlag,
  reportResults,
  runCorpusTests,
  writeDriftRows,
} = require('./pptx-import-semantic-and-roundtrip-fidelity-tester')

function parseListFlags(args, name) {
  return args
    .filter((arg) => arg.startsWith(`${name}=`))
    .flatMap((arg) => arg.slice(name.length + 1).split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

function baselineFromResults(results, summary, gates) {
  return {
    summary: Object.fromEntries(Object.entries(summary).filter(([key]) => key !== 'runAt')),
    gates,
    perDeck: Object.fromEntries(results.map((result) => [result.file, {
      semanticFidelity: result.semanticFidelity,
      roundTripStability: result.roundTrip?.overall ?? null,
      propertyCoverage: result.propertyCoverage,
      elementCount: result.elementCount,
    }])),
  }
}

function enforceStrictSummary(summary, results) {
  if (summary.failedFiles > 0) return 1
  if (!summary.strict) return 0
  if (summary.totalFiles < STRICT_MIN_CORPUS_FILES) {
    console.error(`Strict mode failed: corpus has fewer than ${STRICT_MIN_CORPUS_FILES} files`)
    return 1
  }
  if (summary.avgSemanticFidelity == null || summary.avgSemanticFidelity < STRICT_AVG_MIN_SEMANTIC) {
    console.error('Strict mode failed: average semantic fidelity is below 98%')
    return 1
  }
  if (summary.avgRoundTripStability == null || summary.avgRoundTripStability < STRICT_AVG_MIN_ROUND_TRIP) {
    console.error('Strict mode failed: average round-trip stability is below 99%')
    return 1
  }
  if (results.some((result) => result.roundTripExportMethod !== 'production')) {
    console.error('Strict mode failed: non-production export method detected')
    return 1
  }
  return 0
}

async function runFromCli(args = process.argv.slice(2)) {
  const corpusDir = args.find((arg) => !arg.startsWith('--')) || DEFAULT_CORPUS
  const roundTripRequested = args.includes('--roundtrip')
  const strict = args.includes('--strict')
  const baselineOut = args.find((arg) => arg.startsWith('--baseline-out='))?.slice('--baseline-out='.length) || ''
  const driftOut = args.find((arg) => arg.startsWith('--drift-out='))?.slice('--drift-out='.length) || ''
  const perDeckMin = parsePercentFlag(
    args.find((arg) => arg.startsWith('--per-deck-min='))?.slice('--per-deck-min='.length),
    DEFAULT_PER_DECK_MIN_SEMANTIC
  )
  const maxClassDrop = parsePercentFlag(
    args.find((arg) => arg.startsWith('--max-class-drop='))?.slice('--max-class-drop='.length),
    DEFAULT_MAX_CLASS_DROP
  )
  const options = {
    allowFallback: args.includes('--allow-fallback'),
    excludeClassDrop: parseListFlags(args, '--exclude-class-drop'),
    maxClassDrop,
    perDeckMin,
    skipRoundTrip: strict ? false : !roundTripRequested,
    strict,
  }

  if (strict && !roundTripRequested) {
    console.warn('Strict mode implies --roundtrip; enabling round-trip validation automatically.')
  }

  const { results, summary } = await runCorpusTests(corpusDir, options)
  reportResults({ results, summary })
  if (baselineOut) {
    await fs.outputJson(
      baselineOut,
      baselineFromResults(results, summary, {
        excludeClassDrop: options.excludeClassDrop,
        maxClassDrop,
        perDeckMinSemantic: perDeckMin,
      }),
      { spaces: 2 }
    )
  }
  if (driftOut) await writeDriftRows(driftOut, results)

  const code = enforceStrictSummary(summary, results)
  if (code) process.exit(code)
}

if (require.main === module) {
  runFromCli().catch((err) => {
    console.error(`Error running corpus tests: ${err.message}`)
    process.exit(1)
  })
}

module.exports = { baselineFromResults, enforceStrictSummary, parseListFlags, runFromCli }
