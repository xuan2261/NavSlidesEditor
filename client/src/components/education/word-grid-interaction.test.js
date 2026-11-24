import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { createRuntimeSession } from '../../../../shared/src/education/runtime-session.js'
import {
  validateCrosswordLayout,
  createCrosswordState,
  reduceCrossword,
} from '../../../../shared/src/education/crossword-layout.js'
import { generateWordSearch } from '../../../../shared/src/education/word-search-generator.js'
import {
  createWordSearchState,
  reduceWordSearch,
} from '../../../../shared/src/education/word-search-selection.js'
import { presentCrossword } from '../../../../shared/src/education/browser/crossword-presenter.js'
import { presentWordSearch } from '../../../../shared/src/education/browser/word-search-presenter.js'

function mount(config, crossword) {
  const dom = new JSDOM('<section><div data-ns-game-ui></div></section>')
  const document = dom.window.document,
    root = document.querySelector('section')
  const puzzle = crossword ? validateCrosswordLayout(config) : generateWordSearch(config)
  const initial = crossword ? createCrosswordState : createWordSearchState
  const reduce = crossword ? reduceCrossword : reduceWordSearch
  let presenter
  const session = createRuntimeSession(
    () => initial(puzzle),
    (state, action) => reduce(puzzle, state, action),
    { onState: (state) => presenter?.render(state) }
  )
  const factory = () => {
    presenter = (crossword ? presentCrossword : presentWordSearch)({
      root,
      config,
      puzzle,
      session,
      reset: () => {
        session.reset()
        factory()
      },
    })
    presenter.render(session.getState())
  }
  factory()
  return { dom, document, root, puzzle, session }
}
const crosswordConfig = () => ({
  title: 'Vietnamese',
  rows: 4,
  columns: 4,
  seed: 1,
  entries: [
    { id: 'learn', answer: 'học', clue: 'Learn', row: 0, column: 0, direction: 'across' },
    { id: 'sing', answer: 'hát', clue: 'Sing', row: 0, column: 0, direction: 'down' },
  ],
})
const searchConfig = () => ({
  rows: 5,
  columns: 5,
  seed: 3,
  directions: ['E'],
  alphabet: 'ABCĐ',
  words: [
    { id: 'learn', text: 'học' },
    { id: 'red', text: 'đỏ' },
  ],
})
const cell = (document, part) =>
  document.querySelector(`[data-row="${part.row}"][data-column="${part.column}"]`)
const button = (document, text) =>
  [...document.querySelectorAll('button')].find((item) => item.textContent === text)

describe('actual word grid DOM interactions', () => {
  it('pastes decomposed letters across an entry, checks and solves crossings without replacing focus', () => {
    const { dom, document, puzzle, session } = mount(crosswordConfig(), true)
    const first = cell(document, { row: 0, column: 0 })
    first.focus()
    const paste = new dom.window.Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'ho\u0323c' } })
    first.dispatchEvent(paste)
    expect(session.getState().values).toMatchObject({ '0:0': 'H', '0:1': 'Ọ', '0:2': 'C' })
    const focused = document.activeElement
    button(document, 'Check answers').click()
    expect(session.getState().foundIds).toEqual(['learn'])
    expect(document.activeElement).toBe(focused)
    button(document, '1 down: Sing').click()
    for (const [index, part] of puzzle.placements[1].path.entries()) {
      const input = cell(document, part)
      input.value = puzzle.placements[1].tokens[index]
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    }
    button(document, 'Check answers').click()
    expect(session.getState()).toMatchObject({ completed: true, score: 2 })
    button(document, 'Reset').click()
    expect(session.getState()).toMatchObject({ foundIds: [], score: 0, values: {} })
    expect([...document.querySelectorAll('input')].map((input) => input.value)).toEqual([
      '',
      '',
      '',
      '',
      '',
    ])
    session.destroy()
    dom.window.close()
  })
  it('does not grade intermediate IME text and commits a normalized grapheme only on composition end', () => {
    const { dom, document, session } = mount(crosswordConfig(), true)
    const input = cell(document, { row: 0, column: 1 })
    input.dispatchEvent(new dom.window.CompositionEvent('compositionstart', { bubbles: true }))
    input.value = 'o\u0323'
    input.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, isComposing: true }))
    button(document, 'Check answers').click()
    expect(session.getState().values).toEqual({})
    expect(session.getState().foundIds).toEqual([])
    input.dispatchEvent(new dom.window.CompositionEvent('compositionend', { bubbles: true }))
    expect(session.getState().values['0:1']).toBe('Ọ')
    session.destroy()
    dom.window.close()
  })
  it('supports keyboard endpoints, wrong/retry, coordinate completion and generation-owned reset', () => {
    const { dom, document, puzzle, session } = mount(searchConfig(), false)
    const first = puzzle.placements[0]
    const press = (part, key) =>
      cell(document, part).dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      )
    press(first.path[0], ' ')
    press(first.path.at(-1), ' ')
    press(first.path.at(-1), 'Enter')
    expect(session.getState().foundIds).toEqual([first.id])
    const next = puzzle.placements.find((entry) => entry.id !== first.id)
    document.querySelector('select').value = next.id
    const inputs = [...document.querySelectorAll('input[type=number]')]
    const submit = () =>
      document
        .querySelector('form')
        .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
    inputs.forEach((input) => {
      input.value = '1'
    })
    submit()
    expect(session.getState()).toMatchObject({ lastResult: 'incorrect', score: 1 })
    const coordinates = [
      next.path[0].row + 1,
      next.path[0].column + 1,
      next.path.at(-1).row + 1,
      next.path.at(-1).column + 1,
    ]
    inputs.forEach((input, i) => {
      input.value = String(coordinates[i])
    })
    submit()
    expect(session.getState()).toMatchObject({ completed: true, score: 2 })
    submit()
    expect(session.getState().score).toBe(2)
    const oldCell = cell(document, first.path[0])
    button(document, 'Reset').click()
    oldCell.click()
    expect(session.getState()).toMatchObject({ foundIds: [], score: 0 })
    session.destroy()
    dom.window.close()
  })
  it('click start/end works without dragging and leaves Tab available for exiting the grid', () => {
    const { dom, document, puzzle, session } = mount(searchConfig(), false)
    const entry = puzzle.placements[0]
    cell(document, entry.path[0]).click()
    cell(document, entry.path.at(-1)).click()
    button(document, 'Submit selected path').click()
    expect(session.getState().foundIds).toEqual([entry.id])
    const tab = new dom.window.KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    cell(document, entry.path[0]).dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    session.destroy()
    dom.window.close()
  })
})
