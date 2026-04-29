const { UPLOADS_DIR } = require('../storage')
const { FAILURE_TYPES } = require('./constants')
const { PptxImportError, sanitizeDiagnostic } = require('./diagnostics')
const { mapPptxOutput } = require('./mapper')
const { validatePptxPackage } = require('./pptx-guards')
const { runParserWorker } = require('./worker-runner')

async function importPptxFile(filePath, options = {}) {
  const started = Date.now()
  const originalName = options.originalName || filePath
  const packageInfo = await validatePptxPackage(filePath, originalName)
  const parsed = await runParserWorker(filePath, options.workerOptions)

  if (!parsed.ok) {
    throw new PptxImportError(parsed.error?.message || 'PPTX parse failed', {
      status: 422,
      type: parsed.error?.type || FAILURE_TYPES.parseFailed,
    })
  }

  const mapped = await mapPptxOutput({
    output: parsed.output,
    zip: packageInfo.zip,
    originalName,
    uploadsDir: options.uploadsDir || UPLOADS_DIR,
  })

  return {
    ...mapped,
    stats: {
      parser: 'pptxtojson',
      fallbackParserUsed: Boolean(parsed.fallback),
      packageVersion: parsed.packageVersion,
      slideCount: mapped.stats.slideCount,
      textCount: mapped.stats.textCount,
      imageCount: mapped.stats.imageCount,
      shapeCount: mapped.stats.shapeCount,
      tableCount: mapped.stats.tableCount,
      chartCount: mapped.stats.chartCount || 0,
      placeholderCount: mapped.stats.placeholderCount,
      durationMs: Date.now() - started,
    },
    warnings: [
      ...mapped.warnings,
      ...(parsed.fallback
        ? [{ slideIndex: null, type: 'fallback-inspector', message: sanitizeDiagnostic(parsed.fallback.reason || 'pptx2json fallback inspector used') }]
        : []),
    ],
  }
}

module.exports = {
  importPptxFile,
}
