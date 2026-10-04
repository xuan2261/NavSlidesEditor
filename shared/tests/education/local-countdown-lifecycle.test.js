// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, getRootLifecycle } from '../../src/education/browser/mount.js'
import { createUtilityConfig } from '../../src/education/utility-config.js'

const mounted = []
function countdown() {
  const root = document.createElement('div')
  root.setAttribute('data-ns-game', '')
  root.dataset.nsGameType = 'countdown'
  root.innerHTML =
    '<script type="application/json" data-ns-game-config></script><div data-ns-game-ui></div>'
  root.querySelector('script').textContent = JSON.stringify(
    createUtilityConfig('countdown', { durationSeconds: 2 })
  )
  document.body.append(root)
  const api = mount(root, { clock: { now: () => Date.now(), setTimeout, clearTimeout } })
  const result = {
    root,
    api,
    state: api.getState,
    lifecycle: getRootLifecycle(root),
    click: (command) => root.querySelector(`[data-ns-command="${command}"]`).click(),
  }
  mounted.push(result)
  return result
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
})
afterEach(() => {
  for (const m of mounted.splice(0)) {
    m.api.destroy()
    m.root.remove()
  }
  vi.useRealTimers()
})

describe('mounted countdown slide lifecycle', () => {
  it('preserves consumed remaining while hidden and expires once after returning', () => {
    const m = countdown()
    m.click('start')
    vi.advanceTimersByTime(500)
    m.lifecycle.pause()
    const hidden = m.state()
    expect(hidden).toMatchObject({
      phase: 'paused',
      pauseReason: 'lifecycle',
      remainingMs: 1500,
      deadline: null,
      expiries: 0,
    })
    vi.advanceTimersByTime(9000)
    expect(m.state()).toEqual(hidden)
    m.lifecycle.resume()
    vi.advanceTimersByTime(500)
    expect(m.state()).toMatchObject({
      phase: 'running',
      pauseReason: null,
      remainingMs: 1000,
      expiries: 0,
    })
    vi.advanceTimersByTime(1000)
    expect(m.state()).toMatchObject({
      phase: 'expired',
      remainingMs: 0,
      deadline: null,
      expiries: 1,
    })
    expect(m.root.querySelector('[role=status]').textContent).toBe('Time is up!')
    vi.advanceTimersByTime(5000)
    expect(m.state().expiries).toBe(1)
  })

  it('never resumes a user pause on slide return and does not resurrect reset deadlines', () => {
    const m = countdown()
    m.click('start')
    vi.advanceTimersByTime(500)
    m.click('pause')
    const userPaused = m.state()
    m.lifecycle.pause()
    vi.advanceTimersByTime(5000)
    m.lifecycle.resume()
    expect(m.state()).toEqual(userPaused)
    expect(m.root.querySelector('[data-ns-command=resume]').disabled).toBe(false)
    vi.advanceTimersByTime(3000)
    expect(m.state()).toMatchObject({
      phase: 'paused',
      pauseReason: 'user',
      remainingMs: 1500,
      expiries: 0,
    })
    m.click('resume')
    vi.advanceTimersByTime(1500)
    expect(m.state()).toMatchObject({ phase: 'expired', expiries: 1 })
    m.click('reset')
    m.click('start')
    vi.advanceTimersByTime(200)
    m.click('reset')
    const reset = m.state()
    m.lifecycle.pause()
    vi.advanceTimersByTime(5000)
    m.lifecycle.resume()
    vi.advanceTimersByTime(3000)
    expect(m.state()).toEqual(reset)
    expect(m.state()).toMatchObject({
      phase: 'idle',
      remainingMs: 2000,
      deadline: null,
      expiries: 0,
    })
    expect(m.root.querySelector('[data-ns-countdown]').textContent).toBe('00:02')
  })
})
