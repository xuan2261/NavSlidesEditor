const express = require('express')
const fs = require('fs-extra')
const path = require('path')
const {
  generateRevealHTML,
  normalizePresentationNotes,
} = require('revealjs-shared')
const {
  readPresentations,
  withTemplates,
  withUploadHashes,
  UPLOADS_DIR,
} = require('../services/storage')
const { validate } = require('../middleware/validate')
const { saveAsTemplateSchema } = require('../middleware/schemas')
const { normalizePptxImportedPresentationForRead } = require('../services/presentation-normalization')
const { findServeablePresentation } = require('../services/presentation-finder')
const liveRooms = require('../services/live-rooms')
const { bootstrapPresenterGames } = require('../services/presenter-game-bootstrap')
const { sanitizeClientEditableData } = require('../services/pptx-import/authority-sanitizer')
const { toPresentationEditorDto } = require('../services/pptx-import/package-store/dto')
// Namespace import: tests monkey-patch members of this module then re-require
// the router, so call sites must resolve through the module object.
const packageLifecycle = require('../services/package-lifecycle-integration')
const { readAuthoritativePresentation } = require('../services/package-backed-presentation-read')
const {
  uuidv4,
  isCurrentPresenterBootstrap,
  readPresentablePresentation,
  getUploadMimeType,
  collectPresentationUploadRefs,
  readUploadHashes,
} = require('./presentations-helpers')

const router = express.Router()

// POST /api/presentations/:id/present/game-bootstrap
router.post('/:id/present/game-bootstrap', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const { roomCode, presenterToken, hostCapabilities } = req.body || {}
    if (!roomCode || !presenterToken) {
      return res.status(400).json({ error: 'roomCode and presenterToken are required' })
    }

    const room = liveRooms.getRoomState(roomCode)
    if (!room) return res.status(404).json({ error: 'live-room-not-found' })
    if (!liveRooms.isValidPresenterToken(room, presenterToken)) {
      return res.status(403).json({ error: 'invalid-presenter-token' })
    }
    if (
      !room.presenterId ||
      room.presenterConnected !== true ||
      room.presentationId !== req.params.id
    ) {
      return res.status(409).json({ error: 'presenter-deck-not-ready' })
    }

    const expectedBootstrap = {
      room,
      presenterId: room.presenterId,
      presenterToken,
      presentationId: req.params.id,
      presentationGeneration: room.presentationGeneration,
    }
    const presentation = await readPresentablePresentation(req.params.id)
    const currentRoom = liveRooms.getRoomState(roomCode)
    if (!isCurrentPresenterBootstrap(expectedBootstrap, currentRoom)) {
      return res.status(409).json({ error: 'presenter-deck-not-ready' })
    }
    if (!presentation) return res.status(404).json({ error: 'presentation-not-found' })
    const normalized = normalizePptxImportedPresentationForRead(
      normalizePresentationNotes(presentation)
    )
    const bootstrap = bootstrapPresenterGames(normalized, hostCapabilities, {
      presentationId: req.params.id,
      liveRoomCode: roomCode,
      presentationGeneration: expectedBootstrap.presentationGeneration,
    })
    if (!bootstrap.ok) {
      const status = ['game-room-conflict', 'host-capability-required'].includes(bootstrap.error)
        ? 409
        : 503
      return res.status(status).json({
        error: bootstrap.error,
        ...(bootstrap.gameId ? { gameId: bootstrap.gameId } : {}),
        ...(bootstrap.gameIds ? { gameIds: bootstrap.gameIds } : {}),
      })
    }
    return res.json({ presentationId: req.params.id, games: bootstrap.games })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id/present
router.get('/:id/present', async (req, res) => {
  try {
    // Serve-guard for user decks (trashed decks must not present); templates and
    // built-ins are never trashed, so they stay as a fallback.
    let presentation = await readPresentablePresentation(req.params.id)
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
  let templateOwner
  let retentionAttempted = false
  let templatePublished = false
  try {
    const resolved = await readAuthoritativePresentation(req.params.id)
    if (!resolved) return res.status(404).json({ error: 'Not found' })
    const pres = resolved.presentation
    if (pres.pptxAggregateHead?.pendingJournalHash !== undefined) {
      throw Object.assign(new Error('Cannot save a pending package projection as a template'), {
        code: 'PACKAGE_PENDING_PROJECTION',
        status: 409,
      })
    }
    const now = new Date().toISOString()
    const template = normalizePresentationNotes({
      ...sanitizeClientEditableData(JSON.parse(JSON.stringify(pres))),
      id: uuidv4(),
      title: (req.body.title || pres.title || 'Untitled') + ' (template)',
      isTemplate: true,
      createdAt: now,
      updatedAt: now,
    })
    templateOwner = { ownerType: 'template', ownerId: template.id }
    retentionAttempted = true
    const retainedHead = await packageLifecycle.retainPackageHead(
      templateOwner,
      pres.id,
      { ...(pres.pptxAggregateHead ? { expectedHead: pres.pptxAggregateHead } : {}) }
    )
    if (pres.pptxAggregateHead && !retainedHead) {
      throw Object.assign(new Error('Package-backed presentation head is unavailable'), {
        code: 'PRESENTATION_PACKAGE_HEAD_UNAVAILABLE',
        status: 409,
      })
    }
    if (retainedHead) template.pptxAggregateHead = retainedHead
    await withTemplates((templates) => {
      templates.push(template)
    })
    templatePublished = true
    res.status(201).json(toPresentationEditorDto(template))
  } catch (err) {
    let responseError = err
    if (retentionAttempted && templateOwner && !templatePublished) {
      try {
        await packageLifecycle.releasePackageOwnerWithRetry(templateOwner)
      } catch (rollbackError) {
        responseError = Object.assign(new AggregateError(
          [err, rollbackError],
          'Template creation and package retention rollback failed'
        ), {
          code: 'PACKAGE_LIFECYCLE_ROLLBACK_FAILED',
          status: 503,
        })
      }
    }
    res.status(responseError.status || 500).json({
      error: responseError.message,
      code: responseError.code,
    })
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
