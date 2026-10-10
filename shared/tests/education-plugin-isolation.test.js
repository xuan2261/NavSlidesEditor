import { describe, expect, it, vi } from 'vitest'
import {
  createPluginHostBridge,
  createPluginPeerBridge,
  validatePluginMessage,
} from '../src/education/plugin-message-contract.js'
const token = 'a'.repeat(32)
const generation = 'b'.repeat(32)
const patch = (value) => ({
  source: 'navslides-plugin',
  type: 'update-data',
  instanceToken: token,
  documentToken: generation,
  patch: { value },
})
function channel() {
  const listeners = new Set()
  return {
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    emit: (event) => listeners.forEach((fn) => fn(event)),
    postMessage: vi.fn(),
  }
}
describe('plugin document message isolation', () => {
  it('accepts valid bounded JSON updates and rejects unknown/prototype/oversized fields', () => {
    const context = { direction: 'peer', instanceToken: token, documentToken: generation }
    expect(validatePluginMessage(patch(2), context)).toBe(true)
    for (const message of [
      { ...patch(2), extra: true },
      { ...patch(2), documentToken: token },
      { ...patch(2), patch: JSON.parse('{"__proto__":{"polluted":true}}') },
      { ...patch(2), instanceToken: generation },
      { ...patch(2), patch: { items: Array(2) } },
      Object.defineProperty(patch(2), 'hiddenAuthority', { value: true }),
      { ...patch(2), patch: Object.create({ inherited: 1 }) },
      { ...patch(2), patch: { value: 'x'.repeat(65537) } },
      { ...patch(2), patch: { value: Infinity } },
      { ...patch(2), patch: new Date() },
      { source: 'navslides-plugin', type: 'update-data', patch: {} },
    ]) {
      expect(validatePluginMessage(message, context)).toBe(false)
    }
    expect(validatePluginMessage(patch(1), { ...context, direction: 'host' })).toBe(false)
  })
  it('rejects getters without executing them and rejects oversized host data before admission', () => {
    const getter = vi.fn(() => 1)
    const payload = Object.defineProperty({}, 'value', { enumerable: true, get: getter })
    expect(validatePluginMessage({ ...patch(1), patch: payload }, { direction: 'peer' })).toBe(
      false
    )
    expect(getter).not.toHaveBeenCalled()
    expect(() =>
      createPluginHostBridge({
        frame: { contentWindow: channel() },
        hostWindow: channel(),
        pluginData: { value: 'x'.repeat(65537) },
        size: { width: 360, height: 180 },
        createToken: () => token,
      })
    ).toThrow(/data/i)
  })
  it('initiates on load, rotates generation, rejects siblings/stale updates, and destroys listeners', () => {
    const hostWindow = channel(),
      peer = channel(),
      onDataUpdate = vi.fn()
    const tokens = ['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(32)]
    const bridge = createPluginHostBridge({
      frame: { contentWindow: peer },
      hostWindow,
      pluginData: { value: 4 },
      size: { width: 360, height: 180 },
      onDataUpdate,
      createToken: () => tokens.shift(),
    })
    bridge.load()
    const first = peer.postMessage.mock.calls[0][0]
    expect(first.type).toBe('init')
    hostWindow.emit({ source: channel(), data: patch(1) })
    hostWindow.emit({ source: peer, data: patch(2) })
    expect(onDataUpdate).not.toHaveBeenCalled()
    hostWindow.emit({
      source: peer,
      data: {
        source: 'navslides-plugin',
        type: 'ready',
        instanceToken: token,
        documentToken: generation,
      },
    })
    hostWindow.emit({ source: peer, data: patch(3) })
    expect(onDataUpdate).toHaveBeenCalledWith({ value: 3 })
    bridge.load()
    hostWindow.emit({ source: peer, data: patch(4) })
    expect(onDataUpdate).toHaveBeenCalledTimes(1)
    const fresh = peer.postMessage.mock.calls.at(-1)[0]
    expect(fresh.documentToken).not.toBe(first.documentToken)
    bridge.destroy()
    hostWindow.emit({ source: peer, data: { ...patch(5), documentToken: fresh.documentToken } })
    expect(onDataUpdate).toHaveBeenCalledTimes(1)
  })
  it('binds a peer only to parent init and validates all subsequent messages', () => {
    const peerWindow = channel(),
      parentWindow = channel(),
      onData = vi.fn()
    const peer = createPluginPeerBridge({ peerWindow, parentWindow, onData })
    const init = {
      source: 'navslides-host',
      type: 'init',
      instanceToken: token,
      documentToken: generation,
      pluginData: { value: 10 },
      size: { width: 360, height: 180 },
    }
    peerWindow.emit({ source: channel(), data: init })
    expect(onData).not.toHaveBeenCalled()
    peerWindow.emit({ source: parentWindow, data: init })
    expect(onData).toHaveBeenCalledWith({ value: 10 }, init.size)
    expect(parentWindow.postMessage.mock.calls[0][0].type).toBe('ready')
    peerWindow.emit({ source: parentWindow, data: { ...init, documentToken: token } })
    peerWindow.emit({
      source: parentWindow,
      data: { ...init, type: 'data-changed', documentToken: token },
    })
    expect(onData).toHaveBeenCalledTimes(1)
    peerWindow.emit({
      source: parentWindow,
      data: { ...init, type: 'data-changed', pluginData: { value: 20 } },
    })
    expect(onData).toHaveBeenLastCalledWith({ value: 20 }, init.size)
    expect(peer.updateData({ value: 21 })).toBe(true)
    expect(parentWindow.postMessage.mock.calls.at(-1)[0]).toEqual(patch(21))
    peer.destroy()
    expect(peer.updateData({ value: 22 })).toBe(false)
  })
})
