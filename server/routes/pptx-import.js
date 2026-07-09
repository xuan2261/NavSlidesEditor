const express = require('express')
const fs = require('fs-extra')
const multer = require('multer')
const path = require('path')
const uuidv4 = () => require('node:crypto').randomUUID()
const { MAX_FILE_BYTES, TEMP_UPLOAD_DIR } = require('../services/pptx-import/constants')
const { PptxImportError, sanitizeDiagnostic } = require('../services/pptx-import/diagnostics')
const { importPptxFile } = require('../services/pptx-import/importer')
const {
  persistOriginalPptx,
  deleteOriginalPptx,
} = require('../services/pptx-import/original-package')
const { createImportedPresentation } = require('../services/pptx-import/create-imported-presentation')
const defaultJobManager = require('../services/pptx-import-job-manager')

fs.ensureDirSync(TEMP_UPLOAD_DIR)

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

/**
 * Atomic import: map → persist original → create presentation server-side.
 * On create failure, original is rolled back. Cancel leaves no original.
 */
async function runImport({
  jobId,
  filePath,
  originalName,
  importer,
  jobManager,
  persistOriginal = persistOriginalPptx,
  createPresentation = createImportedPresentation,
  deleteOriginal = deleteOriginalPptx,
  originalBaseDir,
}) {
  const abortController = new AbortController()
  jobManager.registerCancelHandler?.(jobId, () => abortController.abort())
  let originalArtifact = null
  try {
    jobManager.emitProgress(jobId, { stage: 'parsing', percent: 1, message: 'Starting PPTX import' })
    const result = await importer(filePath, {
      originalName,
      onProgress: (progress) => jobManager.emitProgress(jobId, progress),
      signal: abortController.signal,
    })
    if (abortController.signal.aborted) {
      jobManager.completeCancellation?.(jobId)
      return
    }

    jobManager.emitProgress(jobId, { stage: 'persisting-original', percent: 92, message: 'Saving original package' })
    originalArtifact = await persistOriginal(filePath, originalBaseDir ? { baseDir: originalBaseDir } : {})

    if (abortController.signal.aborted) {
      await deleteOriginal(originalArtifact.id, originalBaseDir ? { baseDir: originalBaseDir } : {}).catch(() => {})
      originalArtifact = null
      jobManager.completeCancellation?.(jobId)
      return
    }

    jobManager.emitProgress(jobId, { stage: 'creating-presentation', percent: 96, message: 'Creating presentation' })
    let presentation
    try {
      presentation = await createPresentation(result.presentation, originalArtifact, { originalName })
    } catch (createErr) {
      await deleteOriginal(originalArtifact.id, originalBaseDir ? { baseDir: originalBaseDir } : {}).catch(() => {})
      originalArtifact = null
      throw createErr
    }

    // If cancel races after create, still complete as done — presentation+original already committed.
    jobManager.completeJob(jobId, {
      presentationId: presentation.id,
      stats: result.stats,
      warnings: result.warnings || [],
      // Keep presentation payload for transitional clients; prefer presentationId.
      presentation: result.presentation,
    })
  } catch (err) {
    if (originalArtifact?.id) {
      await deleteOriginal(originalArtifact.id, originalBaseDir ? { baseDir: originalBaseDir } : {}).catch(() => {})
    }
    if (abortController.signal.aborted) jobManager.completeCancellation?.(jobId)
    else jobManager.failJob(jobId, sanitizeDiagnostic(err))
  } finally {
    await fs.unlink(filePath).catch(() => {})
  }
}

function createPptxImportRouter({
  importer = importPptxFile,
  jobManager = defaultJobManager,
  persistOriginal = persistOriginalPptx,
  createPresentation = createImportedPresentation,
  deleteOriginal = deleteOriginalPptx,
  originalBaseDir,
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
        deleteOriginal,
        originalBaseDir,
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

  router.get('/jobs/:jobId', (req, res) => {
    const job = jobManager.getJob(req.params.jobId)
    if (!job) return res.status(404).json({ error: 'job-not-found' })
    res.json(jobManager.serializeJob(job))
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

  router.delete('/jobs/:jobId', (req, res) => {
    const status = jobManager.cancelJob(req.params.jobId)
    if (status === 'unknown') return res.status(404).json({ error: 'job-not-found' })
    if (status === 'conflict') return res.status(409).json({ error: 'job-already-finished' })
    res.status(204).end()
  })

  return router
}

module.exports = createPptxImportRouter()
module.exports.createPptxImportRouter = createPptxImportRouter
module.exports.isValidJobId = isValidJobId
module.exports.runImport = runImport
