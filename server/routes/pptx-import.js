const express = require('express')
const fs = require('fs-extra')
const multer = require('multer')
const path = require('path')
const uuidv4 = () => require('node:crypto').randomUUID()
const { MAX_FILE_BYTES, TEMP_UPLOAD_DIR } = require('../services/pptx-import/constants')
const { PptxImportError, sanitizeDiagnostic } = require('../services/pptx-import/diagnostics')
const { importPptxFile } = require('../services/pptx-import/importer')

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
    const status = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    res.status(status).json({ error: sanitizeDiagnostic(err), type: 'parse-failed' })
  })
}

function createPptxImportRouter({ importer = importPptxFile } = {}) {
  const router = express.Router()

  router.post('/import', uploadSingle, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No PPTX file uploaded', type: 'parse-failed' })

    try {
      const result = await importer(req.file.path, {
        originalName: req.file.originalname,
      })
      res.json(result)
    } catch (err) {
      const status = err instanceof PptxImportError ? err.status : 500
      const type = err instanceof PptxImportError ? err.type : 'parse-failed'
      res.status(status).json({ error: sanitizeDiagnostic(err), type })
    } finally {
      await fs.unlink(req.file.path).catch(() => {})
    }
  })

  return router
}

module.exports = createPptxImportRouter()
module.exports.createPptxImportRouter = createPptxImportRouter
