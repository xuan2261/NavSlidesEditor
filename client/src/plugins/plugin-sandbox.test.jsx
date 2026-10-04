import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PluginSandbox from './plugin-sandbox.jsx'
afterEach(() => vi.unstubAllGlobals())
const fetchDocument = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: async () => '<button>Counter</button>' }))
  )
describe('PluginSandbox', () => {
  it('reports asset failures instead of silently loading a blank peer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 }))
    )
    render(<PluginSandbox sandboxUrl="/missing" />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/404/)
  })
  it('rejects tokenless/sibling/stale patches while preserving ready peer updates', async () => {
    fetchDocument()
    const onDataUpdate = vi.fn()
    const { unmount } = render(
      <PluginSandbox
        sandboxUrl="/peer"
        pluginData={{ value: 1 }}
        width={360}
        height={180}
        onDataUpdate={onDataUpdate}
      />
    )
    const iframe = await screen.findByTitle('Plugin sandbox')
    const source = iframe.contentWindow
    const send = vi.spyOn(source, 'postMessage')
    fireEvent.load(iframe)
    const init = send.mock.calls.at(-1)[0]
    const message = (type, extra = {}) => ({
      source: 'navslides-plugin',
      type,
      instanceToken: init.instanceToken,
      documentToken: init.documentToken,
      ...extra,
    })
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source,
          data: { source: 'navslides-plugin', type: 'update-data', patch: { value: 2 } },
        })
      )
      window.dispatchEvent(new MessageEvent('message', { source: window, data: message('ready') }))
      window.dispatchEvent(new MessageEvent('message', { source, data: message('ready') }))
      window.dispatchEvent(
        new MessageEvent('message', {
          source,
          data: message('update-data', { patch: { value: 3 } }),
        })
      )
    })
    expect(onDataUpdate).toHaveBeenCalledWith({ value: 3 })
    fireEvent.load(iframe)
    act(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          source,
          data: message('update-data', { patch: { value: 4 } }),
        })
      )
    )
    expect(onDataUpdate).toHaveBeenCalledTimes(1)
    unmount()
    act(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          source,
          data: message('update-data', { patch: { value: 5 } }),
        })
      )
    )
    expect(onDataUpdate).toHaveBeenCalledTimes(1)
  })
})
