const path = require('path')
const fs = require('fs-extra')
const { DATA_DIR } = require('./storage')

const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
const SAFE_ELEMENT_TYPE_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
const SAFE_SANDBOX_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/
const MANIFEST_FILE = 'parallax-plugin.json'
const BUNDLED_PLUGINS_DIR = path.resolve(__dirname, '..', '..', 'plugins')

function getUserPluginsDir() {
  return path.join(DATA_DIR, 'plugins')
}

function isSafeSlug(slug) {
  return typeof slug === 'string' && SAFE_SLUG_RE.test(slug)
}

function normalizeContributedElement(raw = {}) {
  const type = String(raw.type || '')
  const sandbox = raw.sandbox ? String(raw.sandbox) : null
  if (!SAFE_ELEMENT_TYPE_RE.test(type) || !raw.label) return null
  if (sandbox && (!SAFE_SANDBOX_RE.test(sandbox) || sandbox.includes('..'))) return null
  return {
    type,
    label: String(raw.label),
    defaultSize: raw.defaultSize || { width: 360, height: 180 },
    defaultData: raw.defaultData || {},
    sandbox,
  }
}

function normalizeManifest(manifest, slug, root) {
  if (!manifest?.id || !manifest?.name || !manifest?.version) return null
  const elements = (manifest.contributes?.elements || [])
    .map(normalizeContributedElement)
    .filter(Boolean)
  return {
    id: String(manifest.id),
    slug,
    name: String(manifest.name),
    version: String(manifest.version),
    description: manifest.description ? String(manifest.description) : '',
    contributes: { elements },
    root,
  }
}

async function readPluginFromRoot(root, slug) {
  if (!isSafeSlug(slug)) return null
  const pluginRoot = path.join(root, slug)
  const manifestPath = path.join(pluginRoot, MANIFEST_FILE)
  if (!(await fs.pathExists(manifestPath))) return null
  try {
    const manifest = await fs.readJson(manifestPath)
    return normalizeManifest(manifest, slug, pluginRoot)
  } catch (err) {
    console.warn(`Skipping invalid plugin manifest ${manifestPath}: ${err.message}`)
    return null
  }
}

async function discoverInRoot(root) {
  if (!(await fs.pathExists(root))) return []
  const entries = await fs.readdir(root, { withFileTypes: true })
  const plugins = await Promise.all(
    entries.filter((entry) => entry.isDirectory()).map((entry) => readPluginFromRoot(root, entry.name))
  )
  return plugins.filter(Boolean)
}

function publicPlugin(plugin) {
  const { root: _root, ...rest } = plugin
  return rest
}

async function listPlugins() {
  const bundled = await discoverInRoot(BUNDLED_PLUGINS_DIR)
  const user = await discoverInRoot(getUserPluginsDir())
  const bySlug = new Map()
  for (const plugin of [...bundled, ...user]) bySlug.set(plugin.slug, plugin)
  return [...bySlug.values()]
    .sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug))
    .map(publicPlugin)
}

async function getPlugin(slug) {
  if (!isSafeSlug(slug)) return { error: 'invalid' }
  const user = await readPluginFromRoot(getUserPluginsDir(), slug)
  const bundled = await readPluginFromRoot(BUNDLED_PLUGINS_DIR, slug)
  const plugin = user || bundled
  return plugin ? publicPlugin(plugin) : null
}

async function resolvePluginAssetPath(slug, assetPath) {
  if (!isSafeSlug(slug)) return { error: 'invalid' }
  const plugin = await readPluginFromRoot(getUserPluginsDir(), slug) || await readPluginFromRoot(BUNDLED_PLUGINS_DIR, slug)
  if (!plugin) return null
  const distRoot = path.join(plugin.root, 'dist')
  const requested = path.resolve(distRoot, assetPath || '')
  if (!requested.startsWith(distRoot + path.sep) && requested !== distRoot) {
    return { error: 'invalid' }
  }
  return requested
}

module.exports = {
  isSafeSlug,
  listPlugins,
  getPlugin,
  resolvePluginAssetPath,
}
