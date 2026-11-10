// @vitest-environment jsdom
import React, { useLayoutEffect, useRef, useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GeometryProperties from '../../client/src/components/properties/geometry-properties'
import PropertiesPanel from '../../client/src/components/PropertiesPanel'
import { useEditorElementController } from '../../client/src/hooks/editor-controller/use-editor-element-controller'
import { useEditorSelectionController } from '../../client/src/hooks/editor-controller/use-editor-selection-controller'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture.js'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
afterEach(cleanup)
function mount(guard, reject = false, selectGroup = false, prepare = (value) => value) {
  const initial = prepare(geometryGroupFillFixture())
  if (guard === 'owner') initial.pptxSemantic.instances.g1.overrides.locked = true
  let current
  function Harness() {
    const [deck, setDeck] = useState(initial)
    const element = { ...deck.slides[0].elements[0], locked: guard === 'leaf' }
    const controller = useEditorElementController({
      presentation: deck,
      setPresentation: setDeck,
      activeSlide: { ...deck.slides[0], elements: [element], locked: guard === 'slide' },
      editingElementIdRef: useRef(null),
      setEditingElementId: vi.fn(),
      setSelectedElementIds: vi.fn(),
      mapActive: (previous, fn) => ({
        ...previous,
        slides: previous.slides.map((slide, index) => (index === 0 ? fn(slide) : slide)),
      }),
    })
    const selection = useEditorSelectionController({
      activeSlideRef: useRef(deck.slides[0]),
      getSelectionSlide: () => ({ ...deck.slides[0], locked: guard === 'slide' }),
      selectedElementIdsRef: useRef(selectGroup ? ['g1'] : ['i1']),
      editingElementIdRef: useRef(null),
      updateElement: controller.updateElement,
      notifyBlockedAction: vi.fn(),
    })
    useLayoutEffect(() => {
      current = deck
    }, [deck])
    if (selectGroup)
      return (
        <PropertiesPanel
          slide={deck.slides[0]}
          presentation={deck}
          selectedElementIds={['g1']}
          onUpdateElement={selection.updateSelectedElements}
        />
      )
    return (
      <GeometryProperties
        element={element}
        pptxSemantic={deck.pptxSemantic}
        slideLocked={guard === 'slide'}
        selectedElementIds={guard === 'multiple' ? ['i1', 'i2'] : ['i1']}
        onUpdate={(patch) => {
          if (reject) throw new Error('Group fill rejected by canonical validation')
          controller.updateElement('i1', patch)
        }}
      />
    )
  }
  render(<Harness />)
  return { initial, current: () => current }
}
describe('explicit inherited group owner inspector', () => {
  it.each(['angle', 'scaled', 'position', 'add', 'remove', 'color'])(
    'retains untouched symbolic gradient colors after an owner %s edit',
    (edit) => {
      const harness = mount(undefined, false, true, (presentation) => {
        const source = presentation.pptxSemantic.styles.groupProvider.payload.properties.fill.source
        const wrap = (value) => ({ source: structuredClone(source), value })
        const symbolic = () =>
          wrap({
            kind: 'scheme',
            value: 'accent1',
            transforms: [
              wrap({ kind: 'tint', value: 10000 }),
              wrap({ kind: 'alpha', value: 70000 }),
            ],
          })
        presentation.pptxSemantic.styles.groupProvider.payload.properties.fill = wrap({
          gradient: wrap({
            kind: 'linear',
            angle: wrap(2700000),
            scaled: wrap(true),
            rotWithShape: wrap(true),
            stops: [
              wrap({ pos: wrap(0), color: symbolic() }),
              wrap({ pos: wrap(50000), color: symbolic() }),
              wrap({ pos: wrap(100000), color: wrap({ kind: 'srgb', value: '112233' }) }),
            ],
          }),
        })
        return presentation
      })
      fireEvent.click(screen.getByRole('button', { name: 'Edit owner group' }))
      const section = screen.getByRole('region', { name: 'Inherited group fill' })
      const controls = within(section)
      if (edit === 'add') fireEvent.click(controls.getByLabelText('Add stop after 1'))
      else if (edit === 'remove') fireEvent.click(controls.getByLabelText('Remove stop 1'))
      else
        fireEvent.change(
          controls.getByLabelText(
            {
              angle: 'Native gradient angle',
              scaled: 'Native gradient scaled',
              position: 'Gradient stop 2 position',
              color: 'Gradient stop 1 RGB',
            }[edit]
          ),
          {
            target: {
              value: { angle: '5400000', scaled: 'false', position: '60000', color: '445566' }[
                edit
              ],
            },
          }
        )
      const edited = harness.current()
      expect(edited.pptxSemantic.styles).toEqual(harness.initial.pptxSemantic.styles)
      expect(edited.pptxSemantic.definitions).toEqual(harness.initial.pptxSemantic.definitions)
      expect(edited.pptxSemantic.instances.i1).toEqual(harness.initial.pptxSemantic.instances.i1)
      expect(edited.pptxSemantic.instances.g2).toEqual(harness.initial.pptxSemantic.instances.g2)
      const themed = JSON.parse(JSON.stringify(edited))
      const context = themed.pptxSemantic.styles.groupContext1.payload
      themed.pptxSemantic.styles.themeEdit = {
        kind: 'theme-override',
        origin: 'project',
        baseStyleId: context.themeId,
        values: { colors: { accent2: { kind: 'srgb', value: 'ABCDEF' } } },
      }
      const reopened = semantic.normalizeSemanticPresentation(themed)
      const gradient = styles.materializeGeometry(reopened.pptxSemantic, 'i1').style.fill.gradient
      const untouched = gradient.stops[edit === 'color' ? 1 : 0].color
      expect(untouched.value).toBe('ABCDEF')
      expect(untouched.transforms).toEqual([
        { kind: 'tint', value: 10000 },
        { kind: 'alpha', value: 70000 },
      ])
      if (edit === 'angle') expect(gradient.angle).toBe(5400000)
      if (edit === 'scaled') expect(gradient.scaled).toBe(false)
      if (edit === 'position') expect(gradient.stops[1].pos).toBe(60000)
      if (edit === 'add') expect(gradient.stops).toHaveLength(4)
      if (edit === 'remove') expect(gradient.stops).toHaveLength(2)
      if (edit === 'color') expect(gradient.stops[0].color.value).toBe('445566')
    }
  )
  it('supports a selected source group through the real property dispatcher and selection controller without a fake leaf', () => {
    const harness = mount(undefined, false, true)
    fireEvent.click(screen.getByRole('button', { name: 'Edit owner group' }))
    const section = screen.getByRole('region', { name: 'Inherited group fill' })
    fireEvent.change(within(section).getByLabelText('Owner group fill RGB'), {
      target: { value: 'ABCDEF' },
    })
    const model = harness.current().pptxSemantic
    expect(styles.materializeGeometry(model, 'i1').style.fill.color.value).toBe('ABCDEF')
    expect(model.instances.i1).toEqual(harness.initial.pptxSemantic.instances.i1)
    expect(model.instances.g2).toEqual(harness.initial.pptxSemantic.instances.g2)
    expect(model.styles).toEqual(harness.initial.pptxSemantic.styles)
    expect(model.definitions).toEqual(harness.initial.pptxSemantic.definitions)
    expect(harness.current().slides[0].elements).toHaveLength(1)
    expect(
      harness.current().slides[0].elements.some((element) => element.pptxInstanceId === 'g1')
    ).toBe(false)
  })
  it('requires opening the named owner before changing owner fill and preserves source and sibling', () => {
    const harness = mount()
    const section = screen.getByRole('region', { name: 'Inherited group fill' })
    expect(section.textContent).toContain('g1')
    expect(within(section).queryByLabelText('Owner group fill RGB')).toBeNull()
    expect(harness.current()).toEqual(harness.initial)
    fireEvent.click(within(section).getByRole('button', { name: 'Edit owner group' }))
    fireEvent.change(within(section).getByLabelText('Owner group fill RGB'), {
      target: { value: 'ABCDEF' },
    })
    const model = harness.current().pptxSemantic
    expect(styles.materializeGeometry(model, 'i1').style.fill.color.value).toBe('ABCDEF')
    expect(model.instances.i1).toEqual(harness.initial.pptxSemantic.instances.i1)
    expect(model.instances.g2).toEqual(harness.initial.pptxSemantic.instances.g2)
    expect(model.styles).toEqual(harness.initial.pptxSemantic.styles)
    expect(model.definitions).toEqual(harness.initial.pptxSemantic.definitions)
    fireEvent.click(within(section).getByRole('button', { name: 'Reset group fill' }))
    expect(harness.current().pptxSemantic.instances.g1.overrides).toEqual({})
    expect(
      styles.materializeGeometry(harness.current().pptxSemantic, 'i1').style.fill.color.value
    ).toBe('FF0000')
  })
  it.each(['leaf', 'owner', 'slide', 'multiple'])(
    'disables explicit owner editing for %s guard',
    (guard) => {
      const harness = mount(guard)
      const button = screen.getByRole('button', { name: 'Edit owner group' })
      expect(button.disabled).toBe(true)
      fireEvent.click(button)
      expect(screen.queryByLabelText('Owner group fill RGB')).toBeNull()
      expect(harness.current()).toEqual(harness.initial)
    }
  )
  it('retains an invalid color draft visibly without changing canonical group paint', () => {
    const harness = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Edit owner group' }))
    const section = screen.getByRole('region', { name: 'Inherited group fill' })
    const color = within(section).getByLabelText('Owner group fill RGB')
    fireEvent.change(color, { target: { value: 'not-rgb' } })
    fireEvent.blur(color)
    expect(color.value).toBe('not-rgb')
    expect(color.getAttribute('aria-invalid')).toBe('true')
    expect(within(section).getByRole('alert').textContent).toContain('six hexadecimal digits')
    expect(harness.current()).toEqual(harness.initial)
  })
  it('shows a rejected owner operation and preserves the complete canonical input', () => {
    const harness = mount(undefined, true)
    fireEvent.click(screen.getByRole('button', { name: 'Edit owner group' }))
    const section = screen.getByRole('region', { name: 'Inherited group fill' })
    fireEvent.change(within(section).getByLabelText('Owner group fill RGB'), {
      target: { value: 'ABCDEF' },
    })
    expect(within(section).getByRole('alert').textContent).toContain('Group fill rejected')
    expect(harness.current()).toEqual(harness.initial)
  })
})
