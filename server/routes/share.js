const express = require('express')
const uuidv4 = () => require('node:crypto').randomUUID()
const { validate } = require('../middleware/validate')
const { z } = require('zod')
const bcrypt = require('bcryptjs')
// eslint-disable-next-line unused-imports/no-unused-vars
const { generateRevealHTML } = require('revealjs-shared')
const { readShareTokens, withShareTokens } = require('../services/storage')
const { findServeablePresentation } = require('../services/presentation-finder')

const router = express.Router()

function sanitizeToken(tokenData) {
  if (typeof tokenData === 'string') {
    return { presentationId: tokenData, views: 0, createdAt: new Date().toISOString() }
  }
  return tokenData
}

// GET /api/presentations/:id/shares - List all share links for presentation
router.get('/:id/shares', async (req, res) => {
  try {
    const tokensRaw = await readShareTokens()
    const shares = Object.entries(tokensRaw)
      .map(([token, data]) => {
        const sanitized = sanitizeToken(data)
        return { token, ...sanitized }
      })
      .filter((share) => share.presentationId === req.params.id)
      .map((share) => {
        // don't send password hash to client
        const { password, ...rest } = share
        return { ...rest, isProtected: !!password }
      })

    res.json({ shares })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const shareBodySchema = z
  .object({
    name: z.string().max(200).optional(),
    password: z.string().max(128).optional(),
    expiresInDays: z.number().positive().max(365).optional(),
  })
  .passthrough()

// POST /api/presentations/:id/share - create a new share link
router.post('/:id/share', validate(shareBodySchema), async (req, res) => {
  try {
    // Serve-guard (C2): refuse minting a token for a missing or trashed deck.
    const presentation = await findServeablePresentation(req.params.id, { normalize: false })
    if (!presentation) return res.status(404).json({ error: 'Not found' })

    const { name, password, expiresInDays } = req.body

    const token = uuidv4()
    const newToken = {
      presentationId: req.params.id,
      name: name || 'Shared Link',
      views: 0,
      createdAt: new Date().toISOString(),
    }

    if (password) {
      newToken.password = await bcrypt.hash(password, 10)
    }

    if (expiresInDays) {
      const ms = expiresInDays * 24 * 60 * 60 * 1000
      newToken.expiresAt = new Date(Date.now() + ms).toISOString()
    }

    // Atomic RMW (I-R5.1): normalize legacy string tokens + insert under one lock.
    await withShareTokens((tokens) => {
      for (const t of Object.keys(tokens)) {
        tokens[t] = sanitizeToken(tokens[t])
      }
      tokens[token] = newToken
    })

    res.json({
      token,
      shared: true,
      data: { ...newToken, password: undefined, isProtected: !!password },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Note: DELETE /api/presentations/:id/share was used previously to delete ALL shares
// We redefine it to delete a specific share by token
// Since this router is mounted on `/api/presentations`, we'll need to be careful with paths.
// The new Phase 5 specifies DELETE /api/shares/:token.
// This requires mounting it separately or using `../shares/:token` but this router is mounted as `/api/presentations`.
// We will export a generic router that mounts at `/api/shares` as well. Wait, `shareRouter` handles both currently?
// No, index.js does: `app.use('/api/presentations', shareRouter)`

// Old delete route (disable all sharing)
router.delete('/:id/share', async (req, res) => {
  try {
    // Atomic RMW (I-R5.1): remove all tokens for this deck under one lock.
    await withShareTokens((tokens) => {
      for (const [token, data] of Object.entries(tokens)) {
        const sanitized = sanitizeToken(data)
        if (sanitized.presentationId === req.params.id) {
          delete tokens[token]
        }
      }
    })
    res.json({ shared: false })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id/share - legacy
router.get('/:id/share', async (req, res) => {
  try {
    const tokens = await readShareTokens()
    const entry = Object.entries(tokens).find(
      ([_token, data]) => sanitizeToken(data).presentationId === req.params.id
    )
    res.json({ shared: !!entry, token: entry ? entry[0] : null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
