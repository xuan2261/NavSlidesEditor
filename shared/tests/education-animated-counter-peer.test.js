import fs from 'node:fs'
import { JSDOM } from 'jsdom'
import { describe, expect, it, vi } from 'vitest'
const sandbox = new URL('../../plugins/animated-counter/dist/sandbox.html', import.meta.url)
describe('shipped Animated Counter peer', () => {
  it('initializes only from its parent and rejects tokenless/stale later updates', () => {
    const dom = new JSDOM(fs.readFileSync(sandbox, 'utf8'), { runScripts: 'dangerously' })
    const win = dom.window
    const post = vi.spyOn(win, 'postMessage').mockImplementation(() => {})
    const instanceToken = 'a'.repeat(32),
      documentToken = 'b'.repeat(32)
    const init = {
      source: 'navslides-host',
      type: 'init',
      instanceToken,
      documentToken,
      pluginData: {
        value: 42,
        prefix: '+',
        suffix: '%',
        label: 'Progress',
        color: '#22c55e',
        fontSize: 64,
      },
      size: { width: 360, height: 180 },
    }
    const emit = (message, source = win) =>
      win.dispatchEvent(
        new win.MessageEvent('message', {
          source,
          data: win.JSON.parse(JSON.stringify(message)),
        })
      )
    emit(init, {})
    expect(win.document.getElementById('value').textContent).toBe('0')
    emit(init)
    expect(win.document.getElementById('value').textContent).toBe('+42%')
    expect(win.document.getElementById('label').textContent).toBe('Progress')
    expect(post.mock.calls[0][0]).toEqual({
      source: 'navslides-plugin',
      type: 'ready',
      instanceToken,
      documentToken,
    })
    emit({
      ...init,
      type: 'data-changed',
      documentToken: 'c'.repeat(32),
      pluginData: { value: 99 },
    })
    emit({ source: 'navslides-host', type: 'data-changed', pluginData: { value: 99 } })
    expect(win.document.getElementById('value').textContent).toBe('+42%')
    emit({ ...init, type: 'data-changed', pluginData: { value: 51, label: 'Updated' } })
    expect(win.document.getElementById('value').textContent).toBe('+51%')
    expect(win.eval('window.navslides.updateData({ value: 52 })')).toBe(true)
    expect(post.mock.calls.at(-1)[0]).toEqual({
      source: 'navslides-plugin',
      type: 'update-data',
      instanceToken,
      documentToken,
      patch: { value: 52 },
    })
    win.dispatchEvent(new win.Event('pagehide'))
    expect(win.eval('window.navslides.updateData({ value: 53 })')).toBe(false)
    dom.window.close()
  })
})
