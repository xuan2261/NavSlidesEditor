const express = require('express')
const uuidv4 = () => require('node:crypto').randomUUID()
const {
  generateRevealHTML,
  getDesignTokensForRevealTheme,
  normalizePresentationNotes,
} = require('revealjs-shared')
const {
  readPresentations,
  withPresentations,
  withTemplates,
  withShareTokens,
  withUploadHashes,
  DATA_DIR,
  HISTORY_DIR,
  UPLOADS_DIR,
} = require('../services/storage')
const fs = require('fs-extra')
const path = require('path')
const { validate } = require('../middleware/validate')
const {
  createPresentationSchema,
  updatePresentationSchema,
  saveAsTemplateSchema,
} = require('../middleware/schemas')
const { rasterizeComplexElements } = require('../services/pptx-exporter')
const { normalizePptxImportedPresentationForRead } = require('../services/presentation-normalization')
const { findServeablePresentation } = require('../services/presentation-finder')
const { normalizeBuiltInTemplates } = require('../services/template-normalization')
const {
  deleteOriginalPptx,
  readOriginalPptx,
  assertSafeOriginalId,
} = require('../services/pptx-import/original-package')
const { stripClientPptxOriginalPaths } = require('../services/pptx-import/create-imported-presentation')

const router = express.Router()
const UPLOAD_HASHES_FILE = path.join(DATA_DIR, 'upload-hashes.json')

async function unlinkPresentationOriginal(presentation) {
  const originalId = presentation?.pptxOriginal?.id
  if (!originalId) return
  await deleteOriginalPptx(originalId).catch(() => {})
}

function getUploadMimeType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const mimeMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp', '.ico': 'image/x-icon',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg',
    '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.flac': 'audio/flac', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
    '.pdf': 'application/pdf',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

function getUploadFilenameFromUrl(value) {
  if (!value || typeof value !== 'string') return null
  const match = value.match(/\/uploads\/([^?#]+)/)
  if (!match) return null
  return path.basename(decodeURIComponent(match[1]))
}

function collectPresentationUploadRefs(presentation) {
  const refs = new Set()
  for (const slide of presentation?.slides || []) {
    for (const element of slide.elements || []) {
      ;[element.src, element.videoUrl, element.poster].forEach((value) => {
        const filename = getUploadFilenameFromUrl(value)
        if (filename) refs.add(filename)
      })
    }
  }
  return refs
}

async function readUploadHashes() {
  try {
    return await fs.readJson(UPLOAD_HASHES_FILE)
  } catch {
    return {}
  }
}

// GET /api/presentations - list summaries (excludes trashed)
router.get('/', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const active = presentations.filter((p) => !p.deletedAt)
    const summaries = active.map((p) => ({
      id: p.id,
      title: p.title,
      theme: p.theme,
      transition: p.transition,
      slideCount: (p.slides || []).length,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      thumbnail: p.slides && p.slides[0] ? p.slides[0].background : null,
    }))
    res.json(summaries)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations - create new (optionally from template)
router.post('/', validate(createPresentationSchema), async (req, res) => {
  try {
    // RT-04: never accept client-supplied pptxOriginal path bindings
    const safeBody = stripClientPptxOriginalPaths(req.body) || {}
    const {
      title,
      theme,
      transition,
      templateId,
      slides: providedSlides,
      ...extraFields
    } = safeBody
    // Defense in depth: strip again from passthrough extras
    delete extraFields.pptxOriginal
    const now = new Date().toISOString()
    const { readTemplates } = require('../services/storage')
    let presentation

    if (providedSlides && Array.isArray(providedSlides)) {
      const resolvedTheme = theme || extraFields.theme || 'black'
      const designTokens = extraFields.designTokens || getDesignTokensForRevealTheme(resolvedTheme)
      presentation = normalizePresentationNotes({
        ...extraFields,
        id: uuidv4(),
        title: title || 'Untitled Presentation',
        theme: resolvedTheme,
        transition: transition || extraFields.transition || 'slide',
        designTokens,
        slides: providedSlides.map((s) => ({
          ...s,
          id: s.id || uuidv4(),
          elements: (s.elements || []).map((el) => ({ ...el, id: el.id || uuidv4() })),
        })),
        createdAt: now,
        updatedAt: now,
      })
      delete presentation.isTemplate
      delete presentation.description
      delete presentation.thumbnail
      delete presentation.pptxOriginal
    } else if (templateId) {
      const templates = await readTemplates()
      let template = templates.find((t) => t.id === templateId)
      if (!template) {
        try {
          const builtIn = await fs.readJson(
            path.join(__dirname, '..', 'data', 'built-in-templates.json')
          )
          template = normalizeBuiltInTemplates(builtIn).find((t) => t.id === templateId)
          // eslint-disable-next-line unused-imports/no-unused-vars
        } catch (e) {}
      }
      if (template) {
        const cloned = JSON.parse(JSON.stringify(template))
        presentation = normalizePresentationNotes({
          ...cloned,
          id: uuidv4(),
          title: title || cloned.title || 'Untitled Presentation',
          createdAt: now,
          updatedAt: now,
          slides: (cloned.slides || []).map((s) => ({
            ...s,
            id: uuidv4(),
            elements: (s.elements || []).map((el) => ({ ...el, id: uuidv4() })),
          })),
        })
        delete presentation.isTemplate
      }
    }

    if (!presentation) {
      const designTokens = extraFields.designTokens || getDesignTokensForRevealTheme(theme || 'black')
      presentation = normalizePresentationNotes({
        id: uuidv4(),
        title: title || 'Untitled Presentation',
        theme: theme || 'black',
        transition: transition || 'slide',
        designTokens,
        slides: [
          {
            id: uuidv4(),
            elements: [
              {
                id: uuidv4(),
                type: 'text',
                x: 80,
                y: 160,
                width: 800,
                height: 220,
                zIndex: 1,
                textColor: 'auto',
                fontFamily: 'var(--ns-font-heading)',
                content:
                  '<h2 style="text-align: center">Welcome to your presentation</h2><p style="text-align: center">Double-click to start editing</p>',
              },
            ],
            notes: '',
            background: { type: 'none' },
          },
        ],
        createdAt: now,
        updatedAt: now,
        presenterTools: extraFields.presenterTools || {
          themeToggle: true,
          fontZoom: true,
          slideMenu: false,
          chalkboard: false,
        },
      })
    }

    delete presentation.pptxOriginal

    const result = await withPresentations((presentations) => {
      presentations.push(presentation)
      return presentation
    })
    res.status(201).json(normalizePresentationNotes(result))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
// GET /api/presentations/trash/list — list trashed presentations
router.get('/trash/list', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const trashed = presentations
      .filter((p) => p.deletedAt)
      .map((p) => ({
        id: p.id,
        title: p.title,
        slideCount: (p.slides || []).length,
        deletedAt: p.deletedAt,
        updatedAt: p.updatedAt,
        thumbnail: p.slides && p.slides[0] ? p.slides[0].background : null,
      }))
    res.json(trashed)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function getLocalBaseUrl(req) {
  const localPort = req.socket?.localPort || process.env.PORT
  const host = req.get('host')
  if (localPort) return `http://127.0.0.1:${localPort}`
  return host ? `${req.protocol || 'http'}://${host}` : ''
}

// POST /api/presentations/raster-elements
// Caps the payload so a malicious/huge deck can't exhaust memory or pin the
// rasterizer (each slide spins up headless rendering work).
const MAX_RASTER_SLIDES = 500
const MAX_RASTER_ELEMENTS = 5000

router.post('/raster-elements', async (req, res) => {
  try {
    const presentation = req.body?.presentation
    if (!presentation || !Array.isArray(presentation.slides)) {
      return res.status(400).json({ error: 'Invalid presentation payload' })
    }
    if (presentation.slides.length > MAX_RASTER_SLIDES) {
      return res.status(413).json({ error: 'Too many slides to rasterize' })
    }
    const elementCount = presentation.slides.reduce(
      (sum, s) => sum + (Array.isArray(s?.elements) ? s.elements.length : 0),
      0
    )
    if (elementCount > MAX_RASTER_ELEMENTS) {
      return res.status(413).json({ error: 'Too many elements to rasterize' })
    }

    const rasters = await rasterizeComplexElements(presentation, { baseUrl: getLocalBaseUrl(req) })
    res.json({ rasters })
  } catch (err) {
    console.error('PPTX element rasterization failed:', err)
    res.status(500).json({ error: 'PPTX element rasterization failed' })
  }
})

// GET /api/presentations/:id/pptx-original — stream stored original bytes (server maps id→uuid only)
// Phase 08c: uses roundtrip policy (hash check; hybrid fallback not generated here).
router.get('/:id/pptx-original', async (req, res) => {
  try {
    const presentation = await findServeablePresentation(req.params.id, { normalize: false })
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    const { resolvePptxExportPayload } = require('../services/pptx-import/roundtrip-original-parts')
    const payload = await resolvePptxExportPayload(presentation, {
      forceHybrid: req.query.forceHybrid === '1',
    })
    if (payload.mode !== 'original-bytes' || !payload.buffer) {
      return res.status(404).json({
        error: 'No original PPTX package available for zero-loss export',
        reason: payload.reason,
        mode: payload.mode,
      })
    }
    const safeTitle = String(presentation.title || 'presentation').replace(/[^a-z0-9._-]+/gi, '_')
    res.setHeader('Content-Type', payload.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pptx"`)
    res.setHeader('Content-Length', String(payload.byteLength))
    res.setHeader('X-Pptx-Export-Mode', payload.mode)
    if (payload.sha256) res.setHeader('X-Pptx-Original-Sha256', payload.sha256)
    res.send(payload.buffer)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id
router.get('/:id', async (req, res) => {
  try {
    const presentation = await findServeablePresentation(req.params.id)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    res.json(normalizePresentationNotes(presentation))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/presentations/:id
router.put('/:id', validate(updatePresentationSchema), async (req, res) => {
  try {
    // RT-04: client cannot inject/rebind pptxOriginal (paths or id steal)
    const safeBody = { ...req.body }
    delete safeBody.pptxOriginal
    const result = await withPresentations((presentations) => {
      const index = presentations.findIndex((p) => p.id === req.params.id)
      if (index === -1) return null
      const previous = presentations[index]
      // Phase 08c: user edits invalidate original-bytes re-export preference
      const contentEdited =
        Boolean(previous.pptxOriginal) &&
        (safeBody.slides !== undefined ||
          safeBody.title !== undefined ||
          safeBody.theme !== undefined ||
          safeBody.transition !== undefined)
      presentations[index] = normalizePresentationNotes({
        ...previous,
        ...safeBody,
        id: req.params.id,
        // Preserve server-owned original package metadata
        pptxOriginal: previous.pptxOriginal,
        ...(contentEdited
          ? { _pptxEdited: true, _pptxEditedAt: new Date().toISOString() }
          : {}),
        updatedAt: new Date().toISOString(),
      })
      return presentations[index]
    })
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json(normalizePresentationNotes(result))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/presentations/:id — soft delete (move to trash)
// Keeps original.pptx for restore (lifecycle = presentation lifetime including trash).
router.delete('/:id', async (req, res) => {
  try {
    const presId = req.params.id
    const result = await withPresentations((presentations) => {
      const pres = presentations.find((p) => p.id === presId)
      if (!pres) return null
      pres.deletedAt = new Date().toISOString()
      return true
    })
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/restore — restore from trash
router.post('/:id/restore', async (req, res) => {
  try {
    const presId = req.params.id
    const result = await withPresentations((presentations) => {
      const pres = presentations.find((p) => p.id === presId)
      if (!pres || !pres.deletedAt) return null
      delete pres.deletedAt
      pres.updatedAt = new Date().toISOString()
      return pres
    })
    if (!result) return res.status(404).json({ error: 'Not found or not in trash' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/presentations/:id/permanent — permanently delete
router.delete('/:id/permanent', async (req, res) => {
  try {
    const presId = req.params.id
    const removed = await withPresentations((presentations) => {
      const index = presentations.findIndex((p) => p.id === presId)
      if (index === -1) return null
      const [pres] = presentations.splice(index, 1)
      return pres
    })
    if (!removed) return res.status(404).json({ error: 'Not found' })

    // Cascade: remove original.pptx package (zero-loss lifecycle ends with presentation)
    await unlinkPresentationOriginal(removed)

    // Cascade: remove share tokens
    try {
      await withShareTokens((tokens) => {
        for (const [token, tokenData] of Object.entries(tokens)) {
          const presentationId =
            typeof tokenData === 'string' ? tokenData : tokenData?.presentationId
          if (presentationId === presId) {
            delete tokens[token]
          }
        }
      })
    } catch {}

    // Cascade: remove history snapshots
    try {
      const presHistDir = path.join(HISTORY_DIR, presId)
      if (fs.existsSync(presHistDir)) fs.removeSync(presHistDir)
    } catch {}

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/duplicate
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { persistOriginalPptx, readOriginalPptx } = require('../services/pptx-import/original-package')
    const result = await withPresentations(async (presentations) => {
      const original = presentations.find((p) => p.id === req.params.id)
      if (!original || original.deletedAt) return null
      const now = new Date().toISOString()
      const copy = JSON.parse(JSON.stringify(normalizePptxImportedPresentationForRead(original)))
      copy.id = uuidv4()
      copy.title = (copy.title || 'Untitled') + ' (copy)'
      copy.createdAt = now
      copy.updatedAt = now
      // H1: never share pptxOriginal.id across decks (permanent delete would unlink sibling).
      // Copy-on-write: new uuid file when bytes exist; strip binding if source package missing.
      if (copy.pptxOriginal?.id) {
        try {
          const bytes = await readOriginalPptx(copy.pptxOriginal.id)
          if (bytes) {
            const artifact = await persistOriginalPptx(bytes)
            copy.pptxOriginal = {
              id: artifact.id,
              sha256: artifact.sha256,
              byteLength: artifact.byteLength,
              uploadedAt: artifact.uploadedAt,
            }
          } else {
            delete copy.pptxOriginal
          }
        } catch {
          delete copy.pptxOriginal
        }
      }
      const normalizedCopy = normalizePresentationNotes(copy)
      presentations.push(normalizedCopy)
      return normalizedCopy
    })
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id/export
router.get('/:id/export', async (req, res) => {
  try {
    const presentation = await findServeablePresentation(req.params.id, { normalize: false })
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    const normalized = normalizePptxImportedPresentationForRead(presentation)
    const html = generateRevealHTML(normalizePresentationNotes(normalized))
    const filename = `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.html`
    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id/present
router.get('/:id/present', async (req, res) => {
  try {
    // Serve-guard for user decks (trashed decks must not present); templates and
    // built-ins are never trashed, so they stay as a fallback.
    let presentation = await findServeablePresentation(req.params.id, { normalize: false })
    if (!presentation) {
      const { readTemplates } = require('../services/storage')
      const templates = await readTemplates()
      presentation = templates.find((t) => t.id === req.params.id)
      if (!presentation) {
        try {
          const fs = require('fs-extra')
          const path = require('path')
          const builtIn = await fs.readJson(
            path.join(__dirname, '..', 'data', 'built-in-templates.json')
          )
          presentation = normalizeBuiltInTemplates(builtIn).find((t) => t.id === req.params.id)
          // eslint-disable-next-line unused-imports/no-unused-vars
        } catch (e) {}
      }
    }
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    presentation = normalizePptxImportedPresentationForRead(presentation)
    let html = generateRevealHTML(normalizePresentationNotes(presentation))
    if (req.query.preview === 'true') {
      html = html.replace(
        '</head>',
        '<style>.reveal .controls, .reveal .progress, .reveal .slide-number, .reveal .navigate-left, .reveal .navigate-right, .reveal .navigate-up, .reveal .navigate-down { display: none !important; pointer-events: none !important; }</style></head>'
      )
      html = html.replace(
        'var revealConfig = {',
        'var revealConfig = { controls: false, progress: false, keyboard: false,'
      )
    }
    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/save-as-template
router.post('/:id/save-as-template', validate(saveAsTemplateSchema), async (req, res) => {
  try {
    const pres = await findServeablePresentation(req.params.id, { normalize: false })
    if (!pres) return res.status(404).json({ error: 'Not found' })
    const now = new Date().toISOString()
    const template = normalizePresentationNotes({
      ...JSON.parse(JSON.stringify(normalizePptxImportedPresentationForRead(pres))),
      id: uuidv4(),
      title: (req.body.title || pres.title || 'Untitled') + ' (template)',
      isTemplate: true,
      createdAt: now,
      updatedAt: now,
    })
    await withTemplates((templates) => {
      templates.push(template)
    })
    res.status(201).json(template)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id/uploads — list uploaded files for a presentation
router.get('/:id/uploads', async (req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) return res.json([])

    const [presentation, allHashes] = await Promise.all([
      findServeablePresentation(req.params.id, { normalize: false }),
      readUploadHashes(),
    ])
    if (!presentation) return res.status(404).json({ error: 'Not found' })

    const presHashes = allHashes[req.params.id] || {}
    const referencedFiles = collectPresentationUploadRefs(presentation)
    const byFilename = new Map()

    for (const [hash, info] of Object.entries(presHashes)) {
      if (info?.filename) byFilename.set(info.filename, { ...info, hash })
    }
    for (const filename of referencedFiles) {
      if (!byFilename.has(filename)) byFilename.set(filename, { filename, hash: null })
    }

    const files = []
    for (const info of byFilename.values()) {
      const safeFilename = path.basename(info.filename)
      const filePath = path.join(UPLOADS_DIR, safeFilename)
      try {
        const stats = await fs.stat(filePath)
        files.push({
          filename: safeFilename,
          originalName: info.originalName || safeFilename,
          url: `/uploads/${safeFilename}`,
          size: stats.size,
          type: info.mimeType || getUploadMimeType(safeFilename),
          uploadedAt: stats.mtime,
          hash: info.hash,
          referenced: referencedFiles.has(safeFilename),
        })
      } catch {
        // File was deleted from disk but still in hash index
      }
    }

    res.json(files)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/presentations/:id/uploads/:filename — remove an uploaded file and hash entry
router.delete('/:id/uploads/:filename', async (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename)
    if (!safeFilename || safeFilename !== req.params.filename) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    const presentations = await readPresentations()
    const presentation = presentations.find((p) => p.id === req.params.id)
    if (!presentation) return res.status(404).json({ error: 'Not found' })

    const filePath = path.join(UPLOADS_DIR, safeFilename)
    await fs.remove(filePath)

    await withUploadHashes(async (hashes) => {
      const presHashes = hashes[req.params.id] || {}
      for (const [hash, info] of Object.entries(presHashes)) {
        if (info?.filename === safeFilename) delete presHashes[hash]
      }
      hashes[req.params.id] = presHashes
    })

    res.json({ deleted: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
