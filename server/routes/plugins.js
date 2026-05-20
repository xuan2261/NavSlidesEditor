const express = require('express')
const path = require('path')
const fs = require('fs-extra')
const {
  getPlugin,
  isSafeSlug,
  listPlugins,
  resolvePluginAssetPath,
} = require('../services/plugin-runtime')

const router = express.Router()

function invalidPluginPath(res) {
  return res.status(400).json({ error: 'Invalid plugin path' })
}

router.get('/', async (_req, res, next) => {
  try {
    res.json(await listPlugins())
  } catch (err) {
    next(err)
  }
})

router.get('/:slug', async (req, res, next) => {
  try {
    const plugin = await getPlugin(req.params.slug)
    if (plugin?.error === 'invalid') return invalidPluginPath(res)
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' })
    res.json(plugin)
  } catch (err) {
    next(err)
  }
})

router.get('/:slug/manifest', async (req, res, next) => {
  try {
    const plugin = await getPlugin(req.params.slug)
    if (plugin?.error === 'invalid') return invalidPluginPath(res)
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' })
    res.json(plugin)
  } catch (err) {
    next(err)
  }
})

router.get('/:slug/assets/*', async (req, res, next) => {
  try {
    if (!isSafeSlug(req.params.slug)) return invalidPluginPath(res)
    const asset = await resolvePluginAssetPath(req.params.slug, req.params[0])
    if (asset?.error === 'invalid') return invalidPluginPath(res)
    if (!asset || !(await fs.pathExists(asset))) {
      return res.status(404).json({ error: 'Plugin asset not found' })
    }
    res.sendFile(path.resolve(asset))
  } catch (err) {
    next(err)
  }
})

module.exports = router
