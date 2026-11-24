// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount, getRootLifecycle } from '../../src/education/browser/mount.js'
import { createDefaultGameConfig } from '../../src/education/game-defaults.js'
import { createCanonicalQuestion } from '../../src/education/question-schema.js'
import { serializeEducationConfig } from '../../src/education/config-serialization.js'
import { generateWordSearch } from '../../src/education/word-search-generator.js'

const mounted = [],
  roots = []
afterEach(() => {
  mounted.splice(0).forEach((api) => api.destroy())
  roots.splice(0).forEach((root) => root.remove())
})
function fixture(type, fields = {}) {
  const config = { ...createDefaultGameConfig(type), ...fields }
  const root = document.createElement('div')
  root.dataset.nsGame = 'true'
  root.dataset.nsGameType = type
  root.innerHTML = `<script type="application/json" data-ns-game-config>${serializeEducationConfig(config)}</script><p data-ns-game-static>Static lesson</p><div data-ns-game-ui></div>`
  document.body.append(root)
  roots.push(root)
  let ticket = 0
  const tasks = new Map()
  const clock = {
    now: () => 0,
    setTimeout: (callback) => {
      const id = ++ticket
      tasks.set(id, callback)
      return id
    },
    clearTimeout: (id) => tasks.delete(id),
  }
  const install = () => {
    const api = mount(root, { clock, random: () => 0 })
    mounted.push(api)
    return api
  }
  return {
    root,
    config,
    install,
    api: install(),
    click: (command) => root.querySelector(`[data-ns-command="${command}"]`).click(),
  }
}
function pointer(target, type, pointerId = 1, x = 0, y = 0) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  target.dispatchEvent(event)
}
const key = (target, value) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })
  )
const submit = (form) =>
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
const rect = () => ({ left: 100, right: 180, top: 20, bottom: 100, width: 80, height: 80 })
function capture(handle) {
  let captured = null
  handle.setPointerCapture = (id) => {
    captured = id
  }
  handle.hasPointerCapture = (id) => captured === id
  handle.releasePointerCapture = (id) => {
    if (captured === id) captured = null
  }
  return () => captured
}

describe('Sorting same-root lifecycle', () => {
  it('preserves authored siblings and remains playable after setup-cleanup-setup and reset', () => {
    const m = fixture('sorting', { points: 37 })
    const script = m.root.querySelector('[data-ns-game-config]'),
      staticView = m.root.querySelector('[data-ns-game-static]')
    expect(script).not.toBeNull()
    expect(staticView).not.toBeNull()
    const serialized = script.textContent,
      ui = m.root.querySelector('[data-ns-game-ui]')
    m.api.destroy()
    expect(ui.querySelector('button')).toBeNull()
    expect(staticView.hidden).toBe(false)
    const replay = m.install()
    expect(m.root.querySelector('[data-ns-game-ui]')).toBe(ui)
    for (const { itemId, bucketId } of m.config.answerKey.assignments) {
      m.root.querySelector(`[data-ns-source="${itemId}"]`).click()
      m.root.querySelector(`[data-ns-target="${bucketId}"]`).click()
    }
    submit(m.root.querySelector('form'))
    expect(replay.getState()).toMatchObject({ score: 37, phase: 'complete' })
    replay.reset()
    expect(replay.getState()).toMatchObject({ score: 0, attempts: 0, phase: 'active' })
    expect(script.textContent).toBe(serialized)
    expect(m.root.querySelector('[data-ns-game-static]')).toBe(staticView)
    expect(m.root.querySelector('[data-ns-source="apple"]').disabled).toBe(false)
  })
})

const typedCases = ['relay-race', 'trivia-champ'].flatMap((type) =>
  ['ordering', 'matching'].map((kind) => [type, kind])
)
describe('Relay and Trivia typed answer lifecycle', () => {
  it.each(typedCases)(
    '%s cancels %s capture/ghost on leave without discarding accepted draft input',
    (type, kind) => {
      const question = createCanonicalQuestion({ id: 'q', kind })
      if (kind === 'matching') {
        question.options.left.push({ id: 'q/left-2', text: 'Second source' })
        question.options.right.push({ id: 'q/right-2', text: 'Second target' })
        question.answerKey.pairs.push({ leftId: 'q/left-2', rightId: 'q/right-2' })
      }
      if (kind === 'ordering') question.answerKey.itemIds.reverse()
      const m = fixture(type, {
        questions: [question],
        ...(type === 'trivia-champ'
          ? {
              rounds: [
                { id: 'r', name: 'Round', mode: 'individual', questionIds: ['q'], timeLimit: 30 },
              ],
            }
          : { shuffleTeams: false }),
      })
      m.click('start')
      const sources = [...m.root.querySelectorAll('[data-ns-source]')]
      const target =
        kind === 'ordering'
          ? m.root.querySelectorAll('[data-ns-order-item]')[1]
          : m.root.querySelectorAll('[data-ns-target]')[1]
      if (kind === 'matching') {
        sources[0].click()
        m.root.querySelector('[data-ns-target]').click()
      }
      const draft = () =>
        kind === 'ordering'
          ? [...m.root.querySelectorAll('[data-ns-order-item]')].map(
              (row) => row.dataset.nsOrderItem
            )
          : [...m.root.querySelectorAll('[data-ns-assigned-label]')].map((row) => row.textContent)
      const before = draft(),
        handle = kind === 'ordering' ? sources[0] : sources[1],
        captured = capture(handle)
      target.getBoundingClientRect = rect
      pointer(handle, 'pointerdown')
      pointer(handle, 'pointermove', 1, 130, 80)
      expect(document.querySelector('[data-ns-drag-ghost]')).not.toBeNull()
      expect(captured()).toBe(1)
      getRootLifecycle(m.root).pause()
      expect(document.querySelector('[data-ns-drag-ghost]')).toBeNull()
      expect(captured()).toBeNull()
      getRootLifecycle(m.root).resume()
      pointer(handle, 'pointerup', 1, 130, 80)
      expect(draft()).toEqual(before)
      pointer(handle, 'pointerdown')
      pointer(handle, 'pointermove', 1, 130, 80)
      pointer(handle, 'pointerup', 1, 130, 80)
      if (kind === 'ordering') expect(draft()).toEqual(question.answerKey.itemIds)
      else expect(draft()[1]).not.toBe('')
      submit(m.root.querySelector('form'))
      expect(m.api.getState()).toMatchObject({
        correct: true,
        phase: type === 'relay-race' ? 'waiting' : 'review',
      })
      expect(document.querySelector('[data-ns-drag-ghost]')).toBeNull()
      m.api.reset()
      m.click('start')
      getRootLifecycle(m.root).pause()
      getRootLifecycle(m.root).resume()
      if (kind === 'ordering') {
        m.root.querySelector('[data-ns-command="order-down"]').click()
        expect(draft()).toEqual(question.answerKey.itemIds)
      } else {
        const fresh = m.root.querySelector('[data-ns-source]')
        fresh.click()
        key(fresh, 'ArrowRight')
        expect(document.activeElement).toBe(m.root.querySelectorAll('[data-ns-source]')[1])
        m.root.querySelector('[data-ns-target]').click()
        expect(draft()[0]).not.toBe('')
      }
    }
  )
})

function wordFixture() {
  const m = fixture('word-search', {
    rows: 4,
    columns: 4,
    directions: ['E'],
    words: [{ id: 'cat', text: 'CAT' }],
  })
  const puzzle = generateWordSearch(m.config),
    path = puzzle.placements[0].path
  const cell = (part) =>
    m.root.querySelector(`[data-row="${part.row}"][data-column="${part.column}"]`)
  return { ...m, path, first: () => cell(path[0]), last: () => cell(path.at(-1)), cell }
}
const unselected = (root) =>
  expect([...root.querySelectorAll('[data-row][aria-pressed="true"]')]).toEqual([])

describe('Word Search gesture cancellation', () => {
  it.each(['escape', 'clear', 'pointercancel', 'pause', 'reset', 'destroy'])(
    'cancels %s before pointerup without an award or resurrected endpoints',
    (reason) => {
      const m = wordFixture(),
        first = m.first(),
        last = m.last()
      pointer(first, 'pointerdown')
      if (reason === 'escape') key(first, 'Escape')
      if (reason === 'clear') m.click('clear')
      if (reason === 'pointercancel') pointer(document, 'pointercancel')
      if (reason === 'pause') {
        getRootLifecycle(m.root).pause()
        getRootLifecycle(m.root).resume()
      }
      if (reason === 'reset') m.api.reset()
      let api = m.api
      if (reason === 'destroy') {
        api.destroy()
        api = m.install()
      }
      pointer(last, 'pointerup')
      expect(api.getState()).toMatchObject({ score: 0, foundIds: [] })
      unselected(m.root)
      // Cancellation also leaves a fresh two-tap selection usable.
      m.first().click()
      m.last().click()
      m.click('submit')
      expect(api.getState()).toMatchObject({ score: 1, foundIds: ['cat'], completed: true })
    }
  )
  it('allows only the originating pointer to finish, ignoring other pointerdown/up/cancel sequences', () => {
    const m = wordFixture()
    pointer(m.first(), 'pointerdown', 1)
    pointer(m.last(), 'pointerdown', 2)
    pointer(m.last(), 'pointerup', 2)
    pointer(document, 'pointercancel', 2)
    expect(m.api.getState()).toMatchObject({ score: 0, foundIds: [] })
    pointer(m.last(), 'pointerup', 1)
    expect(m.api.getState()).toMatchObject({ score: 1, foundIds: ['cat'] })
  })
  it('clears the post-drag synthetic-click state on explicit cancellation so a new tap is not lost', () => {
    const m = wordFixture()
    pointer(m.first(), 'pointerdown')
    pointer(m.last(), 'pointerup')
    m.click('clear')
    m.first().click()
    expect(m.first().getAttribute('aria-pressed')).toBe('true')
  })
  it('keeps drag, taps, keyboard endpoints and coordinate submission playable across resets', () => {
    const m = wordFixture()
    pointer(m.first(), 'pointerdown')
    pointer(m.last(), 'pointerup')
    expect(m.api.getState()).toMatchObject({ foundIds: ['cat'], score: 1 })
    m.api.reset()
    m.first().click()
    m.last().click()
    m.click('submit')
    expect(m.api.getState()).toMatchObject({ foundIds: ['cat'], score: 1 })
    m.api.reset()
    m.first().focus()
    key(m.first(), ' ')
    key(m.first(), 'ArrowRight')
    expect(document.activeElement).toBe(m.cell(m.path[1]))
    key(m.last(), ' ')
    key(m.last(), 'Enter')
    expect(m.api.getState()).toMatchObject({ foundIds: ['cat'], score: 1 })
    m.api.reset()
    const values = [
      m.path[0].row + 1,
      m.path[0].column + 1,
      m.path.at(-1).row + 1,
      m.path.at(-1).column + 1,
    ]
    m.root.querySelectorAll('input[type="number"]').forEach((input, index) => {
      input.value = String(values[index])
    })
    submit(m.root.querySelector('form'))
    expect(m.api.getState()).toMatchObject({ foundIds: ['cat'], score: 1 })
  })
})
