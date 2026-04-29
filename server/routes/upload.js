const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const uuidv4 = () => require('node:crypto').randomUUID()
const { UPLOADS_DIR } = require('../services/storage')

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.mp4',
  '.webm',
  '.ogg',
  '.mov',
  '.avi',
  '.mp3',
  '.wav',
  '.flac',
  '.aac',
  '.m4a',
  '.pdf',
])

// Allowed MIME prefixes for magic-byte validation
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'application/pdf']

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuidv4()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
      return cb(new Error(`File type ${ext} not allowed`), false)
    }
    cb(null, true)
  },
})

const router = express.Router()

// POST /api/upload — with MIME magic-byte verification
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  // Verify actual file content matches claimed type via magic bytes
  try {
    const { fileTypeFromFile } = await import('file-type')
    const detected = await fileTypeFromFile(req.file.path)
    if (detected && !ALLOWED_MIME_PREFIXES.some((p) => detected.mime.startsWith(p))) {
      // Delete the uploaded file — MIME doesn't match allowed types
      await fs.unlink(req.file.path).catch(() => {})
      return res.status(400).json({ error: `File type ${detected.mime} not allowed` })
    }
  } catch {
    // file-type can't detect some formats (SVG, text) — fall back to extension check (already passed)
  }

  res.json({ url: `/uploads/${req.file.filename}` })
})

module.exports = router
