import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import CanvasElement from './canvas-element-wrapper.jsx'

vi.mock('../../plugins/plugin-sandbox', () => ({
  default: () => <iframe title="Plugin sandbox" sandbox="allow-scripts" />,
}))

describe('CanvasElement plugin rendering', () => {
  it('renders plugin elements through PluginSandbox', () => {
    const html = renderToString(
      <CanvasElement
        element={{
          id: 'plugin-1',
          type: 'plugin:counter',
          x: 0,
          y: 0,
          width: 320,
          height: 120,
          pluginSlug: 'animated-counter',
          pluginData: { value: 10 },
          pluginRuntime: { sandbox: 'sandbox.html' },
        }}
        onPointerDown={() => {}}
        onClick={() => {}}
        onDoubleClick={() => {}}
        onContextMenu={() => {}}
      />
    )

    expect(html).toContain('data-element-type="plugin:counter"')
    expect(html).toContain('Plugin sandbox')
  })
})
