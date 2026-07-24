const crypto = require('node:crypto')
const fs = require('fs-extra')
const path = require('node:path')
const { capturePresentSlides } = require('./capture-present')
const { collectActualSlides } = require('./actual-capture-files')
const { inspectPresentationStructure } = require('../presentation-structure')
const { coded, createDeadline, requestJson, safeServerReasonCode, withSignal } = require('./http-boundary')
const { cancelAndReconcileJob, waitForCompletedJob } = require('./job-lifecycle')
const { extractPackageIdentity, readFencedOriginal, readPackageSnapshot, samePackageIdentity } = require('./package-snapshot')

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')

function loopbackBaseUrl(value) {
  let url
  try { url = new URL(value) } catch { throw coded('invalid-base-url') }
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', '::1', 'localhost'].includes(url.hostname)) {
    throw coded('base-url-not-loopback')
  }
  return url.origin
}

function endpoint(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl}/`).href
}

function safeReasonCode(value, fallback) {
  return typeof value === 'string' && /^[a-z][a-z0-9-]{0,127}$/.test(value) ? value : fallback
}

function captureErrorCode(value) {
  return safeReasonCode(value, 'actual-capture-failed')
}

function captureCleanupCodes(values) {
  return Array.isArray(values) ? values.filter((value) => captureErrorCode(value) === value) : []
}

async function reserveDeckOutput(outDir, deckStem) {
  const root = path.resolve(outDir)
  const deckDir = path.resolve(root, deckStem)
  if (!deckDir.startsWith(`${root}${path.sep}`)) throw coded('invalid-actual-output-path')
  try { await fs.ensureDir(root) } catch { throw coded('actual-output-directory-unavailable') }
  try {
    await fs.mkdir(deckDir)
    return deckDir
  } catch (error) {
    if (error?.code === 'EEXIST') throw coded('actual-output-already-exists')
    throw coded('actual-output-reservation-failed')
  }
}

async function capturePackageBackedActuals({
  baseUrl, sourcePath, outDir, fetchImpl = globalThis.fetch, capturePresent = capturePresentSlides,
  inspectSource = inspectPresentationStructure, pollIntervalMs = 250, timeoutMs = 120_000, reconciliationAttempts = 40,
  reconciliationTimeoutMs = 30_000, cleanupTimeoutMs = 30_000,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  let presentationId = null
  let jobId = null
  let reservedDeckDir = null
  let operationDeadline = null
  let result
  try {
    const origin = loopbackBaseUrl(baseUrl)
    if (typeof fetchImpl !== 'function' || typeof capturePresent !== 'function' || typeof inspectSource !== 'function' ||
      typeof sourcePath !== 'string' || !sourcePath || typeof outDir !== 'string' || !outDir ||
      !Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 0 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 0 ||
      !Number.isSafeInteger(reconciliationAttempts) || reconciliationAttempts < 1 ||
      !Number.isSafeInteger(reconciliationTimeoutMs) || reconciliationTimeoutMs < 1 ||
      !Number.isSafeInteger(cleanupTimeoutMs) || cleanupTimeoutMs < 1) throw coded('invalid-capture-options')
    const fileName = path.basename(sourcePath)
    if (!fileName.toLowerCase().endsWith('.pptx') || fileName !== sourcePath && !sourcePath?.endsWith(fileName)) {
      throw coded('invalid-source-file')
    }
    const sourceBytes = await fs.readFile(sourcePath).catch(() => { throw coded('source-read-failed') })
    const source = { fileName, sha256: sha256(sourceBytes), byteLength: sourceBytes.length }
    const sourceStructure = await inspectSource(sourceBytes).catch(() => { throw coded('source-ooxml-inspection-failed') })
    if (!Array.isArray(sourceStructure?.slides) || sourceStructure.slides.length < 1) throw coded('invalid-source-slide-list')
    source.ooxmlSlideCount = sourceStructure.slides.length
    const deckStem = fileName.replace(/\.pptx$/i, '')
    if (!deckStem || deckStem === '.' || deckStem === '..') throw coded('invalid-source-file')
    reservedDeckDir = await reserveDeckOutput(outDir, deckStem)
    operationDeadline = createDeadline(timeoutMs)

    if (typeof FormData !== 'function' || typeof Blob !== 'function') throw coded('form-data-unavailable')
    const form = new FormData()
    form.append('file', new Blob([sourceBytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), fileName)
    const submitted = await requestJson(fetchImpl, endpoint(origin, '/api/pptx/import'), withSignal({ method: 'POST', body: form }, operationDeadline.signal))
    if (typeof submitted?.jobId !== 'string' || !submitted.jobId) throw coded('invalid-import-job')
    jobId = submitted.jobId
    presentationId = await waitForCompletedJob(fetchImpl, origin, jobId, {
      pollIntervalMs, timeoutMs, reconciliationAttempts, reconciliationTimeoutMs, signal: operationDeadline.signal, sleep,
    })

    const presentation = await requestJson(fetchImpl, endpoint(origin, `/api/presentations/${encodeURIComponent(presentationId)}`), withSignal(null, operationDeadline.signal))
    if (!presentation || presentation.id !== presentationId) throw coded('invalid-authoritative-presentation')
    const identity = await readPackageSnapshot(fetchImpl, origin, presentationId, operationDeadline.signal)
    if (identity.originalSha256 !== source.sha256 || identity.originalByteLength !== source.byteLength) {
      throw coded('snapshot-source-identity-mismatch')
    }
    const originalBytes = await readFencedOriginal(fetchImpl, origin, identity, operationDeadline.signal)
    if (sha256(originalBytes) !== identity.originalSha256 || originalBytes.length !== identity.originalByteLength) {
      throw coded('fenced-original-identity-mismatch')
    }

    const captured = await capturePresent(presentation, {
      outDir, deckStem, assetBaseUrl: origin, signal: operationDeadline.signal, teardownTimeoutMs: cleanupTimeoutMs,
    })
    if (!captured?.ok) {
      const error = coded(captureErrorCode(captured?.error))
      const cleanupErrors = captureCleanupCodes(captured?.cleanupErrors)
      if (cleanupErrors.length) error.captureCleanupErrors = cleanupErrors
      throw error
    }
    const confirmedIdentity = await readPackageSnapshot(fetchImpl, origin, presentationId, operationDeadline.signal)
    if (!samePackageIdentity(identity, confirmedIdentity)) throw coded('package-authority-changed-during-capture')
    const slides = await collectActualSlides(captured.files, outDir, deckStem)
    if (slides.length !== source.ooxmlSlideCount) throw coded('actual-source-slide-count-mismatch')
    result = {
      ok: true,
      actual: {
        authority: 'package-backed-http', jobId, source,
        presentation: {
          id: presentationId,
          packageRevisionId: identity.packageRevisionId,
          packageHeadHash: identity.packageHeadHash,
          aggregateGeneration: identity.aggregateGeneration,
          originalSha256: identity.originalSha256,
          originalByteLength: identity.originalByteLength,
        },
        slides,
      },
    }
  } catch (error) {
    const reasonCode = safeServerReasonCode(error?.reasonCode)
    result = {
      ok: false,
      error: safeReasonCode(error?.code, 'package-backed-capture-failed'),
      ...(jobId ? { jobId } : {}),
      ...(reasonCode ? { reasonCode } : {}),
      ...(error?.cleanup ? { cleanup: error.cleanup } : {}),
      ...(Array.isArray(error?.captureCleanupErrors) ? { captureCleanupErrors: error.captureCleanupErrors } : {}),
    }
  }
  operationDeadline?.clear()
  if (presentationId) {
    const cleanupDeadline = createDeadline(cleanupTimeoutMs)
    try {
      const origin = loopbackBaseUrl(baseUrl)
      const deleted = await requestJson(
        fetchImpl,
        endpoint(origin, `/api/presentations/${encodeURIComponent(presentationId)}/permanent`),
        withSignal({ method: 'DELETE' }, cleanupDeadline.signal)
      )
      if (deleted?.success !== true) throw coded('presentation-cleanup-unacknowledged')
    } catch (error) {
      const code = error?.code === 'presentation-cleanup-unacknowledged'
        ? error.code
        : 'presentation-cleanup-failed'
      const cleanup = { jobId, presentationId }
      result = result.ok
        ? { ...result, ok: false, error: code, cleanup }
        : { ...result, cleanupError: code, cleanup }
    } finally {
      cleanupDeadline.clear()
    }
  }
  if (!result.ok && reservedDeckDir) {
    try { await fs.remove(reservedDeckDir) } catch { result = { ...result, outputCleanupError: 'actual-output-cleanup-failed' } }
  }
  return result
}

module.exports = { cancelAndReconcileJob, capturePackageBackedActuals, extractPackageIdentity, waitForCompletedJob }
