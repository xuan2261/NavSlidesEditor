const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const crypto = require('crypto')
const uuidv4 = () => require('node:crypto').randomUUID()
const { DATA_DIR, UPLOADS_DIR, withFileLock } = require('../services/storage')

const HASHES_FILE = path.join(DATA_DIR, 'upload-hashes.json')

async function loadHashes() {
  try {
    const data = await fs.readFile(HASHES_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

async function saveHashes(hashes) {
  await fs.mkdir(path.dirname(HASHES_FILE), { recursive: true })
  await fs.writeFile(HASHES_FILE, JSON.stringify(hashes, null, 2))
}

async function withUploadHashes(fn) {
  return withFileLock(HASHES_FILE, async () => {
    const hashes = await loadHashes()
    const result = await fn(hashes)
    await saveHashes(hashes)
    return result
  })
}

async function computeFileHash(filePath) {
  const buffer = await fs.readFile(filePath)
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

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
  '.ogv',
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

  // SHA-256 deduplication
  const presentationId = req.body.presentationId || 'global'
  const fileHash = await computeFileHash(req.file.path)
  const result = await withUploadHashes(async (hashes) => {
    const presHashes = hashes[presentationId] || {}

    if (presHashes[fileHash]) {
      const existingFilename = presHashes[fileHash].filename
      const existingPath = path.join(UPLOADS_DIR, existingFilename)
      try {
        await fs.access(existingPath)
        await fs.unlink(req.file.path).catch(() => {})
        return { url: `/uploads/${existingFilename}`, deduped: true }
      } catch {
        // Existing file was deleted — fall through to store new file
        delete presHashes[fileHash]
      }
    }

    const stats = await fs.stat(req.file.path)
    presHashes[fileHash] = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: stats.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
    }
    hashes[presentationId] = presHashes
    return { url: `/uploads/${req.file.filename}`, deduped: false }
  })

  res.json(result)
})

module.exports = router
