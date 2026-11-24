// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createRuntimeSession } from '../../src/education/runtime-session.js'
import { createDefaultGameConfig } from '../../src/education/game-defaults.js'
import { createPollState, reducePoll } from '../../src/education/games/poll.js'
import { createWordCloudState, reduceWordCloud } from '../../src/education/games/word-cloud.js'
import { createMatchingState, reduceMatching } from '../../src/education/games/matching.js'
import { presentPoll } from '../../src/education/browser/games/poll.js'
import { presentWordCloud } from '../../src/education/browser/games/word-cloud.js'
import { presentMatching } from '../../src/education/browser/games/matching.js'

function mount(type, factory, reducer, present, overrides = {}) {
  const root = document.createElement('div')
  root.innerHTML = '<div data-ns-game-ui></div>'
  document.body.append(root)
  const config = { ...createDefaultGameConfig(type), ...overrides }
  let presenter,
    time = 0,
    ticket = 0
  const timers = new Map()
  const clock = {
    now: () => time,
    setTimeout: (fn, delay) => {
      const id = ++ticket
      timers.set(id, { fn, due: time + delay })
      return id
    },
    clearTimeout: (id) => timers.delete(id),
  }
  const session = createRuntimeSession(
    () => factory(config),
    (state, command) => reducer(config, state, command, { now: time }),
    { clock, onState: (state) => presenter?.render(state) }
  )
  function rebuild() {
    presenter = present({
      root,
      config,
      session,
      clock,
      reset: () => {
        session.reset()
        rebuild()
      },
    })
    presenter.render(session.getState())
  }
  rebuild()
  return {
    root,
    session,
    presenter,
    tick(now) {
      time = now
      const due = [...timers].filter(([, task]) => task.due <= time)
      due.forEach(([id, task]) => {
        timers.delete(id)
        task.fn()
      })
    },
    close() {
      session.destroy()
      root.remove()
    },
  }
}
const click = (m, command) => m.root.querySelector(`[data-ns-command="${command}"]`).click()
const submit = (m, selector) =>
  m.root
    .querySelector(selector)
    .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
const join = (m, name = 'A') => {
  m.root.querySelector('[data-ns-participant-name]').value = name
  submit(m, '[data-ns-roster-form]')
}

describe('standalone classroom forms', () => {
  it('poll uses one submit activation, stable participants, hidden aggregate and vote replacement', () => {
    const m = mount('poll', createPollState, reducePoll, presentPoll, { showResults: false })
    join(m)
    click(m, 'start')
    const options = m.root.querySelectorAll('[data-ns-poll-option]')
    options[0].click()
    expect(m.session.getState().votes).toEqual([])
    submit(m, '[data-ns-submission-form]')
    expect(m.session.getState().votes).toHaveLength(1)
    expect(m.root.querySelector('[data-ns-results]').hidden).toBe(true)
    options[1].click()
    submit(m, '[data-ns-submission-form]')
    expect(m.session.getState().votes[0].optionId).toBe('option-b')
    click(m, 'reveal')
    expect(m.root.querySelector('[data-ns-results]').hidden).toBe(false)
    click(m, 'reset')
    expect(m.session.getState().votes).toEqual([])
    m.close()
  })
  it('cloud retains draft and focus through timer ticks, counts deliberate repeats, clears quota and cancels replay timers', () => {
    const m = mount('word-cloud', createWordCloudState, reduceWordCloud, presentWordCloud)
    join(m)
    click(m, 'start')
    const input = m.root.querySelector('[data-ns-cloud-input]')
    input.value = '<b>CAT</b>'
    input.focus()
    m.tick(1000)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('<b>CAT</b>')
    submit(m, '[data-ns-submission-form]')
    submit(m, '[data-ns-submission-form]')
    expect(m.session.getState().counts).toEqual([{ text: '<b>cat</b>', count: 2 }])
    expect(m.root.querySelector('[data-ns-results] b')).toBeNull()
    click(m, 'clear')
    expect(m.session.getState().quotas).toEqual([])
    click(m, 'reset')
    m.tick(100000)
    expect(m.session.getState()).toMatchObject({ phase: 'idle', counts: [], accepted: [] })
    m.close()
  })
  it('matching uses shared keyboard-native controls, stable media and exact pair count', () => {
    const pairs = createDefaultGameConfig('matching').pairs
    pairs[0].promptMedia = { src: 'data:image/png;base64,AA==', alt: 'France flag' }
    const m = mount('matching', createMatchingState, reduceMatching, presentMatching, { pairs })
    join(m)
    click(m, 'start')
    expect(m.root.querySelector('img').alt).toBe('France flag')
    const source = m.root.querySelector(`[data-ns-source="${pairs[0].promptId}"]`)
    source.focus()
    source.click()
    expect(source.getAttribute('aria-pressed')).toBe('true')
    m.root.querySelector(`[data-ns-target="${pairs[0].targetId}"]`).click()
    expect(m.session.getState().submissions).toEqual([])
    submit(m, '[data-ns-submission-form]')
    expect(m.session.getState().submissions).toEqual([])
    expect(m.session.getState().lastResult).toMatchObject({
      ok: false,
      error: 'invalid-matching-pairs',
    })
    source.click()
    m.presenter.pause()
    expect(m.session.getState().assignment.selectedId).toBeNull()
    expect(m.session.getState().assignment.assignments).toEqual([
      { sourceId: pairs[0].promptId, targetId: pairs[0].targetId },
    ])
    m.root.querySelector(`[data-ns-source="${pairs[1].promptId}"]`).click()
    m.root.querySelector(`[data-ns-target="${pairs[1].targetId}"]`).click()
    submit(m, '[data-ns-submission-form]')
    expect(m.session.getState().submissions[0]).toMatchObject({
      score: 2,
      total: 2,
      terminal: true,
    })
    expect(source.disabled).toBe(true)
    join(m, 'B')
    expect(m.root.querySelector('[data-ns-submission-form] button').disabled).toBe(false)
    submit(m, '[data-ns-submission-form]')
    expect(m.session.getState().submissions.map((row) => row.score)).toEqual([2, 2])
    click(m, 'reveal')
    expect(m.root.querySelector('[data-ns-results]').textContent).toContain('France')
    click(m, 'reset')
    expect(m.session.getState().assignment.assignments).toEqual([])
    m.close()
  })
})
