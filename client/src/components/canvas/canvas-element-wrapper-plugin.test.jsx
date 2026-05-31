import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import CanvasElement from './canvas-element-wrapper.jsx'

vi.mock('../../plugins/plugin-sandbox', () => ({
  default: ({ onDataUpdate }) => (
    <button type="button" onClick={() => onDataUpdate?.({ value: 11 })}>
      Plugin sandbox
    </button>
  ),
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

  it('persists plugin sandbox data patches through the element update contract', () => {
    const onUpdateElement = vi.fn()
    render(
      <CanvasElement
        element={{
          id: 'plugin-1',
          type: 'plugin:counter',
          x: 0,
          y: 0,
          width: 320,
          height: 120,
          pluginSlug: 'animated-counter',
          pluginData: { value: 10, label: 'Score' },
          pluginRuntime: { sandbox: 'sandbox.html' },
        }}
        onPointerDown={() => {}}
        onClick={() => {}}
        onDoubleClick={() => {}}
        onContextMenu={() => {}}
        onUpdateElement={onUpdateElement}
      />
    )

    fireEvent.click(screen.getByText('Plugin sandbox'))

    expect(onUpdateElement).toHaveBeenCalledWith('plugin-1', {
      pluginData: { value: 11, label: 'Score' },
    })
  })
})
