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
const {
  drainPackageCompatibilityOutbox,
  getPackageStore,
  getReadablePackageStore,
  withPackageStore,
} = require('../services/pptx-import/package-store-runtime')

fs.ensureDirSync(TEMP_UPLOAD_DIR)
const activeTempUploads = new Set()
setImmediate(() => sweepStaleTempUploads(TEMP_UPLOAD_DIR, { activePaths: activeTempUploads }).catch(() => {}))

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

function uploadSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    if (req.pptxJobId) req.pptxJobManager?.cleanup(req.pptxJobId)
    const status = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    res.status(status).json({ error: sanitizeDiagnostic(err), type: 'parse-failed' })
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

async function isPresentationListable(presentationId) {
  if (typeof presentationId !== 'string' || !presentationId) return false
  return withPresentations((presentations) =>
    presentations.some((presentation) => presentation?.id === presentationId)
  )
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
    message: status === 'done' ? 'Import complete' : `Import ${status}`,
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
  if (signal.aborted) {
    Promise.resolve(promise).then(cleanupLate, () => {})
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
        if (settled) return
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
    else jobManager.failJob(jobId, sanitizeDiagnostic(err))
  } finally {
    clearTimeout(deadlineTimer)
    Promise.allSettled(stagePromises).then(() => Promise.allSettled(cleanupPromises)).then(async () => {
      activeTempUploads.delete(filePath)
      await fs.unlink(filePath).catch(() => {})
      jobManager.settleOperation?.(jobId)
    })
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
  packageCommit = process.env.NODE_ENV === 'test' ? null : commitImportedPackage,
  packageRollback = process.env.NODE_ENV === 'test' ? null : rollbackImportedPackage,
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

  // Job status/result routes are not bound to an in-app identity: this service
  // runs behind a trusted reverse proxy that provides any required auth (there
  // is no app-level user model). Job ids are unguessable UUIDv4 and only one
  // import runs at a time (MAX_CONCURRENT_RUNNING=1), so the practical IDOR
  // surface is minimal. If this is ever exposed to mutually-untrusted tenants,
  // bind each job to a per-job secret returned at creation and require it here.

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
      // Fire-and-forget: runImport owns its own try/catch/finally (marks the
      // job failed and unlinks the temp file). The trailing catch guards
      // against an unexpected synchronous throw escaping as an unhandled
      // rejection before runImport's internal try is entered.
      runImport({
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
        jobManager.failJob(jobId, sanitizeDiagnostic(err))
        fs.unlink(req.file.path).catch(() => {})
      })
      res.status(202).json({ jobId })
    } catch (err) {
      jobManager.cleanup(req.pptxJobId)
      await fs.unlink(req.file.path).catch(() => {})
      const status = err instanceof PptxImportError ? err.status : 500
      const type = err instanceof PptxImportError ? err.type : 'import-failed'
      res.status(status).json({ error: sanitizeDiagnostic(err), type })
    }
  })

  router.get('/jobs/:jobId', async (req, res) => {
    const job = jobManager.getJob(req.params.jobId)
    if (job) return res.json(jobManager.serializeJob(job))
    try {
      const durableJob = await readDurableJob(req.params.jobId)
      if (!durableJob) return res.status(404).json({ error: 'job-not-found' })
      let listable
      let reportSummary = durableJob.reportSummary || null
      if (durableJob.status === 'completed' && durableJob.presentationId) {
        listable = await checkPresentationListable(durableJob.presentationId)
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

  router.get('/jobs/:jobId/stream', (req, res) => {
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

  router.delete('/jobs/:jobId', async (req, res) => {
    const status = jobManager.cancelJob(req.params.jobId)
    if (status === 'unknown') {
      try {
        const durableJob = await readDurableJob(req.params.jobId)
        if (durableJob) {
          return res.status(409).json({
            error: 'job-already-finished',
            code: 'JOB_ALREADY_FINISHED',
            job: serializeDurableImportJob(durableJob),
          })
        }
      } catch (error) {
        return res.status(503).json({ error: 'durable-job-authority-unavailable', code: error.code })
      }
      return res.status(404).json({ error: 'job-not-found' })
    }
    if (status === 'conflict') return res.status(409).json({ error: 'job-already-finished' })
    res.status(204).end()
  })

  router.post('/jobs/:jobId/reconcile', async (req, res) => {
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
module.exports.getDurableImportJob = getDurableImportJob
module.exports.isPresentationListable = isPresentationListable
module.exports.isValidJobId = isValidJobId
module.exports.loadPresentationReportSummary = loadPresentationReportSummary
module.exports.reconcileDurableImportJob = reconcileDurableImportJob
module.exports.runImport = runImport
module.exports.serializeDurableImportJob = serializeDurableImportJob
module.exports.stampImportedPresentationFields = stampImportedPresentationFields
