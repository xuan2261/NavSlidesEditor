import { useRef, useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEditorHistoryController } from './use-editor-history-controller'
import { useKeyboard } from '../use-keyboard'

function useHistoryHarness() {
  const [presentation, setPresentation] = useState(null)
  const history = useEditorHistoryController({
    presentation,
    setPresentation,
    setCurrentSlideIndex: () => {},
    setVerticalEdit: () => {},
    resolveHistorySlide: (state) => state.slides[0],
    selectedElementIdsRef: useRef([]),
    editingElementIdRef: useRef(null),
    setSelectedElementIds: () => {},
    setEditingElementId: () => {},
    editor: null,
    settingContent: useRef(false),
  })
  return { presentation, setPresentation, ...history }
}
const deck = (elements) => ({ id: 'deck', slides: [{ id: 'slide', elements }] })
const focusRoots = []
function useKeyboardHistoryHarness() {
  const history = useHistoryHarness()
  useKeyboard({ onUndo: history.handleUndo, onRedo: history.handleRedo })
  return history
}
function insertedBundles() {
  const { result } = renderHook(useKeyboardHistoryHarness)
  const first = [{ id: 'game-a' }, { id: 'trigger-a' }]
  const second = [...first, { id: 'game-b' }, { id: 'trigger-b' }]
  act(() => {
    result.current.seedHistory(deck([]))
    result.current.setPresentation(deck([]))
  })
  act(() => result.current.setPresentation(deck(first)))
  act(() => {
    result.current.commitHistoryTransaction()
    result.current.setPresentation(deck(second))
  })
  return { result, first, second }
}
function commandTarget(markup) {
  const root = document.createElement('div')
  root.innerHTML = markup
  document.body.append(root)
  focusRoots.push(root)
  const target = root.querySelector('button, input, [contenteditable]')
  target.focus()
  return target
}
function historyChord(target, key) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  })
  act(() => target.dispatchEvent(event))
  return event
}
afterEach(() => {
  for (const root of focusRoots.splice(0)) root.remove()
})
afterEach(() => vi.useRealTimers())

describe('explicit authoring history boundaries', () => {
  it('keeps two rapid multi-element bundle inserts independently undoable and redoable', () => {
    vi.useFakeTimers()
    const { result } = renderHook(useHistoryHarness)
    act(() => {
      result.current.seedHistory(deck([]))
      result.current.setPresentation(deck([]))
    })
    const first = [{ id: 'game-a' }, { id: 'trigger-a' }]
    const second = [...first, { id: 'game-b' }, { id: 'trigger-b' }]
    act(() => result.current.setPresentation(deck(first)))
    act(() => {
      result.current.commitHistoryTransaction()
      result.current.setPresentation(deck(second))
    })
    act(() => result.current.handleUndo())
    expect(result.current.presentation.slides[0].elements).toEqual(first)
    act(() => result.current.handleUndo())
    expect(result.current.presentation.slides[0].elements).toEqual([])
    act(() => result.current.handleRedo())
    expect(result.current.presentation.slides[0].elements).toEqual(first)
    act(() => result.current.handleRedo())
    expect(result.current.presentation.slides[0].elements).toEqual(second)
  })

  it('does not insert an extra undo stop when a boundary has no pending change', () => {
    vi.useFakeTimers()
    const { result } = renderHook(useHistoryHarness)
    act(() => {
      result.current.seedHistory(deck([]))
      result.current.setPresentation(deck([]))
    })
    act(() => {
      result.current.commitHistoryTransaction()
      result.current.commitHistoryTransaction()
    })
    act(() => result.current.setPresentation(deck([{ id: 'bundle' }])))
    act(() => result.current.handleUndo())
    expect(result.current.presentation.slides[0].elements).toEqual([])
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it.each([
    ['ribbon', '<div data-ribbon-section><button>Insert block</button></div>'],
    ['quick actions', '<div role="toolbar" aria-label="Quick actions"><button>Save</button></div>'],
  ])(
    'undoes and redoes exact independent bundles while a %s command retains focus',
    (_chrome, markup) => {
      vi.useFakeTimers()
      const { result, first, second } = insertedBundles()
      const target = commandTarget(markup)
      expect(historyChord(target, 'z').defaultPrevented).toBe(true)
      expect(result.current.presentation.slides[0].elements).toEqual(first)
      expect(result.current.canUndo).toBe(true)
      expect(result.current.canRedo).toBe(true)
      expect(document.activeElement).toBe(target)
      expect(historyChord(target, 'y').defaultPrevented).toBe(true)
      expect(result.current.presentation.slides[0].elements).toEqual(second)
      expect(result.current.canUndo).toBe(true)
      expect(result.current.canRedo).toBe(false)
    }
  )

  it.each([
    ['unscoped button', '<button>Activity control</button>'],
    ['input', '<div data-ribbon-section><input value="Draft"></div>'],
    [
      'editable ancestor',
      '<div data-ribbon-section><div contenteditable="true" tabindex="0">Draft</div></div>',
    ],
    ['dialog', '<div data-ribbon-section><dialog open><button>Confirm</button></dialog></div>'],
    ['form', '<div data-ribbon-section><form><button>Submit</button></form></div>'],
    ['popover', '<div data-ribbon-section><div popover><button>Choose</button></div></div>'],
    [
      'composite widget',
      '<div data-ribbon-section><div role="menu"><button>Choose</button></div></div>',
    ],
  ])('does not change document history or claim native chords inside %s', (_owner, markup) => {
    vi.useFakeTimers()
    const { result, second } = insertedBundles()
    const target = commandTarget(markup)
    for (const key of ['z', 'y']) {
      expect(historyChord(target, key).defaultPrevented).toBe(false)
      expect(result.current.presentation.slides[0].elements).toEqual(second)
      expect(result.current.canRedo).toBe(false)
    }
  })
})
