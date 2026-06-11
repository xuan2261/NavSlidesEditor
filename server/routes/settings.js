const express = require('express')
const { readSettings, writeSettings } = require('../services/storage')

const router = express.Router()

// GET /api/settings
router.get('/', async (req, res, next) => {
  try {
    const settings = await readSettings()
    // Mask sensitive fields
    const safeAi = settings.ai ? { ...settings.ai } : {}
    if (safeAi.apiKey) safeAi.apiKey = '***configured***'

    res.json({
      ...settings,
      ai: safeAi,
    })
  } catch (err) {
    next(err)
  }
})

// PUT /api/settings
// Contract: top-level keys are REPLACED (shallow). The `ai` object is the
// exception — it is deep-merged over the stored `ai` so omitting a sub-key
// (especially `apiKey`) preserves the stored value instead of wiping it.
router.put('/', async (req, res, next) => {
  try {
    const existing = await readSettings()
    const body = req.body && typeof req.body === 'object' ? req.body : {}

    const updated = { ...existing, ...body }

    if ('ai' in body) {
      const incomingAi = body.ai && typeof body.ai === 'object' ? body.ai : {}
      // Merge over stored ai so unspecified sub-keys (e.g. apiKey) survive.
      const mergedAi = { ...(existing.ai || {}), ...incomingAi }
      // Sentinel echo or omitted apiKey both keep the stored secret.
      if (incomingAi.apiKey === '***configured***' || incomingAi.apiKey === undefined) {
        mergedAi.apiKey = existing.ai?.apiKey
      }
      updated.ai = mergedAi
    }

    await writeSettings(updated)

    const safeAi = updated.ai ? { ...updated.ai } : {}
    if (safeAi.apiKey) safeAi.apiKey = '***configured***'

    res.json({
      ...updated,
      ai: safeAi,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
