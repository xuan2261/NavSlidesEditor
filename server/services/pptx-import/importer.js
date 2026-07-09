const { UPLOADS_DIR } = require('../storage')
const { FAILURE_TYPES } = require('./constants')
const { PptxImportError, sanitizeDiagnostic } = require('./diagnostics')
const { mapPptxOutput } = require('./mapper')
const { validatePptxPackage } = require('./pptx-guards')
const { runParserWorker } = require('./worker-runner')
const { buildOoxmlSceneGraph, reconcileSceneGraph } = require('./ooxml-scene-graph')

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
  const packageInfo = await validatePptxPackage(filePath, originalName, { signal: options.signal })
  options.signal?.throwIfAborted?.()
  const parsed = await runParserWorker(filePath, {
    ...(options.workerOptions || {}),
    onProgress: options.onProgress,
    signal: options.signal,
  })

  if (!parsed.ok) {
    throw new PptxImportError(parsed.error?.message || 'PPTX parse failed', {
      status: 422,
      type: parsed.error?.type || FAILURE_TYPES.parseFailed,
    })
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
  })

  let sceneWarnings = []
  if (sceneGraph && !sceneGraph.error) {
    try {
      const reconciliation = reconcileSceneGraph(sceneGraph, mapped.presentation, {
        strict: options.strict === true || process.env.PPTX_SLA_STRICT === '1',
      })
      sceneWarnings = reconciliation.warnings || []
    } catch (err) {
      if (err?.code === 'scene-graph-unmapped' || /PPTX_SLA_STRICT/.test(err?.message || '')) {
        throw new PptxImportError(err.message, {
          status: 422,
          type: FAILURE_TYPES.importFailed,
        })
      }
      throw err
    }
  }

  const stats = buildImportStats({ mappedStats: mapped.stats, parsed, startedAt: started })
  if (sceneGraph?.stats) stats.sceneGraph = sceneGraph.stats

  return {
    ...mapped,
    stats,
    sceneGraph: sceneGraph?.stats
      ? { stats: sceneGraph.stats, slideCount: sceneGraph.slides?.length }
      : sceneGraph,
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
