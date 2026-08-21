const express = require('express')
const fs = require('fs-extra')
const multer = require('multer')
const path = require('path')
const uuidv4 = () => require('node:crypto').randomUUID()
const { IMPORT_TIMEOUT_MS, MAX_FILE_BYTES, TEMP_UPLOAD_DIR } = require('../services/pptx-import/constants')
const { PptxImportError, sanitizeDiagnostic } = require('../services/pptx-import/diagnostics')
const { importPptxFile } = require('../services/pptx-import/importer')
const {
  persistOriginalPptx,
  deleteOriginalPptx,
} = require('../services/pptx-import/original-package')
const {
  createImportedPresentation,
  deleteImportedPresentation,
  stampImportedPresentationFields,
} = require('../services/pptx-import/create-imported-presentation')
const {
  buildBoundedImportReport,
  toReportSummary,
} = require('../services/pptx-import/import-report')
const defaultJobManager = require('../services/pptx-import-job-manager')
const { createMediaTransaction } = require('../services/pptx-import/media-dedup')
const { sweepStaleTempUploads } = require('../services/pptx-import/temp-upload-sweep')
const { withPresentations } = require('../services/storage')
const { readAuthoritativePresentation } = require('../services/package-backed-presentation-read')
const { hashCanonical } = require('../services/pptx-import/evidence/canonical-hash')
const {
  drainPackageCompatibilityOutbox,
  getPackageStore,
  getReadablePackageStore,
  withPackageStore,
} = require('../services/pptx-import/package-store-runtime')

fs.ensureDirSync(TEMP_UPLOAD_DIR)
const activeTempUploads = new Set()
setImmediate(() => sweepStaleTempUploads(TEMP_UPLOAD_DIR, { activePaths: activeTempUploads }).catch(() => {}))
const detachedImportCleanups = new Set()
const activeImportAbortControllers = new Set()

function trackDetachedImportCleanup(promise) {
  const tracked = Promise.resolve(promise)
    .catch((error) => {
      console.error('[pptx-import] detached cleanup failed:', sanitizeDiagnostic(error))
    })
    .finally(() => detachedImportCleanups.delete(tracked))
  detachedImportCleanups.add(tracked)
  return tracked
}

async function drainDetachedImportCleanups({ timeoutMs = 5000 } = {}) {
  for (const controller of activeImportAbortControllers) {
    controller.abort(new Error('Server shutdown'))
  }
  const drain = async () => {
    while (detachedImportCleanups.size > 0) {
      await Promise.allSettled([...detachedImportCleanups])
    }
  }
  if (!Number.isFinite(timeoutMs)) return drain()
  let timer
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => resolve(true), Math.max(0, timeoutMs))
    timer.unref?.()
  })
  const result = await Promise.race([drain().then(() => false), timedOut])
  clearTimeout(timer)
  if (result) {
    console.warn(`[pptx-import] cleanup drain deadline exceeded with ${detachedImportCleanups.size} operation(s)`)
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMP_UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    if (ext !== '.pptx') return cb(new Error('Only .pptx files are supported'), false)
    cb(null, true)
  },
})

/** Multipart admission bounds (idle between chunks + total wall clock). */
const UPLOAD_IDLE_MS = Number(process.env.PPTX_UPLOAD_IDLE_MS) > 0
  ? Number(process.env.PPTX_UPLOAD_IDLE_MS)
  : 30_000
const UPLOAD_TOTAL_MS = Number(process.env.PPTX_UPLOAD_TOTAL_MS) > 0
  ? Number(process.env.PPTX_UPLOAD_TOTAL_MS)
  : 120_000

function releaseAdmissionSlot(req) {
  if (req.pptxJobId && req.pptxJobManager) {
    req.pptxJobManager.cleanup(req.pptxJobId)
    req.pptxJobId = null
  }
  if (req.file?.path) {
    fs.unlink(req.file.path).catch(() => {})
    req.file = null
  }
}

function uploadSingle(req, res, next) {
  let settled = false
  let idleTimer
  let totalTimer
  const clearTimers = () => {
    if (idleTimer) clearTimeout(idleTimer)
    if (totalTimer) clearTimeout(totalTimer)
    idleTimer = null
    totalTimer = null
  }
  const failAdmission = (status, error, type = 'parse-failed') => {
    if (settled) return
    settled = true
    clearTimers()
    try {
      req.unpipe?.()
      req.destroy?.(new Error(error))
    } catch {
      // ignore stream destroy races
    }
    releaseAdmissionSlot(req)
    if (!res.headersSent) {
      res.status(status).json({ error: sanitizeDiagnostic(error), type })
    }
  }
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      failAdmission(408, 'PPTX upload idle timeout', 'upload-timeout')
    }, UPLOAD_IDLE_MS)
    idleTimer.unref?.()
  }

  totalTimer = setTimeout(() => {
    failAdmission(408, 'PPTX upload total timeout', 'upload-timeout')
  }, UPLOAD_TOTAL_MS)
  totalTimer.unref?.()
  armIdle()
  req.on('data', armIdle)
  req.on('aborted', () => failAdmission(499, 'PPTX upload aborted', 'upload-aborted'))
  req.on('close', () => {
    if (!settled && !req.complete && !req.readableEnded) {
      failAdmission(499, 'PPTX upload connection closed', 'upload-aborted')
    }
  })

  upload.single('file')(req, res, (err) => {
    if (settled) return
    settled = true
    clearTimers()
    if (!err) return next()
    releaseAdmissionSlot(req)
    const status = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    if (!res.headersSent) {
      res.status(status).json({ error: sanitizeDiagnostic(err), type: 'parse-failed' })
    }
  })
}

function isValidJobId(jobId) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)
}

async function getDurableImportJob(jobId) {
  try {
    const store = await getReadablePackageStore()
    const job = store.getJob(jobId)
    return job?.kind === 'import' ? job : null
  } catch (error) {
    if (error?.code === 'PACKAGE_STORE_UNAVAILABLE') return null
    throw error
  }
}

const DURABLE_OUTCOME_FIELDS = [
  'outcomeRevisionId',
  'outcomeGeneration',
  'outcomeHeadHash',
]
const AUTHORITY_VISIBILITY_ERRORS = new Set([
  'PRESENTATION_PACKAGE_HEAD_MISSING',
  'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
  'CANONICAL_TEXT_JOURNAL_INVALID',
  'STALE_MATRIX_AUTHORITY',
])

function durableOutcomeExpectation(job) {
  if (job?.status !== 'completed' || typeof job.presentationId !== 'string') return null
  if (!DURABLE_OUTCOME_FIELDS.every((field) => job[field] !== undefined)) return null
  return {
    revisionId: job.outcomeRevisionId,
    generation: job.outcomeGeneration,
    headHash: job.outcomeHeadHash,
  }
}

/**
 * Contract B visibility: legacy rows may be read through the compatibility
 * store, but package-backed rows require an identity-bound expected outcome.
 */
async function isPresentationListable(presentationId, expected = null) {
  if (typeof presentationId !== 'string' || !presentationId) return false
  try {
    const resolved = await readAuthoritativePresentation(presentationId)
    if (!resolved) return false
    if (resolved.generation === null) return expected == null
    if (!expected) return false
    const head = resolved.presentation?.pptxAggregateHead
    return resolved.generation === expected.generation &&
      head?.packageRevisionId === expected.revisionId &&
      hashCanonical(head) === expected.headHash
  } catch (error) {
    if (AUTHORITY_VISIBILITY_ERRORS.has(error?.code)) return false
    throw error
  }
}

/**
 * A durable receipt records no failure reason, only whether the transaction was
 * undone. That distinction is the one thing a failed import can still tell the
 * user: rolled back means nothing was persisted and a retry is safe, while any
 * other state means partial data may survive and needs checking.
 */
function durableJobMessage(job, status) {
  if (status === 'done') return 'Import complete'
  if (
    (status === 'failed' || status === 'cancelled') &&
    job.transactionState === 'rolled-back'
  ) {
    return `Import ${status}; partial import rolled back`
  }
  return `Import ${status}`
}

/**
 * Contract B: durable completed receipt is not openable until the presentation
 * row is listable (outbox drained). When listable is false, withhold
 * presentationId and surface pending-visibility.
 * Openable done includes presentationId + bounded reportSummary (never full warnings).
 */
function serializeDurableImportJob(job, { listable, reportSummary } = {}) {
  if (!job) return null
  const presentationId = typeof job.presentationId === 'string' && job.presentationId
    ? job.presentationId
    : null
  const completed = job.status === 'completed'
  if (completed && presentationId && listable === false) {
    return {
      jobId: job.id,
      status: 'pending-visibility',
      stage: 'pending-visibility',
      percent: 99,
      message: 'Import published; awaiting list visibility',
      durable: true,
      transactionState: job.transactionState,
      cancellationPoint: job.cancellationPoint,
    }
  }
  const status = completed ? 'done' : job.status
  const summary = reportSummary || toReportSummary(job.reportSummary) || job.reportSummary || null
  const result = presentationId && status === 'done'
    ? {
      presentationId,
      ...(summary ? { reportSummary: summary } : {}),
    }
    : null
  return {
    jobId: job.id,
    status,
    stage: status === 'done' ? 'complete' : status,
    percent: status === 'done' || status === 'failed' || status === 'cancelled' ? 100 : 0,
    message: durableJobMessage(job, status),
    ...(result ? { result } : {}),
    durable: true,
    transactionState: job.transactionState,
    cancellationPoint: job.cancellationPoint,
  }
}

async function loadPresentationReportSummary(presentationId) {
  if (typeof presentationId !== 'string' || !presentationId) return null
  return withPresentations((presentations) => {
    const presentation = presentations.find((item) => item?.id === presentationId)
    return toReportSummary(presentation?._pptxImportReport)
  })
}

function reconciliationReasonCode(error) {
  return typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code)
    ? error.code
    : 'PACKAGE_IMPORT_RECONCILIATION_FAILED'
}

async function reconcileDurableImportJob(job, {
  deletePresentation,
  packageRollback,
  drainCompatibility = drainPackageCompatibilityOutbox,
}) {
  const presentationId = job?.presentationId
  if (typeof presentationId !== 'string' || !presentationId) {
    return { success: true, jobId: job?.id, status: 'nothing-to-reconcile' }
  }
  const identity = { jobId: job.id, presentationId }
  try {
    if (packageRollback) {
      await packageRollback(identity)
      await drainCompatibility?.()
    }
    await deletePresentation(presentationId)
    return { success: true, status: 'reconciled', ...identity }
  } catch (error) {
    return {
      success: false,
      status: 'reconciliation-failed',
      error: 'package-import-reconciliation-failed',
      reasonCode: reconciliationReasonCode(error),
      ...identity,
      detail: sanitizeDiagnostic(error),
    }
  }
}

function withAbort(promise, signal, cleanupLateResult, trackCleanup) {
  const cleanupLate = (value) => {
    try {
      const cleanup = Promise.resolve(cleanupLateResult?.(value)).catch(() => {})
      trackCleanup?.(cleanup)
    } catch {}
  }
  const diagnoseLateRejection = (error) => {
    const diagnostic = Promise.resolve().then(() => {
      if (error?.name !== 'AbortError') {
        console.warn('[pptx-import] detached stage rejected:', sanitizeDiagnostic(error))
      }
    })
    trackCleanup?.(diagnostic)
  }
  if (signal.aborted) {
    Promise.resolve(promise).then(cleanupLate, diagnoseLateRejection)
    return Promise.reject(signal.reason || new Error('PPTX import cancelled'))
  }
  return new Promise((resolve, reject) => {
    let settled = false
    const onAbort = () => {
      if (settled) return
      settled = true
      reject(signal.reason || new Error('PPTX import cancelled'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve(promise).then(
      (value) => {
        if (settled) {
          cleanupLate(value)
          return
        }
        settled = true
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        if (settled) {
          diagnoseLateRejection(error)
          return
        }
        settled = true
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

/**
 * Production imports publish package authority before compatibility presentation
 * visibility and API-job completion. Legacy dependency injection retains the
 * original artifact path for focused route tests and legacy records.
 */
async function runImport({
  jobId,
  filePath,
  originalName,
  importer,
  jobManager,
  persistOriginal = persistOriginalPptx,
  createPresentation = createImportedPresentation,
  deletePresentation = deleteImportedPresentation,
  deleteOriginal = deleteOriginalPptx,
  packageCommit = null,
  packageRollback = null,
  drainCompatibility = null,
  /** Test/ops seam: after publish, before drain (crash/cancel injection). */
  afterPackagePublish = null,
  /** Test/ops seam: after successful drain, before media commit/completeJob. */
  afterPackageVisibility = null,
  originalBaseDir,
  timeoutMs = IMPORT_TIMEOUT_MS,
}) {
  const abortController = new AbortController()
  activeImportAbortControllers.add(abortController)
  const mediaTransaction = createMediaTransaction()
  const stagePromises = []
  const cleanupPromises = []
  const trackStage = (promise) => {
    const tracked = Promise.resolve(promise)
    stagePromises.push(tracked)
    return tracked
  }
  let deadlineExceeded = false
  const deadlineTimer = setTimeout(() => {
    deadlineExceeded = true
    abortController.abort(new Error('PPTX import deadline exceeded'))
  }, timeoutMs)
  deadlineTimer.unref?.()
  activeTempUploads.add(filePath)
  jobManager.holdOperation?.(jobId)
  jobManager.registerCancelHandler?.(jobId, () => abortController.abort())
  const finishAbortedJob = () => {
    if (deadlineExceeded) jobManager.failJob(jobId, 'PPTX import deadline exceeded')
    else jobManager.completeCancellation?.(jobId)
  }
  let originalArtifact = null
  try {
    jobManager.emitProgress(jobId, { stage: 'parsing', percent: 1, message: 'Starting PPTX import' })
    const result = await withAbort(trackStage(importer(filePath, {
      originalName,
      onProgress: (progress) => jobManager.emitProgress(jobId, progress),
      signal: abortController.signal,
      mediaTransaction,
    })), abortController.signal)
    if (abortController.signal.aborted) {
      finishAbortedJob()
      await mediaTransaction.rollback()
      return
    }

    jobManager.emitProgress(jobId, { stage: 'creating-presentation', percent: 96, message: 'Creating presentation' })
    const reportCreatedAt = new Date().toISOString()
    const importReport = buildBoundedImportReport(result.warnings, result.stats, {
      jobId,
      createdAt: reportCreatedAt,
      accumulateOmittedCount:
        result.accumulateOmittedCount ?? result.warnings?.omittedCount ?? 0,
    })
    const reportSummary = toReportSummary(importReport)
    let presentation
    if (packageCommit) {
      // Package path: outbox is the sole presentations.json writer (no direct push).
      const presentationId = uuidv4()
      try {
        jobManager.emitProgress(jobId, { stage: 'committing-package', percent: 96, message: 'Publishing package authority' })
        const compatibilityUpdatedAt = reportCreatedAt
        const stamped = stampImportedPresentationFields(result.presentation, {
          id: presentationId,
          originalName,
          createdAt: compatibilityUpdatedAt,
          updatedAt: compatibilityUpdatedAt,
          importReport,
        })
        const packageResult = await withAbort(trackStage(packageCommit(filePath, {
          jobId,
          presentationId,
          projection: stamped,
          sourceMap: result.sourceMap,
          compatibilityPresentation: stamped,
          compatibilityUpdatedAt,
          controlCapabilityHash: jobManager.getControlCapabilityHash?.(jobId) || undefined,
        })), abortController.signal, () => packageRollback?.({ jobId, presentationId }),
        (cleanup) => cleanupPromises.push(cleanup))
        if (typeof afterPackagePublish === 'function') {
          await afterPackagePublish({ jobId, presentationId, packageResult })
        }
        if (abortController.signal.aborted) {
          finishAbortedJob()
          if (packageRollback) await packageRollback({ jobId, presentationId }).catch(() => {})
          await mediaTransaction.rollback()
          return
        }
        presentation = {
          ...stamped,
          ...(packageResult?.head ? { pptxAggregateHead: packageResult.head } : {}),
        }
        jobManager.emitProgress(jobId, {
          stage: 'draining-compatibility',
          percent: 98,
          message: 'Applying compatibility projection',
        })
        if (typeof drainCompatibility === 'function') {
          await withAbort(
            trackStage(drainCompatibility()),
            abortController.signal,
            () => packageRollback?.({ jobId, presentationId }),
            (cleanup) => cleanupPromises.push(cleanup)
          )
        }
        if (typeof afterPackageVisibility === 'function') {
          await afterPackageVisibility({ jobId, presentationId })
        }
        // Post-visibility (listable after successful drain): cancel is a no-op for
        // delete. Fall through to completeJob; client must not onOpen on leave.
        // Pre-drain cancel is handled by the abort check after packageCommit and by
        // withAbort cleanup/rollback on the drain call itself.
      } catch (packageErr) {
        if (!abortController.signal.aborted) {
          if (packageRollback) await packageRollback({ jobId, presentationId }).catch(() => {})
        }
        throw packageErr
      }
    } else {
      jobManager.emitProgress(jobId, { stage: 'persisting-original', percent: 92, message: 'Saving original package' })
      const originalOptions = originalBaseDir ? { baseDir: originalBaseDir } : {}
      originalArtifact = await withAbort(
        trackStage(persistOriginal(filePath, originalOptions)),
        abortController.signal,
        (artifact) => deleteOriginal(artifact?.id, originalOptions),
        (cleanup) => cleanupPromises.push(cleanup)
      )

      if (abortController.signal.aborted) {
        finishAbortedJob()
        await deleteOriginal(originalArtifact.id, originalBaseDir ? { baseDir: originalBaseDir } : {}).catch(() => {})
        originalArtifact = null
        await mediaTransaction.rollback()
        return
      }

      try {
        presentation = await withAbort(
          trackStage(createPresentation(result.presentation, originalArtifact, {
            originalName,
            importReport,
          })),
          abortController.signal,
          (created) => deletePresentation(created?.id),
          (cleanup) => cleanupPromises.push(cleanup)
        )
      } catch (createErr) {
        if (!abortController.signal.aborted) {
          await deleteOriginal(originalArtifact.id, originalBaseDir ? { baseDir: originalBaseDir } : {}).catch(() => {})
          originalArtifact = null
        }
        throw createErr
      }
    }

    // If cancel races after create, still complete as done — presentation+original already committed.
    await mediaTransaction.commit()
    // Prefer bounded reportSummary for both in-memory and durable recovery shapes.
    jobManager.completeJob(jobId, {
      presentationId: presentation.id,
      stats: result.stats,
      reportSummary,
    })
  } catch (err) {
    const aborted = abortController.signal.aborted
    if (originalArtifact?.id) {
      const cleanup = Promise.resolve(deleteOriginal(
        originalArtifact.id,
        originalBaseDir ? { baseDir: originalBaseDir } : {}
      )).catch(() => {})
      cleanupPromises.push(cleanup)
    }
    await mediaTransaction.rollback().catch(() => {})
    if (aborted) finishAbortedJob()
    else {
      jobManager.failJob(jobId, {
        message: sanitizeDiagnostic(err),
        type: err?.type || (err instanceof PptxImportError ? err.type : undefined),
        code: typeof err?.code === 'string' ? err.code : undefined,
        stage: typeof err?.stage === 'string' ? err.stage : 'failed',
      })
    }
  } finally {
    clearTimeout(deadlineTimer)
    const cleanup = Promise.allSettled(stagePromises)
      .then(() => Promise.allSettled(cleanupPromises))
      .then(async () => {
        activeImportAbortControllers.delete(abortController)
        activeTempUploads.delete(filePath)
        await fs.unlink(filePath).catch(() => {})
        jobManager.settleOperation?.(jobId)
      })
    trackDetachedImportCleanup(cleanup)
  }
}

async function commitImportedPackage(source, input) {
  const prepared = await getPackageStore().prepareImport(source, input)
  return withPackageStore((store) => store.publishImport(prepared))
}

async function rollbackImportedPackage(input) {
  return withPackageStore((store) => store.rollbackImport(input))
}

function createPptxImportRouter({
  importer = importPptxFile,
  jobManager = defaultJobManager,
  persistOriginal = persistOriginalPptx,
  createPresentation = createImportedPresentation,
  deletePresentation = deleteImportedPresentation,
  deleteOriginal = deleteOriginalPptx,
  packageCommit = commitImportedPackage,
  packageRollback = rollbackImportedPackage,
  drainCompatibility = drainPackageCompatibilityOutbox,
  readDurableJob = getDurableImportJob,
  checkPresentationListable = isPresentationListable,
  loadReportSummary = loadPresentationReportSummary,
  originalBaseDir,
  importTimeoutMs = IMPORT_TIMEOUT_MS,
} = {}) {
  const router = express.Router()

  router.param('jobId', (req, res, next, jobId) => {
    if (!isValidJobId(jobId)) return res.status(400).json({ error: 'Invalid jobId' })
    next()
  })

  // Per-job control capability: POST /import returns a one-time capability secret.
  // Sensitive job routes require header X-Pptx-Job-Capability; UUID secrecy alone is
  // not authorization for Map or durable jobs.
  //
  // This process never logs or persists the secret, but EventSource cannot set
  // headers, so the stream route carries it in the query string and a reverse proxy
  // will record it in access logs by default. The disclosure is bounded: a capability
  // only reads, cancels, or reconciles one import job that expires in minutes, which
  // is less than the unauthenticated presentations API on the same origin allows.

  const CAPABILITY_HEADER = 'x-pptx-job-capability'

  function readProvidedCapability(req, { allowQuery = false } = {}) {
    const header = req.get?.('X-Pptx-Job-Capability') || req.headers?.[CAPABILITY_HEADER]
    if (typeof header === 'string' && header) return header
    // EventSource cannot set custom headers; query is SSE-only.
    if (!allowQuery) return null
    const query = req.query?.capability
    return typeof query === 'string' && query ? query : null
  }

  function denyCapability(res) {
    return res.status(401).json({
      error: 'job-capability-required',
      code: 'JOB_CAPABILITY_REQUIRED',
    })
  }

  function assertJobCapability(req, res, next) {
    const jobId = req.params.jobId
    const isStream = String(req.path || '').endsWith('/stream') || req.route?.path === '/jobs/:jobId/stream'
    const provided = readProvidedCapability(req, { allowQuery: isStream })
    const live = jobManager.getJob?.(jobId)
    if (live) {
      const verify = jobManager.verifyControlCapability || defaultJobManager.verifyControlCapability
      if (!verify(live, provided)) return denyCapability(res)
      return next()
    }
    // Durable path: load is async — attach provided for handlers and re-check there.
    req.pptxJobCapability = provided
    return next()
  }

  async function assertDurableCapability(durableJob, provided, res) {
    // Fail closed. A receipt with no hash predates capability enforcement, and
    // treating that as "allow" let anyone holding a job UUID read, cancel, or
    // reconcile it. The cost is that such a receipt is no longer reachable —
    // acceptable, because it describes an import that already finished and whose
    // presentation is served by the presentations API regardless.
    if (!durableJob?.controlCapabilityHash) {
      denyCapability(res)
      return false
    }
    const verify = jobManager.verifyControlCapability || defaultJobManager.verifyControlCapability
    if (verify(durableJob.controlCapabilityHash, provided)) return true
    denyCapability(res)
    return false
  }

  function reserveImportJob(req, res, next) {
    try {
      const jobId = jobManager.createJob()
      req.pptxJobId = jobId
      req.pptxJobManager = jobManager
      next()
    } catch (err) {
      if (err?.code === 'import-in-progress') {
        res.set('Retry-After', '60')
        return res.status(429).json({ error: 'import-in-progress' })
      }
      res.status(500).json({ error: sanitizeDiagnostic(err), type: 'import-failed' })
    }
  }

  router.post('/import', reserveImportJob, uploadSingle, async (req, res) => {
    if (!req.file) {
      jobManager.cleanup(req.pptxJobId)
      return res.status(400).json({ error: 'No PPTX file uploaded', type: 'parse-failed' })
    }

    try {
      const jobId = req.pptxJobId
      const capability =
        jobManager.takeJobCapability?.(jobId) || defaultJobManager.takeJobCapability?.(jobId) || null
      // Track the detached operation so shutdown and tests can wait for both
      // its terminal state and any late stage cleanup it registers.
      trackDetachedImportCleanup(runImport({
        jobId,
        filePath: req.file.path,
        originalName: req.file.originalname,
        importer,
        jobManager,
        persistOriginal,
        createPresentation,
        deletePresentation,
        deleteOriginal,
        packageCommit,
        packageRollback,
        drainCompatibility,
        originalBaseDir,
        timeoutMs: importTimeoutMs,
      }).catch((err) => {
        jobManager.failJob(jobId, {
          message: sanitizeDiagnostic(err),
          type: err?.type,
          code: typeof err?.code === 'string' ? err.code : undefined,
          stage: 'failed',
        })
        return fs.unlink(req.file.path).catch(() => {})
      }))
      res.status(202).json({
        jobId,
        ...(capability ? { capability } : {}),
      })
    } catch (err) {
      jobManager.cleanup(req.pptxJobId)
      await fs.unlink(req.file.path).catch(() => {})
      const status = err instanceof PptxImportError ? err.status : 500
      const type = err instanceof PptxImportError ? err.type : 'import-failed'
      res.status(status).json({ error: sanitizeDiagnostic(err), type })
    }
  })

  router.get('/jobs/:jobId', assertJobCapability, async (req, res) => {
    const job = jobManager.getJob(req.params.jobId)
    // Map `done` is only set after package drain or legacy create (already listable).
    // Contract B re-check applies to durable fallback below (restart / Map miss).
    if (job) return res.json(jobManager.serializeJob(job))
    try {
      const durableJob = await readDurableJob(req.params.jobId)
      if (!durableJob) return res.status(404).json({ error: 'job-not-found' })
      if (!(await assertDurableCapability(durableJob, req.pptxJobCapability, res))) return
      let listable
      let reportSummary = durableJob.reportSummary || null
      if (durableJob.status === 'completed' && durableJob.presentationId) {
        const expected = durableOutcomeExpectation(durableJob)
        listable = expected
          ? await checkPresentationListable(durableJob.presentationId, expected)
          : false
        if (listable && !reportSummary) {
          try {
            reportSummary = await loadReportSummary(durableJob.presentationId)
          } catch {
            // Report is best-effort; openable presentationId still returns.
            reportSummary = null
          }
        }
      }
      return res.json(serializeDurableImportJob(durableJob, { listable, reportSummary }))
    } catch (error) {
      return res.status(503).json({ error: 'durable-job-authority-unavailable', code: error.code })
    }
  })

  router.get('/jobs/:jobId/stream', assertJobCapability, (req, res) => {
    const job = jobManager.getJob(req.params.jobId)
    if (!job) return res.status(404).json({ error: 'job-not-found' })
    res.set({
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders?.()
    jobManager.attachSseClient(req.params.jobId, res)
    req.on('close', () => jobManager.detachSseClient(req.params.jobId, res))
  })

  router.delete('/jobs/:jobId', assertJobCapability, async (req, res) => {
    const status = jobManager.cancelJob(req.params.jobId)
    if (status === 'unknown') {
      try {
        const durableJob = await readDurableJob(req.params.jobId)
        if (durableJob) {
          if (!(await assertDurableCapability(durableJob, req.pptxJobCapability, res))) return
          let listable
          let reportSummary = durableJob.reportSummary || null
          if (durableJob.status === 'completed' && durableJob.presentationId) {
            const expected = durableOutcomeExpectation(durableJob)
            listable = expected
              ? await checkPresentationListable(durableJob.presentationId, expected)
              : false
            if (listable && !reportSummary) {
              try {
                reportSummary = await loadReportSummary(durableJob.presentationId)
              } catch {
                reportSummary = null
              }
            }
          }
          const serialized = serializeDurableImportJob(durableJob, { listable, reportSummary })
          return res.status(409).json({
            error: 'job-too-late',
            code: 'JOB_CANCEL_TOO_LATE',
            status: serialized?.status || 'done',
            job: serialized,
          })
        }
      } catch (error) {
        return res.status(503).json({ error: 'durable-job-authority-unavailable', code: error.code })
      }
      return res.status(404).json({ error: 'job-not-found' })
    }
    if (status === 'conflict') {
      const current = jobManager.getJob?.(req.params.jobId)
      if (current?.status === 'cancelling') {
        return res.status(409).json({
          error: 'job-cancellation-in-progress',
          code: 'JOB_CANCEL_IN_PROGRESS',
          status: current.status,
        })
      }
      if (current?.status === 'done' || current?.result?.presentationId) {
        return res.status(409).json({
          error: 'job-too-late',
          code: 'JOB_CANCEL_TOO_LATE',
          status: 'done',
          job: jobManager.serializeJob?.(current),
        })
      }
      return res.status(409).json({
        error: 'job-already-finished',
        code: 'JOB_ALREADY_FINISHED',
        status: current?.status,
      })
    }
    res.status(204).end()
  })

  router.post('/jobs/:jobId/reconcile', assertJobCapability, async (req, res) => {
    const jobId = req.params.jobId
    const current = jobManager.getJob(jobId)
    if (current && !current.terminalState) {
      return res.status(409).json({ error: 'job-not-terminal', code: 'JOB_NOT_TERMINAL' })
    }
    let durableJob
    try {
      durableJob = await readDurableJob(jobId)
    } catch (error) {
      return res.status(503).json({ error: 'durable-job-authority-unavailable', code: error.code })
    }
    if (durableJob && ['queued', 'running'].includes(durableJob.status)) {
      return res.status(409).json({ error: 'job-not-terminal', code: 'JOB_NOT_TERMINAL' })
    }
    if (durableJob && !(await assertDurableCapability(durableJob, req.pptxJobCapability, res))) return
    const job = durableJob || (current?.status === 'done'
      ? { id: jobId, status: 'completed', presentationId: current.result?.presentationId }
      : null)
    if (!job) return res.status(404).json({ error: 'job-not-found' })
    const result = await reconcileDurableImportJob(job, {
      deletePresentation,
      packageRollback,
      drainCompatibility,
    })
    res.status(result.success ? 200 : 409).json(result)
  })

  return router
}

module.exports = createPptxImportRouter()
module.exports.createPptxImportRouter = createPptxImportRouter
module.exports.drainDetachedImportCleanups = drainDetachedImportCleanups
module.exports.getDurableImportJob = getDurableImportJob
module.exports.isPresentationListable = isPresentationListable
module.exports.isValidJobId = isValidJobId
module.exports.loadPresentationReportSummary = loadPresentationReportSummary
module.exports.reconcileDurableImportJob = reconcileDurableImportJob
module.exports.runImport = runImport
module.exports.serializeDurableImportJob = serializeDurableImportJob
module.exports.stampImportedPresentationFields = stampImportedPresentationFields
