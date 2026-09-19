const express = require('express')
const fs = require('fs-extra')
const path = require('path')
const {
  getDesignTokensForRevealTheme,
  normalizePresentationNotes,
} = require('revealjs-shared')
const {
  readPresentations,
  readTemplates,
  withPresentations,
  withShareTokens,
  HISTORY_DIR,
} = require('../services/storage')
const { validate } = require('../middleware/validate')
const {
  createPresentationSchema,
  updatePresentationSchema,
} = require('../middleware/schemas')
const { normalizePptxImportedPresentationForRead } = require('../services/presentation-normalization')
const { normalizeBuiltInTemplates } = require('../services/template-normalization')
const { stripClientPptxOriginalPaths } = require('../services/pptx-import/create-imported-presentation')
const { sanitizeClientEditableData } = require('../services/pptx-import/authority-sanitizer')
const { toPresentationEditorDto } = require('../services/pptx-import/package-store/dto')
const { hashRecord } = require('../services/pptx-import/package-store/schemas')
// Namespace import: tests monkey-patch members of this module then re-require
// the router, so call sites must resolve through the module object.
const packageLifecycle = require('../services/package-lifecycle-integration')
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
const { uuidv4, isSafePresentationId } = require('./presentations-helpers')

const router = express.Router()

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
      const packageHead = await packageLifecycle.instantiateRetainedPackageHead(
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
        await packageLifecycle.quarantinePackageOwnerWithRetry(presentationId, { compatibilityRemove: true })
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
        retainedOwnerExists = await packageLifecycle.packageOwnerExists(retainedOwner)
        historyOwners = await packageLifecycle.getPackageHistoryOwners(presId)
        if (!presentation) compatibilityPending = await packageLifecycle.packageCompatibilityPending(presId)
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
        livePackageBacked = await packageLifecycle.packagePresentationExists(presId)
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
          const packageHead = await packageLifecycle.getPackageHead(presId)
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
          retainedHead = await packageLifecycle.retainPackageHead(retainedOwner, presId, {
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
          await packageLifecycle.quarantinePackageOwnerWithRetry(presId, {
            compatibilityRemove: true,
            expectedHead: retainedHead,
          })
        } catch (error) {
          if (error.code === 'STALE_GENERATION') {
            let successorExists
            try {
              successorExists = await packageLifecycle.packagePresentationExists(presId)
            } catch {
              throw Object.assign(new Error('Package lifecycle is temporarily unavailable; retry deletion'), {
                code: 'PACKAGE_LIFECYCLE_UNAVAILABLE',
                status: 503,
                retryable: true,
              })
            }
            if (successorExists) {
              try {
                await packageLifecycle.releasePackageOwnerWithRetry(retainedOwner)
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
              await packageLifecycle.restoreQuarantinedPackageHeadWithRetry(
                retainedOwner,
                presId,
                { compatibilityPresentation: packageAuthorityPresentation, updatedAt: packageAuthorityPresentation?.updatedAt }
              )
              await packageLifecycle.releasePackageOwnerWithRetry(retainedOwner)
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
            await packageLifecycle.restoreQuarantinedPackageHeadWithRetry(
              retainedOwner,
              presId,
              { compatibilityPresentation: packageAuthorityPresentation, updatedAt: packageAuthorityPresentation?.updatedAt }
            )
            await packageLifecycle.releasePackageOwnerWithRetry(retainedOwner)
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
              await packageLifecycle.restoreQuarantinedPackageHeadWithRetry(
                retainedOwner,
                presId,
                { compatibilityPresentation: packageAuthorityPresentation, updatedAt: packageAuthorityPresentation?.updatedAt }
              )
              await packageLifecycle.releasePackageOwnerWithRetry(retainedOwner)
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
            await packageLifecycle.releasePackageOwnerWithRetry(owner)
          } catch (error) {
            cleanupErrors.push(error)
          }
        }
      }
      if (retainedHead || retainedOwnerExists) {
        try {
          await packageLifecycle.releasePackageOwnerWithRetry(retainedOwner)
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
    packageHead = await packageLifecycle.duplicatePackageOwner(original.id, copy.id, {
      projection: copy,
      expectedSourceHead,
    })
    if (expectedSourceHead && !packageHead) {
      throw Object.assign(new Error('Package-backed source head is unavailable'), {
        code: 'PRESENTATION_PACKAGE_HEAD_UNAVAILABLE',
        status: 409,
      })
    }
    if (!expectedSourceHead && !packageHead && await packageLifecycle.packagePresentationExists(original.id)) {
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
          await packageLifecycle.quarantinePackageOwnerWithRetry(destinationId)
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

module.exports = router
