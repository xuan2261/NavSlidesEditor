export const PLUGIN_TYPE_PREFIX = 'plugin:'

export class PluginRegistry {
  constructor() {
    this.plugins = new Map()
    this.types = new Map()
  }

  clear() {
    this.plugins.clear()
    this.types.clear()
  }

  registerPlugin(plugin) {
    if (!plugin?.id || !plugin?.slug) return []
    this.plugins.set(plugin.id, plugin)
    const registered = []
    for (const element of plugin.contributes?.elements || []) {
      if (!element?.type) continue
      const fullType = `${PLUGIN_TYPE_PREFIX}${element.type}`
      const normalized = {
        fullType,
        pluginId: plugin.id,
        pluginSlug: plugin.slug,
        label: element.label || element.type,
        defaultSize: element.defaultSize || { width: 360, height: 180 },
        defaultData: element.defaultData || {},
        sandbox: element.sandbox || null,
      }
      this.types.set(fullType, normalized)
      registered.push(normalized)
    }
    return registered
  }

  getInsertablePluginTypes() {
    return [...this.types.values()].sort((a, b) => a.label.localeCompare(b.label))
  }

  getPluginForElement(type) {
    return this.types.get(type) || null
  }
}

export const pluginRegistry = new PluginRegistry()

export function isPluginElementType(type) {
  return typeof type === 'string' && type.startsWith(PLUGIN_TYPE_PREFIX)
}
