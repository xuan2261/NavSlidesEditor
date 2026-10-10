import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EditorContent } from '@tiptap/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuickAccessToolbar from '../../components/QuickAccessToolbar'
import { getElementForActiveSlideEdit } from '../../pages/editor-page-helpers'
import { api } from '../../utils/api'
import { useEditorHistoryController } from './use-editor-history-controller'
import { useEditorLayoutController } from './use-editor-layout-controller'
import { useEditorRichTextController } from './use-editor-rich-text-controller'
import { useEditorSaveController } from './use-editor-save-controller'

vi.mock('../../utils/api', () => ({ api: { updatePresentation: vi.fn() } }))
const element = () => ({ id: 'text', type: 'text', content: '<p>Alpha</p>', locked: true })
const initial = () => ({
  id: 'history-text', aggregateGeneration: 1,
  slides: [{ id: 'slide', elements: [{ ...element(), locked: false }] }],
  layoutMasters: [{ id: 'master', fixedElements: [element()], placeholders: [] }],
})
const range = document.createRange.bind(document)
let current

function Harness({ seed = initial() }) {
  const [presentation, setPresentation] = useState(null)
  const [editingElementId, setEditingElementId] = useState(null)
  const [selectedIds, setSelectedElementIds] = useState([])
  const editingElementIdRef = useRef(null)
  const selectedElementIdsRef = useRef([])
  selectedElementIdsRef.current = selectedIds
  const currentSlideIndexRef = useRef(0)
  const verticalEditRef = useRef(null)
  const layout = useEditorLayoutController({
    presentation, setPresentation, setSelectedElementIds,
    mapActive: (previous, transform) => ({ ...previous, slides: [transform(previous.slides[0])] }),
  })
  const activeSlideRef = useRef(null)
  activeSlideRef.current = layout.masterEdit
    ? { elements: layout.masterEdit.fixedElements } : presentation?.slides[0]
  const rich = useEditorRichTextController({
    presentation, setPresentation, mapActive: layout.mapAuthoringTarget,
    activeSlideRef, currentSlideIndexRef, editingElementId, editingElementIdRef,
    setEditingElementId, setSelectedElementIds, setActiveTab: () => {},
    getElement: getElementForActiveSlideEdit, exitEditOnEscape: () => false,
  })
  const history = useEditorHistoryController({
    presentation, setPresentation, currentSlideIndexRef, verticalEditRef,
    selectedElementIdsRef, editingElementIdRef, setSelectedElementIds, setEditingElementId,
    setCurrentSlideIndex: () => {}, setVerticalEdit: () => {},
    authoringTarget: layout.masterEdit ? { kind: 'master', id: 'master' } : null,
    resetContent: rich.resetContent,
  })
  useLayoutEffect(() => {
    history.seedHistory(seed)
    setPresentation(seed)
  }, [history.seedHistory, seed])
  const save = useEditorSaveController({ isTemplate: false })
  useLayoutEffect(() => {
    current = { presentation, setPresentation, editingElementId, selectedIds, ...rich, ...layout, save }
  })
  return <><QuickAccessToolbar
    onUndo={history.handleUndo} onRedo={history.handleRedo}
    canUndo={history.canUndo} canRedo={history.canRedo}
    onSave={() => save.scheduleSave(presentation, 0)}
  /><EditorContent editor={rich.editor} /></>
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('indexedDB', undefined)
  localStorage.clear()
  api.updatePresentation.mockReset()
  vi.spyOn(document, 'createRange').mockImplementation(() => Object.assign(range(), {
    getClientRects: () => [],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }),
  }))
})
afterEach(() => {
  cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals()
})
const targetContent = (deck, master) => master
  ? deck.layoutMasters[0].fixedElements[0].content : deck.slides[0].elements[0].content

describe('toolbar document history with a surviving real TipTap target', () => {
  it.each([[false, false], [false, true], [true, false], [true, true]])(
    'persists further typing from restored content (master=%s, redo=%s)', async (master, redo) => {
      let persisted
      api.updatePresentation.mockImplementation((_id, snapshot) => {
        persisted = structuredClone(snapshot)
        return Promise.resolve({ aggregateGeneration: 2 })
      })
      const seed = initial()
      const mounted = render(<Harness seed={seed} />)
      if (master) {
        act(() => current.openLayoutManager())
        act(() => current.layoutManagerProps.onEditMaster('master'))
      }
      act(() => current.startEditingElement('text'))
      act(() => vi.advanceTimersByTime(10))
      act(() => current.editor.chain().setTextSelection(6).insertContent('!').run())
      expect(targetContent(current.presentation, master)).toBe('<p>Alpha!</p>')
      if (redo) {
        act(() => vi.advanceTimersByTime(500))
        act(() => current.editor.chain().setTextSelection(7).insertContent('~').run())
        expect(targetContent(current.presentation, master)).toBe('<p>Alpha!~</p>')
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
        expect(targetContent(current.presentation, master)).toBe('<p>Alpha!</p>')
      }
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(targetContent(current.presentation, master)).toBe('<p>Alpha</p>')
      if (redo) {
        fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
        expect(targetContent(current.presentation, master)).toBe('<p>Alpha!</p>')
      }
      expect(current.editingElementId).toBe('text')
      expect(current.selectedIds).toEqual(['text'])
      act(() => current.editor.chain().setTextSelection(current.editor.state.doc.content.size - 1).insertContent('?').run())
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await act(async () => { await current.save.flushAndWait() })
      const expected = redo ? '<p>Alpha!?</p>' : '<p>Alpha?</p>'
      expect(targetContent(persisted, master)).toBe(expected)
      if (master) {
        expect(persisted.layoutMasters[0].fixedElements[0].locked).toBe(true)
        expect(persisted.slides[0].elements[0].content).toBe('<p>Alpha</p>')
      }
      mounted.unmount()
      render(<Harness seed={persisted} />)
      if (master) {
        act(() => current.openLayoutManager())
        act(() => current.layoutManagerProps.onEditMaster('master'))
      }
      act(() => current.startEditingElement('text'))
      expect(current.editor.getHTML()).toBe(expected)
    }
  )

  it('preserves block heading typography through Undo and further saved input', async () => {
    let persisted
    api.updatePresentation.mockImplementation((_id, snapshot) => {
      persisted = structuredClone(snapshot)
      return Promise.resolve({ aggregateGeneration: 2 })
    })
    const seed = initial()
    seed.slides[0].elements[0].content = '<h1 style="font-size:120px;color:#c73639">Alpha</h1>'
    render(<Harness seed={seed} />)
    act(() => current.startEditingElement('text'))
    act(() => current.editor.chain().setTextSelection(6).insertContent('!').run())
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(targetContent(current.presentation, false)).toBe(seed.slides[0].elements[0].content)
    act(() => current.editor.chain().setTextSelection(6).insertContent('?').run())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await act(async () => { await current.save.flushAndWait() })
    const document = new DOMParser().parseFromString(targetContent(persisted, false), 'text/html')
    const styled = document.querySelector('[style*="120px"]')
    expect(styled?.style.fontSize).toBe('120px')
    expect(styled?.style.color).toBe('rgb(199, 54, 57)')
    expect(styled?.textContent).toBe('Alpha?')
  })

  it.each(['slide', 'element'])('ends inline editing when Undo restores the %s lock', (scope) => {
    const seed = initial()
    if (scope === 'slide') seed.slides[0].locked = true
    else seed.slides[0].elements[0].locked = true
    render(<Harness seed={seed} />)
    act(() => current.setPresentation((previous) => ({ ...previous, slides: [{
      ...previous.slides[0], locked: false,
      elements: previous.slides[0].elements.map((element) => ({ ...element, locked: false })),
    }] })))
    act(() => current.startEditingElement('text'))
    expect(current.editingElementId).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(current.editingElementId).toBeNull()
    expect(current.selectedIds).toEqual(['text'])
    expect(current.editor.getText()).toBe('')
    act(() => current.editor.commands.insertContent('blocked'))
    expect(targetContent(current.presentation, false)).toBe('<p>Alpha</p>')
  })

  it('P06-04 coalesces document history inside 500ms without retaining stale intermediate content', () => {
    const seed = initial()
    render(<Harness seed={seed} />)
    const original = JSON.stringify(current.presentation)
    act(() => current.setPresentation((previous) => ({ ...previous, title: 'Intermediate', slides: [{ ...previous.slides[0], elements: [{ ...previous.slides[0].elements[0], content: '<p>Intermediate</p>' }] }] })))
    act(() => vi.advanceTimersByTime(200))
    act(() => current.setPresentation((previous) => ({ ...previous, title: 'Latest', slides: [{ ...previous.slides[0], elements: [{ ...previous.slides[0].elements[0], content: '<p>Latest</p>' }] }] })))
    const latest = JSON.stringify(current.presentation)
    act(() => vi.advanceTimersByTime(500))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(JSON.stringify(current.presentation)).toBe(original)
    expect(screen.getByRole('button', { name: 'Undo' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(JSON.stringify(current.presentation)).toBe(latest)
    expect(screen.getByRole('button', { name: 'Redo' }).disabled).toBe(true)
  })

  it('P06-06 stops integrated Undo at the oldest retained serialized document after the cap', () => {
    const seed = initial()
    render(<Harness seed={seed} />)
    const snapshots = []
    for (let index = 1; index <= 65; index++) {
      act(() => current.setPresentation((previous) => ({ ...previous, title: `Capped ${index}`, slides: [{ ...previous.slides[0], elements: [{ ...previous.slides[0].elements[0], content: `<p>Snapshot ${index}</p>` }] }] })))
      snapshots[index] = JSON.stringify(current.presentation)
      act(() => vi.advanceTimersByTime(500))
    }
    for (let index = 64; index >= 16; index--) {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(JSON.stringify(current.presentation)).toBe(snapshots[index])
    }
    expect(screen.getByRole('button', { name: 'Undo' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(JSON.stringify(current.presentation)).toBe(snapshots[16])
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(JSON.stringify(current.presentation)).toBe(snapshots[17])
  })
})
