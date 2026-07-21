const { UPLOADS_DIR } = require('../storage')
const { FAILURE_TYPES } = require('./constants')
const { PptxImportError, sanitizeDiagnostic } = require('./diagnostics')
const { mapPptxOutput } = require('./mapper')
const { loadPptxArchive } = require('./pptx-guards')
const { runParserWorker } = require('./worker-runner')
const { buildOoxmlSceneGraph, reconcileSceneGraph } = require('./ooxml-scene-graph')
const { resolveSceneGraphStrictPolicy } = require('./ooxml-scene-graph/strict-policy')
const { assertPresentationAcceptance } = require('./acceptance-criteria')
const { createMediaBudget } = require('./resource-budgets')
const { runShadowReconciliation } = require('./reconciliation')
const { buildImportSourceMap } = require('./source-map')

function buildImportStats({ mappedStats = {}, parsed = {}, startedAt = Date.now(), now = Date.now() }) {
  return {
    parser: 'pptxtojson',
    fallbackParserUsed: Boolean(parsed.fallback),
    packageVersion: parsed.packageVersion,
    slideCount: mappedStats.slideCount,
    textCount: mappedStats.textCount,
    imageCount: mappedStats.imageCount,
    shapeCount: mappedStats.shapeCount,
    tableCount: mappedStats.tableCount,
    chartCount: mappedStats.chartCount || 0,
    diagramCount: mappedStats.diagramCount || 0,
    nativeChartCount: mappedStats.nativeChartCount || 0,
    nativeSmartArtCount: mappedStats.nativeSmartArtCount || 0,
    nativeChartImportedCount: mappedStats.nativeChartImportedCount || 0,
    nativeSmartArtImportedCount: mappedStats.nativeSmartArtImportedCount || 0,
    nativeObjectCoverage: mappedStats.nativeObjectCoverage,
    ooxml: mappedStats.ooxml,
    placeholderCount: mappedStats.placeholderCount,
    durationMs: now - startedAt,
  }
}

async function importPptxFile(filePath, options = {}) {
  const started = Date.now()
  const originalName = options.originalName || filePath
  const strictPolicy = resolveSceneGraphStrictPolicy(options)
  const parsed = await runParserWorker(filePath, {
    ...(options.workerOptions || {}),
    onProgress: options.onProgress,
    signal: options.signal,
    originalName,
  })

  if (!parsed.ok) {
    throw new PptxImportError(parsed.error?.message || 'PPTX parse failed', {
      status: parsed.error?.status || 422,
      type: parsed.error?.type || FAILURE_TYPES.parseFailed,
    })
  }

  options.signal?.throwIfAborted?.()
  const packageInfo = {
    ...parsed.packageInfo,
    zip: await loadPptxArchive(filePath),
  }
  options.signal?.throwIfAborted?.()
  // Scene graph is inventory truth (Phase 03); mapper still uses pptxtojson payloads.
  let sceneGraph = null
  try {
    options.onProgress?.({ stage: 'scene-graph', percent: 70, message: 'Building OOXML scene graph' })
    sceneGraph = await buildOoxmlSceneGraph(packageInfo.zip)
  } catch (err) {
    // Non-fatal unless strict later — surface diagnostic
    sceneGraph = { error: sanitizeDiagnostic(err), stats: { nodeCount: 0 } }
  }

  options.signal?.throwIfAborted?.()
  const mapped = await mapPptxOutput({
    output: parsed.output,
    zip: packageInfo.zip,
    originalName,
    uploadsDir: options.uploadsDir || UPLOADS_DIR,
    onProgress: options.onProgress,
    signal: options.signal,
    mediaBudget: options.mediaBudget || createMediaBudget(options.maxAggregateMediaBytes),
    mediaTransaction: options.mediaTransaction,
    sceneGraph: sceneGraph && !sceneGraph.error ? sceneGraph : null,
    strict: strictPolicy.strict,
  })

  let sceneWarnings = []
  if (sceneGraph && !sceneGraph.error) {
    try {
      const reconciliation = reconcileSceneGraph(sceneGraph, mapped.presentation, {
        strictCountGate: strictPolicy.strictCountGate,
        strictNodeGate: strictPolicy.strictNodeGate,
      })
      sceneWarnings = reconciliation.warnings || []
      if (mapped.stats) {
        mapped.stats.sceneGraphMappedNodes = reconciliation.mappedNodeIds?.length || 0
        mapped.stats.sceneGraphUnmapped = reconciliation.unmapped?.length || 0
      }
    } catch (err) {
      if (
        err?.code === 'scene-graph-unmapped' ||
        /PPTX_SLA_STRICT_COUNT|PPTX_SLA_STRICT_NODES/.test(err?.message || '')
      ) {
        throw new PptxImportError(err.message, {
          status: 422,
          type: FAILURE_TYPES.importFailed,
        })
      }
      throw err
    }
  }

  if (strictPolicy.strict) {
    try {
      assertPresentationAcceptance(mapped.presentation, undefined, parsed.output, {
        strictPrimitives: process.env.PPTX_SLA_STRICT_PRIMITIVES === '1' || options.strictPrimitives === true,
      })
    } catch (err) {
      throw new PptxImportError(err.message || 'PPTX acceptance failed', {
        status: 422,
        type: FAILURE_TYPES.schemaUnusable,
      })
    }
  }

  let shadowReconciliation = null
  if (options.shadowReconciliation?.enabled === true) {
    const shadowResult = await runShadowReconciliation({
      ...options.shadowReconciliation,
      enabled: true,
      nativeProjection: mapped.presentation,
      sceneGraph: sceneGraph && !sceneGraph.error ? sceneGraph : null,
      signal: options.signal,
    })
    shadowReconciliation = shadowResult.shadow
  }

  const stats = buildImportStats({ mappedStats: mapped.stats, parsed, startedAt: started })
  const sourceMap = await buildImportSourceMap(
    mapped.presentation,
    sceneGraph && !sceneGraph.error ? sceneGraph : null,
    packageInfo.zip,
    options.sourceMapIdentity || {}
  )
  if (sceneGraph?.stats) stats.sceneGraph = sceneGraph.stats
  stats.primitivePlaceholderCount = (mapped.presentation?.slides || []).reduce((sum, slide) => {
    return (
      sum +
      (slide.elements || []).filter((el) => el?.importPlaceholderType).length
    )
  }, 0)

  return {
    ...mapped,
    sourceMap,
    stats,
    sceneGraph: sceneGraph?.stats
      ? { stats: sceneGraph.stats, slideCount: sceneGraph.slides?.length }
      : sceneGraph,
    shadowReconciliation,
    warnings: [
      ...mapped.warnings,
      ...sceneWarnings,
      ...(parsed.fallback
        ? [{ slideIndex: null, type: 'fallback-inspector', message: sanitizeDiagnostic(parsed.fallback.reason || 'pptx2json fallback inspector used') }]
        : []),
    ],
  }
}

module.exports = {
  buildImportStats,
  importPptxFile,
}
