import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import presenter from '../../src/education/browser/interaction-presenter.js'
import variables from '../../src/education/interaction-variables.js'
const fixtures = []
afterEach(() => {
  for (const f of fixtures.splice(0)) {
    f.controller.destroy()
    f.dom.window.close()
  }
})
function fixture(view = 'local') {
  const dom = new JSDOM(
    `<html data-ns-education-view="${view}"><body><div class="reveal"><div class="slides"><section data-ns-effective-slide-id="a"><button data-ns-element-id="source">Action</button><div data-ns-element-id="answer" data-ns-initial-visibility="hidden" class="fragment">Answer</div><button data-ns-element-for="answer">Target overlay</button><div data-ns-element-id="game"><div data-ns-game-ui><button>Widget</button></div></div></section><section data-ns-effective-slide-id="b"><div data-ns-element-id="answer">Other answer</div></section></div></div></body></html>`
  )
  const document = dom.window.document,
    sections = [...document.querySelectorAll('section')],
    callbacks = new Map()
  let active = sections[0]
  const reveal = {
    getCurrentSlide: () => active,
    on: (name, fn) => callbacks.set(name, fn),
    off: (name, fn) => {
      if (callbacks.get(name) === fn) callbacks.delete(name)
    },
    navigateFragment: vi.fn(),
  }
  const store = variables.createInteractionVariableStore([
    { id: 'score', name: 'Points', initialValue: 0, min: 0, max: 10 },
  ])
  const resetSlide = vi.fn()
  const controller = presenter.initInteractionPresenter({
    document,
    reveal,
    variables: store,
    resetSlide,
  })
  const f = {
    dom,
    document,
    sections,
    reveal,
    store,
    resetSlide,
    controller,
    emit: (name) => callbacks.get(name)?.(),
    setActive: (section) => {
      active = section
    },
    source: document.querySelector('[data-ns-element-id="source"]'),
    answer: document.querySelector('[data-ns-element-id="answer"]'),
    overlay: document.querySelector('[data-ns-element-for]'),
  }
  fixtures.push(f)
  f.action = (action) => {
    f.source.dataset.nsAction = JSON.stringify(action)
    f.source.click()
  }
  return f
}
describe('interaction presenter document behavior', () => {
  it('combines trigger and fragment gates across target content and sibling overlays', () => {
    const f = fixture()
    f.action({ kind: 'show', targetElementId: 'answer' })
    expect(f.answer.hidden).toBe(true)
    expect(f.overlay.hidden).toBe(true)
    f.answer.classList.add('visible')
    f.emit('fragmentshown')
    expect(f.answer.hidden).toBe(false)
    expect(f.overlay.hidden).toBe(false)
    f.action({ kind: 'hide', targetElementId: 'answer' })
    f.emit('fragmenthidden')
    f.emit('fragmentshown')
    expect(f.answer.hidden).toBe(true)
    expect(f.overlay.style.display).toBe('none')
    expect(f.sections[1].querySelector('[data-ns-element-id="answer"]').hidden).toBe(false)
    f.action({ kind: 'toggle', targetElementId: 'answer' })
    expect(f.answer.hidden).toBe(false)
  })
  it('executes native click once, ignores native key adapters and preserves default scores on reset', () => {
    const f = fixture('live')
    f.source.dataset.nsAction = JSON.stringify({
      kind: 'score-add',
      variableId: 'score',
      amount: 1,
    })
    f.source.dispatchEvent(
      new f.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    expect(f.store.read('score')).toBe(0)
    f.source.click()
    expect(f.store.read('score')).toBe(1)
    f.action({ kind: 'reset-slide' })
    expect(f.store.read('score')).toBe(1)
    expect(f.resetSlide).toHaveBeenCalledWith(f.sections[0])
    expect(f.reveal.navigateFragment).toHaveBeenCalledWith(-1)
    f.action({ kind: 'reset-slide', resetVariables: true })
    expect(f.store.read('score')).toBe(0)
  })
  it('does not hijack game controls, old navigation or editor interaction', () => {
    const f = fixture()
    const game = f.document.querySelector('[data-ns-element-id="game"]')
    game.dataset.nsAction = JSON.stringify({ kind: 'score-add', variableId: 'score', amount: 1 })
    game.querySelector('button').click()
    expect(f.store.read('score')).toBe(0)
    f.source.dataset.nsAction = JSON.stringify({ kind: 'next' })
    const click = new f.dom.window.MouseEvent('click', { bubbles: true, cancelable: true })
    f.source.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    const editor = fixture('editor')
    editor.action({ kind: 'score-add', variableId: 'score', amount: 1 })
    expect(editor.store.read('score')).toBe(0)
  })
  it('reports missing targets accessibly instead of touching another slide and cleans up', () => {
    const f = fixture()
    f.action({ kind: 'show', targetElementId: 'missing' })
    expect(f.sections[0].querySelector('[role="alert"]').textContent).toMatch(/effective slide/)
    f.controller.destroy()
    expect(f.document.querySelector('[role="alert"]')).toBeNull()
    expect(f.answer.hidden).toBe(false)
    f.action({ kind: 'score-add', variableId: 'score', amount: 1 })
    expect(f.store.read('score')).toBe(0)
  })
  it('uses one nonnative keyboard adapter and suppresses repeat activation', () => {
    const f = fixture(),
      source = f.document.createElement('div')
    source.tabIndex = 0
    source.setAttribute('role', 'button')
    source.dataset.nsAction = JSON.stringify({ kind: 'score-add', variableId: 'score', amount: 1 })
    f.sections[0].append(source)
    source.dispatchEvent(
      new f.dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    )
    source.dispatchEvent(
      new f.dom.window.KeyboardEvent('keydown', {
        key: ' ',
        repeat: true,
        bubbles: true,
        cancelable: true,
      })
    )
    expect(f.store.read('score')).toBe(1)
  })
})
