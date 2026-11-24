const express = require('express')
const { readSettings, updateSettings } = require('../services/storage')
const router = express.Router()

function respond(res, settings) {
  const ai = { ...(settings.ai || {}) }
  if (ai.apiKey) ai.apiKey = '***configured***'
  return res.set('ETag', `"${settings.settingsRevision}"`).json({ ...settings, ai })
}

router.get('/', async (req, res, next) => {
  try {
    respond(res, await readSettings())
  } catch (err) {
    next(err)
  }
})

// Top-level replacement; ai subkeys merge, with omitted/sentinel key preserving the secret.
router.put('/', async (req, res, next) => {
  try {
    const header = req.get('If-Match')
    if (header === undefined) return res.status(428).json({ error: 'If-Match settings revision is required' })
    if (!/^"\d+"$/.test(header) || !Number.isSafeInteger(Number(header.slice(1, -1)))) {
      return res.status(400).json({ error: 'If-Match must be a quoted integer settings revision' })
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    if (Object.hasOwn(body, 'settingsRevision')) {
      return res.status(400).json({ error: 'settingsRevision is server-owned' })
    }
    const updated = await updateSettings(Number(header.slice(1, -1)), (existing) => {
      const result = { ...existing, ...body }
      if ('ai' in body) {
        const incoming = body.ai && typeof body.ai === 'object' ? body.ai : {}
        result.ai = { ...(existing.ai || {}), ...incoming }
        if (incoming.apiKey === '***configured***' || incoming.apiKey === undefined) {
          result.ai.apiKey = existing.ai?.apiKey
        }
      }
      return result
    })
    respond(res, updated)
  } catch (err) {
    if (err.status === 412) return res.status(412).json({ error: err.message })
    next(err)
  }
})

module.exports = router
