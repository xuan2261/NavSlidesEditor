// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { normalizeGameConfig } from '../../src/education/normalize-game-config.js'
import { createCanonicalQuestion } from '../../src/education/question-schema.js'
import { createRuntimeSession } from '../../src/education/runtime-session.js'
import { createHotPotatoState, reduceHotPotato } from '../../src/education/games/hot-potato.js'
import { presentHotPotato } from '../../src/education/browser/games/hot-potato.js'

const submit = (form) =>
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
function mount(allowLate = true) {
  const question = createCanonicalQuestion({ id: 'q', points: 7, timeLimit: 5 })
  const config = normalizeGameConfig({ questions: [question], allowLate }, 'hot-potato')
  const root = document.createElement('div')
  root.innerHTML = '<div data-ns-game-ui></div>'
  document.body.append(root)
  let time = 100.25,
    ticket = 0,
    presenter
  const tasks = new Map()
  const clock = {
    now: () => time,
    setTimeout: (fn, delay) => {
      const id = ++ticket
      tasks.set(id, { id, fn, due: time + delay })
      return id
    },
    clearTimeout: (id) => tasks.delete(id),
  }
  const session = createRuntimeSession(
    () => createHotPotatoState(config, { random: () => 0 }),
    (state, command, activityClock) =>
      reduceHotPotato(config, state, command, { now: activityClock.now }),
    { clock, onState: (state) => presenter?.render(state) }
  )
  const rebuild = () => {
    presenter = presentHotPotato({
      root,
      config,
      session,
      clock: session.clock,
      reset: () => {
        presenter = null
        session.reset()
        rebuild()
      },
    })
    presenter.render(session.getState())
  }
  rebuild()
  const click = (command) => root.querySelector(`[data-ns-command="${command}"]`).click()
  const start = () => {
    root.querySelector('[aria-label="Participant ID"]').value = 'ada'
    root.querySelector('[aria-label="Participant name"]').value = 'Ada'
    submit(root.querySelector('[data-ns-roster-form]'))
    click('start')
  }
  start()
  const deadline = session.getState().deadline
  const originalDeadline = [...tasks.values()].find((task) => task.due === deadline)
  function advance(target) {
    for (;;) {
      const task = [...tasks.values()]
        .filter((item) => item.due <= target)
        .sort((a, b) => a.due - b.due)[0]
      if (!task) break
      time = Math.max(time, task.due)
      tasks.delete(task.id)
      task.fn()
    }
    time = target
  }
  function early() {
    let task = originalDeadline
    for (const at of [deadline - 0.5, deadline - 0.25]) {
      advance(at)
      tasks.delete(task.id)
      task.fn()
      task = [...tasks.values()].at(-1)
    }
    return task
  }
  return {
    root,
    session,
    deadline,
    early,
    advance,
    click,
    start,
    feedback: () => root.querySelector('[role="status"]').textContent,
    answer: () => {
      root.querySelector(`input[value="${question.answerKey.optionId}"]`).checked = true
      submit(root.querySelector('[data-ns-answer-form]'))
    },
    close: () => {
      session.destroy()
      root.remove()
    },
  }
}

describe('Round deadline delivery at fractional clock boundaries', () => {
  it.each([false, true])(
    'rearms early callbacks without expiring prematurely for allowLate=%s',
    (allowLate) => {
      const m = mount(allowLate)
      try {
        m.early()
        expect(m.session.getState()).toMatchObject({
          phase: 'active',
          deadlinePassed: false,
          scores: {},
        })
        expect(m.feedback()).toBe('Choose a participant and answer.')
        m.advance(m.deadline)
        expect(m.session.getState()).toMatchObject({
          phase: allowLate ? 'active' : 'review',
          deadlinePassed: true,
        })
        if (allowLate) {
          expect(m.feedback()).toBe('Time expired; late answers are allowed.')
          m.answer()
          expect(m.session.getState().answeredPlayers.ada).toMatchObject({
            correct: true,
            late: true,
            points: 7,
          })
          expect(m.root.querySelector('[aria-label="Participant score"]').textContent).toBe(
            'Ada: 7 points'
          )
          expect(m.feedback()).toContain('7 base + 0 speed bonus.')
        } else {
          expect(m.feedback()).toBe('Time expired. Answers revealed.')
          expect(m.root.querySelector('[data-ns-answer-form]')).toBeNull()
          expect(m.session.getState().scores).toEqual({})
        }
      } finally {
        m.close()
      }
    }
  )

  it('preserves the remaining active time when paused after an early callback', () => {
    const m = mount()
    try {
      const stale = m.early()
      m.session.pause()
      m.advance(m.deadline + 10000)
      stale.fn()
      expect(m.session.getState()).toMatchObject({ phase: 'active', deadlinePassed: false })
      expect(m.feedback()).toBe('Choose a participant and answer.')
      m.session.resume()
      m.advance(m.deadline + 10000 + 0.25)
      expect(m.session.getState()).toMatchObject({ phase: 'active', deadlinePassed: true })
      expect(m.feedback()).toBe('Time expired; late answers are allowed.')
    } finally {
      m.close()
    }
  })

  it.each(['reset', 'destroy'])('ignores a retained rearmed callback after %s', (action) => {
    const m = mount()
    try {
      const stale = m.early()
      if (action === 'reset') {
        m.click('reset')
        m.start()
      } else m.session.destroy()
      const current = m.session.getState()
      m.advance(m.deadline + 1)
      stale.fn()
      expect(m.session.getState()).toBe(current)
      expect(m.session.getState()).toMatchObject({
        phase: 'active',
        deadlinePassed: false,
        scores: {},
      })
      if (action === 'reset') expect(m.feedback()).toBe('Choose a participant and answer.')
    } finally {
      m.close()
    }
  })
})
