/**
 * Report finalization + content-address digests for perf matrix.
 */
const crypto = require('crypto')
const {
  MAX_FILE_BYTES,
  MAX_ZIP_ENTRIES,
  MAX_DECOMPRESSED_BYTES,
} = require('../constants')
const { assertValidPerfReport, createPerfReport } = require('./report-schema')
const { summarizeDurations } = require('./stage-timers')

function limitsDigest(limits = {}) {
  const payload = {
    maxFileBytes: limits.maxFileBytes ?? MAX_FILE_BYTES,
    maxZipEntries: limits.maxZipEntries ?? MAX_ZIP_ENTRIES,
    maxDecompressedBytes: limits.maxDecompressedBytes ?? MAX_DECOMPRESSED_BYTES,
  }
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16)
}

function packageSha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function finalizeReport({ mode, runs }) {
  const wallSamples = runs.filter((r) => r.ok && Number.isFinite(r.wallMs)).map((r) => r.wallMs)
  const stageSummaries = {}
  for (const key of ['parse', 'revalidate', 'map']) {
    stageSummaries[key] = summarizeDurations(
      runs.filter((r) => r.ok && r.stages?.[key]).map((r) => r.stages[key].durationMs)
    )
  }

  const ratios = runs
    .filter((r) => r.ok && r.doublePass?.ratio != null)
    .map((r) => r.doublePass.ratio)
  const doublePass = {
    sampleCount: ratios.length,
    meanRatio:
      ratios.length === 0
        ? null
        : Number((ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(3)),
    residualCost: 'worker validatePptxPackage + host loadPptxArchive full revalidate',
  }

  const archiveReuse = {
    status: 'deferred',
    keyShape: '(sha256(packageBytes), limitsDigest)',
    residualCost: doublePass.residualCost,
    rationale:
      'No sustained measurable win on default tiny matrix; hash-bound inventory cache deferred to avoid unsafe skip of revalidation',
  }

  return assertValidPerfReport(
    createPerfReport({
      mode,
      runs,
      wallSummary: summarizeDurations(wallSamples),
      stageSummaries,
      doublePass,
      archiveReuse,
    })
  )
}

module.exports = {
  finalizeReport,
  limitsDigest,
  packageSha256,
}
