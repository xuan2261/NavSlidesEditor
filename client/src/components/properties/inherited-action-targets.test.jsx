import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createInteractionSlideState,
  executeInteractionAction,
  resolveEffectiveSlide,
} from 'revealjs-shared'
import PropertiesPanel from '../PropertiesPanel'
import FormatTabContent from '../ribbon/ribbon-format-tab-element-position-size-rotation-controls'

const shape = (id, patch = {}) => ({
  id,
  type: 'shape',
  shape: 'rect',
  x: 20,
  y: 20,
  width: 100,
  height: 60,
  ...patch,
})
const fixedId = 'layout-fixed:master:answer'
function fixture() {
  return {
    layoutMasters: [
      {
        id: 'master',
        name: 'Master',
        fixedElements: [
          shape('answer', { initialVisibility: 'hidden' }),
          shape('editor-hidden', { hidden: true }),
          shape('suppressed'),
        ],
        placeholders: [{ ...shape('slot'), role: 'custom' }],
      },
    ],
    slides: [
      {
        id: 'parent',
        layoutId: 'master',
        layoutOverrides: {
          hiddenElementIds: ['suppressed'],
          placeholderBindings: { slot: 'bound' },
        },
        elements: [
          shape('trigger', { action: { kind: 'show', targetElementId: '' } }),
          shape('answer', { initialVisibility: 'hidden' }),
          shape('bound'),
        ],
        children: [{ id: 'child', elements: [shape('child-target')] }],
      },
    ],
  }
}
function Harness({ Controls, initial, owner = initial.slides[0], isMaster = false }) {
  const [slide, setSlide] = useState(owner)
  const element = slide.elements[0]
  const update = (patch) =>
    setSlide((previous) => ({
      ...previous,
      elements: previous.elements.map((item) =>
        item.id === element.id ? { ...item, ...patch } : item
      ),
    }))
  return (
    <>
      <Controls
        slide={slide}
        elements={slide.elements}
        presentation={initial}
        isMaster={isMaster}
        selectedElement={element}
        selectedElementIds={[element.id]}
        onUpdateElement={update}
      />
      <output aria-label="Authored slide">{JSON.stringify(slide)}</output>
    </>
  )
}
const authored = () => JSON.parse(screen.getByLabelText('Authored slide').textContent)
const choices = () =>
  [...screen.getByLabelText('Target element').options].map((option) => option.value)

for (const [name, Controls] of [
  ['Inspector', PropertiesPanel],
  ['Ribbon', FormatTabContent],
]) {
  describe(`${name} effective action targets`, () => {
    it('authors a locked inherited reveal target without materializing it or changing a colliding local target', () => {
      const initial = fixture(),
        original = structuredClone(initial)
      render(<Harness Controls={Controls} initial={initial} />)
      expect(new Set(choices())).toEqual(new Set(['', fixedId, 'bound', 'trigger', 'answer']))
      fireEvent.change(screen.getByLabelText('Target element'), { target: { value: fixedId } })
      const raw = authored()
      expect(raw.elements).toEqual(
        initial.slides[0].elements.map((element) =>
          element.id === 'trigger'
            ? { ...element, action: { kind: 'show', targetElementId: fixedId } }
            : element
        )
      )
      expect(screen.queryByRole('alert')).toBeNull()
      const effective = resolveEffectiveSlide(raw, initial.layoutMasters).slide
      expect(effective.elements.find((element) => element.id === fixedId).locked).toBe(true)
      const before = createInteractionSlideState(effective)
      expect(before.visibility[fixedId]).toBe(false)
      expect(before.visibility.answer).toBe(false)
      const shown = executeInteractionAction(before, raw.elements[0].action).state
      expect(shown.visibility[fixedId]).toBe(true)
      expect(shown.visibility.answer).toBe(false)
      expect(initial).toEqual(original)
    })

    it('retains unavailable provenance until explicit repair when the layout is missing', () => {
      const initial = fixture()
      initial.slides[0].layoutId = 'missing-layout'
      initial.slides[0].elements[0].action = {
        kind: 'show',
        targetElementId: fixedId,
        label: 'Reveal answer',
        referenceError: 'Target requires repair.',
      }
      render(<Harness Controls={Controls} initial={initial} />)
      expect(screen.getByRole('alert').textContent).toBe('Target requires repair.')
      expect(screen.getByRole('option', { name: 'Unavailable target' }).value).toBe(fixedId)
      expect(authored().elements[0].action).toEqual(initial.slides[0].elements[0].action)
      fireEvent.change(screen.getByLabelText('Target element'), { target: { value: 'answer' } })
      expect(authored().elements[0].action).toEqual({
        kind: 'show',
        targetElementId: 'answer',
        label: 'Reveal answer',
      })
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('does not expose the parent layout or sibling elements while authoring a child', () => {
      const initial = fixture(),
        child = initial.slides[0].children[0]
      child.elements.unshift(
        shape('child-trigger', { action: { kind: 'show', targetElementId: '' } })
      )
      render(<Harness Controls={Controls} initial={initial} owner={child} />)
      expect(new Set(choices())).toEqual(new Set(['', 'child-trigger', 'child-target']))
      fireEvent.change(screen.getByLabelText('Target element'), {
        target: { value: 'child-target' },
      })
      expect(authored().elements[0].action).toEqual({
        kind: 'show',
        targetElementId: 'child-target',
      })
      expect(initial.slides[0].elements[0].action.targetElementId).toBe('')
    })

    it('keeps master editing in raw master ownership rather than instance-prefixed identities', () => {
      const initial = fixture(),
        owner = {
          id: 'master:master',
          elements: [
            shape('master-trigger', { action: { kind: 'show', targetElementId: '' } }),
            ...initial.layoutMasters[0].fixedElements,
          ],
        }
      render(<Harness Controls={Controls} initial={initial} owner={owner} isMaster />)
      expect(new Set(choices())).toEqual(new Set(['', 'master-trigger', 'answer', 'suppressed']))
      fireEvent.change(screen.getByLabelText('Target element'), { target: { value: 'answer' } })
      expect(authored().elements[0].action).toEqual({ kind: 'show', targetElementId: 'answer' })
    })
  })
}
