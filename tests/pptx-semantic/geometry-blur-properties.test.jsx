// @vitest-environment jsdom
import React, { useLayoutEffect, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import GeometryProperties from '../../client/src/components/properties/geometry-properties'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import { authored, inheritedGeometryStyleFixture } from './geometry-style-fixture'
import operations from '../../shared/src/pptx-projection-operation'
import resolution from '../../shared/src/pptx-geometry-style-resolution'
import geometryCore from '../../shared/src/pptx-geometry-document'
afterEach(cleanup)
const label = 'Native blur radius (EMU)'
const growLabel = 'Native blur grow'
function fixture(schema = 2, blur = { kind: 'blur', rad: 9525 }) {
  const deck = geometryProjectionFixture()
  if (schema === 2) {
    deck.pptxSemantic = inheritedGeometryStyleFixture()
    const wrapped = { kind: blur.kind }
    for (const key of ['rad', 'grow']) {
      if (Object.hasOwn(blur, key)) wrapped[key] = authored(blur[key])
    }
    deck.pptxSemantic.styles.provider.payload.properties.effects = authored({
      kind: 'list',
      effects: [authored(wrapped)],
    })
  } else {
    deck.pptxSemantic.definitions.definition.content.geometry.style = {
      effects: { kind: 'list', effects: [blur] },
    }
  }
  return deck
}
function inspector(deck, callback, extra = {}) {
  return (
    <GeometryProperties
      element={deck.slides[0].elements[0]}
      pptxSemantic={deck.pptxSemantic}
      selectedElementIds={['i1']}
      onUpdate={callback}
      {...extra}
    />
  )
}
function mount(initial = fixture()) {
  let current = initial
  const emitted = []
  function Harness() {
    const [deck, setDeck] = useState(initial)
    useLayoutEffect(() => {
      current = deck
    }, [deck])
    return inspector(deck, (patch) => {
      emitted.push(patch.pptxProjectionOperation)
      setDeck((previous) =>
        operations.applyPresentationProjectionOperation(previous, patch.pptxProjectionOperation)
      )
    })
  }
  render(<Harness />)
  return { current: () => current, emitted }
}
const edit = (value, name = label) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } })
const click = (name) => fireEvent.click(screen.getByRole('button', { name }))
const effect = (deck) =>
  geometryCore.geometryBlur(resolution.materializeGeometry(deck.pptxSemantic, 'i1'))
it.each([1, 2])('edits schema %s optional blur fields without source mutation', (schema) => {
  const initial = fixture(schema)
  const before = structuredClone(initial)
  const state = mount(initial)
  expect(screen.getAllByLabelText(/^Native blur/, { selector: 'input,select' })).toHaveLength(2)
  edit('27273042316900')
  expect(state.emitted.at(-1)).toEqual({
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'blur', blur: { kind: 'blur', rad: 27273042316900 } },
  })
  edit('')
  expect(effect(state.current())).toEqual({ kind: 'blur' })
  edit('0')
  for (const [value, grow] of [
    ['false', false],
    ['true', true],
    ['', undefined],
  ]) {
    edit(value, growLabel)
    expect(effect(state.current())).toEqual({
      kind: 'blur',
      rad: 0,
      ...(grow === undefined ? {} : { grow }),
    })
    expect(effect(JSON.parse(JSON.stringify(state.current())))).toEqual(effect(state.current()))
  }
  fireEvent.blur(screen.getByLabelText(label))
  expect(state.current().pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  expect(state.current().pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(state.current().pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(initial).toEqual(before)
})
it.each([1, 2])('removes and adds schema %s blur without guessed defaults', (schema) => {
  const state = mount(fixture(schema))
  click('Remove native blur')
  expect(state.emitted.at(-1).command).toEqual({ type: 'blur', blur: null })
  if (schema === 2)
    expect(
      state.current().pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.effects
    ).toEqual({ kind: 'list', effects: [] })
  expect(effect(state.current())).toBeNull()
  click('Add native blur')
  expect(effect(state.current())).toEqual({ kind: 'blur' })
})
it.each(
  ['glow', 'soft edge', 'inner shadow', 'outer shadow'].flatMap((kind) =>
    [undefined, 0, 19050].map((rad) => [kind, rad])
  )
)('switches %s preserving optional radius %s and only blur fields', (kind, rad) => {
  const state = mount(
    fixture(2, { kind: 'blur', ...(rad === undefined ? {} : { rad }), grow: false })
  )
  click(`Switch to native ${kind}`)
  click('Switch to native blur')
  expect(effect(state.current())).toEqual({ kind: 'blur', ...(rad === undefined ? {} : { rad }) })
  expect(
    state.current().pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.effects
      .effects
  ).toHaveLength(1)
})
it.each(['element', 'slide', 'multiple'])('guards blur controls for %s', (guard) => {
  const deck = fixture()
  const callback = vi.fn()
  render(
    inspector(deck, callback, {
      element: { ...deck.slides[0].elements[0], locked: guard === 'element' },
      slideLocked: guard === 'slide',
      selectedElementIds: guard === 'multiple' ? ['i1', 'i2'] : ['i1'],
    })
  )
  for (const name of [label, growLabel]) {
    expect(screen.getByLabelText(name).disabled).toBe(true)
    edit('0', name)
  }
  for (const button of screen.getAllByRole('button')) {
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
  }
  expect(callback).not.toHaveBeenCalled()
})
it.each(
  ['-1', '27273042316901', '1.5', '1e3', '9007199254740992'].flatMap((raw) =>
    [1, 2].map((schema) => [raw, schema])
  )
)('retains invalid %s in schema %s until Discard', (raw, schema) => {
  const state = mount(fixture(schema))
  edit(raw)
  const input = screen.getByLabelText(label)
  fireEvent.blur(input)
  expect(input.value).toBe(raw)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
  expect(state.emitted).toHaveLength(0)
  edit('false', growLabel)
  expect(input.value).toBe(raw)
  expect(effect(state.current())).toEqual({ kind: 'blur', rad: 9525, grow: false })
  click('Discard invalid draft')
  expect(input.value).toBe('9525')
})
it('isolates invalid drafts by occurrence and source identity', () => {
  const initial = fixture()
  const callback = vi.fn()
  const view = render(inspector(initial, callback))
  edit('-1')
  view.rerender(inspector(initial, callback, { element: initial.slides[1].elements[0] }))
  expect(screen.getByLabelText(label).value).toBe('9525')
  view.rerender(inspector(initial, callback))
  edit('-1')
  const changed = fixture(2, { kind: 'blur', rad: 19050 })
  changed.pptxSemantic.definitions.definition.source.nativeId = 'replacement'
  view.rerender(inspector(changed, callback))
  expect(screen.getByLabelText(label).value).toBe('19050')
  expect(screen.queryByRole('alert')).toBeNull()
})
it('renders reducer-backed undo/redo values after input blur', () => {
  const initial = fixture()
  const callback = vi.fn()
  const view = render(inspector(initial, callback))
  edit('0')
  const changed = operations.applyPresentationProjectionOperation(
    initial,
    callback.mock.calls[0][0].pptxProjectionOperation
  )
  view.rerender(inspector(changed, callback))
  fireEvent.blur(screen.getByLabelText(label))
  view.rerender(inspector(initial, callback))
  expect(screen.getByLabelText(label).value).toBe('9525')
  view.rerender(inspector(changed, callback))
  expect(screen.getByLabelText(label).value).toBe('0')
})
