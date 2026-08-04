const express = require('express')
const uuidv4 = () => require('node:crypto').randomUUID()
const {
  generateRevealHTML,
  getDesignTokensForRevealTheme,
  normalizePresentationNotes,
} = require('revealjs-shared')
const {
  readPresentations,
  readTemplates,
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
const liveRooms = require('../services/live-rooms')
const { bootstrapPresenterGames } = require('../services/presenter-game-bootstrap')
const { stripClientPptxOriginalPaths } = require('../services/pptx-import/create-imported-presentation')
const { sanitizeClientEditableData } = require('../services/pptx-import/authority-sanitizer')
const { toPresentationEditorDto } = require('../services/pptx-import/package-store/dto')
const { hashRecord } = require('../services/pptx-import/package-store/schemas')
const { hashCanonical } = require('../services/pptx-import/evidence/canonical-hash')
const {
  duplicatePackageOwner,
  getPackageHead,
  getPackageHistoryOwners,
  instantiateRetainedPackageHead,
  packageOwnerExists,
  packagePresentationExists,
  packageCompatibilityPending,
  quarantinePackageOwnerWithRetry,
  releasePackageOwnerWithRetry,
  restoreQuarantinedPackageHeadWithRetry,
  retainPackageHead,
} = require('../services/package-lifecycle-integration')
const {
  getPackageGeneration,
  savePackageProjection,
} = require('../services/generation-safe-save')
const { drainPackageCompatibilityOutbox } = require('../services/pptx-import/package-store-runtime')
const {
  readAuthoritativePresentation,
  readAuthoritativePresentations,
  resolvePackageBackedRead,
} = require('../services/package-backed-presentation-read')
const { withHistoryLock } = require('../services/history-lock')
const { createEditedExportHandler } = require('./pptx-edited-export')
const {
  readPackageAuthoritySnapshot,
  publicPackageAuthoritySnapshot,
} = require('../services/pptx-import/package-authority-snapshot')
const {
  editedExportAvailability,
  executeValidatedEditedExport,
  hasValidatedEditedReplay,
} = require('../services/validated-edited-export')

const router = express.Router()
const UPLOAD_HASHES_FILE = path.join(DATA_DIR, 'upload-hashes.json')

function isSafePresentationId(value) {
  return typeof value === 'string' && value.length > 0 && value !== '.' && value !== '..' &&
    !value.includes('/') && !value.includes('\\') &&
    !value.includes(String.fromCharCode(0))
}

async function readPresentablePresentation(id) {
  const resolved = await readAuthoritativePresentation(id)
  if (resolved?.presentation) return resolved.presentation

  const templates = await readTemplates()
  const template = templates.find((item) => item.id === id)
  if (template) return template

  try {
    const builtIn = await fs.readJson(path.join(__dirname, '..', 'data', 'built-in-templates.json'))
    return normalizeBuiltInTemplates(builtIn).find((item) => item.id === id) || null
  } catch {
    return null
  }
}

function isCurrentPresenterBootstrap(expected, currentRoom) {
  return Boolean(
    currentRoom &&
    expected &&
    currentRoom === expected.room &&
    currentRoom.presenterId === expected.presenterId &&
    currentRoom.presenterConnected === true &&
    currentRoom.presentationId === expected.presentationId &&
    currentRoom.presentationGeneration === expected.presentationGeneration &&
    liveRooms.isValidPresenterToken(currentRoom, expected.presenterToken)
  )
}

function packageIdentityForFidelity(presentation) {
  const head = presentation?.pptxAggregateHead
  if (typeof head?.packageRevisionId !== 'string' || !head.packageRevisionId) return undefined
  return { revisionId: head.packageRevisionId, headHash: hashCanonical(head) }
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
// Known package-authority failures are quarantined; healthy rows remain a bare array.
// Quarantine counts are additive response headers (array shape unchanged).
router.get('/', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const quarantine = []
    const authoritative = (await readAuthoritativePresentations(presentations, {
      collectQuarantine: quarantine,
    })).map((resolved) => resolved.presentation)
    const summaries = authoritative.map((p) => ({
      id: p.id,
      title: p.title,
      theme: p.theme,
      transition: p.transition,
      slideCount: (p.slides || []).length,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      thumbnail: p.slides && p.slides[0] ? p.slides[0].background : null,
    }))
    if (quarantine.length > 0) {
      res.set('X-Presentations-Quarantined-Count', String(quarantine.length))
      const codes = [...new Set(quarantine.map((item) => item.code).filter(Boolean))]
      if (codes.length) res.set('X-Presentations-Quarantined-Codes', codes.join(','))
    }
    res.json(summaries)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code })
  }
})

// POST /api/presentations - create new (optionally from template)
router.post('/', validate(createPresentationSchema), async (req, res) => {
  let templatePackageOwner
  let templatePackageAttempted = false
  let presentationId
  let presentationPublished = false
  try {
    // RT-04: never accept client-supplied pptxOriginal path bindings
    const safeBody = sanitizeClientEditableData(stripClientPptxOriginalPaths(req.body) || {})
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
        const packageBackedTemplate = Boolean(template.pptxAggregateHead)
        if (packageBackedTemplate && (template.slides || []).some((slide) =>
          !slide?.id || (slide.elements || []).some((element) => !element?.id)
        )) {
          throw Object.assign(new Error('Package-backed template source identity is unavailable'), {
            code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
            status: 422,
          })
        }
        if (packageBackedTemplate) {
          templatePackageOwner = { ownerType: 'template', ownerId: template.id }
        }
        const cloned = JSON.parse(JSON.stringify(template))
        presentation = normalizePresentationNotes({
          ...cloned,
          id: uuidv4(),
          title: title || cloned.title || 'Untitled Presentation',
          createdAt: now,
          updatedAt: now,
          slides: (cloned.slides || []).map((s) => ({
            ...s,
            id: packageBackedTemplate ? s.id : uuidv4(),
            elements: (s.elements || []).map((el) => ({
              ...el,
              id: packageBackedTemplate ? el.id : uuidv4(),
            })),
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
    presentationId = presentation.id

    if (templatePackageOwner) {
      templatePackageAttempted = true
      const packageHead = await instantiateRetainedPackageHead(
        templatePackageOwner,
        presentation.id,
        {
          projection: presentation,
          requireProjectionMatch: true,
          updatedAt: now,
        }
      )
      if (!packageHead) {
        throw Object.assign(new Error('Package-backed template head is unavailable'), {
          code: 'TEMPLATE_PACKAGE_HEAD_UNAVAILABLE',
          status: 409,
        })
      }
      presentation.pptxAggregateHead = packageHead
    }

    const result = await withPresentations((presentations) => {
      presentations.push(presentation)
      return presentation
    })
    presentationPublished = true
    res.status(201).json(toPresentationEditorDto(normalizePresentationNotes(result)))
  } catch (err) {
    let responseError = err
    if (templatePackageAttempted && presentationId && !presentationPublished) {
      try {
        await quarantinePackageOwnerWithRetry(presentationId, { compatibilityRemove: true })
      } catch (rollbackError) {
        responseError = Object.assign(new AggregateError(
          [err, rollbackError],
          'Template instantiation and package rollback failed'
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

// GET /api/presentations/:id/pptx-fidelity — safe capability and export summary.
router.get('/:id/pptx-fidelity', async (req, res) => {
  try {
    const resolved = await readAuthoritativePresentation(req.params.id)
    if (!resolved) return res.status(404).json({ error: 'Not found' })
    const presentation = resolved.presentation
    const { buildFidelityDto } = require('../services/pptx-import/fidelity-contract')
    let verifiedOriginalAvailable = false
    if ((presentation.pptxOriginal?.id && presentation.pptxOriginal?.sha256) ||
      presentation.pptxAggregateHead?.packageRevisionId) {
      try {
        const { resolvePptxOriginalPayload } = require(
          '../services/pptx-import/roundtrip-original-parts'
        )
        const {
          resolveImmutableOriginalRevisionBytes,
        } = require('../services/pptx-import/package-revision-resolver')
        const payload = await resolvePptxOriginalPayload(presentation, {
          resolveImmutableOriginalRevision: resolveImmutableOriginalRevisionBytes,
        })
        verifiedOriginalAvailable = Boolean(payload.buffer)
      } catch {
        verifiedOriginalAvailable = false
      }
    }
    const editedAvailability = await editedExportAvailability(presentation)
    const aggregateGeneration = resolved.generation
    const fidelity = buildFidelityDto(presentation, {
      aggregateGeneration,
      verifiedOriginalAvailable,
      validatedEditedAvailable: editedAvailability.available && editedAvailability.noOp !== true,
      validatedEditedNoOpAvailable: editedAvailability.noOp === true,
      validatedEditedReasonCode: editedAvailability.reasonCode,
      officeCliAvailable: editedAvailability.officeCliAvailable === true,
    })
    const {
      buildPrivateFidelityCapability,
    } = require('../services/pptx-import/evidence/private-fidelity-capability')
    const packageAuthority = packageIdentityForFidelity(presentation)
    res.json({
      ...fidelity,
      ...(packageAuthority ? { packageAuthority } : {}),
      localEvidence: buildPrivateFidelityCapability(presentation, fidelity, {
        aggregateGeneration,
        officeCliAvailable: editedAvailability.officeCliAvailable === true,
        originalAvailable: verifiedOriginalAvailable,
      }),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id/pptx-package-snapshot — return one safe package/R0 identity.
router.get('/:id/pptx-package-snapshot', async (req, res) => {
  try {
    const resolved = await readAuthoritativePresentation(req.params.id, { normalize: false })
    if (!resolved) return res.status(404).json({ error: 'Not found' })
    const snapshot = await readPackageAuthoritySnapshot(req.params.id)
    const head = resolved.presentation?.pptxAggregateHead
    if (!head || resolved.generation !== snapshot.aggregateGeneration ||
        hashCanonical(head) !== snapshot.packageHeadHash ||
        head.packageRevisionId !== snapshot.packageRevisionId) {
      return res.status(409).json({
        error: 'Package authority changed while reading the snapshot',
        code: 'PACKAGE_AUTHORITY_CHANGED',
      })
    }
    res.json(publicPackageAuthoritySnapshot(snapshot))
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code })
  }
})

// GET /api/presentations/:id/pptx-original — stream immutable upload/R0 bytes only.
router.get('/:id/pptx-original', async (req, res) => {
  try {
    const generationHeader = req.get('If-Pptx-Generation')
    const generationRequested = generationHeader !== undefined
    if (generationRequested && (!/^[1-9]\d*$/u.test(generationHeader) ||
      !Number.isSafeInteger(Number(generationHeader)))) {
      return res.status(400).json({
        error: 'If-Pptx-Generation must be a positive safe integer',
        code: 'INVALID_EXPECTED_GENERATION',
      })
    }
    const packageRevisionHeader = req.get('If-Pptx-Package-Revision')
    const packageHeadHashHeader = req.get('If-Pptx-Package-Head-Hash')
    const packageAuthorityRequested = packageRevisionHeader !== undefined ||
      packageHeadHashHeader !== undefined
    if (packageAuthorityRequested &&
        (typeof packageRevisionHeader !== 'string' ||
          !/^[A-Za-z0-9._:-]+$/u.test(packageRevisionHeader) ||
          typeof packageHeadHashHeader !== 'string' ||
          !/^[a-f0-9]{64}$/u.test(packageHeadHashHeader))) {
      return res.status(400).json({
        error: 'If-Pptx-Package-Revision and If-Pptx-Package-Head-Hash are required',
        code: 'INVALID_EXPECTED_PACKAGE_AUTHORITY',
      })
    }
    const resolved = await readAuthoritativePresentation(req.params.id, {
      normalize: false,
      allowIncompleteAuthority: true,
    })
    const presentation = resolved?.presentation
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    if (packageAuthorityRequested && !presentation.pptxAggregateHead) {
      return res.status(409).json({
        error: 'Package authority is unavailable for this presentation',
        code: 'PACKAGE_AUTHORITY_UNAVAILABLE',
      })
    }
    if (generationRequested && resolved.generation !== Number(generationHeader)) {
      return res.status(409).json({
        error: 'Package generation is stale',
        code: 'STALE_GENERATION',
        currentGeneration: Number.isSafeInteger(resolved.generation) ? resolved.generation : null,
      })
    }
    const { resolvePptxOriginalPayload } = require('../services/pptx-import/roundtrip-original-parts')
    const {
      resolveImmutableOriginalRevisionBytes,
    } = require('../services/pptx-import/package-revision-resolver')
    const payload = await resolvePptxOriginalPayload(presentation, {
      resolveImmutableOriginalRevision: (input) => resolveImmutableOriginalRevisionBytes(input, {
        expectedGeneration: generationRequested ? Number(generationHeader) : undefined,
        expectedPackageRevisionId: packageAuthorityRequested ? packageRevisionHeader : undefined,
        expectedPackageHeadHash: packageAuthorityRequested ? packageHeadHashHeader : undefined,
      }),
    })
    if (!payload.buffer) {
      return res.status(payload.status || 404).json({
        error: 'No immutable original PPTX package is available',
        code: payload.code || 'ORIGINAL_UNAVAILABLE',
        reason: payload.reason,
        mode: payload.mode,
      })
    }
    const safeTitle = String(presentation.title || 'presentation').replace(/[^a-z0-9._-]+/gi, '_')
    res.setHeader('Content-Type', payload.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pptx"`)
    res.setHeader('Content-Length', String(payload.byteLength))
    res.setHeader('X-Pptx-Export-Mode', payload.mode)
    if (payload.sha256) {
      res.setHeader('X-Pptx-Package-Sha256', payload.sha256)
      res.setHeader('X-Pptx-Original-Sha256', payload.sha256)
    }
    res.send(payload.buffer)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code })
  }
})

// POST /api/presentations/:id/pptx-edited — authoritative, fail-closed package export.
router.post('/:id/pptx-edited', createEditedExportHandler({
  findPresentation: (id) => findServeablePresentation(id, { normalize: false }),
  getReplay: hasValidatedEditedReplay,
  getAvailability: editedExportAvailability,
  execute: executeValidatedEditedExport,
  drainCompatibility: drainPackageCompatibilityOutbox,
}))

// GET /api/presentations/:id
router.get('/:id', async (req, res) => {
  try {
    const resolved = await readAuthoritativePresentation(req.params.id)
    if (!resolved) return res.status(404).json({ error: 'Not found' })
    res.json(toPresentationEditorDto(normalizePresentationNotes(resolved.presentation), {
      aggregateGeneration: resolved.generation,
    }))
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code })
  }
})

// PUT /api/presentations/:id
router.put('/:id', validate(updatePresentationSchema), async (req, res) => {
  try {
    let packageResult
    const expectedGeneration = req.body?.aggregateGeneration
    const baseRevisionId = req.body?.baseRevisionId
    const idempotencyKey = req.get('Idempotency-Key') || req.body?.idempotencyKey
    // RT-04: client cannot inject/rebind pptxOriginal (paths or id steal)
    const safeBody = sanitizeClientEditableData(req.body)
    delete safeBody.aggregateGeneration
    delete safeBody.baseRevisionId
    delete safeBody.idempotencyKey
    packageResult = await savePackageProjection({
      presentationId: req.params.id,
      expectedGeneration,
      baseRevisionId,
      idempotencyKey,
      after: { ...safeBody, id: req.params.id },
      loadStored: async () => {
        const presentations = await readPresentations()
        return presentations.find((item) => item.id === req.params.id) || null
      },
    })
    if (packageResult.packageBacked && !packageResult.ok) {
      return res.status(packageResult.status).json({
        error: packageResult.reason,
        code: packageResult.reason,
        reason: packageResult.reason,
        currentGeneration: packageResult.currentGeneration,
        currentRevisionId: packageResult.currentRevisionId,
        reasonCode: packageResult.reasonCode,
        reasonCodes: packageResult.reasonCodes,
        reasonCodeSubject: packageResult.reasonCodeSubject,
      })
    }
    let result
    if (packageResult.packageBacked) {
      // The package outbox is the sole compatibility writer for package-backed saves;
      // avoid a second JSON critical section that could overwrite a newer generation.
      await drainPackageCompatibilityOutbox()
      const presentations = await readPresentations()
      result = presentations.find((item) => item.id === req.params.id) || null
    } else {
      result = await withPresentations((presentations) => {
        const index = presentations.findIndex((p) => p.id === req.params.id)
        if (index === -1) return null
        const previous = presentations[index]
        // Legacy reconstructed export still observes this marker. Package-backed saves
        // instead record a server-owned pending journal and retain immutable R0 bytes.
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
    }
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json({
      ...toPresentationEditorDto(normalizePresentationNotes(result), {
        aggregateGeneration: packageResult?.packageBacked ? packageResult.generation : undefined,
      }),
      ...(!packageResult?.packageBacked
        ? {}
        : { saveOutcome: packageResult.idempotent ? 'idempotent-replay' : 'committed' }),
    })
  } catch (err) {
    const code = err.code || 'PACKAGE_SAVE_FAILED'
    const status = code === 'SNAPSHOT_BUDGET_EXCEEDED'
      ? 413
      : code === 'STALE_GENERATION'
        ? 409
        : 500
    const currentGeneration = code === 'STALE_GENERATION'
      ? (err.currentGeneration ?? await getPackageGeneration(req.params.id).catch(() => undefined))
      : undefined
    res.status(status).json({ error: err.message, code, reason: code, currentGeneration })
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
    const result = await withHistoryLock(presId, () => withPresentations((presentations) => {
      const pres = presentations.find((p) => p.id === presId)
      if (!pres || !pres.deletedAt) return null
      delete pres.deletedAt
      pres.updatedAt = new Date().toISOString()
      return pres
    }))
    if (!result) return res.status(404).json({ error: 'Not found or not in trash' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/presentations/:id/permanent — permanently delete
router.delete('/:id/permanent', async (req, res) => {
  const presId = req.params.id
  if (!isSafePresentationId(presId)) {
    return res.status(400).json({ error: 'Invalid presentation identifier' })
  }
  try {
    const result = await withHistoryLock(presId, async () => {
      const presentation = (await readPresentations()).find((item) => item.id === presId)
      const presHistDir = path.join(HISTORY_DIR, presId)
      const historyFiles = (await fs.pathExists(presHistDir))
        ? (await fs.readdir(presHistDir)).filter((file) => file.endsWith('.json'))
        : []
      const retainedOwner = {
        ownerType: 'permanent-delete',
        ownerId: presId,
      }
      let retainedOwnerExists = false
      let compatibilityPending = false
      let historyOwners = []
      try {
        retainedOwnerExists = await packageOwnerExists(retainedOwner)
        historyOwners = await getPackageHistoryOwners(presId)
        if (!presentation) compatibilityPending = await packageCompatibilityPending(presId)
      } catch {
        throw Object.assign(new Error('Package lifecycle is temporarily unavailable; retry deletion'), {
          code: 'PACKAGE_LIFECYCLE_UNAVAILABLE',
          status: 503,
          retryable: true,
        })
      }
      let retainedHead = null
      let packageBacked = Boolean(presentation?.pptxAggregateHead)
      let livePackageBacked = false
      try {
        livePackageBacked = await packagePresentationExists(presId)
        // A retained permanent-delete owner is durable evidence that a prior
        // attempt already quarantined the package and now needs reconciliation.
        packageBacked = packageBacked || livePackageBacked || retainedOwnerExists
      } catch {
        throw Object.assign(new Error('Package lifecycle is temporarily unavailable; retry deletion'), {
          code: 'PACKAGE_LIFECYCLE_UNAVAILABLE',
          status: 503,
          retryable: true,
        })
      }
      let packageAuthorityPresentation = presentation
      if (livePackageBacked) {
        try {
          const packageHead = await getPackageHead(presId)
          if (!packageHead) {
            throw Object.assign(new Error('Package lifecycle source head changed'), {
              code: 'STALE_GENERATION',
              status: 409,
              retryable: true,
            })
          }
          packageAuthorityPresentation = {
            ...(presentation || { id: presId, slides: [] }),
            pptxAggregateHead: packageHead,
          }
        } catch (error) {
          if (error.status) throw error
          throw Object.assign(new Error('Package lifecycle is temporarily unavailable; retry deletion'), {
            cause: error,
            code: 'PACKAGE_LIFECYCLE_UNAVAILABLE',
            status: 503,
            retryable: true,
          })
        }
      }
      if (!presentation && !packageBacked && !retainedOwnerExists &&
          !compatibilityPending && !historyFiles.length && !historyOwners.length) {
        return { status: 404, body: { error: 'Not found' } }
      }
      const historyOwnersKnownAbsent = historyOwners.length === 0

      if (livePackageBacked) {
        try {
          retainedHead = await retainPackageHead(retainedOwner, presId, {
            ...(packageAuthorityPresentation?.pptxAggregateHead
              ? { expectedHead: packageAuthorityPresentation.pptxAggregateHead }
              : {}),
          })
        } catch (error) {
          if (error.status) throw error
          throw Object.assign(new Error('Package lifecycle is temporarily unavailable; retry deletion'), {
            cause: error,
            code: 'PACKAGE_LIFECYCLE_UNAVAILABLE',
            status: 503,
            retryable: true,
          })
        }
        if (!retainedHead) {
          throw Object.assign(new Error('Package lifecycle source head changed'), {
            code: 'STALE_GENERATION',
            status: 409,
            retryable: true,
          })
        }
        try {
          await quarantinePackageOwnerWithRetry(presId, {
            compatibilityRemove: true,
            expectedHead: retainedHead,
          })
        } catch (error) {
          if (error.code === 'STALE_GENERATION') {
            let successorExists
            try {
              successorExists = await packagePresentationExists(presId)
            } catch {
              throw Object.assign(new Error('Package lifecycle is temporarily unavailable; retry deletion'), {
                code: 'PACKAGE_LIFECYCLE_UNAVAILABLE',
                status: 503,
                retryable: true,
              })
            }
            if (successorExists) {
              try {
                await releasePackageOwnerWithRetry(retainedOwner)
              } catch (cleanupError) {
                throw Object.assign(new AggregateError(
                  [error, cleanupError],
                  'Package deletion became stale and temporary ownership cleanup failed'
                ), {
                  code: 'PACKAGE_LIFECYCLE_ROLLBACK_FAILED',
                  status: 503,
                })
              }
              error.retryable = true
              throw error
            }
            // A retry can observe a missing H1 after the first attempt published
            // the quarantine root. Keep the retained owner until JSON cleanup
            // succeeds so the normal rollback boundary remains recoverable.
          } else {
            try {
              await restoreQuarantinedPackageHeadWithRetry(
                retainedOwner,
                presId,
                { compatibilityPresentation: packageAuthorityPresentation, updatedAt: packageAuthorityPresentation?.updatedAt }
              )
              await releasePackageOwnerWithRetry(retainedOwner)
            } catch (rollbackError) {
              throw Object.assign(new AggregateError(
                [error, rollbackError],
                'Package deletion and retention rollback failed'
              ), {
                code: 'PACKAGE_LIFECYCLE_ROLLBACK_FAILED',
                status: 503,
              })
            }
            if (error.status) throw error
            throw Object.assign(new Error('Package lifecycle is temporarily unavailable; retry deletion'), {
              cause: error,
              code: 'PACKAGE_LIFECYCLE_UNAVAILABLE',
              status: 503,
              retryable: true,
            })
          }
        }
      }

      let removed = !presentation
      try {
        if (presentation) {
          removed = await withPresentations((presentations) => {
            const index = presentations.findIndex((p) => p.id === presId)
            if (index === -1) return null
            const [pres] = presentations.splice(index, 1)
            return pres
          })
        }
      } catch (error) {
        let presentationStillPublished = true
        try {
          presentationStillPublished = (await readPresentations()).some((item) => item.id === presId)
        } catch {}
        if (retainedHead && presentationStillPublished) {
          try {
            await restoreQuarantinedPackageHeadWithRetry(
              retainedOwner,
              presId,
              { compatibilityPresentation: packageAuthorityPresentation, updatedAt: packageAuthorityPresentation?.updatedAt }
            )
            await releasePackageOwnerWithRetry(retainedOwner)
            await drainPackageCompatibilityOutbox()
          } catch (rollbackError) {
            throw Object.assign(new AggregateError(
              [error, rollbackError],
              'Presentation deletion and package rollback failed'
            ), {
              code: 'PACKAGE_LIFECYCLE_ROLLBACK_FAILED',
              status: 503,
            })
          }
        }
        throw error
      }

      if (!removed) {
        let presentationStillPublished = true
        try {
          presentationStillPublished = (await readPresentations()).some((item) => item.id === presId)
        } catch {}
        if (presentationStillPublished) {
          if (retainedHead) {
            try {
              await restoreQuarantinedPackageHeadWithRetry(
                retainedOwner,
                presId,
                { compatibilityPresentation: packageAuthorityPresentation, updatedAt: packageAuthorityPresentation?.updatedAt }
              )
              await releasePackageOwnerWithRetry(retainedOwner)
              await drainPackageCompatibilityOutbox()
            } catch (rollbackError) {
              throw Object.assign(new Error('Presentation was already removed and package rollback failed'), {
                cause: rollbackError,
                code: 'PACKAGE_LIFECYCLE_ROLLBACK_FAILED',
                status: 503,
              })
            }
          }
          return { status: 404, body: { error: 'Not found' } }
        }
        removed = true
      }

      const cleanupErrors = []
      if (!historyOwnersKnownAbsent) {
        for (const owner of historyOwners) {
          try {
            await releasePackageOwnerWithRetry(owner)
          } catch (error) {
            cleanupErrors.push(error)
          }
        }
      }
      if (retainedHead || retainedOwnerExists) {
        try {
          await releasePackageOwnerWithRetry(retainedOwner)
        } catch (error) {
          cleanupErrors.push(error)
        }
      }
      if (cleanupErrors.length) {
        throw Object.assign(new AggregateError(
          cleanupErrors,
          'Presentation deletion completed with package cleanup pending'
        ), {
          code: 'PACKAGE_LIFECYCLE_UNAVAILABLE',
          status: 503,
        })
      }

      try {
        await fs.remove(presHistDir)
      } catch (error) {
        throw Object.assign(error, {
          code: 'HISTORY_CLEANUP_UNAVAILABLE',
          status: 503,
        })
      }

      // Cascade: remove share tokens
      try {
        await withShareTokens((tokens) => {
          for (const [token, tokenData] of Object.entries(tokens)) {
            const presentationId =
              typeof tokenData === 'string' ? tokenData : tokenData?.presentationId
            if (presentationId === presId) delete tokens[token]
          }
        })
      } catch {}

      await drainPackageCompatibilityOutbox()
      return { status: 200, body: { success: true } }
    })
    res.status(result.status).json(result.body)
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.message,
      code: err.code,
      ...(err.retryable ? { retryable: true } : {}),
    })
  }
})

// POST /api/presentations/:id/duplicate
router.post('/:id/duplicate', async (req, res) => {
  let copiedOriginalId
  let packageDuplicationAttempted = false
  let packageHead
  let destinationId
  let presentationPublished = false
  try {
    const {
      persistOriginalPptx,
      readOriginalPptx,
    } = require('../services/pptx-import/original-package')
    const original = (await readPresentations()).find((p) => p.id === req.params.id)
    if (!original || original.deletedAt) return res.status(404).json({ error: 'Not found' })

    const sourceFingerprint = hashRecord(original)
    const authoritative = await resolvePackageBackedRead(
      original.id,
      normalizePptxImportedPresentationForRead(original)
    )
    const expectedSourceHead = authoritative.presentation.pptxAggregateHead || null
    const now = new Date().toISOString()
    const copy = JSON.parse(JSON.stringify(authoritative.presentation))
    copy.id = uuidv4()
    destinationId = copy.id
    copy.title = (copy.title || 'Untitled') + ' (copy)'
    copy.createdAt = now
    copy.updatedAt = now

    packageDuplicationAttempted = true
    packageHead = await duplicatePackageOwner(original.id, copy.id, {
      projection: copy,
      expectedSourceHead,
    })
    if (expectedSourceHead && !packageHead) {
      throw Object.assign(new Error('Package-backed source head is unavailable'), {
        code: 'PRESENTATION_PACKAGE_HEAD_UNAVAILABLE',
        status: 409,
      })
    }
    if (!expectedSourceHead && !packageHead && await packagePresentationExists(original.id)) {
      throw Object.assign(new Error('Presentation package head appeared while duplicating'), {
        code: 'STALE_GENERATION',
        status: 409,
        retryable: true,
      })
    }
    if (packageHead) {
      copy.pptxAggregateHead = packageHead
    } else {
      delete copy.pptxAggregateHead
    }
    // H1: never share pptxOriginal.id across decks (permanent delete would unlink sibling).
    // Copy-on-write: new uuid file when bytes exist; strip binding if source package missing.
    if (!packageHead && copy.pptxOriginal?.id) {
      const bytes = await readOriginalPptx(copy.pptxOriginal.id)
      if (bytes) {
        const artifact = await persistOriginalPptx(bytes)
        copiedOriginalId = artifact.id
        copy.pptxOriginal = {
          id: artifact.id,
          sha256: artifact.sha256,
          byteLength: artifact.byteLength,
          uploadedAt: artifact.uploadedAt,
        }
      } else {
        delete copy.pptxOriginal
      }
    }

    const normalizedCopy = normalizePresentationNotes(copy)
    const result = await withPresentations((presentations) => {
      const current = presentations.find((p) => p.id === original.id)
      if (!current || current.deletedAt || hashRecord(current) !== sourceFingerprint) {
        throw Object.assign(new Error('Presentation changed while duplicating'), {
          code: 'STALE_GENERATION',
          status: 409,
        })
      }
      presentations.push(normalizedCopy)
      return normalizedCopy
    })
    presentationPublished = true
    res.status(201).json(toPresentationEditorDto(result))
  } catch (err) {
    let responseError = err
    if (!presentationPublished) {
      const rollbackErrors = []
      if (packageDuplicationAttempted && destinationId) {
        try {
          await quarantinePackageOwnerWithRetry(destinationId)
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError)
        }
      }
      if (copiedOriginalId) {
        try {
          await require('../services/pptx-import/original-package').deleteOriginalPptx(
            copiedOriginalId,
            { strict: true }
          )
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError)
        }
      }
      if (rollbackErrors.length) {
        responseError = Object.assign(new AggregateError(
          [err, ...rollbackErrors],
          'Presentation duplication rollback failed'
        ), {
          code: 'PRESENTATION_DUPLICATION_ROLLBACK_FAILED',
          status: 503,
        })
      }
    }
    const status = responseError.status ||
      (responseError.code === 'PACKAGE_PENDING_PROJECTION' ? 409 : 500)
    res.status(status).json({ error: responseError.message, code: responseError.code })
  }
})

// GET /api/presentations/:id/export
router.get('/:id/export', async (req, res) => {
  try {
    const resolved = await readAuthoritativePresentation(req.params.id)
    if (!resolved) return res.status(404).json({ error: 'Not found' })
    const presentation = normalizePresentationNotes(resolved.presentation)
    const html = generateRevealHTML(presentation)
    const filename = `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.html`
    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

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
    const retainedHead = await retainPackageHead(
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
        await releasePackageOwnerWithRetry(templateOwner)
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

router.isCurrentPresenterBootstrap = isCurrentPresenterBootstrap

module.exports = router
