const { UPLOADS_DIR } = require('../storage')
const { FAILURE_TYPES } = require('./constants')
const { PptxImportError, sanitizeDiagnostic } = require('./diagnostics')
const { mapPptxOutput } = require('./mapper')
const { validatePptxPackage } = require('./pptx-guards')
const { runParserWorker } = require('./worker-runner')

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
  const mapped = await mapPptxOutput({
    output: parsed.output,
    zip: packageInfo.zip,
    originalName,
    uploadsDir: options.uploadsDir || UPLOADS_DIR,
    onProgress: options.onProgress,
    signal: options.signal,
  })

  return {
    ...mapped,
    stats: buildImportStats({ mappedStats: mapped.stats, parsed, startedAt: started }),
    warnings: [
      ...mapped.warnings,
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
