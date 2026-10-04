// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createUtilityConfig } from '../../src/education/utility-config.js'
import { createLuckyWheelState, reduceLuckyWheel } from '../../src/education/lucky-wheel-state.js'
import { createCountdownState, reduceCountdown } from '../../src/education/countdown-state.js'
import { createScoreboardState, reduceScoreboard } from '../../src/education/scoreboard-state.js'
import { presentLuckyWheel } from '../../src/education/browser/lucky-wheel-presenter.js'
import { presentCountdown } from '../../src/education/browser/countdown-presenter.js'
import { presentScoreboard } from '../../src/education/browser/scoreboard-presenter.js'
import { createRuntimeSession } from '../../src/education/runtime-session.js'
import { createInteractionVariableStore } from '../../src/education/interaction-variables.js'

const implementations = {
  'lucky-wheel': [createLuckyWheelState, reduceLuckyWheel, presentLuckyWheel],
  countdown: [createCountdownState, reduceCountdown, presentCountdown],
  scoreboard: [createScoreboardState, reduceScoreboard, presentScoreboard],
}
function mount(type, patch, variables) {
  const config = createUtilityConfig(type, patch),
    root = document.createElement('div')
  root.innerHTML = '<div data-ns-game-ui></div>'
  document.body.append(root)
  let now = 0,
    presenter,
    nextId = 0
  const tasks = new Map(),
    [factory, reducer, present] = implementations[type]
  const clock = {
    now: () => now,
    setTimeout: (fn, delay) => {
      const id = ++nextId
      tasks.set(id, { fn, due: now + delay })
      return id
    },
    clearTimeout: (id) => tasks.delete(id),
  }
  const dependencies = { now: clock.now, random: () => 0 }
  const session = createRuntimeSession(
    () => factory(config, dependencies),
    (state, command) => reducer(config, state, command, dependencies),
    { clock, onState: (state) => presenter?.render(state) }
  )
  const reset = () => {
    presenter = null
    session.reset()
    build()
  }
  function build() {
    presenter = present({ root, config, session, clock, variables, reset })
    presenter.render(session.getState())
  }
  build()
  return {
    root,
    session,
    config,
    tasks,
    tick: (time) => {
      now = time
      const ready = [...tasks].filter(([, task]) => task.due <= now)
      ready.forEach(([id, task]) => {
        tasks.delete(id)
        task.fn()
      })
    },
    close: () => {
      session.destroy()
      root.remove()
    },
  }
}
const click = (root, label) =>
  [...root.querySelectorAll('button')].find((control) => control.textContent === label).click()
const variableSpecs = [
  { id: 'score', name: 'Score', initialValue: 1, min: 0, max: 3 },
  { id: 'other', name: 'Other', initialValue: 0, min: 0, max: 9 },
]
const boundTeam = { id: 'a', name: 'A', color: '#123456', variableId: 'score' }

describe('utility DOM controls and lifecycle', () => {
  it('commits wheel selection once, exhausts, resets and cancels old completion', () => {
    const mounted = mount('lucky-wheel', {
      items: [{ id: 'a', label: 'A', weight: 1 }],
      animationDuration: 20,
      showConfetti: false,
    })
    click(mounted.root, 'Spin')
    click(mounted.root, 'Spinning…')
    expect(mounted.session.getState().turn).toBe(1)
    expect(mounted.session.getState().poolIds).toEqual([])
    const old = [...mounted.tasks.values()][0].fn
    click(mounted.root, 'Reset')
    old()
    expect(mounted.session.getState().poolIds).toEqual(['a'])
    click(mounted.root, 'Spin')
    mounted.tick(20)
    expect(mounted.root.querySelector('[data-ns-winner]').textContent).toBe('A')
    expect(mounted.root.querySelector('[data-ns-command=spin]').disabled).toBe(true)
    mounted.close()
  })
  it('keeps duration draft and focus during ticks and preserves user pause', () => {
    const mounted = mount('countdown', { durationSeconds: 2 })
    click(mounted.root, 'Start')
    const duration = mounted.root.querySelector('input')
    duration.value = '7'
    duration.focus()
    mounted.tick(500)
    expect(duration.value).toBe('7')
    expect(document.activeElement).toBe(duration)
    click(mounted.root, 'Pause')
    mounted.tick(9000)
    expect(mounted.session.getState().remainingMs).toBe(1500)
    expect(mounted.root.querySelector('[role=status]').textContent).not.toContain('Time is up')
    click(mounted.root, 'Resume')
    mounted.tick(10500)
    expect(mounted.session.getState().expiries).toBe(1)
    expect(mounted.root.querySelector('[role=status]').textContent).toBe('Time is up!')
    mounted.close()
  })
  it('applies a local duration once through form submit and resets to authored duration', () => {
    const mounted = mount('countdown', { durationSeconds: 3 })
    const input = mounted.root.querySelector('input'),
      form = mounted.root.querySelector('form')
    input.value = '0'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(mounted.session.getState().remainingMs).toBe(3000)
    expect(mounted.root.querySelector('[role=alert]').textContent).toMatch(/whole duration/)
    input.value = '7'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(mounted.session.getState().remainingMs).toBe(7000)
    expect(mounted.config.durationSeconds).toBe(3)
    click(mounted.root, 'Start')
    mounted.tick(2000)
    expect(mounted.session.getState().remainingMs).toBe(5000)
    click(mounted.root, 'Reset')
    expect(mounted.session.getState().phase).toBe('idle')
    expect(mounted.session.getState().remainingMs).toBe(3000)
    mounted.close()
  })
  it('uses one document variable authority for two boards and preserves unrelated values on explicit reset', () => {
    const variables = createInteractionVariableStore(variableSpecs)
    const first = mount('scoreboard', { teams: [boundTeam] }, variables)
    const second = mount('scoreboard', { teams: [boundTeam], resetBoundVariables: true }, variables)
    first.root.querySelector('[data-ns-command=increase]').click()
    expect(variables.read('score')).toBe(2)
    expect(first.root.querySelector('[data-ns-score]').textContent).toBe('2')
    expect(second.root.querySelector('[data-ns-score]').textContent).toBe('2')
    click(first.root, 'Reset')
    expect(variables.read('score')).toBe(2)
    variables.change('other', 4)
    click(second.root, 'Reset')
    expect(variables.getState()).toEqual({ score: 1, other: 4 })
    first.close()
    variables.change('score', 1)
    expect(second.root.querySelector('[data-ns-score]').textContent).toBe('2')
    expect(second.config.teams[0]).not.toHaveProperty('initialScore')
    second.close()
    variables.destroy()
  })
  it('clamps one large bound score adjustment without changing the local scoreboard range', () => {
    const variables = createInteractionVariableStore(variableSpecs)
    const mounted = mount(
      'scoreboard',
      { teams: [boundTeam], step: 1e9, minScore: -1, maxScore: 1 },
      variables
    )
    mounted.root.querySelector('[data-ns-command=increase]').click()
    expect(variables.read('score')).toBe(3)
    expect(mounted.root.querySelector('[data-ns-score]').textContent).toBe('3')
    mounted.root.querySelector('[data-ns-command=decrease]').click()
    expect(variables.read('score')).toBe(0)
    mounted.close()
    variables.destroy()
  })
  it('keeps two wheel pools and timer durations independent', () => {
    const first = mount('lucky-wheel', { animationDuration: 0 }),
      second = mount('lucky-wheel', { animationDuration: 0 })
    click(first.root, 'Spin')
    expect(first.session.getState().poolIds).toEqual(['prize-2'])
    expect(second.session.getState().poolIds).toEqual(['prize-1', 'prize-2'])
    first.close()
    second.close()
    const short = mount('countdown', { durationSeconds: 1, autoStart: true }),
      long = mount('countdown', { durationSeconds: 3, autoStart: true })
    short.tick(1000)
    long.tick(1000)
    expect(short.session.getState().phase).toBe('expired')
    expect(long.session.getState().remainingMs).toBe(2000)
    click(short.root, 'Reset')
    expect(short.session.getState().remainingMs).toBe(1000)
    expect(long.session.getState().remainingMs).toBe(2000)
    short.close()
    long.close()
  })
  it('shows unknown variable failures rather than creating a local score fallback', () => {
    const variables = createInteractionVariableStore([])
    const mounted = mount('scoreboard', { teams: [boundTeam] }, variables)
    expect(mounted.root.querySelector('[role=status]').textContent).toMatch(
      /declared interaction variable/
    )
    expect(mounted.root.querySelector('[data-ns-command=increase]').disabled).toBe(true)
    expect(mounted.session.getState().scores).toEqual({})
    mounted.close()
    variables.destroy()
  })
})
