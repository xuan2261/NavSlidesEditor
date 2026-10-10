import { act, cleanup, renderHook } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../utils/api'
import { getElementForActiveSlideEdit } from '../../pages/editor-page-helpers'

let editorUnavailable = false
let editorOptions
vi.mock('@tiptap/react', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    useEditor: (options) => {
      editorOptions = options
      return editorUnavailable ? null : original.useEditor(options)
    },
  }
})
import { useEditorRichTextController } from './use-editor-rich-text-controller'
import { useEditorSaveController } from './use-editor-save-controller'

function useTableHarness({ locked = false, slideLocked = false } = {}) {
  const [presentation, setPresentation] = useState({
    slides: [
      {
        id: 's1',
        locked: slideLocked,
        elements: [
          { id: 'text', type: 'text', content: '<p>Original</p>' },
          { id: 'table', type: 'table', locked, data: [['First\nSecond']] },
        ],
      },
    ],
  })
  const [editingElementId, setEditingElementId] = useState(null)
  const [selection, setSelectedElementIds] = useState([])
  const activeSlideRef = useRef(presentation.slides[0])
  activeSlideRef.current = presentation.slides[0]
  const editingElementIdRef = useRef(null)
  const currentSlideIndexRef = useRef(0)
  const controller = useEditorRichTextController({
    presentation,
    setPresentation,
    mapActive: (previous, update) => ({ ...previous, slides: previous.slides.map(update) }),
    activeSlideRef,
    currentSlideIndexRef,
    editingElementId,
    editingElementIdRef,
    setEditingElementId,
    setSelectedElementIds,
    setActiveTab: () => {},
    getElement: getElementForActiveSlideEdit,
    exitEditOnEscape: () => false,
  })
  return { ...controller, presentation, editingElementId, selection }
}


describe('text and table editing transitions', () => {
  it('admits table editing with an unavailable TipTap editor and keeps its cells intact', () => {
    editorUnavailable = true
    const { result } = renderHook(() => useTableHarness())
    act(() => result.current.startEditingElement('table'))
    expect(result.current.editingElementId).toBe('table')
    expect(result.current.selection).toEqual(['table'])
    expect(result.current.presentation.slides[0].elements[1].data).toEqual([['First\nSecond']])
  })
})

vi.mock('../../utils/api', () => ({ api: { updatePresentation: vi.fn() } }))

const text = (id, content) => ({ id, type: 'text', content })
const initial = () => ({
  id: 'rich-deck', aggregateGeneration: 1,
  slides: [{ id: 'slide', elements: [text('first', '<p>Alpha</p>'), text('second', '<p>Beta</p>')] }],
})
const range = document.createRange.bind(document)

function useHarness(seed = initial()) {
  const [presentation, setPresentation] = useState(seed)
  const [editingElementId, setEditingElementId] = useState(null)
  const [selectedIds, setSelectedElementIds] = useState([])
  const editingElementIdRef = useRef(null)
  const activeSlideRef = useRef(presentation.slides[0])
  activeSlideRef.current = presentation.slides[0]
  const currentSlideIndexRef = useRef(0)
  const controller = useEditorRichTextController({
    presentation, setPresentation,
    mapActive: (previous, transform) => ({ ...previous, slides: [transform(previous.slides[0])] }),
    activeSlideRef, currentSlideIndexRef, editingElementId, editingElementIdRef,
    setEditingElementId, setSelectedElementIds, setActiveTab: () => {},
    getElement: getElementForActiveSlideEdit, exitEditOnEscape: () => false,
  })
  const save = useEditorSaveController({ isTemplate: false })
  return { ...controller, presentation, setPresentation, selectedIds, editingElementId, save }
}

beforeEach(() => {
  vi.useFakeTimers()
  editorUnavailable = false
  vi.stubGlobal('indexedDB', undefined)
  localStorage.clear()
  api.updatePresentation.mockReset()
  vi.spyOn(document, 'createRange').mockImplementation(() => Object.assign(range(), {
    getClientRects: () => [],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }),
  }))
})
afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const content = (result, index = 0) => result.current.presentation.slides[0].elements[index].content

function start(result, id = 'first') {
  act(() => result.current.startEditingElement(id))
  act(() => vi.advanceTimersByTime(10))
}

describe('useEditorRichTextController real TipTap transactions', () => {
  it('does not undo an unedited seed but can undo and redo subsequent input', () => {
    const { result } = renderHook(() => useHarness())
    start(result)
    act(() => result.current.editor.commands.undo())
    expect(result.current.editor.getHTML()).toBe('<p>Alpha</p>')
    expect(content(result)).toBe('<p>Alpha</p>')
    act(() => result.current.editor.chain().setTextSelection(6).insertContent('!').run())
    expect(content(result)).toBe('<p>Alpha!</p>')
    act(() => result.current.editor.commands.undo())
    expect(content(result)).toBe('<p>Alpha</p>')
    act(() => result.current.editor.commands.redo())
    expect(content(result)).toBe('<p>Alpha!</p>')
  })

  it('does not replay another element history after changing the editing target', () => {
    const { result } = renderHook(() => useHarness())
    start(result)
    act(() => result.current.editor.chain().setTextSelection({ from: 1, to: 6 }).toggleBold().run())
    start(result, 'second')
    act(() => result.current.editor.commands.undo())
    expect(result.current.editor.getHTML()).toBe('<p>Beta</p>')
    expect(content(result, 1)).toBe('<p>Beta</p>')
    act(() => result.current.editor.commands.redo())
    expect(content(result, 1)).toBe('<p>Beta</p>')
    act(() => result.current.editor.chain().setTextSelection(5).insertContent('!').run())
    expect(content(result, 1)).toBe('<p>Beta!</p>')
    act(() => result.current.editor.commands.undo())
    expect(content(result, 1)).toBe('<p>Beta</p>')
    expect(content(result)).toBe('<p><strong>Alpha</strong></p>')
    expect(result.current.selectedIds).toEqual(['second'])
  })

  it('persists selected-text formatting across target changes, remote save and reload', async () => {
    let persisted
    api.updatePresentation.mockImplementation((_id, snapshot) => {
      persisted = JSON.parse(JSON.stringify(snapshot))
      return Promise.resolve({ aggregateGeneration: 2 })
    })
    const mounted = renderHook(() => useHarness())
    start(mounted.result)
    act(() => mounted.result.current.editor.chain().setTextSelection({ from: 1, to: 6 }).toggleBold().run())
    expect(mounted.result.current.editor.state.selection.from).toBe(1)
    expect(mounted.result.current.editor.state.selection.to).toBe(6)
    expect(content(mounted.result)).toBe('<p><strong>Alpha</strong></p>')
    start(mounted.result, 'second')
    expect(mounted.result.current.selectedIds).toEqual(['second'])
    expect(mounted.result.current.editor.getHTML()).toBe('<p>Beta</p>')
    expect(content(mounted.result)).toBe('<p><strong>Alpha</strong></p>')
    act(() => mounted.result.current.save.scheduleSave(mounted.result.current.presentation, 0))
    await act(async () => { await mounted.result.current.save.flushAndWait() })
    expect(persisted.slides[0].elements[0].content).toBe('<p><strong>Alpha</strong></p>')
    expect(persisted.slides[0].elements[1].content).toBe('<p>Beta</p>')
    mounted.unmount()
    const reloaded = renderHook(() => useHarness(persisted))
    start(reloaded.result)
    expect(reloaded.result.current.editor.getHTML()).toBe('<p><strong>Alpha</strong></p>')
    expect(reloaded.result.current.selectedIds).toEqual(['first'])
  })

  it('keeps TipTap undo and redo formatting on the currently edited element', () => {
    const { result } = renderHook(() => useHarness())
    start(result)
    act(() => result.current.editor.chain().setTextSelection({ from: 1, to: 6 }).toggleItalic().run())
    expect(content(result)).toBe('<p><em>Alpha</em></p>')
    act(() => result.current.editor.commands.undo())
    expect(content(result)).toBe('<p>Alpha</p>')
    act(() => result.current.editor.commands.redo())
    expect(content(result)).toBe('<p><em>Alpha</em></p>')
    expect(content(result, 1)).toBe('<p>Beta</p>')
  })

  it('clears the live editor without writing an empty document into the selected element', () => {
    const { result } = renderHook(() => useHarness())
    start(result)
    act(() => result.current.clearContent())
    expect(result.current.editor.getText()).toBe('')
    expect(content(result)).toBe('<p>Alpha</p>')
  })

  it('does not write stale content after editing ends or touch a destroyed editor', () => {
    const { result } = renderHook(() => useHarness())
    start(result)
    act(() => result.current.stopEditingElement())
    act(() => result.current.editor.commands.insertContent('orphaned'))
    expect(content(result)).toBe('<p>Alpha</p>')
    expect(result.current.editingElementId).toBeNull()
    act(() => result.current.editor.destroy())
    act(() => result.current.clearContent())
    act(() => result.current.startEditingElement('second'))
    expect(content(result, 1)).toBe('<p>Beta</p>')
  })

  it.each(['slide', 'element'])('rejects live updates after the active %s becomes locked', (scope) => {
    const { result } = renderHook(() => useHarness())
    start(result)
    act(() => result.current.setPresentation((previous) => ({ ...previous, slides: [{
      ...previous.slides[0],
      ...(scope === 'slide' ? { locked: true } : {}),
      elements: previous.slides[0].elements.map((element) =>
        scope === 'element' && element.id === 'first' ? { ...element, locked: true } : element),
    }] })))
    const locked = result.current.presentation
    act(() => result.current.editor.chain().setTextSelection(6).insertContent('!').run())
    expect(result.current.presentation).toBe(locked)
    expect(content(result)).toBe('<p>Alpha</p>')
  })
})

describe('text and table editing focus and writes', () => {

  it('does not write stale text updates into a table, but resumes saving ordinary text', () => {
    const { result } = renderHook(() => useTableHarness())
    act(() => result.current.startEditingElement('table'))
    act(() => editorOptions.onUpdate({ editor: { getHTML: () => '<p>Stale</p>' } }))
    expect(result.current.presentation.slides[0].elements[1]).toEqual({
      id: 'table',
      type: 'table',
      locked: false,
      data: [['First\nSecond']],
    })
    act(() => result.current.startEditingElement('text'))
    act(() => editorOptions.onUpdate({ editor: { getHTML: () => '<p>Edited</p>' } }))
    expect(result.current.presentation.slides[0].elements[0].content).toBe('<p>Edited</p>')
    expect(result.current.presentation.slides[0].elements[1].data).toEqual([['First\nSecond']])
  })

  it('does not let a delayed text-focus callback steal table keyboard focus', () => {
    vi.useFakeTimers()
    const text = document.createElement('input')
    const cell = document.createElement('textarea')
    document.body.append(text, cell)
    const { result } = renderHook(() => useTableHarness())
    const commands = result.current.editor.commands
    vi.spyOn(result.current.editor, 'commands', 'get').mockReturnValue({
      ...commands, focus: () => text.focus(),
    })
    act(() => result.current.startEditingElement('text'))
    act(() => result.current.startEditingElement('table'))
    cell.focus()
    act(() => vi.advanceTimersByTime(20))
    expect(document.activeElement).toBe(cell)
  })

  it.each([{ locked: true }, { slideLocked: true }])(
    'keeps locked table editing unavailable: %j',
    (locks) => {
      editorUnavailable = true
      const { result } = renderHook(() => useTableHarness(locks))
      act(() => result.current.startEditingElement('table'))
      expect(result.current.editingElementId).toBeNull()
      expect(result.current.selection).toEqual([])
      expect(result.current.presentation.slides[0].elements[1].data).toEqual([['First\nSecond']])
    }
  )
})
