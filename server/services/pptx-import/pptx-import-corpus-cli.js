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
const { runImporterQualification } = require('./pptx-import-qualification')

function parseListFlags(args, name) {
  return args
    .filter((arg) => arg.startsWith(`${name}=`))
    .flatMap((arg) => arg.slice(name.length + 1).split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

function readFlagValue(args, name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const index = args.indexOf(name)
  return index >= 0 && !args[index + 1]?.startsWith('--') ? args[index + 1] : ''
}

function corpusArgument(args) {
  const valueFlags = new Set([
    '--baseline-out', '--drift-out', '--fixture-map', '--manifest-in', '--manifest-out',
    '--max-class-drop', '--per-deck-min',
  ])
  for (let index = 0; index < args.length; index += 1) {
    if (valueFlags.has(args[index])) {
      index += 1
      continue
    }
    if (!args[index].startsWith('--')) return args[index]
  }
  return DEFAULT_CORPUS
}

function baselineFromResults(results, summary, gates = STRICT_CORPUS_GATES) {
  const aggregateEvidence = (read) => {
    const values = results.map(read)
    const finite = values.length > 0 && values.every(Number.isFinite)
    return { finite, value: finite ? values.reduce((sum, value) => sum + value, 0) : null }
  }
  const evidence = {
    sceneGraphUnmapped: aggregateEvidence((result) => result.stats?.sceneGraphUnmapped),
    chartCoverageGapCount: aggregateEvidence((result) => result.stats?.nativeObjectCoverage?.chartCoverageGapCount),
    smartArtCoverageGapCount: aggregateEvidence((result) => result.stats?.nativeObjectCoverage?.smartArtCoverageGapCount),
    permanentPlaceholderCount: aggregateEvidence((result) => result.stats?.primitivePlaceholderCount),
  }
  return {
    evidenceVersion: 2,
    summary: {
      ...Object.fromEntries(Object.entries(summary).filter(([key]) => key !== 'runAt')),
      corpusEvidence: Object.fromEntries(Object.entries(evidence).map(([key, item]) => [key, item.value])),
      corpusEvidenceValidity: Object.fromEntries(Object.entries(evidence).map(([key, item]) => [key, item.finite])),
      invalidCorpusEvidence: Object.keys(evidence).filter((key) => !evidence[key].finite),
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
    console.error(`Strict mode failed: corpus has fewer than ${STRICT_CORPUS_GATES.minCorpusFiles} files`)
    return 1
  }
  if (summary.avgSemanticFidelity == null || summary.avgSemanticFidelity < STRICT_CORPUS_GATES.avgSemanticFidelity.min) {
    console.error(`Strict mode failed: average semantic fidelity is below ${STRICT_CORPUS_GATES.avgSemanticFidelity.label}`)
    return 1
  }
  if (summary.avgRoundTripStability == null || summary.avgRoundTripStability < STRICT_CORPUS_GATES.avgRoundTripStability.min) {
    console.error(`Strict mode failed: average round-trip stability is below ${STRICT_CORPUS_GATES.avgRoundTripStability.label}`)
    return 1
  }
  if (results.some((result) => result.roundTripExportMethod !== 'production')) {
    console.error('Strict mode failed: non-production export method detected')
    return 1
  }
  return 0
}

async function runFromCli(args = process.argv.slice(2), dependencies = {}) {
  const runMetrics = dependencies.runCorpusTests || runCorpusTests
  const renderMetrics = dependencies.reportResults || reportResults
  const qualifyImporter = dependencies.runImporterQualification || runImporterQualification
  const outputJson = dependencies.outputJson || fs.outputJson
  const logger = dependencies.logger || console
  const corpusDir = corpusArgument(args)
  const legacyStrict = args.includes('--strict')
  const strictMetrics = args.includes('--strict-metrics') || legacyStrict
  const importerStrict = args.includes('--importer-strict')
  const manifestIn = readFlagValue(args, '--manifest-in')

  if (strictMetrics && importerStrict) throw new Error('--strict-metrics and --importer-strict cannot be combined')
  if (manifestIn && !importerStrict) throw new Error('--manifest-in requires --importer-strict')
  if (legacyStrict) logger.warn('--strict is deprecated; use --strict-metrics or --importer-strict explicitly.')

  if (importerStrict) {
    if (!manifestIn) throw new Error('--importer-strict requires --manifest-in')
    const report = await qualifyImporter({ corpusDir, manifestPath: manifestIn })
    logger.log(JSON.stringify(report, null, 2))
    return report.exitCode || 0
  }

  const roundTripRequested = args.includes('--roundtrip')
  const baselineOut = readFlagValue(args, '--baseline-out')
  const manifestOut = readFlagValue(args, '--manifest-out')
  const fixtureMapPath = readFlagValue(args, '--fixture-map')
  const driftOut = readFlagValue(args, '--drift-out')
  const perDeckMin = parsePercentFlag(readFlagValue(args, '--per-deck-min'), STRICT_CORPUS_GATES.perDeckSemantic.min)
  const maxClassDrop = parsePercentFlag(readFlagValue(args, '--max-class-drop'), STRICT_CORPUS_GATES.maxClassDrop.max)
  if (args.some((arg) => arg.startsWith('--feature-rows='))) {
    throw new Error('--feature-rows is unsupported; canonical coverage rows are derived from the feature matrix')
  }
  if (fixtureMapPath && !manifestOut) throw new Error('--fixture-map requires --manifest-out')
  const fixtureMap = fixtureMapPath ? await fs.readJson(fixtureMapPath) : undefined
  const options = {
    allowFallback: args.includes('--allow-fallback'),
    excludeClassDrop: parseListFlags(args, '--exclude-class-drop'),
    maxClassDrop,
    perDeckMin,
    skipRoundTrip: strictMetrics ? false : !roundTripRequested,
    strict: strictMetrics,
  }
  if (strictMetrics && !roundTripRequested) logger.warn('Strict metrics imply --roundtrip; enabling round-trip validation automatically.')

  const { results, summary } = await runMetrics(corpusDir, options)
  renderMetrics({ results, summary })
  if (baselineOut) {
    await outputJson(baselineOut, baselineFromResults(results, summary, {
      ...STRICT_CORPUS_GATES,
      excludeClassDrop: options.excludeClassDrop,
      maxClassDrop: { ...STRICT_CORPUS_GATES.maxClassDrop, max: maxClassDrop, label: `${maxClassDrop * 100}%` },
      perDeckSemantic: { ...STRICT_CORPUS_GATES.perDeckSemantic, min: perDeckMin, label: `${perDeckMin * 100}%` },
    }), { spaces: 2 })
  }
  if (manifestOut) await outputJson(manifestOut, await buildCorpusManifest(summary.corpusDir, fixtureMap), { spaces: 2 })
  if (driftOut) await writeDriftRows(driftOut, results)
  return enforceStrictSummary(summary, results)
}

if (require.main === module) {
  runFromCli().then((code) => {
    process.exitCode = code
  }).catch((err) => {
    console.error(`Error running corpus tests: ${err.message}`)
    process.exitCode = 1
  })
}

module.exports = { baselineFromResults, corpusArgument, enforceStrictSummary, parseListFlags, readFlagValue, runFromCli }
