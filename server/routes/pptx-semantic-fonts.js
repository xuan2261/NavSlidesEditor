const express = require('express')
const { readAuthoritativePresentation } = require('../services/package-backed-presentation-read')
const { resolveSemanticFontDelivery } = require('../services/pptx-import/semantic-font-delivery')
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

// Mounted inside the existing local-server / externally authenticated API
// boundary. Public share tokens never authorize filesystem font access.
function createSemanticFontRouter({ roots, readPresentation = readAuthoritativePresentation } = {}) {
  const router = express.Router()
  async function deliver(req, res) {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    if (!/^[a-zA-Z0-9_-]+$/.test(req.params.id) ||
        Object.keys(req.query).some((key) => key !== 'sourceIdentity') ||
        !hash(req.query.sourceIdentity) ||
        (req.params.assetHash !== undefined && !hash(req.params.assetHash)))
      return res.status(400).json({ code: 'source-font-request-invalid' })
    try {
      const resolved = await readPresentation(req.params.id)
      if (!resolved) return res.status(404).json({ code: 'source-font-presentation-missing' })
      const result = await resolveSemanticFontDelivery(
        resolved.presentation, req.query.sourceIdentity, roots)
      if (req.params.assetHash) {
        const face = result.fontProfile.faces.find((face) => face.assetHash === req.params.assetHash)
        if (!face) return res.status(404).json({ code: 'source-font-asset-unavailable' })
        const asset = result.assets.find((asset) => asset.faceId === face.id)
        return res.set({ 'Content-Type': 'application/octet-stream',
          'X-Content-SHA256': face.assetHash }).send(Buffer.from(asset.bytes))
      }
      const { assets: _assets, ...profile } = result
      return res.json(profile)
    } catch (error) {
      const known = typeof error.code === 'string' && error.code.startsWith('source-font-')
      return res.status(known ? error.status : 422)
        .json({ code: known ? error.code : 'source-font-authority-unavailable' })
    }
  }
  router.get('/:id/semantic-fonts', deliver)
  router.get('/:id/semantic-fonts/:assetHash', deliver)
  return router
}
module.exports = { createSemanticFontRouter }
