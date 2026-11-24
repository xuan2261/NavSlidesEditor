import { describe, expect, it, vi } from 'vitest'
import { bindings, fixture, success } from './helpers/education-live-document.js'
const timer = (effectiveSlideId, remaining) => ({
  effectiveSlideId,
  elementId: 'layout-fixed:lesson:shared',
  remaining,
  duration: 30,
  running: true,
  endedAt: Date.now() + remaining * 1000,
})

describe('generated host timer instance snapshots', () => {
  it('buffers admitted timer sync during private hydration and isolates inherited copies through pause and expiry', async () => {
    let resolve
    const pending = new Promise((done) => {
      resolve = done
    })
    const { dom, sockets, live } = await fixture(pending)
    live.receive('timer:sync', timer('one', 20))
    live.receive('timer:sync', timer('two', 25))
    resolve(success(bindings()))
    await vi.waitFor(() =>
      expect(sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
    )
    const roots = [...dom.window.document.querySelectorAll('[data-ns-game]')]
    const parent = dom.window.NavSlidesEducation.mount(roots[0]),
      child = dom.window.NavSlidesEducation.mount(roots[1])
    expect(parent.getState().state.timer.remaining).toBe(20)
    expect(child.getState().state.timer.remaining).toBe(25)
    live.receive('timer:sync', {
      ...timer('one', 7),
      running: false,
      endedAt: null,
      pausedRemaining: 7,
    })
    expect(parent.getState().state.timer).toMatchObject({ running: false, remaining: 7 })
    expect(child.getState().state.timer.remaining).toBe(25)
    live.receive('timer:ended', {
      effectiveSlideId: 'one',
      elementId: 'layout-fixed:lesson:shared',
    })
    expect(parent.getState().state.timer).toMatchObject({ running: false, remaining: 0 })
    expect(child.getState().state.timer).toMatchObject({ running: true, remaining: 25 })
    live.receive('timer:sync', timer('unknown', 1))
    live.receive('disconnect')
    live.receive('timer:sync', timer('one', 10))
    expect(dom.window.NavSlidesEducation.mount(roots[0]).getState()).toMatchObject({
      runtimeMode: 'live',
      connection: 'disconnected',
    })
    expect(roots[0].querySelector('button, input, select')).toBeNull()
  })
})
