// @vitest-environment jsdom
import React, { useLayoutEffect, useRef, useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import PropertiesPanel from '../../client/src/components/PropertiesPanel'
import NativeChartRenderer from '../../client/src/components/native-chart-renderer'
import { useEditorElementController } from '../../client/src/hooks/editor-controller/use-editor-element-controller'
import { useEditorHistoryController } from '../../client/src/hooks/editor-controller/use-editor-history-controller'
import semantic from '../../shared/src/pptx-semantic-presentation'
import { familyDocumentsFixture } from './family-documents-fixture'

afterEach(cleanup)
const noop = () => {}
it('replays the real paint control through editor reducer, Undo/Redo and canonical JSON reopen', async () => {
  const document = (await familyDocumentsFixture()).chart
  document.instances.sibling = { ...document.instances.occurrence, id: 'sibling' }
  const source = Object.values(document.definitions)[0].content.chartDocument
  const series = source.plots[0].series[0]
  series.paint = { fill: { kind: 'solid', color: 'C0504D' } }
  const initial = semantic.normalizeSemanticPresentation({ pptxSemantic: document,
    slides: [{ id: 's1', elements: ['occurrence', 'sibling'].map(id => ({
      id, type: 'chart', pptxInstanceId: id, x: 0, y: 0, width: 400, height: 300,
    })) }],
  })
  let current, history
  function Harness() {
    const [deck, setDeck] = useState(initial)
    const editingElementIdRef = useRef(null), selectedElementIdsRef = useRef(['occurrence'])
    const controller = useEditorElementController({
      presentation: deck, setPresentation: setDeck, activeSlide: deck.slides[0],
      editingElementIdRef, setEditingElementId: noop, setSelectedElementIds: noop,
      mapActive: (previous, apply) => ({ ...previous,
        slides: previous.slides.map((slide, index) => index === 0 ? apply(slide) : slide) }),
    })
    const snapshots = useEditorHistoryController({ presentation: deck, setPresentation: setDeck,
      setCurrentSlideIndex: noop, setVerticalEdit: noop, currentSlideIndexRef: useRef(0),
      verticalEditRef: useRef(null), selectedElementIdsRef, editingElementIdRef,
      setSelectedElementIds: noop, setEditingElementId: noop, resetContent: noop })
    useLayoutEffect(() => {
      current = deck
      history = { ...snapshots, seed: () => { snapshots.seedHistory(deck); setDeck({ ...deck }) } }
    }, [deck, snapshots])
    return <PropertiesPanel slide={deck.slides[0]} selectedElement={deck.slides[0].elements[0]}
      selectedElementIds={selectedElementIdsRef.current} presentation={deck} onUpdateElement={controller.updateElement} />
  }
  render(<Harness />)
  act(() => history.seed())
  const control = screen.getByLabelText(`${series.id} series fill`)
  fireEvent.change(control, { target: { value: '#112233' } })
  expect(current.slides[0].elements[0].chartDocument.plots[0].series[0].paint.fill.color).toBe('112233')
  expect(current.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
  expect(current.pptxSemantic.instances.sibling).toEqual(initial.pptxSemantic.instances.sibling)
  const reopened = semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(current)))
  expect(reopened.slides[0].elements[0].chartDocument).toEqual(current.slides[0].elements[0].chartDocument)
  act(() => history.handleUndo())
  expect(screen.getByLabelText(`${series.id} series fill`).value.toUpperCase()).toBe('#C0504D')
  act(() => history.handleRedo())
  expect(screen.getByLabelText(`${series.id} series fill`).value).toBe('#112233')
})
it('renders source SVG through the production component without a Chart.js iframe', async () => {
  const d = Object.values((await familyDocumentsFixture()).chart.definitions)[0].content.chartDocument
  delete d.style
  delete d.legend
  delete d.workbook
  d.axes = []
  d.options = {}
  d.plots = [{ ...d.plots[0], family: 'pieChart', options: {}, axisIds: [],
    series: [{ ...d.plots[0].series[0], paint: { fill: { kind: 'solid', color: '112233' } } }] }]
  render(<NativeChartRenderer chartDocument={d} width={400} height={300} />)
  expect(document.querySelector('svg [data-chart-series]').getAttribute('fill')).toBe('#112233')
  expect(document.querySelector('iframe')).toBeNull()
})
