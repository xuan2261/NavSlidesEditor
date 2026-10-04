// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, getRootLifecycle } from '../../src/education/browser/mount.js'
import { createCanonicalQuestion } from '../../src/education/question-schema.js'

const mounted = []
const cell = (id, points, prompt = id) =>
  createCanonicalQuestion({
    id,
    points,
    prompt,
    options: [
      { id: `${id}-no`, text: 'Not this' },
      { id: `${id}-yes`, text: 'Authored answer' },
    ],
    answerKey: { optionId: `${id}-yes` },
    feedback: { explanation: 'Authored explanation' },
  })
function board(patch = {}) {
  const config = {
    title: 'Classroom board',
    teams: [
      { id: 'red', name: 'Red team', color: '#ff0000' },
      { id: 'blue', name: 'Blue team', color: '#0000ff' },
    ],
    categories: [
      { id: 'science', title: 'Science', questions: [cell('seed', 100), cell('double', 700)] },
      { id: 'history', title: 'History', questions: [cell('last', 100, 'Who wrote this?')] },
    ],
    dailyDouble: ['double'],
    wagerLimit: 1000,
    timerDuration: 1,
    showTimer: true,
    negativePoints: true,
    ...patch,
  }
  const root = document.createElement('div')
  root.setAttribute('data-ns-game', '')
  root.dataset.nsGameType = 'jeopardy'
  root.innerHTML =
    '<script type="application/json" data-ns-game-config></script><div data-ns-game-ui></div>'
  root.querySelector('script').textContent = JSON.stringify(config)
  document.body.append(root)
  const api = mount(root, { clock: { now: () => Date.now(), setTimeout, clearTimeout } })
  const control = (command) => root.querySelector(`[data-ns-command="${command}"]`)
  const result = {
    root,
    api,
    config,
    control,
    click: (command) => control(command).click(),
    state: api.getState,
    lifecycle: getRootLifecycle(root),
  }
  mounted.push(result)
  return result
}
const wager = (m, value) => {
  m.root.querySelector('input[type=number]').value = String(value)
  m.root
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}
const adjudicate = (m, correct) => {
  m.click('show-answer')
  m.click(correct ? 'correct' : 'incorrect')
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

describe('mounted local Jeopardy board', () => {
  it('bounds daily-double wagers, applies negative score clamp and prevents duplicate completed cells', () => {
    const m = board()
    m.click('cell-seed')
    adjudicate(m, true)
    expect(m.state().scores).toEqual({ red: 100, blue: 0 })
    m.click('cell-double')
    expect(m.state()).toMatchObject({
      phase: 'wager',
      activeCellId: 'double',
      currentWager: 100,
      deadline: null,
    })
    const input = m.root.querySelector('input[type=number]')
    expect([input.min, input.max, input.value]).toEqual(['0', '1000', '100'])
    for (const invalid of [-1, 1001, 1.5]) {
      wager(m, invalid)
      expect(m.state().phase).toBe('wager')
      expect(m.root.querySelector('[role=status]').textContent).toMatch(/whole.*0.*1000/)
    }
    wager(m, 700)
    expect(m.state()).toMatchObject({ phase: 'question', currentWager: 700, deadline: 1000 })
    m.click('show-answer')
    const accepted = m.control('incorrect')
    accepted.click()
    accepted.click()
    expect(m.state().scores).toEqual({ red: 0, blue: 0 })
    expect(m.state().usedCellIds).toEqual(['seed', 'double'])
    expect(m.control('cell-double').disabled).toBe(true)
    m.click('cell-double')
    expect(m.state().phase).toBe('board')
    m.click('cell-last')
    adjudicate(m, true)
    expect(m.state()).toMatchObject({
      phase: 'ended',
      winnerId: 'red',
      scores: { red: 100, blue: 0 },
    })
    expect(m.root.querySelector('[role=status]').textContent).toContain('Red team wins')
    expect(m.root.querySelector('[aria-label=Scores]').textContent).toContain('Red team: 100')
  })
  it('uses the earned team score for wager bounds and preserves authored no-negative policy', () => {
    const m = board({ wagerLimit: 20, negativePoints: false })
    m.click('cell-seed')
    adjudicate(m, true)
    m.click('cell-double')
    const input = m.root.querySelector('input[type=number]')
    expect([input.max, input.value]).toEqual(['100', '20'])
    wager(m, 100)
    adjudicate(m, false)
    expect(m.state().scores.red).toBe(100)
    expect(m.root.querySelector('[aria-label=Scores]').textContent).toContain('Red team: 100')
  })
  it('expires the active timer but leaves host reveal and once-only completion available', () => {
    const m = board()
    m.click('cell-last')
    expect(m.root.querySelector('[role=timer]').textContent).toContain('1 seconds')
    const radio = m.root.querySelector('input[value="last-yes"]')
    radio.checked = true
    radio.focus()
    vi.advanceTimersByTime(500)
    expect(m.root.querySelector('input[value="last-yes"]')).toBe(radio)
    expect(document.activeElement).toBe(radio)
    vi.advanceTimersByTime(500)
    expect(m.state()).toMatchObject({
      phase: 'question',
      expired: true,
      deadline: null,
      usedCellIds: [],
    })
    expect(m.root.querySelector('[role=status]').textContent).toContain('Time expired')
    expect(m.root.querySelector('fieldset').disabled).toBe(true)
    m.click('show-answer')
    expect(m.root.querySelector('[data-ns-answer]').textContent).toContain(
      'Answer: Authored answer'
    )
    expect(m.root.querySelector('[data-ns-answer]').textContent).toContain('Authored explanation')
    m.click('incorrect')
    vi.advanceTimersByTime(10000)
    expect(m.state()).toMatchObject({
      phase: 'board',
      scores: { red: 0, blue: 0 },
      usedCellIds: ['last'],
    })
    expect(m.control('cell-last').disabled).toBe(true)
  })
  it('cancels the timer on reveal and renders authored media and native choices before host adjudication', () => {
    const question = cell('picture', 300, 'Identify the picture')
    question.media = { src: 'https://example.com/picture.png', alt: 'Authored diagram' }
    const m = board({
      categories: [{ id: 'pictures', title: 'Pictures', questions: [question] }],
      dailyDouble: [],
    })
    expect(m.root.textContent).toContain('Pictures')
    m.click('cell-picture')
    expect(m.root.querySelector('h4').textContent).toBe('Identify the picture')
    expect(m.root.querySelector('img').alt).toBe('Authored diagram')
    expect(m.root.querySelector('input[value="picture-yes"]').type).toBe('radio')
    expect(m.control('correct').hidden).toBe(true)
    m.click('show-answer')
    vi.advanceTimersByTime(2000)
    expect(m.state()).toMatchObject({ revealed: true, expired: false, deadline: null })
    expect(m.root.querySelector('[data-ns-answer]').textContent).toContain('Authored answer')
    m.click('correct')
    expect(m.state().scores.red).toBe(300)
    expect(m.state().winnerId).toBe('red')
  })
  it('selects honest classroom teams and stable cells even when categories share a point value', () => {
    const m = board({ showTimer: false })
    m.click('team-blue')
    expect(m.control('team-blue').getAttribute('aria-pressed')).toBe('true')
    m.click('cell-last')
    expect(m.state()).toMatchObject({ activeTeamId: 'blue', activeCellId: 'last', deadline: null })
    expect(m.root.querySelector('h4').textContent).toBe('Who wrote this?')
    expect(m.root.querySelector('[role=timer]').textContent).toBe('')
    adjudicate(m, true)
    expect(m.state().scores).toEqual({ red: 0, blue: 100 })
    expect(m.root.querySelector('[aria-label=Scores]').textContent).toContain('Blue team: 100')
    expect(m.control('cell-seed').disabled).toBe(false)
    m.click('cell-seed')
    m.click('close-cell')
    expect(m.state().usedCellIds).toEqual(['last', 'seed'])
    expect(m.state().scores.blue).toBe(100)
  })
  it('freezes hidden roots independently and resets all state without resurrecting old controls or deadlines', () => {
    const first = board(),
      second = board()
    first.click('cell-seed')
    second.click('team-blue')
    second.click('cell-last')
    const oldReveal = first.control('show-answer')
    vi.advanceTimersByTime(400)
    first.lifecycle.pause()
    vi.advanceTimersByTime(4600)
    expect(first.state().expired).toBe(false)
    expect(second.state().expired).toBe(true)
    first.lifecycle.resume()
    vi.advanceTimersByTime(599)
    expect(first.state().expired).toBe(false)
    vi.advanceTimersByTime(1)
    expect(first.state().expired).toBe(true)
    first.click('reset')
    oldReveal.click()
    vi.advanceTimersByTime(5000)
    expect(first.state()).toMatchObject({
      generation: 1,
      phase: 'board',
      turn: 0,
      activeTeamId: 'red',
      activeCellId: null,
      scores: { red: 0, blue: 0 },
      usedCellIds: [],
      awardedKeys: [],
      deadline: null,
      expired: false,
    })
    expect(first.control('cell-seed').disabled).toBe(false)
    expect(second.state()).toMatchObject({
      generation: 0,
      activeTeamId: 'blue',
      activeCellId: 'last',
      expired: true,
    })
    first.click('cell-seed')
    const detached = first.control('show-answer')
    first.api.destroy()
    detached.click()
    vi.advanceTimersByTime(1000)
    expect(first.state().revealed).toBe(false)
    expect(first.state().expired).toBe(false)
    expect(first.root.querySelector('[data-ns-game-ui]').textContent).toBe('')
    adjudicate(second, true)
    expect(second.state().scores.blue).toBe(100)
  })
  it('cancels a pending question deadline and clears a daily-double draft on replay', () => {
    const m = board()
    m.click('cell-seed')
    vi.advanceTimersByTime(200)
    m.click('reset')
    vi.advanceTimersByTime(5000)
    expect(m.state()).toMatchObject({
      generation: 1,
      phase: 'board',
      expired: false,
      usedCellIds: [],
      scores: { red: 0, blue: 0 },
    })
    m.click('cell-double')
    m.root.querySelector('input[type=number]').value = '999'
    m.click('reset')
    m.click('cell-double')
    expect(m.state()).toMatchObject({
      generation: 2,
      phase: 'wager',
      currentWager: 0,
      deadline: null,
    })
    expect(m.root.querySelector('input[type=number]').value).toBe('0')
  })
  it('reuses the native hotspot view and disables its canonical fieldset on reveal', () => {
    const question = createCanonicalQuestion({
      id: 'map',
      kind: 'image-hotspot',
      prompt: 'Choose the target',
      points: 50,
    })
    const m = board({
      categories: [{ id: 'maps', title: 'Maps', questions: [question] }],
      dailyDouble: [],
    })
    m.click('cell-map')
    expect(m.root.querySelector('img').alt).toContain('Blue target square')
    expect(m.root.querySelector('select[aria-label="Named region"]').options[1].value).toBe(
      'map/option-1'
    )
    m.click('show-answer')
    expect(m.root.querySelector('fieldset').disabled).toBe(true)
    expect(m.root.querySelector('[data-ns-answer]').textContent).toContain('Answer: Target')
    m.click('correct')
    expect(m.state()).toMatchObject({ phase: 'ended', scores: { red: 50, blue: 0 } })
  })
  it('contains only focused control navigation keys rather than intercepting the whole page', () => {
    const m = board(),
      received = []
    const observe = (event) => received.push(event.key)
    document.addEventListener('keydown', observe)
    try {
      const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      m.control('cell-seed').dispatchEvent(key)
      expect(received).toEqual([])
      expect(key.defaultPrevented).toBe(false)
      m.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      expect(received).toEqual(['ArrowRight'])
    } finally {
      document.removeEventListener('keydown', observe)
    }
  })
})
