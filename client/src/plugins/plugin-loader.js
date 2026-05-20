import { pluginRegistry } from './plugin-registry.js'

function createId() {
  return crypto.randomUUID()
}

export async function loadPlugins(fetcher = fetch, registry = pluginRegistry) {
  try {
    const response = await fetcher('/api/plugins')
    if (!response?.ok) return []
    const plugins = await response.json()
    registry.clear()
    for (const plugin of plugins || []) registry.registerPlugin(plugin)
    return registry.getInsertablePluginTypes()
  } catch {
    return []
  }
}

export function createPluginElement(fullType, overrides = {}, registry = pluginRegistry) {
  const meta = registry.getPluginForElement(fullType)
  if (!meta) throw new Error(`Unknown plugin element type: ${fullType}`)
  const element = {
    id: createId(),
    type: fullType,
    x: 100,
    y: 100,
    width: meta.defaultSize.width || 360,
    height: meta.defaultSize.height || 180,
    zIndex: 3,
    pluginId: meta.pluginId,
    pluginSlug: meta.pluginSlug,
    pluginData: { ...meta.defaultData },
    pluginRuntime: {
      label: meta.label,
      sandbox: meta.sandbox,
      exportMode: 'fallback',
    },
    ...overrides,
  }
  element.pluginData = { ...meta.defaultData, ...(overrides.pluginData || {}) }
  return element
}
