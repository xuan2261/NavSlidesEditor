import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPluginElement, loadPlugins } from './plugin-loader.js'
import { PluginRegistry } from './plugin-registry.js'

const plugin = {
  id: 'navslides.animated-counter',
  slug: 'animated-counter',
  contributes: {
    elements: [
      {
        type: 'counter',
        label: 'Animated Counter',
        defaultSize: { width: 320, height: 120 },
        defaultData: { value: 42 },
        sandbox: 'sandbox.html',
      },
    ],
  },
}

describe('plugin-loader', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'plugin-el-1' })
  })

  it('returns an empty list when API loading fails', async () => {
    const result = await loadPlugins(() => Promise.reject(new Error('offline')), new PluginRegistry())

    expect(result).toEqual([])
  })

  it('loads plugins and creates plugin elements with defaults', async () => {
    const registry = new PluginRegistry()
    const result = await loadPlugins(
      () => Promise.resolve({ ok: true, json: () => Promise.resolve([plugin]) }),
      registry
    )
    const element = createPluginElement('plugin:counter', {}, registry)

    expect(result).toHaveLength(1)
    expect(element).toMatchObject({
      id: 'plugin-el-1',
      type: 'plugin:counter',
      width: 320,
      height: 120,
      pluginSlug: 'animated-counter',
      pluginData: { value: 42 },
      pluginRuntime: { label: 'Animated Counter', sandbox: 'sandbox.html' },
    })
  })

  it('lets caller overrides win while merging plugin data', () => {
    const registry = new PluginRegistry()
    registry.registerPlugin(plugin)
    const element = createPluginElement(
      'plugin:counter',
      { width: 500, pluginData: { value: 7, suffix: '%' } },
      registry
    )

    expect(element.width).toBe(500)
    expect(element.pluginData).toEqual({ value: 7, suffix: '%' })
  })
})
