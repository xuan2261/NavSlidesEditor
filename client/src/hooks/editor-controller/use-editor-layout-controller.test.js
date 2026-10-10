import { act, cleanup, renderHook } from '@testing-library/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorLayoutController } from './use-editor-layout-controller'
import { createInteractionSlideState, executeInteractionAction } from 'revealjs-shared'
import { useEditorHistoryController } from './use-editor-history-controller'

const initialPresentation = {
  id: 'master-deck',
  slides: [{ id: 'slide-1', elements: [] }],
  layoutMasters: [
    {
      id: 'layout-1',
      name: 'Custom master',
      fixedElements: [
        { id: 'band', type: 'shape', x: 0, y: 0, width: 300, height: 40, locked: true },
      ],
      placeholders: [],
    },
  ],
}

function useHarness(initial = initialPresentation) {
  const [presentation, setPresentation] = useState(null)
  const [selectedIds, setSelectedElementIds] = useState([])
  const selectedElementIdsRef = useRef([])
  selectedElementIdsRef.current = selectedIds
  const currentSlideIndexRef = useRef(0)
  const verticalEditRef = useRef(null)
  const editingElementIdRef = useRef(null)
  const controller = useEditorLayoutController({
    presentation,
    setPresentation,
    mapActive: (previous, transform) => ({
      ...previous,
      slides: previous.slides.map((slide, index) => (index === 0 ? transform(slide) : slide)),
    }),
    setSelectedElementIds,
  })
  const history = useEditorHistoryController({
    presentation, setPresentation, selectedElementIdsRef, currentSlideIndexRef,
    verticalEditRef, editingElementIdRef, resetContent: vi.fn(),
    authoringTarget: controller.masterEdit ? { kind: 'master', id: controller.masterEdit.id } : null,
    setSelectedElementIds, setCurrentSlideIndex: () => {},
    setVerticalEdit: () => {}, setEditingElementId: () => {},
  })
  useLayoutEffect(() => {
    const loaded = structuredClone(initial)
    history.seedHistory(loaded)
    setPresentation(loaded)
  }, [history.seedHistory, initial])
  return { presentation, setPresentation, selectedIds, setSelectedElementIds, history, ...controller }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers() })

describe('useEditorLayoutController master authoring surface', () => {
  it('exposes fixed master elements as editable while retaining their stored lock contract', () => {
    const { result } = renderHook(useHarness)

    act(() => result.current.openLayoutManager())
    act(() => result.current.layoutManagerProps.onEditMaster('layout-1'))

    expect(result.current.masterEdit.fixedElements[0].locked).toBe(false)
    expect(result.current.presentation.layoutMasters[0].fixedElements[0].locked).toBe(true)
  })

  it('deletes a master element from the selected layout only', () => {
    const { result } = renderHook(useHarness)

    act(() => result.current.openLayoutManager())
    act(() => result.current.layoutManagerProps.onEditMaster('layout-1'))
    act(() => result.current.deleteMasterElement('band'))

    expect(result.current.presentation.layoutMasters[0].fixedElements).toEqual([])
  })

  it('keeps an unresolved detached target disabled and publishes a repair notice', () => {
    const notices = []
    const listener = (event) => notices.push(event.detail)
    window.addEventListener('navslides:feedback', listener)
    try {
      const initial = {
        slides: [{ id: 'slide', layoutId: 'layout', elements: [{ id: 'missing', type: 'text' }] }],
        layoutMasters: [
          {
            id: 'layout',
            name: 'Master',
            placeholders: [],
            fixedElements: [
              {
                id: 'button',
                type: 'shape',
                x: 0,
                y: 0,
                width: 120,
                height: 60,
                action: { kind: 'show', targetElementId: 'missing' },
              },
            ],
          },
        ],
      }
      const { result } = renderHook(() => useHarness(initial))
      act(() => result.current.detachActiveLayout())
      const detached = result.current.presentation.slides[0]
      expect(detached.layoutId).toBeUndefined()
      expect(detached.elements[0].action.referenceError).toBeTruthy()
      expect(detached.elements[0]).toMatchObject({ type: 'shape', locked: false })
      expect(detached.elements[0].id).not.toBe('button')
      expect(detached.elements[0].action.targetElementId).toBe('missing')
      const state = createInteractionSlideState(detached)
      const disabled = executeInteractionAction(state, detached.elements[0].action)
      expect(disabled.state).toBe(state)
      expect(disabled.error).toBe(detached.elements[0].action.referenceError)
      expect(initial.layoutMasters[0].fixedElements[0].action.targetElementId).toBe('missing')
      expect(notices).toContainEqual(
        expect.objectContaining({
          type: 'notice',
          message: expect.stringMatching(/choose|target/i),
        })
      )
    } finally {
      window.removeEventListener('navslides:feedback', listener)
    }
  })

  it('persists an authoring mutation without unlocking stored master elements or changing the local slide', () => {
    const { result } = renderHook(useHarness)
    act(() => result.current.openLayoutManager())
    act(() => result.current.layoutManagerProps.onEditMaster('layout-1'))
    act(() => result.current.setPresentation((previous) => result.current.mapAuthoringTarget(previous, (slide) => ({
      ...slide, elements: slide.elements.map((element) => ({ ...element, x: 42 })),
    }))))
    expect(result.current.presentation.layoutMasters[0].fixedElements[0]).toMatchObject({ id: 'band', x: 42, locked: true })
    expect(result.current.masterEdit.fixedElements[0]).toMatchObject({ x: 42, locked: false })
    expect(result.current.presentation.slides[0].elements).toEqual([])
    act(() => result.current.history.handleUndo())
    expect(result.current.presentation.layoutMasters[0].fixedElements[0]).toEqual(initialPresentation.layoutMasters[0].fixedElements[0])
    act(() => result.current.history.handleRedo())
    expect(result.current.presentation.layoutMasters[0].fixedElements[0]).toMatchObject({ x: 42, locked: true })
  })

  it('keeps a surviving selected master target through document undo and redo', () => {
    const { result } = renderHook(useHarness)
    act(() => result.current.openLayoutManager())
    act(() => result.current.layoutManagerProps.onEditMaster('layout-1'))
    act(() => result.current.setSelectedElementIds(['band']))
    act(() => result.current.updateMasterElement('band', { x: 99 }))
    act(() => result.current.history.handleUndo())
    expect(result.current.masterEdit.id).toBe('layout-1')
    expect(result.current.masterEdit.fixedElements[0].x).toBe(initialPresentation.layoutMasters[0].fixedElements[0].x)
    expect(result.current.selectedIds).toEqual(['band'])
    expect(result.current.presentation.slides[0].elements).toEqual([])
    act(() => result.current.history.handleRedo())
    expect(result.current.masterEdit.fixedElements[0].x).toBe(99)
    expect(result.current.selectedIds).toEqual(['band'])
  })

  it('drops a deleted selection and restores the master content without resurrecting stale selection', () => {
    const { result } = renderHook(useHarness)
    act(() => result.current.openLayoutManager())
    act(() => result.current.layoutManagerProps.onEditMaster('layout-1'))
    act(() => result.current.setSelectedElementIds(['band']))
    act(() => result.current.deleteMasterElement('band'))
    expect(result.current.selectedIds).toEqual([])
    act(() => result.current.history.handleUndo())
    expect(result.current.masterEdit.fixedElements[0].id).toBe('band')
    expect(result.current.selectedIds).toEqual([])
    act(() => result.current.history.handleRedo())
    expect(result.current.masterEdit.fixedElements).toEqual([])
    expect(result.current.presentation.slides[0].elements).toEqual([])
  })

  it('clears a removed master target without selecting a same-id local element on redo', () => {
    const { result } = renderHook(useHarness)
    act(() => result.current.openLayoutManager())
    act(() => result.current.layoutManagerProps.onEditMaster('layout-1'))
    act(() => result.current.setPresentation((previous) => ({
      ...previous,
      layoutMasters: [],
      slides: [{ ...previous.slides[0], elements: [{ id: 'band', type: 'text', content: '<p>Local collision</p>' }] }],
    })))
    expect(result.current.masterEdit).toBeNull()
    act(() => result.current.history.handleUndo())
    expect(result.current.masterEdit.id).toBe('layout-1')
    act(() => result.current.setSelectedElementIds(['band']))
    act(() => result.current.history.handleRedo())
    expect(result.current.masterEdit).toBeNull()
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.presentation.slides[0].elements[0].content).toBe('<p>Local collision</p>')
  })
})
