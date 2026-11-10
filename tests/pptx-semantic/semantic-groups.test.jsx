// @vitest-environment jsdom
import { useLayoutEffect, useRef, useState } from 'react'
import { act, fireEvent, render, renderHook, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditorCanvasWorkspace from '../../client/src/components/editor/editor-canvas-workspace'
import { useEditorElementController } from '../../client/src/hooks/editor-controller/use-editor-element-controller'
import { useEditorHistoryController } from '../../client/src/hooks/editor-controller/use-editor-history-controller'
import { useUIStore } from '../../client/src/stores/ui-store'
import { useSlideOperations } from '../../client/src/hooks/use-slide-operations'
import { useEditorStore } from '../../client/src/stores/editor-store'
import { ungroupSemanticSelection } from '../../client/src/components/canvas/canvas-semantic-group-commands'
import semanticPresentation from '../../shared/src/pptx-semantic-presentation.js'
const U = 914400 / 96
function fixture() {
  const definition = (id, kind) => ({
    id,
    kind,
    source: { partUri: 'ppt/slides/slide1.xml', nativeId: id, preconditionHash: 'a'.repeat(64) },
    components: [],
    content: { extent: { cx: 100 * U, cy: 50 * U } },
  })
  const instance = (id, definitionId, parentInstanceId, localTransform, slideId = 's1') => ({
    id,
    definitionId,
    parentInstanceId,
    localTransform,
    slideId,
    paintIndex: 0,
    overrides: {},
  })
  return {
    pptxSemantic: {
      schemaVersion: 1,
      definitions: { g: definition('g', 'group'), a: definition('a', 'shape') },
      instances: {
        g: instance('g', 'g', null, [-2, 0, 0, 0.5, 200 * U, 20 * U]),
        a: instance('a', 'a', 'g', [1, 0, 0, 1, -2.5 * U, 3.25 * U]),
        other: instance('other', 'a', null, [1, 0, 0, 1, 0, 0], 's2'),
      },
      styles: {},
      fonts: {},
    },
    slides: [
      {
        id: 's1',
        elements: [
          {
            id: 'leaf',
            pptxInstanceId: 'a',
            type: 'shape',
            shape: 'rect',
            x: 205,
            y: 21.625,
            width: 100,
            height: 50,
            fill: '#123456',
          },
        ],
      },
      {
        id: 's2',
        elements: [
          {
            id: 'other-leaf',
            pptxInstanceId: 'other',
            type: 'shape',
            x: 0,
            y: 0,
            width: 100,
            height: 50,
          },
        ],
      },
    ],
  }
}
let current, history
function Harness({ initial = fixture() }) {
  const [presentation, setPresentation] = useState(initial)
  const editingElementIdRef = useRef(null)
  const c = {
    presentation,
    setPresentation,
    activeSlide: presentation.slides[0],
    setSelectedElementIds: vi.fn(),
    setEditingElementId: vi.fn(),
    mapActive: (prev, fn) => ({
      ...prev,
      slides: prev.slides.map((s, i) => (i === 0 ? fn(s) : s)),
    }),
    editingElementIdRef,
  }
  const controller = useEditorElementController(c)
  const historyController = useEditorHistoryController({
    presentation,
    setPresentation,
    setCurrentSlideIndex: vi.fn(),
    setVerticalEdit: vi.fn(),
    currentSlideIndexRef: useRef(0),
    verticalEditRef: useRef(null),
    selectedElementIdsRef: useRef(['leaf']),
    editingElementIdRef,
    setSelectedElementIds: vi.fn(),
    setEditingElementId: vi.fn(),
    resetContent: vi.fn(),
  })
  useLayoutEffect(() => {
    current = presentation
    history = {
      ...historyController,
      deleteElement: controller.deleteElement,
      seedBaseline: () => {
        historyController.seedHistory(presentation)
        setPresentation({ ...presentation })
      },
    }
  }, [presentation, historyController, controller.deleteElement])
  return (
    <EditorCanvasWorkspace
      overlayOpen={false}
      c={{
        ...c,
        ...controller,
        selectedElementIds: ['leaf'],
        editingElementId: null,
        editor: null,
        showGrid: false,
        toggleElementSelection: vi.fn(),
        startEditingElement: vi.fn(),
        stopEditingElement: vi.fn(),
        updateElements: vi.fn(),
      }}
    />
  )
}
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  useUIStore.setState({ zoom: 1, userZoomMode: true })
  useEditorStore.setState({ smartGuidesEnabled: false })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('mounted semantic canvas and controller', () => {
  it('deletes nested retained paint scopes atomically and restores them through undo', () => {
    const initial = fixture()
    const model = initial.pptxSemantic
    model.definitions.paint = {
      ...model.definitions.g,
      id: 'paint',
      source: { ...model.definitions.g.source, nativeId: 'paint' },
      content: { ...model.definitions.g.content, opacity: 0.5 },
    }
    model.instances.paint = {
      ...model.instances.g,
      id: 'paint',
      definitionId: 'paint',
      parentInstanceId: 'g',
      localTransform: [1, 0, 0, 1, 0, 0],
      lineage: { paintOnly: true },
    }
    model.instances.a.parentInstanceId = 'paint'
    render(<Harness initial={initial} />)
    act(() => history.seedBaseline())
    const before = current
    act(() => history.deleteElement('g'))
    expect(current.slides[0].elements).toEqual([])
    expect(current.pptxSemantic.instances.paint.lineage.tombstone).toBe(true)
    expect(current.pptxSemantic.instances.paint.lineage.paintOnly).not.toBe(true)
    expect(() => semanticPresentation.normalizeSemanticPresentation(current)).not.toThrow()
    act(() => history.handleUndo())
    expect(current).toEqual(before)
  })
  it('renders local reflected hierarchy exactly once and exposes group and child targets', () => {
    const initial = fixture()
    initial.pptxSemantic.definitions.inner = {
      ...initial.pptxSemantic.definitions.g,
      id: 'inner',
      source: { ...initial.pptxSemantic.definitions.g.source, nativeId: 'inner' },
    }
    initial.pptxSemantic.instances.inner = {
      ...initial.pptxSemantic.instances.g,
      id: 'inner',
      definitionId: 'inner',
      parentInstanceId: 'g',
      localTransform: [0, 1, -1, 0, 20 * U, 10 * U],
    }
    initial.pptxSemantic.instances.a.parentInstanceId = 'inner'
    const { container } = render(<Harness initial={initial} />)
    const group = container.querySelector('[data-semantic-instance-id="g"]'),
      child = container.querySelector('[data-semantic-instance-id="a"]')
    expect(group).not.toBeNull()
    expect([
      screen.getByTestId('slide-element-g').style.pointerEvents,
      screen.getByTestId('resize-handle-se').style.pointerEvents,
    ]).toEqual(['none', 'auto'])
    const inner = container.querySelector('[data-semantic-instance-id="inner"]')
    expect(group.contains(inner) && inner.contains(child)).toBe(true)
    expect(inner.style.transform).toBe('matrix(0,1,-1,0,20,10)')
    expect(group.style.transform).toBe('matrix(-2,0,0,0.5,200,20)')
    expect(child.style.transform).toBe('matrix(1,0,0,1,-2.5,3.25)')
    expect(screen.getByTestId('slide-element-leaf').style.left).toBe('0px')
    expect(screen.getByTestId('slide-element-g')).toBeTruthy()
  })
  it('commits fractional off-slide world movement through the inverse parent without collateral changes', () => {
    render(<Harness />)
    const before = current.pptxSemantic.instances.other
    fireEvent.pointerDown(screen.getByTestId('slide-element-leaf'), {
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
      altKey: true,
    })
    fireEvent.pointerMove(document, { pointerId: 1, clientX: -210.5, clientY: 16.25 })
    fireEvent.pointerUp(document, { pointerId: 1, clientX: -210.5, clientY: 16.25 })
    expect(current.pptxSemantic.instances.a.localTransform[4] / U).toBeCloseTo(107.75)
    expect(current.pptxSemantic.instances.a.localTransform[5] / U).toBeCloseTo(15.75)
    expect(current.slides[0].elements[0].x).toBeCloseTo(-15.5)
    expect(current.pptxSemantic.instances.other).toEqual(before)
    expect(current.pptxSemantic.definitions).toEqual(fixture().pptxSemantic.definitions)
  })
  it('rejects bad render linkage before displaying a partial semantic tree', () => {
    const bad = fixture()
    bad.slides[0].elements[0].pptxInstanceId = 'absent'
    render(<Harness initial={bad} />)
    expect(screen.getByRole('alert').textContent).toMatch(/semantic/i)
    expect(screen.queryByTestId('slide-element-leaf')).toBeNull()
    expect(current).toEqual(bad)
  })
  it('previews and commits native-axis resize under reflected anisotropic ancestry, then undoes and redoes', () => {
    render(<Harness />)
    act(() => history.seedBaseline())
    const original = current
    fireEvent.pointerDown(screen.getByTestId('resize-handle-se'), {
      pointerId: 2,
      button: 0,
      clientX: 10,
      clientY: 10,
    })
    fireEvent.pointerMove(document, { pointerId: 2, clientX: -90, clientY: 22.5 })
    expect(current).toBe(original)
    fireEvent.pointerUp(document, { pointerId: 2, clientX: -90, clientY: 22.5 })
    expect(current.pptxSemantic.instances.a.localTransform[0]).toBeCloseTo(1.5)
    expect(current.pptxSemantic.instances.a.localTransform[3]).toBeCloseTo(1.5)
    const resized = current
    act(() => history.handleUndo())
    expect(current).toEqual(original)
    act(() => history.handleRedo())
    expect(current).toEqual(resized)
  })
  it('rotates through canonical world operations without changing the definition or another occurrence', () => {
    render(<Harness />)
    const before = current.pptxSemantic
    fireEvent.pointerDown(screen.getByTestId('rotation-handle'), {
      pointerId: 3,
      button: 0,
      clientX: 155,
      clientY: 34.125,
    })
    fireEvent.pointerMove(document, { pointerId: 3, clientX: 105, clientY: 84.125 })
    fireEvent.pointerUp(document, { pointerId: 3, clientX: 105, clientY: 84.125 })
    expect(current.pptxSemantic.instances.a.localTransform).not.toEqual(
      before.instances.a.localTransform
    )
    expect(current.pptxSemantic.definitions).toEqual(before.definitions)
    expect(current.pptxSemantic.instances.other).toEqual(before.instances.other)
  })
  it('does not commit a singular resize or a cancelled pointer and nudges off-slide without legacy clamping', () => {
    render(<Harness />)
    const before = current
    fireEvent.pointerDown(screen.getByTestId('resize-handle-se'), {
      pointerId: 4,
      button: 0,
      clientX: 10,
      clientY: 10,
    })
    fireEvent.pointerMove(document, { pointerId: 4, clientX: 210, clientY: 10 })
    fireEvent.pointerUp(document, { pointerId: 4, clientX: 210, clientY: 10 })
    expect(current).toBe(before)
    fireEvent.pointerDown(screen.getByTestId('slide-element-leaf'), {
      pointerId: 5,
      button: 0,
      clientX: 10,
      clientY: 10,
    })
    fireEvent.pointerMove(document, { pointerId: 5, clientX: -500, clientY: 10 })
    fireEvent.pointerCancel(document, { pointerId: 5 })
    expect(current).toBe(before)
    fireEvent.keyDown(screen.getByTestId('slide-element-leaf'), { key: 'ArrowLeft' })
    expect(current.slides[0].elements[0].x).toBeCloseTo(204)
  })
  it.each(['project', 'source'])(
    'groups real selections and restores the same %s group through editor operations',
    (origin) => {
      const initial = fixture()
      if (origin === 'project') initial.pptxSemantic.instances.a.parentInstanceId = null
      initial.pptxSemantic.instances.b = {
        ...initial.pptxSemantic.instances.a,
        id: 'b',
        localTransform: [1, 0, 0, 1, 140 * U, 0],
      }
      initial.slides[0].elements.push({
        ...initial.slides[0].elements[0],
        id: 'second',
        pptxInstanceId: 'b',
      })
      const selected = { current: ['leaf', 'second'] }
      const { result } = renderHook(() => {
        const [presentation, setPresentation] = useState(initial)
        const operations = useSlideOperations({
          presentation,
          setPresentation,
          currentSlideIndexRef: { current: 0 },
          selectedElementIdsRef: selected,
          editingElementIdRef: { current: null },
        })
        return { presentation, ...operations }
      })
      if (origin === 'source') {
        selected.current = ['g']
        act(() => result.current.ungroupElements())
        selected.current = ['leaf', 'second']
      }
      act(() => result.current.groupElements())
      const groupId = useEditorStore.getState().selectedElementIds[0]
      if (origin === 'source') expect(groupId).toBe('g')
      expect(result.current.presentation.pptxSemantic.instances.a.parentInstanceId).toBe(groupId)
      selected.current = [groupId]
      act(() => result.current.ungroupElements())
      expect(result.current.presentation.pptxSemantic.instances[groupId].lineage.tombstone).toBe(
        true
      )
      selected.current = ['leaf', 'second']
      act(() => result.current.groupElements())
      expect(useEditorStore.getState().selectedElementIds).toEqual([groupId])
      expect(result.current.presentation.pptxSemantic.instances.a.parentInstanceId).toBe(groupId)
      expect(result.current.presentation.pptxSemantic.instances.other).toEqual(
        initial.pptxSemantic.instances.other
      )
      selected.current = [groupId]
      act(() => result.current.deleteSelectedElements())
      expect(result.current.presentation.pptxSemantic.instances[groupId].lineage.tombstone).toBe(
        true
      )
      expect(result.current.presentation.slides[0].elements).toEqual([])
      expect(() =>
        semanticPresentation.normalizeSemanticPresentation(result.current.presentation)
      ).not.toThrow()
    }
  )
  it('retains source-hidden children after ungroup and refuses an unsupported composite effect atomically', () => {
    const initial = fixture()
    initial.pptxSemantic.definitions.g.content.hidden = true
    const ungrouped = ungroupSemanticSelection(initial.pptxSemantic, ['g'])
    render(<Harness initial={{ ...initial, pptxSemantic: ungrouped }} />)
    expect(screen.queryByTestId('slide-element-leaf')).toBeNull()
    expect(ungrouped.definitions).toEqual(initial.pptxSemantic.definitions)
    expect(ungrouped.instances.other).toEqual(initial.pptxSemantic.instances.other)
    const effect = fixture().pptxSemantic
    effect.definitions.g.content.effects = { glow: { radius: 5 } }
    const before = structuredClone(effect)
    expect(() => ungroupSemanticSelection(effect, ['g'])).toThrow(/effect/i)
    expect(effect).toEqual(before)
  })
  it('retains a composite opacity scope after ungroup without authoring group chrome', () => {
    const initial = fixture()
    initial.pptxSemantic.definitions.g.content.effects = { opacity: 0.5 }
    const ungrouped = ungroupSemanticSelection(initial.pptxSemantic, ['g'])
    expect(ungrouped.instances.g.lineage.paintOnly).toBe(true)
    expect(ungrouped.instances.a.parentInstanceId).toBe('g')
    expect(ungrouped.instances.a.localTransform).toEqual(
      initial.pptxSemantic.instances.a.localTransform
    )
    const { container } = render(<Harness initial={{ ...initial, pptxSemantic: ungrouped }} />)
    expect(container.querySelector('[data-semantic-instance-id="g"]').style.opacity).toBe('0.5')
    expect(screen.queryByTestId('slide-element-g')).toBeNull()
    expect(screen.getByTestId('slide-element-leaf')).toBeTruthy()
    expect(() => semanticPresentation.normalizeSemanticPresentation(current)).not.toThrow()
  })
  it.each(['leaf', 'g'])(
    'tombstones %s deletion and descendants in one undoable, save-valid update',
    (id) => {
      render(<Harness />)
      act(() => history.seedBaseline())
      const before = current
      act(() => history.deleteElement('other'))
      expect(current).toBe(before)
      act(() => history.deleteElement(id))
      expect(current.slides[0].elements).toEqual([])
      expect(current.pptxSemantic.instances.a.lineage?.tombstone).toBe(true)
      if (id === 'g') expect(current.pptxSemantic.instances.g.lineage.tombstone).toBe(true)
      expect(current.pptxSemantic.instances.other).toEqual(before.pptxSemantic.instances.other)
      expect(() => semanticPresentation.normalizeSemanticPresentation(current)).not.toThrow()
      act(() => history.handleUndo())
      expect(current).toEqual(before)
    }
  )
})
