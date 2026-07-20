const fs = require('fs-extra')
const {
  DEFAULT_CORPUS,
  STRICT_CORPUS_GATES,
  parsePercentFlag,
  reportResults,
  runCorpusTests,
  writeDriftRows,
} = require('./pptx-import-semantic-and-roundtrip-fidelity-tester')
const { buildCorpusManifest } = require('./evidence/corpus-manifest')

function parseListFlags(args, name) {
  return args
    .filter((arg) => arg.startsWith(`${name}=`))
    .flatMap((arg) => arg.slice(name.length + 1).split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

function baselineFromResults(results, summary, gates = STRICT_CORPUS_GATES) {
  const sumMetric = (read) => {
    const values = results.map(read)
    return values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) : null
  }
  return {
    evidenceVersion: 2,
    summary: {
      ...Object.fromEntries(Object.entries(summary).filter(([key]) => key !== 'runAt')),
      corpusEvidence: {
        sceneGraphUnmapped: sumMetric((result) => result.stats?.sceneGraphUnmapped),
        chartCoverageGapCount: sumMetric(
          (result) => result.stats?.nativeObjectCoverage?.chartCoverageGapCount
        ),
        smartArtCoverageGapCount: sumMetric(
          (result) => result.stats?.nativeObjectCoverage?.smartArtCoverageGapCount
        ),
        permanentPlaceholderCount: sumMetric(
          (result) => result.stats?.primitivePlaceholderCount ?? result.stats?.placeholderCount
        ),
      },
    },
    gates,
    perDeck: Object.fromEntries(
      results.map((result) => [
        result.file,
        {
          semanticFidelity: result.semanticFidelity,
          roundTripStability: result.roundTrip?.overall ?? null,
          propertyCoverage: result.propertyCoverage,
          elementCount: result.elementCount,
        },
      ])
    ),
  }
}

function enforceStrictSummary(summary, results) {
  if (summary.failedFiles > 0) return 1
  if (!summary.strict) return 0
  if (summary.totalFiles < STRICT_CORPUS_GATES.minCorpusFiles) {
    console.error(
      `Strict mode failed: corpus has fewer than ${STRICT_CORPUS_GATES.minCorpusFiles} files`
    )
    return 1
  }
  if (
    summary.avgSemanticFidelity == null ||
    summary.avgSemanticFidelity < STRICT_CORPUS_GATES.avgSemanticFidelity.min
  ) {
    console.error(
      `Strict mode failed: average semantic fidelity is below ${STRICT_CORPUS_GATES.avgSemanticFidelity.label}`
    )
    return 1
  }
  if (
    summary.avgRoundTripStability == null ||
    summary.avgRoundTripStability < STRICT_CORPUS_GATES.avgRoundTripStability.min
  ) {
    console.error(
      `Strict mode failed: average round-trip stability is below ${STRICT_CORPUS_GATES.avgRoundTripStability.label}`
    )
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
  const baselineOut =
    args.find((arg) => arg.startsWith('--baseline-out='))?.slice('--baseline-out='.length) || ''
  const manifestOut =
    args.find((arg) => arg.startsWith('--manifest-out='))?.slice('--manifest-out='.length) || ''
  const fixtureMapPath =
    args.find((arg) => arg.startsWith('--fixture-map='))?.slice('--fixture-map='.length) || ''
  const driftOut =
    args.find((arg) => arg.startsWith('--drift-out='))?.slice('--drift-out='.length) || ''
  const perDeckMin = parsePercentFlag(
    args.find((arg) => arg.startsWith('--per-deck-min='))?.slice('--per-deck-min='.length),
    STRICT_CORPUS_GATES.perDeckSemantic.min
  )
  const maxClassDrop = parsePercentFlag(
    args.find((arg) => arg.startsWith('--max-class-drop='))?.slice('--max-class-drop='.length),
    STRICT_CORPUS_GATES.maxClassDrop.max
  )
  if (args.some((arg) => arg.startsWith('--feature-rows='))) {
    throw new Error(
      '--feature-rows is unsupported; canonical coverage rows are derived from the feature matrix'
    )
  }
  if (fixtureMapPath && !manifestOut) {
    throw new Error('--fixture-map requires --manifest-out')
  }
  const fixtureMap = fixtureMapPath ? await fs.readJson(fixtureMapPath) : undefined
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
        ...STRICT_CORPUS_GATES,
        excludeClassDrop: options.excludeClassDrop,
        maxClassDrop: {
          ...STRICT_CORPUS_GATES.maxClassDrop,
          max: maxClassDrop,
          label: `${(maxClassDrop * 100).toFixed(Number.isInteger(maxClassDrop * 100) ? 0 : 1)}%`,
        },
        perDeckSemantic: {
          ...STRICT_CORPUS_GATES.perDeckSemantic,
          min: perDeckMin,
          label: `${(perDeckMin * 100).toFixed(Number.isInteger(perDeckMin * 100) ? 0 : 1)}%`,
        },
      }),
      { spaces: 2 }
    )
  }
  if (manifestOut) {
    await fs.outputJson(manifestOut, await buildCorpusManifest(summary.corpusDir, fixtureMap), {
      spaces: 2,
    })
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
