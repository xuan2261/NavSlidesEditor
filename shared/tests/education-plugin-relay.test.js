import { describe, expect, it, vi } from 'vitest'
import { createPluginRelayBridge } from '../src/education/plugin-message-contract.js'
function endpoint() {
  const listeners = new Map()
  return {
    postMessage: vi.fn(),
    addEventListener(type, callback) {
      listeners.set(type, [...(listeners.get(type) || []), callback])
    },
    removeEventListener(type, callback) {
      listeners.set(
        type,
        (listeners.get(type) || []).filter((item) => item !== callback)
      )
    },
    emit(type, event) {
      ;(listeners.get(type) || []).forEach((callback) => callback(event))
    },
  }
}
describe('trusted two-epoch plugin container', () => {
  it('terminates both bridges, defers outer ready, rotates inner loads and discards stale/sibling patches', () => {
    const parent = endpoint(),
      child = endpoint(),
      relayWindow = endpoint(),
      frame = endpoint()
    relayWindow.parent = parent
    frame.contentWindow = child
    const tokens = ['d'.repeat(32), 'e'.repeat(32), 'f'.repeat(32)]
    const relay = createPluginRelayBridge({ frame, relayWindow, createToken: () => tokens.shift() })
    const outer = {
      source: 'navslides-host',
      type: 'init',
      instanceToken: 'a'.repeat(32),
      documentToken: 'b'.repeat(32),
      pluginData: { value: 42 },
      size: { width: 360, height: 180 },
    }
    relayWindow.emit('message', { source: parent, data: outer })
    expect(parent.postMessage).not.toHaveBeenCalled()
    frame.emit('load', {})
    const init = child.postMessage.mock.calls.at(-1)[0]
    expect(init.pluginData).toEqual({ value: 42 })
    expect(init.instanceToken).not.toBe(outer.instanceToken)
    const childMessage = (type, fields = {}) => ({
      source: 'navslides-plugin',
      type,
      instanceToken: init.instanceToken,
      documentToken: init.documentToken,
      ...fields,
    })
    relayWindow.emit('message', { source: child, data: childMessage('ready') })
    expect(parent.postMessage.mock.calls.at(-1)[0]).toEqual({
      source: 'navslides-plugin',
      type: 'ready',
      instanceToken: outer.instanceToken,
      documentToken: outer.documentToken,
    })
    relayWindow.emit('message', {
      source: endpoint(),
      data: childMessage('update-data', { patch: { value: 99 } }),
    })
    relayWindow.emit('message', {
      source: child,
      data: childMessage('update-data', { patch: { value: 43 } }),
    })
    expect(parent.postMessage.mock.calls.at(-1)[0]).toEqual({
      source: 'navslides-plugin',
      type: 'update-data',
      instanceToken: outer.instanceToken,
      documentToken: outer.documentToken,
      patch: { value: 43 },
    })
    frame.emit('load', {})
    const count = parent.postMessage.mock.calls.length
    relayWindow.emit('message', {
      source: child,
      data: childMessage('update-data', { patch: { value: 44 } }),
    })
    expect(parent.postMessage.mock.calls.length).toBe(count)
    expect(child.postMessage.mock.calls.at(-1)[0].documentToken).not.toBe(init.documentToken)
    relay.destroy()
    frame.emit('load', {})
    expect(parent.postMessage.mock.calls.length).toBe(count)
  })
})
