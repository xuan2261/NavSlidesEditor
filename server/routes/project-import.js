const express = require('express')
const multer = require('multer')
const path = require('node:path')
const fs = require('fs-extra')
const crypto = require('node:crypto')
const { DATA_DIR } = require('../services/storage')
const { validateProjectArchive } = require('../services/project-import-archive')
const { validateProjectJson } = require('../services/project-import-archive-json')
const sessions = require('../services/project-import-media-session')
const { privateEditorOnly } = require('./project-import-origin')

const incomingDir = path.join(DATA_DIR, 'project-import-incoming')
const stagingRoot = path.join(DATA_DIR, 'project-import-staging')
const upload = multer({
  dest: incomingDir,
  limits: { files: 1, fileSize: 100 * 1024 * 1024, fields: 2 },
})
const router = express.Router()

router.use(privateEditorOnly)
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

function capability(req) {
  return req.get('X-NavSlides-Import-Capability') || ''
}

function acknowledged(value) {
  return value === true || value === 'true'
}

function sendError(res, error) {
  res.status(error.status || 500).json({
    error: error.message,
    code: error.code || 'PROJECT_IMPORT_FAILED',
    ...(error.activeContent ? { activeContent: error.activeContent } : {}),
  })
}

function receiveArchive(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next()
    const tooLarge = error.code === 'LIMIT_FILE_SIZE'
    res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'Project archive is too large' : 'Project upload is invalid',
      code: tooLarge ? 'PROJECT_ARCHIVE_COMPRESSED_LIMIT' : 'PROJECT_UPLOAD_INVALID',
    })
  })
}

router.post('/preflight', receiveArchive, async (req, res) => {
  const stagingDir = path.join(stagingRoot, crypto.randomUUID())
  try {
    if (!req.file) return res.status(400).json({ error: 'Project file is required' })
    const options = {
      stagingDir,
      trustedAuthorActiveContentAcknowledged:
        acknowledged(req.body?.trustedAuthorActiveContentAcknowledged),
    }
    const isJson = /\.json$/iu.test(req.file.originalname)
    const validated = isJson
      ? await validateProjectJson(req.file.path, options)
      : await validateProjectArchive(req.file.path, options)
    const admitted = await sessions.createProjectImportSession(validated)
    res.status(201).json(admitted)
  } catch (error) {
    await fs.remove(stagingDir).catch(() => {})
    sendError(res, error)
  } finally {
    if (req.file?.path) await fs.remove(req.file.path).catch(() => {})
  }
})

router.post('/:sessionId/media', async (req, res) => {
  try {
    res.json(await sessions.stageProjectImportMedia({
      sessionId: req.params.sessionId,
      capability: capability(req),
    }))
  } catch (error) {
    sendError(res, error)
  }
})

router.post('/:sessionId/publish', async (req, res) => {
  try {
    const receipt = await sessions.publishProjectImport({
      sessionId: req.params.sessionId,
      capability: capability(req),
      trustedAuthorActiveContentAcknowledged:
        req.body?.trustedAuthorActiveContentAcknowledged === true,
    })
    res.status(201).json(receipt)
  } catch (error) {
    sendError(res, error)
  }
})

router.delete('/:sessionId', async (req, res) => {
  try {
    res.json(await sessions.rollbackProjectImport({
      sessionId: req.params.sessionId,
      capability: capability(req),
    }))
  } catch (error) {
    sendError(res, error)
  }
})

module.exports = router
