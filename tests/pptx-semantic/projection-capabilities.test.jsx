// @vitest-environment jsdom
import React, { useState, useRef, useLayoutEffect } from 'react'
import { fireEvent, render, screen, cleanup, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChartProperties from '../../client/src/components/properties/chart-properties'
import { chartProjectionFixture, valuesOperation } from './projection-capabilities-fixture'
import PropertiesPanel from '../../client/src/components/PropertiesPanel'
import FormatTabContent from '../../client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls'
import { useEditorElementController } from '../../client/src/hooks/editor-controller/use-editor-element-controller'
import { useEditorSelectionController } from '../../client/src/hooks/editor-controller/use-editor-selection-controller'
import { useEditorHistoryController } from '../../client/src/hooks/editor-controller/use-editor-history-controller'

afterEach(cleanup)

describe('semantic chart property operation consumer', () => {
  it('does not expose an unbound chart-type command in the actual ribbon', () => {
    const deck = chartProjectionFixture()
    const onUpdate = vi.fn()
    render(
      <FormatTabContent
        selectedElement={deck.slides[0].elements[0]}
        elements={deck.slides[0].elements}
        slide={deck.slides[0]}
        selectedElementIds={['i1']}
        presentation={deck}
        onUpdateElement={onUpdate}
      />
    )
    expect(screen.getByRole('combobox', { name: 'Chart type' }).disabled).toBe(true)
    expect(onUpdate).not.toHaveBeenCalled()
  })
  it('does not resurrect a chart when deletion was queued before a projection operation', () => {
    let current, commands
    function QueuedHarness() {
      const [deck, setDeck] = useState(chartProjectionFixture())
      const controller = useEditorElementController({
        presentation: deck,
        setPresentation: setDeck,
        activeSlide: deck.slides[0],
        editingElementIdRef: useRef(null),
        setEditingElementId: vi.fn(),
        setSelectedElementIds: vi.fn(),
        mapActive: (prev, fn) => ({
          ...prev,
          slides: prev.slides.map((slide, index) => (index === 0 ? fn(slide) : slide)),
        }),
      })
      useLayoutEffect(() => {
        current = deck
        commands = controller
      }, [deck, controller])
      return null
    }
    render(<QueuedHarness />)
    expect(() =>
      act(() => {
        commands.deleteElement('i1')
        commands.updateElement('i1', { pptxProjectionOperation: valuesOperation() })
      })
    ).not.toThrow()
    expect(current.slides[0].elements).toEqual([])
    expect(current.pptxSemantic.instances.i1.lineage.tombstone).toBe(true)
    expect(current.pptxSemantic.instances.i1.overrides).toEqual({})
  })
  it('uses the actual property dispatcher and controller with projection history and active-slide isolation', () => {
    const initial = chartProjectionFixture()
    let current, controller, history
    function EditorHarness() {
      const [deck, setDeck] = useState(initial)
      const editingElementIdRef = useRef(null)
      const commands = useEditorElementController({
        presentation: deck,
        setPresentation: setDeck,
        activeSlide: deck.slides[0],
        editingElementIdRef,
        setEditingElementId: vi.fn(),
        setSelectedElementIds: vi.fn(),
        mapActive: (prev, fn) => ({
          ...prev,
          slides: prev.slides.map((slide, index) => (index === 0 ? fn(slide) : slide)),
        }),
      })
      const selection = useEditorSelectionController({
        activeSlideRef: useRef(deck.slides[0]),
        getSelectionSlide: () => deck.slides[0],
        selectedElementIdsRef: useRef(['i1']),
        editingElementIdRef,
        updateElement: commands.updateElement,
        updateElements: commands.updateElements,
        notifyBlockedAction: vi.fn(),
      })
      const snapshots = useEditorHistoryController({
        presentation: deck,
        setPresentation: setDeck,
        setCurrentSlideIndex: vi.fn(),
        setVerticalEdit: vi.fn(),
        currentSlideIndexRef: useRef(0),
        verticalEditRef: useRef(null),
        selectedElementIdsRef: useRef(['i1']),
        editingElementIdRef,
        setSelectedElementIds: vi.fn(),
        setEditingElementId: vi.fn(),
        resetContent: vi.fn(),
      })
      useLayoutEffect(() => {
        current = deck
        controller = commands
        history = {
          ...snapshots,
          seed: () => {
            snapshots.seedHistory(deck)
            setDeck({ ...deck })
          },
        }
      }, [deck, commands, snapshots])
      return (
        <PropertiesPanel
          slide={deck.slides[0]}
          presentation={deck}
          selectedElement={deck.slides[0].elements[0]}
          selectedElementIds={['i1']}
          onUpdateElement={selection.updateSelectedElements}
        />
      )
    }
    render(<EditorHarness />)
    act(() => history.seed())
    fireEvent.change(screen.getByTestId('prop-chart-values-0'), { target: { value: '11, 22' } })
    expect(current.pptxSemantic.instances.i1.overrides.components['series-17'].values).toEqual([
      11, 22,
    ])
    expect(current.slides[1]).toEqual(initial.slides[1])
    const committed = current
    act(() => history.handleUndo())
    expect(current.pptxSemantic).toEqual(initial.pptxSemantic)
    act(() => history.handleRedo())
    expect(current.pptxSemantic).toEqual(committed.pptxSemantic)
    expect(() =>
      act(() =>
        controller.updateElement('i1', {
          pptxProjectionOperation: { ...valuesOperation(), instanceId: 'i2' },
        })
      )
    ).toThrow(/active occurrence/)
    expect(current.pptxSemantic).toEqual(committed.pptxSemantic)
  })
  it('rejects unbound raw chart-data patches through the actual controller before any state change', () => {
    let current, commands
    function ControllerHarness() {
      const [deck, setDeck] = useState(chartProjectionFixture())
      const controller = useEditorElementController({
        presentation: deck,
        setPresentation: setDeck,
        activeSlide: deck.slides[0],
        editingElementIdRef: useRef(null),
        setEditingElementId: vi.fn(),
        setSelectedElementIds: vi.fn(),
        mapActive: (prev, fn) => ({
          ...prev,
          slides: prev.slides.map((slide, index) => (index === 0 ? fn(slide) : slide)),
        }),
      })
      useLayoutEffect(() => {
        current = deck
        commands = controller
      }, [deck, controller])
      return null
    }
    render(<ControllerHarness />)
    const before = current
    expect(() =>
      act(() =>
        commands.updateElement('i1', {
          chartData: {
            labels: ['A', 'B'],
            datasets: [{ componentId: 'series-17', data: [99, 99] }],
          },
        })
      )
    ).toThrow(/source-bound/)
    expect(current).toBe(before)
  })
  it('enables only source-bound numeric series values despite unqualified native flags', () => {
    const deck = chartProjectionFixture()
    const onUpdate = vi.fn()
    render(
      <ChartProperties
        element={deck.slides[0].elements[0]}
        pptxSemantic={deck.pptxSemantic}
        onUpdate={onUpdate}
      />
    )
    expect(screen.getByTestId('prop-chart-values-0').disabled).toBe(false)
    expect(screen.queryByTestId('prop-chart-type')).toBeNull()
    fireEvent.change(screen.getByTestId('prop-chart-values-0'), { target: { value: '11, 22' } })
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith({ pptxProjectionOperation: valuesOperation() })
  })

  it('does not convert malformed semantic values to zero or submit a partial edit', () => {
    const deck = chartProjectionFixture()
    const onUpdate = vi.fn()
    render(
      <ChartProperties
        element={deck.slides[0].elements[0]}
        pptxSemantic={deck.pptxSemantic}
        onUpdate={onUpdate}
      />
    )
    const input = screen.getByTestId('prop-chart-values-0')
    expect(input.disabled).toBe(false)
    for (const value of ['11, bad', '11, ', '11', '11, Infinity', '11, 22, 33'])
      fireEvent.change(input, { target: { value } })
    expect(onUpdate).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it.each(['missing-model', 'inventory-only', 'locked', 'derived-data', 'type-mismatch'])(
    'cannot unlock semantic controls using client/native flags: %s',
    (failure) => {
      const deck = chartProjectionFixture()
      const element = deck.slides[0].elements[0]
      Object.assign(element._pptxChartMeta, {
        editable: true,
        preservationTier: 'editable',
        adapterQualified: true,
        transactionEligible: true,
        level4Promoted: true,
      })
      if (failure === 'missing-model') delete deck.pptxSemantic
      if (failure === 'inventory-only')
        delete deck.pptxSemantic.definitions['chart-definition'].content.chartProjection
      if (failure === 'locked') element.locked = true
      if (failure === 'derived-data') element.chartData.datasets[0].data[0] = 999
      if (failure === 'type-mismatch') element.chartType = 'pie'
      const onUpdate = vi.fn()
      render(
        <ChartProperties element={element} pptxSemantic={deck.pptxSemantic} onUpdate={onUpdate} />
      )
      expect(screen.queryAllByRole('textbox').every((input) => input.disabled)).toBe(true)
      expect(onUpdate).not.toHaveBeenCalled()
    }
  )

  it('commits the real operation callback with occurrence isolation and undo-ready state', async () => {
    const { default: operations } = await import('../../shared/src/pptx-projection-operation.js')
    const initial = chartProjectionFixture()
    let current
    function Mounted() {
      const [deck, setDeck] = useState(initial)
      current = deck
      return (
        <ChartProperties
          element={deck.slides[0].elements[0]}
          pptxSemantic={deck.pptxSemantic}
          onUpdate={({ pptxProjectionOperation }) =>
            setDeck((prev) =>
              operations.applyPresentationProjectionOperation(prev, pptxProjectionOperation)
            )
          }
        />
      )
    }
    render(<Mounted />)
    fireEvent.change(screen.getByTestId('prop-chart-values-0'), { target: { value: '11, 22' } })
    expect(current.pptxSemantic.instances.i1.overrides.components['series-17'].values).toEqual([
      11, 22,
    ])
    expect(current.slides[0].elements[0].chartData.datasets[0].data).toEqual([11, 22])
    expect(current.slides[1]).toEqual(initial.slides[1])
    expect(initial.pptxSemantic.instances.i1.overrides).toEqual({})
  })
})
