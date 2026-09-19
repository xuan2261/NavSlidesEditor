const logger = require('../services/logger')
const express = require('express')
const {
  generateRevealHTML,
  normalizePresentationNotes,
} = require('revealjs-shared')
const { rasterizeComplexElements } = require('../services/pptx-exporter')
const { findServeablePresentation } = require('../services/presentation-finder')
const { hashCanonical } = require('../services/pptx-import/evidence/canonical-hash')
const { drainPackageCompatibilityOutbox } = require('../services/pptx-import/package-store-runtime')
const { readAuthoritativePresentation } = require('../services/package-backed-presentation-read')
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
const { packageIdentityForFidelity, getLocalBaseUrl } = require('./presentations-helpers')

const router = express.Router()

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
    logger.error('PPTX element rasterization failed:', err)
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

module.exports = router
