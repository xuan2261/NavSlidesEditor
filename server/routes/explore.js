const express = require('express')
const uuidv4 = () => require('node:crypto').randomUUID()
const {
  readPresentations,
  readShareTokens,
  withPresentations,
} = require('../services/storage')
const {
  duplicatePackageOwner,
  packagePresentationExists,
  quarantinePackageOwnerWithRetry,
} = require('../services/package-lifecycle-integration')
const {
  readAuthoritativePresentation,
  readAuthoritativePresentations,
} = require('../services/package-backed-presentation-read')
const { toPresentationEditorDto } = require('../services/pptx-import/package-store/dto')

const router = express.Router()

function sanitizeToken(tokenData) {
  if (typeof tokenData === 'string') {
    return { presentationId: tokenData, views: 0 }
  }
  return tokenData
}

// GET /api/explore - List all public presentations
router.get('/', async (req, res) => {
  try {
    const tokens = await readShareTokens()

    // In our simplified model, "public" implies any presentation with at least one active shared link
    // that isn't password protected or expired.
    const publicShares = Object.values(tokens)
      .map(sanitizeToken)
      .filter((t) => !t.password && (!t.expiresAt || new Date(t.expiresAt) > new Date()))

    // Collect unique presentation IDs
    const uniqueIds = [...new Set(publicShares.map((t) => t.presentationId))]

    const storedPresentations = await readPresentations()
    const publicIdSet = new Set(uniqueIds)
    const publicCandidates = storedPresentations.filter((presentation) =>
      presentation && !presentation.deletedAt && publicIdSet.has(presentation.id)
    )
    const authoritative = await readAuthoritativePresentations(publicCandidates)
    const authoritativeById = new Map(authoritative.map(({ presentation }) => [
      presentation.id,
      presentation,
    ]))
    const publicDecks = uniqueIds.map((id) => {
      const presentation = authoritativeById.get(id)
      if (!presentation) return null
      return {
        id: presentation.id,
        title: presentation.title || 'Untitled Presentation',
        slideCount: presentation.slides ? presentation.slides.length : 0,
        createdAt: presentation.createdAt || new Date().toISOString(),
      }
    }).filter(Boolean)

    res.json({ presentations: publicDecks })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/explore/:token/fork - Fork a presentation from a share token
router.post('/:token/fork', async (req, res) => {
  try {
    const tokens = await readShareTokens()
    const tokenData = sanitizeToken(tokens[req.params.token])

    if (!tokenData) return res.status(404).json({ error: 'Share link not found' })

    const expiry = tokenData.expiresAt ? new Date(tokenData.expiresAt) : null
    if (expiry && (!Number.isFinite(expiry.getTime()) || expiry <= new Date())) {
      return res.status(403).json({ error: 'Share link expired', code: 'SHARE_LINK_EXPIRED' })
    }

    // Check password if needed
    if (tokenData.password && !req.body.password) {
      return res.status(401).json({ error: 'Password required to fork' })
    }

    if (tokenData.password) {
      const bcrypt = require('bcryptjs')
      const isValid = await bcrypt.compare(req.body.password, tokenData.password)
      if (!isValid) return res.status(401).json({ error: 'Invalid password' })
    }

    const resolved = await readAuthoritativePresentation(tokenData.presentationId)

    if (!resolved) return res.status(404).json({ error: 'Original presentation not found' })

    const now = new Date().toISOString()
    const forkedPresentation = {
      ...resolved.presentation,
      id: uuidv4(),
      title: `${resolved.presentation.title} (Forked)`,
      createdAt: now,
      updatedAt: now,
    }
    delete forkedPresentation.deletedAt

    let packageHead
    let packageLifecycleAttempted = false
    const expectedSourceHead = resolved.presentation.pptxAggregateHead || null
    try {
      packageLifecycleAttempted = true
      packageHead = await duplicatePackageOwner(
        tokenData.presentationId,
        forkedPresentation.id,
        {
          projection: forkedPresentation,
          expectedSourceHead,
        }
      )
      if (expectedSourceHead && !packageHead) {
        throw Object.assign(new Error('Package-backed source head is unavailable'), {
          code: 'PRESENTATION_PACKAGE_HEAD_UNAVAILABLE',
          status: 409,
        })
      }
      if (!expectedSourceHead && !packageHead && await packagePresentationExists(tokenData.presentationId)) {
        throw Object.assign(new Error('Presentation package head appeared while forking'), {
          code: 'STALE_GENERATION',
          status: 409,
        })
      }
      if (packageHead) forkedPresentation.pptxAggregateHead = packageHead
      else delete forkedPresentation.pptxAggregateHead
      await withPresentations((presentations) => {
        presentations.push(forkedPresentation)
      })
    } catch (error) {
      let packagePublished = Boolean(packageHead)
      if (!packagePublished && packageLifecycleAttempted) {
        try {
          packagePublished = await packagePresentationExists(forkedPresentation.id)
        } catch {
          packagePublished = true
        }
      }
      if (packagePublished) {
        try {
          await quarantinePackageOwnerWithRetry(forkedPresentation.id)
        } catch (rollbackError) {
          throw Object.assign(new AggregateError(
            [error, rollbackError],
            'Explore fork and package rollback failed'
          ), {
            code: 'PACKAGE_LIFECYCLE_ROLLBACK_FAILED',
            status: 503,
          })
        }
      }
      throw error
    }

    res.json({
      presentation: toPresentationEditorDto(forkedPresentation),
    })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code })
  }
})

module.exports = router
