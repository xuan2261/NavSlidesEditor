import { useRef, useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SlidePanel from './SlidePanel'
import { useSlideOperations } from '../hooks/use-slide-operations'

const child = (id) => ({
  id,
  notes: `Notes ${id}`,
  elements: [
    {
      id: `${id}-source`,
      type: 'shape',
      shape: 'rect',
      x: 10,
      y: 10,
      width: 80,
      height: 40,
      action: { kind: 'toggle', targetElementId: `${id}-target`, label: `Toggle ${id}` },
    },
    {
      id: `${id}-target`,
      type: 'shape',
      shape: 'rect',
      x: 100,
      y: 10,
      width: 80,
      height: 40,
      initialVisibility: 'hidden',
      fill: '#22c55e',
    },
  ],
})
const baseline = {
  slides: [
    { id: 'parent-a', notes: 'Keep A', elements: [], children: [child('a1'), child('a2')] },
    { id: 'parent-b', notes: 'Keep B', elements: [], children: [child('b1'), child('b2')] },
  ],
}
function Harness() {
  const [presentation, setPresentation] = useState(() => structuredClone(baseline))
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentSlideIndexRef = useRef(0),
    selectedElementIdsRef = useRef([]),
    editingElementIdRef = useRef(null)
  const operations = useSlideOperations({
    presentation,
    setPresentation,
    currentSlideIndex: currentIndex,
    setCurrentSlideIndex: setCurrentIndex,
    currentSlideIndexRef,
    selectedElementIdsRef,
    editingElementIdRef,
  })
  return (
    <>
      <SlidePanel
        slides={presentation.slides}
        currentIndex={currentIndex}
        onSelect={setCurrentIndex}
        onDuplicate={operations.duplicateSlide}
        onDuplicateChild={operations.duplicateChildSlide}
        resolution={{ width: 960, height: 540 }}
      />
      <output data-testid="presentation-state">{JSON.stringify(presentation)}</output>
    </>
  )
}
const state = () => JSON.parse(screen.getByTestId('presentation-state').textContent)

describe('Child context duplication ownership', () => {
  it.each(['pointer', 'keyboard'])(
    '%s menu duplicates the invoked child, preserves parents and restores focus',
    async (input) => {
      render(<Harness />)
      const origin = screen.getByRole('button', { name: 'Select vertical slide 2.2' })
      const open = () =>
        input === 'pointer'
          ? fireEvent.contextMenu(origin, { clientX: 10, clientY: 20 })
          : fireEvent.keyDown(origin, { key: 'F10', shiftKey: true })
      origin.focus()
      open()
      const menu = screen.getByRole('menu', { name: 'Slide actions' })
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.textContent.trim())
      ).toEqual(['Duplicate'])
      fireEvent.keyDown(within(menu).getByRole('menuitem', { name: 'Duplicate' }), {
        key: 'Escape',
      })
      await waitFor(() => expect(document.activeElement).toBe(origin))
      expect(state()).toEqual(baseline)
      open()
      fireEvent.click(
        within(screen.getByRole('menu', { name: 'Slide actions' })).getByRole('menuitem', {
          name: 'Duplicate',
        })
      )
      const saved = state()
      expect(saved.slides).toHaveLength(2)
      expect(saved.slides[0]).toEqual(baseline.slides[0])
      expect({ ...saved.slides[1], children: [] }).toEqual({ ...baseline.slides[1], children: [] })
      expect(saved.slides[1].children.slice(0, 2)).toEqual(baseline.slides[1].children)
      expect(saved.slides[1].children).toHaveLength(3)
      const clone = saved.slides[1].children[2],
        original = baseline.slides[1].children[1]
      const [source, target] = clone.elements
      expect(clone.id).not.toBe(original.id)
      expect(source.id).not.toBe(original.elements[0].id)
      expect(target.id).not.toBe(original.elements[1].id)
      expect(source).toEqual({
        ...original.elements[0],
        id: source.id,
        action: { ...original.elements[0].action, targetElementId: target.id },
      })
      expect(target).toEqual({ ...original.elements[1], id: target.id })
      expect(clone.notes).toBe(original.notes)
      await waitFor(() => expect(document.activeElement).toBe(origin))
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Select slide 1' }), {
        clientX: 10,
        clientY: 20,
      })
      fireEvent.click(
        within(screen.getByRole('menu', { name: 'Slide actions' })).getByRole('menuitem', {
          name: 'Duplicate',
        })
      )
      const parents = state().slides
      expect(parents).toHaveLength(3)
      expect(parents[0]).toEqual(baseline.slides[0])
      expect(parents[2]).toEqual(saved.slides[1])
      expect(parents[1].id).not.toBe(parents[0].id)
      expect(parents[1].children).toHaveLength(2)
    }
  )
})
