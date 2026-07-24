/**
 * PPTX import perf matrix runner (tiny always; full gated by PPTX_PERF=1).
 * Measures validate/revalidate/map-prep stages — does not raise concurrency.
 */
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const { MAX_ZIP_ENTRIES } = require('../constants')
const { validatePptxPackage } = require('../pptx-guards')
const { SKIP_REASONS, createSkippedReport } = require('./report-schema')
const {
  ENTRY_LADDER,
  SIZE_LADDER_MIB,
  buildEntryLadderPackage,
  buildSizeLadderPackage,
  buildTinyPptx,
} = require('./synthetic-package')
const { createStageTimer } = require('./stage-timers')
const { finalizeReport, limitsDigest, packageSha256 } = require('./matrix-summary')

const DEFAULT_REPORT_DIR = path.resolve(__dirname, '../../../../plans/reports')
const HEAVY_SIZE_CAP_MIB = 12 // CI-safe max pad; 50/100 MiB points may skip

async function withTempFile(bytes, name, fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-perf-matrix-'))
  const filePath = path.join(dir, name)
  try {
    await fs.writeFile(filePath, bytes)
    return await fn(filePath)
  } finally {
    await fs.remove(dir).catch(() => {})
  }
}

async function timePackageStages(filePath, originalName, limits = {}) {
  const timer = createStageTimer()
  const wallStart = Date.now()
  let ok = true
  let errorMessage = null
  let entryCount = null
  let fileSize = null
  try {
    const first = await timer.measure('parse', () =>
      validatePptxPackage(filePath, originalName, limits)
    )
    entryCount = first.entryCount
    fileSize = first.fileSize
    await timer.measure('revalidate', () =>
      validatePptxPackage(filePath, originalName, limits)
    )
    await timer.measure('map', async () => {
      await fs.readFile(filePath)
    })
  } catch (err) {
    ok = false
    errorMessage = String(err?.message || err)
  }
  const stages = timer.snapshot()
  const parseMs = stages.parse?.durationMs ?? null
  const revalidateMs = stages.revalidate?.durationMs ?? null
  return {
    ok,
    errorMessage,
    wallMs: Date.now() - wallStart,
    stages,
    entryCount,
    fileSize,
    doublePass: {
      parseMs,
      revalidateMs,
      ratio:
        parseMs > 0 && revalidateMs != null
          ? Number((revalidateMs / parseMs).toFixed(3))
          : null,
    },
  }
}

async function runTinyMatrix({ iterations = 1 } = {}) {
  const runs = []
  for (let i = 0; i < iterations; i += 1) {
    const bytes = await buildTinyPptx()
    const measured = await withTempFile(bytes, 'tiny.pptx', (filePath) =>
      timePackageStages(filePath, 'tiny.pptx')
    )
    runs.push({
      id: `tiny-${i}`,
      dimension: 'tiny',
      target: 'baseline',
      sha256: packageSha256(bytes),
      limitsDigest: limitsDigest(),
      ...measured,
    })
  }

  const entryBytes = await buildEntryLadderPackage({ entryCount: 50 })
  const entryMeasured = await withTempFile(entryBytes, 'entries-50.pptx', (filePath) =>
    timePackageStages(filePath, 'entries-50.pptx')
  )
  runs.push({
    id: 'entries-50',
    dimension: 'entries',
    target: 50,
    sha256: packageSha256(entryBytes),
    limitsDigest: limitsDigest(),
    ...entryMeasured,
  })

  return finalizeReport({ mode: 'tiny', runs })
}

async function runFullMatrix({ env = process.env } = {}) {
  if (env.PPTX_PERF !== '1') {
    return createSkippedReport({
      reason: SKIP_REASONS.ENV,
      mode: 'full',
      detail: 'Heavy ladder requires PPTX_PERF=1 (avoids CI OOM)',
    })
  }

  const runs = []
  for (const mib of SIZE_LADDER_MIB) {
    if (mib > HEAVY_SIZE_CAP_MIB) {
      runs.push({
        id: `size-${mib}mib`,
        dimension: 'compressed-size',
        target: `${mib}MiB`,
        ok: false,
        skipped: true,
        reason: SKIP_REASONS.RESOURCE,
        detail: `Size point ${mib}MiB exceeds harness pad cap ${HEAVY_SIZE_CAP_MIB}MiB`,
      })
      continue
    }
    const bytes = await buildSizeLadderPackage({
      targetBytes: mib * 1024 * 1024,
      maxPadBytes: HEAVY_SIZE_CAP_MIB * 1024 * 1024,
    })
    const measured = await withTempFile(bytes, `size-${mib}.pptx`, (filePath) =>
      timePackageStages(filePath, `size-${mib}.pptx`)
    )
    runs.push({
      id: `size-${mib}mib`,
      dimension: 'compressed-size',
      target: `${mib}MiB`,
      sha256: packageSha256(bytes),
      limitsDigest: limitsDigest(),
      ...measured,
    })
  }

  for (const count of ENTRY_LADDER) {
    const bytes = await buildEntryLadderPackage({ entryCount: count })
    const limits = { maxZipEntries: Math.max(MAX_ZIP_ENTRIES, count) }
    const measured = await withTempFile(bytes, `entries-${count}.pptx`, (filePath) =>
      timePackageStages(filePath, `entries-${count}.pptx`, limits)
    )
    runs.push({
      id: `entries-${count}`,
      dimension: 'entries',
      target: count,
      sha256: packageSha256(bytes),
      limitsDigest: limitsDigest(limits),
      ...measured,
    })
  }

  return finalizeReport({ mode: 'full', runs })
}

async function writeReport(report, { reportDir = DEFAULT_REPORT_DIR, fileName } = {}) {
  await fs.ensureDir(reportDir)
  const stamp = new Date().toISOString().slice(0, 10)
  const name = fileName || `${stamp}-pptx-import-perf-matrix.json`
  const outPath = path.join(reportDir, name)
  await fs.writeJson(outPath, report, { spaces: 2 })
  return outPath
}

module.exports = {
  DEFAULT_REPORT_DIR,
  HEAVY_SIZE_CAP_MIB,
  limitsDigest,
  packageSha256,
  runFullMatrix,
  runTinyMatrix,
  timePackageStages,
  writeReport,
}
