import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PluginSandbox from './plugin-sandbox.jsx'

describe('PluginSandbox', () => {
  it('renders a loading state while sandbox fetch is pending', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<PluginSandbox sandboxUrl="/api/plugins/p/assets/sandbox.html" />)

    expect(screen.getByText('Loading plugin...')).toBeTruthy()
  })

  it('renders an allow-scripts iframe after loading sandbox html', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve('<html><head></head><body></body></html>') })))
    render(<PluginSandbox sandboxUrl="/api/plugins/p/assets/sandbox.html" />)

    const iframe = await screen.findByTitle('Plugin sandbox')
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
    expect(iframe.getAttribute('srcdoc')).toContain('navslides')
  })

  it('ignores unrelated messages and forwards sandbox data patches', async () => {
    const onDataUpdate = vi.fn()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve('<html></html>') })))
    render(<PluginSandbox sandboxUrl="/api/plugins/p/assets/sandbox.html" onDataUpdate={onDataUpdate} />)
    const iframe = await screen.findByTitle('Plugin sandbox')
    const source = iframe.contentWindow

    act(() => {
      window.dispatchEvent(new MessageEvent('message', { source: window, data: { source: 'navslides-plugin', type: 'update-data', patch: { value: 1 } } }))
      window.dispatchEvent(new MessageEvent('message', { source, data: { source: 'navslides-plugin', type: 'update-data', patch: { value: 2 } } }))
    })

    expect(onDataUpdate).toHaveBeenCalledTimes(1)
    expect(onDataUpdate).toHaveBeenCalledWith({ value: 2 })
  })
})
