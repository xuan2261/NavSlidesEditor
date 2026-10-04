// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { normalizeGameConfig } from '../../src/education/normalize-game-config.js'
import { createCanonicalQuestion } from '../../src/education/question-schema.js'
import { createRuntimeSession } from '../../src/education/runtime-session.js'
import { createRelayRaceState, reduceRelayRace } from '../../src/education/games/relay-race.js'
import {
  createTriviaChampState,
  reduceTriviaChamp,
} from '../../src/education/games/trivia-champ.js'
import {
  createScattergoriesState,
  reduceScattergories,
} from '../../src/education/games/scattergories.js'
import { presentRelayRace } from '../../src/education/browser/games/relay-race.js'
import { presentTriviaChamp } from '../../src/education/browser/games/trivia-champ.js'
import { presentScattergories } from '../../src/education/browser/games/scattergories.js'
function mount(type, create, reduce, present, fields = {}) {
  const config = normalizeGameConfig(
    {
      teams: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      questions: [createCanonicalQuestion({ id: 'q', kind: 'fill-blank' })],
      ...fields,
    },
    type
  )
  const root = document.createElement('div')
  root.innerHTML = '<div data-ns-game-ui></div>'
  document.body.append(root)
  let time = 0,
    presenter,
    ticket = 0
  const tasks = new Map()
  const clock = {
    now: () => time,
    setTimeout: (fn, delay) => {
      const id = ++ticket
      tasks.set(id, { fn, due: time + delay })
      return id
    },
    clearTimeout: (id) => tasks.delete(id),
  }
  const session = createRuntimeSession(
    () => create(config),
    (state, command) => reduce(config, state, command, { now: clock.now, random: () => 0 }),
    { clock, onState: (state) => presenter?.render(state) }
  )
  const rebuild = () => {
    presenter = present({
      root,
      config,
      session,
      clock,
      random: () => 0,
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
    click: (command) => root.querySelector(`[data-ns-command="${command}"]`).click(),
    tick: (value) => {
      time = value
      for (const [id, task] of [...tasks])
        if (task.due <= time) {
          tasks.delete(id)
          task.fn()
        }
    },
    close: () => {
      session.destroy()
      root.remove()
    },
  }
}
const submit = (root) =>
  root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
describe('Native round game controls', () => {
  it('plays real Relay answers with lanes, retained focus, delayed finish and pending replay safety', () => {
    const m = mount('relay-race', createRelayRaceState, reduceRelayRace, presentRelayRace, {
      questionsPerRound: 1,
    })
    m.click('start')
    const input = m.root.querySelector('input[type=text]')
    input.value = 'Answer'
    input.focus()
    m.tick(250)
    expect(m.root.querySelector('input[type=text]')).toBe(input)
    expect(document.activeElement).toBe(input)
    submit(m.root)
    expect(m.session.getState().phase).toBe('waiting')
    m.tick(1449)
    expect(m.session.getState().positions.a).toBe(0)
    m.tick(1450)
    expect(m.session.getState().winnerId).toBe('a')
    expect(m.root.querySelector('progress').value).toBe(1)
    m.click('reset')
    m.click('start')
    m.root.querySelector('input[type=text]').value = 'wrong'
    submit(m.root)
    m.click('reset')
    m.tick(10000)
    expect(m.session.getState().phase).toBe('setup')
    expect(m.session.getState().positions).toEqual({ a: 0, b: 0 })
    m.close()
  })
  it('makes every Trivia team buzz reachable and separates answer activation from buzz', () => {
    const m = mount('trivia-champ', createTriviaChampState, reduceTriviaChamp, presentTriviaChamp, {
      rounds: [{ id: 'r', name: 'Authored', mode: 'buzzer', timeLimit: 30, questionIds: ['q'] }],
    })
    m.click('start')
    m.click('buzz-b')
    expect(m.session.getState().scores.b).toBe(10)
    m.root.querySelector('input[type=text]').value = 'Answer'
    expect(m.session.getState().scores.b).toBe(10)
    submit(m.root)
    expect(m.session.getState().scores.b).toBe(20)
    m.click('next')
    expect(m.session.getState().phase).toBe('ended')
    m.click('reset')
    expect(m.session.getState().scores.b).toBe(0)
    m.close()
  })
  it('provides editable category/team fields, manual letter, deadline review and New Round', () => {
    const m = mount(
      'scattergories',
      createScattergoriesState,
      reduceScattergories,
      presentScattergories,
      {
        letterMode: 'manual',
        letter: 'A',
        timePerRound: 1,
        categories: [{ id: 'fruit', label: 'Fruit' }],
      }
    )
    m.root.querySelector('[data-ns-letter]').value = 'B'
    submit(m.root)
    const input = m.root.querySelector('[data-ns-team="b"]')
    input.value = 'Banana'
    input.focus()
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(m.root.querySelector('[data-ns-team="b"]')).toBe(input)
    expect(document.activeElement).toBe(input)
    m.tick(1000)
    expect(m.session.getState().scores.b).toBe(10)
    expect(input.disabled).toBe(true)
    m.click('new-round')
    expect(m.session.getState().letter).toBe(null)
    expect(m.session.getState().scores.b).toBe(0)
    m.close()
  })
  it('isolates two native roots and cancels replay deadlines without erasing the other game', () => {
    const fields = {
      letterMode: 'manual',
      letter: 'A',
      timePerRound: 1,
      categories: [{ id: 'fruit', label: 'Fruit' }],
    }
    const first = mount(
      'scattergories',
      createScattergoriesState,
      reduceScattergories,
      presentScattergories,
      fields
    )
    const second = mount(
      'scattergories',
      createScattergoriesState,
      reduceScattergories,
      presentScattergories,
      fields
    )
    submit(first.root)
    submit(second.root)
    const input = second.root.querySelector('[data-ns-team="a"]')
    input.value = 'Apple'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    first.click('reset')
    first.tick(5000)
    second.tick(1000)
    expect(first.session.getState().phase).toBe('setup')
    expect(first.session.getState().answers).toEqual({})
    expect(second.session.getState().scores.a).toBe(10)
    first.close()
    second.close()
  })
})
