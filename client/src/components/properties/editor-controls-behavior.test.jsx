import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import FormatTabContent from '../ribbon/ribbon-format-tab-element-position-size-rotation-controls'
import { useSlideOperations } from '../../hooks/use-slide-operations'
import { buildSelectionUpdates } from '../../utils/element-update-fanout'
import { getRotatedAABB } from '../canvas/use-canvas-resize-rotate'

const shapes = [
  { id: 'a', type: 'shape', shape: 'rect', x: 100, y: 50, width: 200, height: 100 },
  { id: 'b', type: 'shape', shape: 'rect', x: 400, y: 100, width: 100, height: 100 },
  { id: 'c', type: 'shape', shape: 'rect', x: 250, y: 200, width: 80, height: 60 },
]

function Authoring({ initial = shapes, ids = initial.map((element) => element.id) }) {
  const [presentation, setPresentation] = useState({ slides: [{ id: 'slide', elements: initial }] })
  const selectedElementIdsRef = useRef(ids)
  const currentSlideIndexRef = useRef(0)
  const editingElementIdRef = useRef(null)
  const mapActiveSlide = (previous, update) => ({
    ...previous,
    slides: [update(previous.slides[0])],
  })
  const { alignElements } = useSlideOperations({
    presentation,
    setPresentation,
    currentSlideIndex: 0,
    setCurrentSlideIndex: () => {},
    currentSlideIndexRef,
    selectedElementIdsRef,
    editingElementIdRef,
    mapActiveSlide,
    getActiveSlide: () => presentation.slides[0],
  })
  const elements = presentation.slides[0].elements
  const selectedElement = elements.find((element) => element.id === ids.at(-1))
  const apply = (updates) => {
    const patches = buildSelectionUpdates(elements, ids, selectedElement.id, updates)
    setPresentation((previous) =>
      mapActiveSlide(previous, (slide) => ({
        ...slide,
        elements: slide.elements.map((element) => ({
          ...element,
          ...patches.find((patch) => patch.id === element.id),
        })),
      }))
    )
  }
  return (
    <>
      <FormatTabContent
        selectedElement={selectedElement}
        selectedElementIds={ids}
        elements={elements}
        onUpdateElement={apply}
        onAlignElements={alignElements}
        slideWidth={1600}
      />
      <output data-testid="authoring-state">{JSON.stringify(elements)}</output>
    </>
  )
}

const state = () => JSON.parse(screen.getByTestId('authoring-state').textContent)

describe('editor selection authoring behavior', () => {
  it.each([
    ['Align left', [100, 100, 100]],
    ['Align center horizontal', [200, 250, 260]],
    ['Align right', [300, 400, 420]],
  ])('%s aligns independent elements to selection bounds', (label, expected) => {
    render(<Authoring />)
    fireEvent.mouseDown(screen.getByLabelText(label))
    expect(state().map((element) => element.x)).toEqual(expected)
    expect(state().map((element) => element.y)).toEqual([50, 100, 200])
  })

  it('numeric position edits preserve relative separation', () => {
    render(<Authoring />)
    fireEvent.change(screen.getByLabelText('X position'), { target: { value: '0' } })
    expect(state().map((element) => element.x)).toEqual([-150, 150, 0])
  })

  it.each([
    ['Align left', 'left', 0],
    ['Align center horizontal', 'centerX', 800],
    ['Align right', 'right', 1600],
  ])('%s uses the deck width for one rotated off-canvas element', (label, edge, target) => {
    const initial = [{ ...shapes[0], x: -180, width: 221, rotation: 23 }]
    render(<Authoring initial={initial} />)
    fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' })
    const after = state()[0]
    const bounds = getRotatedAABB(after)
    const actual = edge === 'centerX' ? (bounds.left + bounds.right) / 2 : bounds[edge]
    expect(Math.abs(actual - target)).toBeLessThanOrEqual(0.500001)
    expect(after.y).toBe(initial[0].y)
    expect(after.rotation).toBe(23)
  })

  it('does not reinterpret a locked multi-selection as single slide alignment', () => {
    const initial = [{ ...shapes[1], locked: true }, shapes[0]]
    render(<Authoring initial={initial} />)
    fireEvent.mouseDown(screen.getByLabelText('Align right'))
    expect(state()).toEqual(initial)
  })

  it('legacy image descriptions reach only unlocked image owners', () => {
    const initial = [
      { id: 'a', type: 'image', src: '/a.png' },
      { id: 'text', type: 'text', content: '<p>Untouched</p>' },
      { id: 'locked', type: 'image', src: '/locked.png', locked: true },
      { id: 'b', type: 'image', src: '/b.png' },
    ]
    const patches = buildSelectionUpdates(
      initial,
      initial.map((element) => element.id),
      'b',
      {
        longDescription: 'Accessible diagram description',
      }
    )
    const after = initial.map((element) => ({
      ...element,
      ...patches.find((patch) => patch.id === element.id),
    }))
    expect(after[0].longDescription).toBe('Accessible diagram description')
    expect(after[3].longDescription).toBe('Accessible diagram description')
    expect(after[1]).toEqual(initial[1])
    expect(after[2]).toEqual(initial[2])
  })
})
