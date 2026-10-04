import { useRef, useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getElementForActiveSlideEdit } from '../../pages/editor-page-helpers'

let mockEditor
let editorOptions
vi.mock('@tiptap/react', () => ({
  useEditor: (options) => {
    editorOptions = options
    return mockEditor
  },
}))
import { useEditorRichTextController } from './use-editor-rich-text-controller'

function useHarness({ locked = false, slideLocked = false } = {}) {
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

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('text and table editing transitions', () => {
  it('admits table editing with an unavailable TipTap editor and keeps its cells intact', () => {
    mockEditor = null
    const { result } = renderHook(() => useHarness())
    act(() => result.current.startEditingElement('table'))
    expect(result.current.editingElementId).toBe('table')
    expect(result.current.selection).toEqual(['table'])
    expect(result.current.presentation.slides[0].elements[1].data).toEqual([['First\nSecond']])
  })

  it('does not write stale text updates into a table, but resumes saving ordinary text', () => {
    mockEditor = { isDestroyed: false, commands: { setContent: () => {}, focus: () => {} } }
    const { result } = renderHook(() => useHarness())
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
    mockEditor = {
      isDestroyed: false,
      commands: { setContent: () => {}, focus: () => text.focus() },
    }
    const { result } = renderHook(() => useHarness())
    act(() => result.current.startEditingElement('text'))
    act(() => result.current.startEditingElement('table'))
    cell.focus()
    act(() => vi.advanceTimersByTime(20))
    expect(document.activeElement).toBe(cell)
  })

  it.each([{ locked: true }, { slideLocked: true }])(
    'keeps locked table editing unavailable: %j',
    (locks) => {
      mockEditor = null
      const { result } = renderHook(() => useHarness(locks))
      act(() => result.current.startEditingElement('table'))
      expect(result.current.editingElementId).toBeNull()
      expect(result.current.selection).toEqual([])
      expect(result.current.presentation.slides[0].elements[1].data).toEqual([['First\nSecond']])
    }
  )
})
