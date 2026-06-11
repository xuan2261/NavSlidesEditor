const express = require('express')
const uuidv4 = () => require('node:crypto').randomUUID()
const { readShareTokens, readPresentations, withPresentations } = require('../services/storage')
const { findServeablePresentation } = require('../services/presentation-finder')

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
    const presentations = await readPresentations()

    // In our simplified model, "public" implies any presentation with at least one active shared link
    // that isn't password protected or expired.
    const publicShares = Object.values(tokens)
      .map(sanitizeToken)
      .filter((t) => !t.password && (!t.expiresAt || new Date(t.expiresAt) > new Date()))

    // Collect unique presentation IDs
    const uniqueIds = [...new Set(publicShares.map((t) => t.presentationId))]

    const publicDecks = presentations
      .filter((p) => uniqueIds.includes(p.id) && !p.deletedAt)
      .map((p) => ({
        id: p.id,
        title: p.title || 'Untitled Presentation',
        slideCount: p.slides ? p.slides.length : 0,
        createdAt: p.createdAt || new Date().toISOString(),
      }))

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

    // Check password if needed
    if (tokenData.password && !req.body.password) {
      return res.status(401).json({ error: 'Password required to fork' })
    }

    if (tokenData.password) {
      const bcrypt = require('bcryptjs')
      const isValid = await bcrypt.compare(req.body.password, tokenData.password)
      if (!isValid) return res.status(401).json({ error: 'Invalid password' })
    }

    const original = await findServeablePresentation(tokenData.presentationId, { normalize: false })

    if (!original) return res.status(404).json({ error: 'Original presentation not found' })

    const forkedPresentation = {
      ...original,
      id: uuidv4(),
      title: `${original.title} (Forked)`,
      createdAt: new Date().toISOString(),
    }
    delete forkedPresentation.deletedAt

    await withPresentations((presentations) => {
      presentations.push(forkedPresentation)
    })

    res.json({ presentation: forkedPresentation })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
