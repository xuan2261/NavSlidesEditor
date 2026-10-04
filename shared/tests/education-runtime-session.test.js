import { describe, expect, it } from 'vitest'
import { createRuntimeSession } from '../src/education/runtime-session.js'
import { createDeadlineClock } from '../src/education/browser/deadline-clock.js'

function manualClock() {
  let now = 0,
    nextId = 0
  const jobs = new Map()
  const clock = {
    now: () => now,
    setTimeout: (fn, delay) => {
      const id = ++nextId
      jobs.set(id, { fn, due: now + delay })
      return id
    },
    clearTimeout: (id) => jobs.delete(id),
    jump: (ms) => {
      now += ms
    },
    callbacks: () => [...jobs.values()].map((job) => job.fn),
    flush: () => {
      for (;;) {
        const due = [...jobs].find(([, job]) => job.due <= now)
        if (!due) return
        jobs.delete(due[0])
        due[1].fn()
      }
    },
  }
  return clock
}
const initialState = () => ({ count: 0, answers: [] })
const reducer = (state, command) => ({ ...state, count: state.count + command.amount })

describe('document-root session ownership', () => {
  it('isolates roots and exposes immutable state snapshots', () => {
    const a = createRuntimeSession(initialState, reducer)
    const b = createRuntimeSession(initialState, reducer)
    const before = a.getState()
    a.dispatch({ amount: 2 })
    expect(a.getState().count).toBe(2)
    expect(b.getState().count).toBe(0)
    expect(before.count).toBe(0)
    expect(() => a.getState().answers.push('modified')).toThrow()
    a.destroy()
    b.destroy()
  })
  it('replay invalidates delayed work and captured event generations', () => {
    const clock = manualClock(),
      cleanup = []
    const session = createRuntimeSession(initialState, reducer, { clock })
    const generation = session.getState().generation
    session.own(() => cleanup.push('subscription'))
    session.schedule(() => session.dispatch({ amount: 5 }), 100)
    const stale = clock.callbacks()[0]
    session.reset()
    stale()
    session.dispatch({ amount: 9 }, generation)
    expect(session.getState()).toMatchObject({ count: 0, generation: generation + 1 })
    expect(cleanup).toEqual(['subscription'])
    session.destroy()
  })
  it('pauses pending local feedback on leave and resumes only its remaining delay', () => {
    const clock = manualClock()
    const session = createRuntimeSession(initialState, reducer, { clock })
    session.schedule(() => session.dispatch({ amount: 3 }), 1000)
    clock.jump(400)
    session.pause()
    clock.jump(5000)
    clock.flush()
    expect(session.getState().count).toBe(0)
    session.resume()
    clock.jump(599)
    clock.flush()
    expect(session.getState().count).toBe(0)
    clock.jump(1)
    clock.flush()
    expect(session.getState().count).toBe(3)
    session.destroy()
  })
  it('destroys every owned resource and rejects work after teardown', () => {
    const clock = manualClock(),
      cleanup = []
    const session = createRuntimeSession(initialState, reducer, { clock })
    session.own(() => cleanup.push('pointer'))
    session.own(() => cleanup.push('listener'))
    session.schedule(() => session.dispatch({ amount: 8 }), 5)
    const stale = clock.callbacks()[0]
    session.destroy()
    session.destroy()
    stale()
    session.dispatch({ amount: 4 })
    expect(cleanup).toEqual(['pointer', 'listener'])
    expect(session.getState().count).toBe(0)
  })
  it('keeps reducer deadlines on active time across repeated hides and a paused replay', () => {
    const clock = manualClock()
    const initial = (active) => ({ deadline: active.now() + 1000, expired: false })
    const session = createRuntimeSession(
      initial,
      (state, command, active) =>
        command.type === 'tick' ? { ...state, expired: active.now() >= state.deadline } : state,
      { clock }
    )
    session.pause()
    clock.jump(5000)
    session.resume()
    expect(session.clock.now()).toBe(0)
    clock.jump(400)
    session.pause()
    clock.jump(3000)
    session.reset()
    expect(session.getState()).toMatchObject({ generation: 1, deadline: 1400, expired: false })
    session.clock.setTimeout(() => session.dispatch({ type: 'tick' }), 1000)
    clock.jump(6000)
    clock.flush()
    expect(session.getState().expired).toBe(false)
    session.resume()
    clock.jump(999)
    clock.flush()
    expect(session.getState().expired).toBe(false)
    clock.jump(1)
    clock.flush()
    expect(session.getState().expired).toBe(true)
    session.destroy()
  })
  it('does not freeze live time and cancels clock callbacks on replay', () => {
    const clock = manualClock(),
      values = []
    const session = createRuntimeSession(
      () => ({}),
      (state) => state,
      { clock, pauseOnHide: false }
    )
    session.clock.setTimeout(() => values.push('obsolete'), 500)
    const old = clock.callbacks()[0]
    session.reset()
    session.pause()
    clock.jump(2000)
    old()
    expect(session.clock.now()).toBe(2000)
    expect(values).toEqual([])
    session.destroy()
  })
})

describe('monotonic local and live deadlines', () => {
  it('expires once after a scheduler delay rather than counting received ticks', () => {
    const clock = manualClock(),
      expired = []
    const timer = createDeadlineClock({ clock, onExpire: () => expired.push('expired') })
    timer.start(5500)
    clock.jump(9000)
    clock.flush()
    clock.flush()
    expect(timer.getState()).toMatchObject({ remainingMs: 0, running: false, expired: true })
    expect(expired).toEqual(['expired'])
    timer.destroy()
  })
  it('keeps exact local remaining time across leave, but never pauses live deadlines', () => {
    const clock = manualClock()
    const local = createDeadlineClock({ clock }),
      live = createDeadlineClock({ clock, live: true })
    local.start(5500)
    live.start(5500)
    clock.jump(1500)
    local.pause()
    live.pause()
    clock.jump(3000)
    expect(local.getState().remainingMs).toBe(4000)
    expect(live.getState().remainingMs).toBe(1000)
    local.resume()
    clock.jump(1000)
    clock.flush()
    expect(local.getState().remainingMs).toBe(3000)
    expect(live.getState()).toMatchObject({ remainingMs: 0, expired: true })
    local.destroy()
    live.destroy()
  })
  it('cannot expire an old run after restart or destroy', () => {
    const clock = manualClock(),
      expired = []
    const timer = createDeadlineClock({ clock, onExpire: () => expired.push('expired') })
    timer.start(1000)
    const old = clock.callbacks()[0]
    timer.start(5000)
    clock.jump(1000)
    old()
    expect(timer.getState().remainingMs).toBe(4000)
    const current = clock.callbacks()[0]
    timer.destroy()
    clock.jump(9000)
    current()
    expect(expired).toEqual([])
  })
})
