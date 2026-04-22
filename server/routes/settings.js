const express = require('express')
const { readSettings, writeSettings } = require('../services/storage')

const router = express.Router()

// GET /api/settings
router.get('/', async (req, res) => {
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
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const existing = await readSettings()
    const updated = { ...existing, ...req.body }

    // If client sends '***configured***', preserve the original key
    if (updated.ai && updated.ai.apiKey === '***configured***') {
      updated.ai.apiKey = existing.ai?.apiKey
    }

    await writeSettings(updated)

    const safeAi = updated.ai ? { ...updated.ai } : {}
    if (safeAi.apiKey) safeAi.apiKey = '***configured***'

    res.json({
      ...updated,
      ai: safeAi,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
