import { describe, expect, it } from 'vitest'
import { PluginRegistry } from './plugin-registry.js'

const manifest = {
  id: 'navslides.animated-counter',
  slug: 'animated-counter',
  name: 'Animated Counter',
  contributes: {
    elements: [{ type: 'counter', label: 'Animated Counter', sandbox: 'sandbox.html' }],
  },
}

describe('PluginRegistry', () => {
  it('normalizes contributed element types to plugin-prefixed insertable types', () => {
    const registry = new PluginRegistry()
    registry.registerPlugin(manifest)

    expect(registry.getInsertablePluginTypes()[0]).toMatchObject({
      fullType: 'plugin:counter',
      pluginId: 'navslides.animated-counter',
      pluginSlug: 'animated-counter',
      label: 'Animated Counter',
    })
  })

  it('does not duplicate types when a manifest is registered repeatedly', () => {
    const registry = new PluginRegistry()
    registry.registerPlugin(manifest)
    registry.registerPlugin(manifest)

    expect(registry.getInsertablePluginTypes()).toHaveLength(1)
  })
})
