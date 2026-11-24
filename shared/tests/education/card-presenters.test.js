import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { createMemoryConfig } from '../../src/education/memory-config.js'
import { createMemoryState, memoryReducer } from '../../src/education/memory-state.js'
import { createFlashcardsConfig } from '../../src/education/flashcards-config.js'
import { createFlashcardsState, flashcardsReducer } from '../../src/education/flashcards-state.js'
import { createRuntimeSession } from '../../src/education/runtime-session.js'
import { presentMemory } from '../../src/education/browser/memory-presenter.js'
import { presentFlashcards } from '../../src/education/browser/flashcards-presenter.js'

const text = (value) => ({ type: 'text', text: value })
const memory = () =>
  createMemoryConfig({
    shuffleOnStart: false,
    mismatchDelayMs: 1000,
    pairs: [
      {
        id: 'a',
        first: text('France'),
        second: { type: 'image', src: '/paris.png', alt: 'Paris skyline' },
      },
      { id: 'b', first: text('Italy'), second: text('Rome') },
    ],
  })
const flashcards = () =>
  createFlashcardsConfig({
    cards: [
      { id: 'a', front: text('Question one'), back: text('Secret answer one') },
      { id: 'b', front: text('Question two'), back: text('Secret answer two') },
    ],
  })
const disposals = []
let dom, document
beforeEach(() => {
  dom = new JSDOM('<!doctype html><body></body>')
  document = dom.window.document
})
afterEach(() => {
  disposals.splice(0).forEach((dispose) => dispose())
  vi.useRealTimers()
  dom.window.close()
})
function mount(type, config) {
  const root = document.createElement('div')
  root.innerHTML = '<div data-ns-game-ui></div>'
  document.body.append(root)
  const initial =
    type === 'memory' ? () => createMemoryState(config) : () => createFlashcardsState(config)
  const reducer = type === 'memory' ? memoryReducer : flashcardsReducer
  const present = type === 'memory' ? presentMemory : presentFlashcards
  let presenter
  const session = createRuntimeSession(
    initial,
    (state, action) => reducer(state, action, config, { random: () => 0 }),
    { onState: (state) => presenter?.render(state) }
  )
  function reset() {
    presenter = null
    session.reset()
    install()
  }
  function install() {
    presenter = present({ root, config, session, reset })
    presenter.render(session.getState())
  }
  install()
  disposals.push(session.destroy)
  return { root, session, reset, render: () => presenter.render(session.getState()) }
}
const command = (root, value) =>
  [...root.querySelectorAll('[data-ns-command]')].find(
    (control) => control.dataset.nsCommand === value
  )
const click = (root, value) => command(root, value).click()

describe('native card presenters', () => {
  it('never places concealed memory answers or alt into DOM, labels or focusable descendants', () => {
    const { root, session } = mount('memory', memory())
    expect(root.textContent).not.toContain('France')
    expect(root.querySelector('img')).toBeNull()
    expect(command(root, 'card:a:second').getAttribute('aria-label')).toBe('Card 2, face down')
    click(root, 'card:a:second')
    expect(root.querySelector('img').alt).toBe('Paris skyline')
    expect(command(root, 'card:a:second').getAttribute('aria-label')).toContain('Paris skyline')
    click(root, 'card:a:first')
    expect(session.getState()).toMatchObject({ score: 10, matchedPairIds: ['a'] })
    expect(root.querySelector('[role="status"]').textContent).toContain('Pair matched')
    click(root, 'reveal')
    expect(root.textContent).toContain('Rome')
    expect(session.getState().score).toBe(10)
    click(root, 'reset')
    expect(root.textContent).not.toContain('France')
    expect(root.querySelector('img')).toBeNull()
  })

  it('retains the remaining mismatch delay through session pause and cancels stale reset callbacks', () => {
    vi.useFakeTimers()
    const { root, session } = mount('memory', memory())
    click(root, 'card:a:first')
    click(root, 'card:b:first')
    vi.advanceTimersByTime(400)
    session.pause()
    vi.advanceTimersByTime(5000)
    expect(session.getState().faceUp).toEqual(['a:first', 'b:first'])
    session.resume()
    vi.advanceTimersByTime(599)
    expect(session.getState().pendingMismatch).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(session.getState().faceUp).toEqual([])
    expect(root.textContent).not.toContain('France')
    click(root, 'card:a:first')
    click(root, 'card:b:first')
    click(root, 'reset')
    click(root, 'card:a:first')
    vi.advanceTimersByTime(2000)
    expect(session.getState()).toMatchObject({
      faceUp: ['a:first'],
      attempts: 0,
      score: 0,
      generation: 1,
    })
  })

  it('moves focus from newly disabled memory cards to a usable control without stealing unrelated focus', () => {
    const { root } = mount('memory', memory())
    const focused = command(root, 'card:a:first')
    focused.focus()
    focused.click()
    expect(document.activeElement).toBe(focused)
    const second = command(root, 'card:b:first')
    second.focus()
    second.click()
    expect(document.activeElement).toBe(command(root, 'reveal'))
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    click(root, 'reveal')
    expect(document.activeElement).toBe(outside)
  })

  it('conceals the other flashcard face, preserves focus during renders and counts unique study progress', () => {
    const { root, session, render } = mount('flashcards', flashcards())
    expect(root.textContent).not.toContain('Secret answer')
    const flip = command(root, 'flip')
    flip.focus()
    flip.click()
    expect(root.textContent).toContain('Secret answer one')
    expect(root.textContent).not.toContain('Question one')
    expect(root.querySelector('[aria-label="Card front"]').hidden).toBe(true)
    render()
    render()
    expect(document.activeElement).toBe(flip)
    flip.click()
    flip.click()
    expect(session.getState().studiedIds).toEqual(['a'])
    click(root, 'next')
    expect(root.textContent).toContain('Question two')
    expect(root.textContent).not.toContain('Secret answer')
    expect(command(root, 'next').disabled).toBe(true)
    click(root, 'shuffle')
    expect(session.getState().order[session.getState().currentIndex]).toBe('b')
    expect(root.querySelector('[role="status"]').textContent).toContain('Cards shuffled')
    click(root, 'reset')
    expect(root.querySelector('[data-ns-flashcards-progress]').textContent).toBe(
      'Card 1 / 2 · 0 / 2 studied'
    )
  })

  it('does not install repeat listeners during rendering and cleans up destroyed controls', () => {
    const { root, session, render } = mount('flashcards', flashcards())
    const old = command(root, 'flip')
    render()
    render()
    render()
    old.click()
    expect(session.getState().side).toBe('back')
    session.destroy()
    old.click()
    expect(session.getState().side).toBe('back')
    expect(root.querySelector('[data-ns-game-ui]').childNodes.length).toBe(0)
  })
})
