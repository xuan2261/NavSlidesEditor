// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { normalizeGameConfig } from '../../src/education/normalize-game-config.js'
import { createCanonicalQuestion } from '../../src/education/question-schema.js'
import { createRuntimeSession } from '../../src/education/runtime-session.js'
import { createHotPotatoState, reduceHotPotato } from '../../src/education/games/hot-potato.js'
import {
  createFourCornersState,
  reduceFourCorners,
} from '../../src/education/games/four-corners.js'
import { presentHotPotato } from '../../src/education/browser/games/hot-potato.js'
import { presentFourCorners } from '../../src/education/browser/games/four-corners.js'
import { createPollState, reducePoll } from '../../src/education/games/poll.js'
import { createWordCloudState, reduceWordCloud } from '../../src/education/games/word-cloud.js'
import { presentPoll } from '../../src/education/browser/games/poll.js'
import { presentWordCloud } from '../../src/education/browser/games/word-cloud.js'

function mount(type, fields = {}) {
  const config = normalizeGameConfig(fields, type)
  const [create, reduce, present] = {
    'hot-potato': [createHotPotatoState, reduceHotPotato, presentHotPotato],
    'four-corners': [createFourCornersState, reduceFourCorners, presentFourCorners],
    poll: [createPollState, reducePoll, presentPoll],
    'word-cloud': [createWordCloudState, reduceWordCloud, presentWordCloud],
  }[type]
  const root = document.createElement('div')
  root.innerHTML = '<div data-ns-game-ui></div>'
  document.body.append(root)
  let time = 0,
    ticket = 0,
    presenter
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
    () => create(config, { random: () => 0 }),
    (state, command, activityClock) => reduce(config, state, command, { now: activityClock.now }),
    { clock, onState: (state) => presenter?.render(state) }
  )
  const rebuild = () => {
    presenter = present({
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
  const advance = (target) => {
    for (;;) {
      const entry = [...tasks]
        .filter(([, task]) => task.due <= target)
        .sort((a, b) => a[1].due - b[1].due)[0]
      if (!entry) break
      const [id, task] = entry
      time = Math.max(time, task.due)
      tasks.delete(id)
      task.fn()
    }
    time = target
  }
  return {
    root,
    session,
    click,
    advance,
    jump: (target) => {
      time = target
    },
    tasks,
    close: () => {
      session.destroy()
      root.remove()
    },
  }
}
const submit = (form) =>
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
function add(m, id, name) {
  m.root.querySelector('[aria-label="Participant ID"]').value = id
  m.root.querySelector('[aria-label="Participant name"]').value = name
  submit(m.root.querySelector('[data-ns-roster-form]'))
}
function choose(m, id) {
  const select = m.root.querySelector('[aria-label="Current participant"]')
  select.value = id
  select.dispatchEvent(new Event('change', { bubbles: true }))
}
const answer = (m, id) => {
  m.root.querySelector(`input[value="${id}"]`).checked = true
  submit(m.root.querySelector('[data-ns-answer-form]'))
}
const question = (id = 'q', timeLimit = 10) =>
  createCanonicalQuestion({
    id,
    timeLimit,
    feedback: {
      correct: 'Well done',
      incorrect: 'Not this corner',
      explanation: 'The first option is right.',
    },
  })
const corners = (id = 'q', timeLimit = 10) =>
  createCanonicalQuestion({
    id,
    timeLimit,
    options: ['North', 'East', 'South', 'West'].map((text, index) => ({
      id: `${id}-${index}`,
      text,
    })),
    answerKey: { optionId: `${id}-0` },
  })

describe('Local question presenters use real classroom identities and reducers', () => {
  it.each(['hot-potato', 'four-corners'])(
    'lets prototype-named %s learners start at zero and answer independently once',
    (type) => {
      const q = { ...(type === 'hot-potato' ? question('q', null) : corners('q', null)), points: 7 }
      const m = mount(type, { questions: [q] })
      try {
        for (const id of ['constructor', 'toString', '__proto__']) add(m, id, `Learner ${id}`)
        const board = type === 'hot-potato' ? 'Leaderboard' : 'Participant scores'
        for (const id of ['constructor', 'toString', '__proto__']) {
          expect(
            [...m.root.querySelector(`[aria-label="${board}"]`).children].find((row) =>
              row.textContent.startsWith(`Learner ${id}:`)
            ).textContent
          ).toBe(`Learner ${id}: 0`)
        }
        m.click('start')
        for (const id of ['constructor', 'toString', '__proto__']) {
          choose(m, id)
          if (type === 'hot-potato') {
            expect(m.root.querySelector('[data-ns-command="submit-answer"]').disabled).toBe(false)
            expect(m.root.querySelector('[aria-label="Participant score"]').textContent).toBe(
              `Learner ${id}: 0 points`
            )
            answer(m, q.answerKey.optionId)
            expect(m.session.getState().scores[id]).toBe(7)
            const accepted = m.session.getState()
            submit(m.root.querySelector('[data-ns-answer-form]'))
            expect(m.session.getState()).toBe(accepted)
          } else {
            expect(m.root.querySelector('[aria-label="Current corner"]').textContent).toContain(
              'No corner selected'
            )
            m.click(`corner-${q.answerKey.optionId}`)
            expect(m.session.getState().votes[id]).toBe(q.answerKey.optionId)
          }
        }
        if (type === 'four-corners') m.click('reveal')
        for (const id of ['constructor', 'toString', '__proto__']) {
          expect(m.session.getState().scores[id]).toBe(7)
          expect(
            [...m.root.querySelector(`[aria-label="${board}"]`).children].find((row) =>
              row.textContent.startsWith(`Learner ${id}:`)
            ).textContent
          ).toBe(`Learner ${id}: 7`)
        }
        m.click('reset')
        expect(m.session.getState().scores).toEqual({})
      } finally {
        m.close()
      }
    }
  )
  it.each(['poll', 'word-cloud'])(
    'disables active %s Start while keeping explicit Reset and ended-round Start usable',
    (type) => {
      const m = mount(type, { timerDuration: 30 })
      try {
        const start = () => m.root.querySelector('[data-ns-command="start"]')
        m.root.querySelector('[aria-label="Participant name"]').value = 'Ada'
        submit(m.root.querySelector('[data-ns-roster-form]'))
        expect(start().disabled).toBe(false)
        m.click('start')
        if (type === 'poll') m.root.querySelector('[data-ns-poll-option]').checked = true
        else m.root.querySelector('[data-ns-cloud-input]').value = 'first'
        submit(m.root.querySelector('[data-ns-submission-form]'))
        m.advance(10000)
        const active = m.session.getState()
        expect(start().disabled).toBe(true)
        m.click('start')
        m.click('start')
        expect(m.session.getState()).toBe(active)
        m.session.dispatch({
          type: 'start',
          generation: active.generation,
          roundId: active.roundId,
        })
        expect(m.session.getState()).toBe(active)
        m.advance(30000)
        expect(m.session.getState().phase).toBe('ended')
        expect(start().disabled).toBe(false)
        m.click('start')
        expect(m.session.getState()).toMatchObject({
          phase: 'active',
          roundId: active.roundId + 1,
          deadline: 60000,
        })
        if (type === 'poll') expect(m.session.getState().votes).toEqual(active.votes)
        else expect(m.session.getState().quotas).toEqual(active.quotas)
        m.click('reset')
        expect(m.session.getState()).toMatchObject({
          phase: 'idle',
          participants: [],
          accepted: [],
          roundId: 0,
          deadline: null,
        })
        expect(start().disabled).toBe(false)
      } finally {
        m.close()
      }
    }
  )
  it('rejects incomplete answers, records wrong answers, and awards a correct learner only once', () => {
    const m = mount('hot-potato', { questions: [question()] })
    expect(m.root.querySelector('[data-ns-command="start"]').disabled).toBe(true)
    add(m, 'ada', 'Ada')
    add(m, 'ben', 'Ben')
    choose(m, 'ada')
    m.click('start')
    submit(m.root.querySelector('[data-ns-answer-form]'))
    expect(m.session.getState().scores).toEqual({})
    expect(m.session.getState().error).toBeTruthy()
    answer(m, 'q/option-2')
    expect(m.session.getState().scores.ada).toBe(0)
    expect(m.root.querySelector('[role=status]').textContent).toContain('Not this corner')
    choose(m, 'ben')
    m.advance(2000)
    const form = m.root.querySelector('[data-ns-answer-form]')
    answer(m, 'q/option-1')
    submit(form)
    expect(m.session.getState().scores).toEqual({ ada: 0, ben: 18 })
    expect(m.root.querySelector('[aria-label="Leaderboard"]').textContent).toContain('Ben: 18')
    expect(m.root.querySelector('[role=status]').textContent).toContain('10 base + 8 speed bonus')
    m.click('reveal')
    expect(m.root.textContent).toContain('The first option is right.')
    m.click('next')
    expect(m.session.getState().phase).toBe('ended')
    m.click('reset')
    expect(m.session.getState().scores).toEqual({})
    expect(m.root.querySelector('[aria-label="Current participant"]').options).toHaveLength(0)
    m.close()
  })
  it.each([false, true])(
    'honors allowLate=%s at the reducer deadline without browser wall-clock scoring',
    (allowLate) => {
      const m = mount('hot-potato', { allowLate, questions: [question()] })
      add(m, 'ada', 'Ada')
      m.click('start')
      m.jump(10000)
      answer(m, 'q/option-1')
      expect(m.session.getState().answeredPlayers.ada).toMatchObject({
        late: true,
        points: allowLate ? 10 : 0,
      })
      expect(m.session.getState().scores.ada ?? 0).toBe(allowLate ? 10 : 0)
      expect(m.root.querySelector('[role=status]').textContent).toContain('Late')
      m.close()
      expect(m.tasks.size).toBe(0)
    }
  )
  it('replaces one learner vote, keeps a second learner independent, and reveals elimination and scores once', () => {
    const m = mount('four-corners', { questions: [corners(), corners('next')], timerDuration: 5 })
    add(m, 'ada', 'Ada')
    add(m, 'ben', 'Ben')
    choose(m, 'ada')
    m.click('start')
    m.click('corner-q-1')
    m.click('corner-q-0')
    choose(m, 'ben')
    m.click('corner-q-1')
    expect(m.session.getState().votes).toEqual({ ada: 'q-0', ben: 'q-1' })
    expect(m.root.querySelector('[data-ns-corner-total="q-0"]').textContent).toContain('1')
    const reveal = m.root.querySelector('[data-ns-command="reveal"]')
    reveal.click()
    reveal.click()
    expect(m.session.getState().scores).toEqual({ ada: 10 })
    expect(m.session.getState().eliminated).toEqual(['ben'])
    expect(m.root.textContent).toContain('Ben: 0 — eliminated')
    expect(m.root.textContent).toContain('Correct corner: North')
    m.click('next')
    expect(m.session.getState().eliminated).toEqual([])
    expect(m.session.getState().votes).toEqual({})
    m.click('corner-next-0')
    expect(m.session.getState().votes.ben).toBe('next-0')
    m.click('reveal')
    expect(m.session.getState().scores).toEqual({ ada: 10, ben: 10 })
    m.click('next')
    expect(m.session.getState().phase).toBe('ended')
    m.click('reset')
    expect(m.session.getState()).toMatchObject({
      phase: 'setup',
      scores: {},
      eliminated: [],
      votes: {},
    })
    m.close()
  })
  it('uses the state deadline, retains participants when elimination is disabled, and ignores old corner controls', () => {
    const m = mount('four-corners', {
      eliminateMode: 'none',
      timerDuration: 2,
      questions: [corners()],
    })
    add(m, 'ada', 'Ada')
    m.click('start')
    const old = m.root.querySelector('[data-ns-command="corner-q-1"]')
    old.click()
    m.advance(2000)
    expect(m.session.getState()).toMatchObject({ phase: 'revealed', eliminated: [], scores: {} })
    m.click('reset')
    old.click()
    m.advance(20000)
    expect(m.session.getState()).toMatchObject({ phase: 'setup', votes: {}, scores: {} })
    m.close()
  })
  it.each(['hot-potato', 'four-corners'])(
    'freezes %s deadline and speed clock while hidden, then cancels resources on destroy',
    (type) => {
      const m = mount(type, {
        questions: [type === 'hot-potato' ? question() : corners()],
        timerDuration: 10,
      })
      add(m, 'ada', 'Ada')
      m.click('start')
      m.advance(2000)
      m.session.pause()
      expect(m.tasks.size).toBe(0)
      m.advance(22000)
      expect(m.session.clock.now()).toBe(2000)
      expect(m.session.getState().phase).toBe(type === 'hot-potato' ? 'active' : 'guessing')
      m.session.resume()
      if (type === 'hot-potato') {
        answer(m, 'q/option-1')
        expect(m.session.getState().scores.ada).toBe(18)
      } else m.click('corner-q-0')
      m.advance(30000)
      expect(m.session.getState().phase).toBe(type === 'hot-potato' ? 'review' : 'revealed')
      m.click('reset')
      add(m, 'ada', 'Ada')
      m.click('start')
      const control = m.root.querySelector('[data-ns-command="end"]')
      const before = m.session.getState()
      m.session.destroy()
      expect(m.tasks.size).toBe(0)
      control.click()
      m.advance(50000)
      expect(m.session.getState()).toBe(before)
      m.close()
    }
  )
  it.each(['hot-potato', 'four-corners'])(
    'shows honest unlimited %s rounds and explicit early end/reset',
    (type) => {
      const m = mount(type, {
        questions: [type === 'hot-potato' ? question('q', null) : corners('q', null)],
      })
      add(m, 'ada', 'Ada')
      m.click('start')
      expect(m.root.querySelector('[role=timer]').textContent).toBe('No time limit')
      expect(m.tasks.size).toBe(0)
      m.click('end')
      expect(m.root.textContent).toContain('Game ended')
      m.click('reset')
      expect(m.session.getState().questionIndex).toBe(-1)
      m.close()
    }
  )
  it.each([
    'single-choice',
    'multi-choice',
    'true-false',
    'fill-blank',
    'ordering',
    'matching',
    'image-hotspot',
  ])('submits canonical %s controls and reveals the authored solution', (kind) => {
    const q = createCanonicalQuestion({
      id: 'q',
      kind,
      media: { src: '/uploads/question.png', alt: 'Question media' },
    })
    if (kind === 'ordering') q.answerKey.itemIds.reverse()
    if (['single-choice', 'multi-choice', 'ordering'].includes(kind))
      q.options[0].media = { src: '/uploads/option.png', alt: 'Option media' }
    const m = mount('hot-potato', { questions: [q] })
    add(m, 'ada', 'Ada')
    m.click('start')
    expect(m.root.querySelector('img[alt="Question media"]').getAttribute('src')).toBe(
      '/uploads/question.png'
    )
    if (['single-choice', 'multi-choice', 'ordering'].includes(kind))
      expect(m.root.querySelector('img[alt="Option media"]')).not.toBeNull()
    if (['single-choice', 'multi-choice', 'true-false'].includes(kind))
      m.root.querySelector('input[value]').checked = true
    if (kind === 'fill-blank') m.root.querySelector('[data-ns-answer-form] input').value = 'Answer'
    if (kind === 'ordering') m.click('order-down')
    if (kind === 'matching') {
      m.root.querySelector('[data-ns-source]').click()
      m.root.querySelector('[data-ns-target]').click()
    }
    if (kind === 'image-hotspot') {
      const select = m.root.querySelector('[aria-label="Named region"]')
      select.value = q.options[0].id
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    submit(m.root.querySelector('[data-ns-answer-form]'))
    expect(m.session.getState().answeredPlayers.ada).toMatchObject({ correct: true, points: 10 })
    expect(m.root.querySelector('[data-ns-answer-form] fieldset').disabled).toBe(true)
    m.click('reveal')
    expect(m.root.textContent).toContain('Answer:')
    m.click('next')
    expect(m.session.getState().phase).toBe('ended')
    m.close()
  })
  it('renders authored corner media and preserves the selected control while totals change', () => {
    const q = corners()
    q.options[1].media = { src: '/uploads/east.png', alt: 'East corner' }
    const m = mount('four-corners', { questions: [q] })
    add(m, 'ada', 'Ada')
    m.click('start')
    const east = m.root.querySelector('[data-ns-command="corner-q-1"]')
    east.focus()
    east.click()
    expect(m.root.querySelector('[data-ns-command="corner-q-1"]')).toBe(east)
    expect(document.activeElement).toBe(east)
    expect(east.getAttribute('aria-pressed')).toBe('true')
    expect(east.querySelector('img').alt).toBe('East corner')
    m.close()
  })
  it('rejects incomplete or duplicate roster identities rather than inventing a local actor', () => {
    const m = mount('hot-potato')
    add(m, '', 'Ada')
    expect(m.root.querySelector('[aria-label="Current participant"]').options).toHaveLength(0)
    add(m, 'ada', 'Ada')
    add(m, 'ada', 'Other')
    expect(
      [...m.root.querySelector('[aria-label="Current participant"]').options].map(
        (option) => option.textContent
      )
    ).toEqual(['Ada (ada)'])
    expect(m.session.getState().scores).toEqual({})
    m.close()
  })
})
