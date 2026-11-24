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
const label = 'Native soft edge radius (EMU)'
function fixture(schema = 2, rad = 9525) {
  const deck = geometryProjectionFixture()
  if (schema === 2) {
    deck.pptxSemantic = inheritedGeometryStyleFixture()
    deck.pptxSemantic.styles.provider.payload.properties.effects = authored({
      kind: 'list',
      effects: [authored({ kind: 'softEdge', rad: authored(rad) })],
    })
  } else {
    deck.pptxSemantic.definitions.definition.content.geometry.style = {
      effects: { kind: 'list', effects: [{ kind: 'softEdge', rad }] },
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
const edit = (value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const click = (name) => fireEvent.click(screen.getByRole('button', { name }))
const effect = (deck) =>
  geometryCore.geometrySoftEdge(resolution.materializeGeometry(deck.pptxSemantic, 'i1'))

it.each([1, 2])(
  'edits native schema %s radius, preserves absence/zero and immutable source',
  (schema) => {
    const initial = fixture(schema)
    const before = structuredClone(initial)
    const state = mount(initial)
    expect(
      screen.getAllByLabelText(/^Native soft edge/, { selector: 'input,select' })
    ).toHaveLength(1)
    edit('27273042316900')
    expect(state.emitted.at(-1)).toEqual({
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'soft-edge', softEdge: { kind: 'softEdge', rad: 27273042316900 } },
    })
    edit('')
    expect(effect(state.current())).toEqual({ kind: 'softEdge' })
    edit('0')
    expect(effect(state.current())).toEqual({ kind: 'softEdge', rad: 0 })
    fireEvent.blur(screen.getByLabelText(label))
    expect(effect(JSON.parse(JSON.stringify(state.current())))).toEqual({
      kind: 'softEdge',
      rad: 0,
    })
    expect(state.current().pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(state.current().pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(state.current().pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    expect(initial).toEqual(before)
  }
)

it('removes inherited soft edge with explicit null and adds a single effect again', () => {
  const state = mount()
  click('Remove native soft edge')
  expect(state.emitted.at(-1).command).toEqual({ type: 'soft-edge', softEdge: null })
  expect(
    state.current().pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.effects
  ).toEqual({ kind: 'list', effects: [] })
  expect(effect(state.current())).toBeNull()
  click('Add native soft edge')
  expect(effect(state.current())).toEqual({ kind: 'softEdge', rad: 38100 })
})

it.each(['glow', 'inner shadow', 'outer shadow'])(
  'switches to %s and back without color or shadow fields',
  (kind) => {
    const state = mount()
    click(`Switch to native ${kind}`)
    click('Switch to native soft edge')
    expect(Object.keys(effect(state.current())).sort()).toEqual(['kind', 'rad'])
    expect(
      state.current().pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.effects
        .effects
    ).toHaveLength(1)
  }
)

it.each(['', '0'])('preserves radius %j when switching glow and soft edge', (radius) => {
  const state = mount()
  edit(radius)
  click('Switch to native glow')
  click('Switch to native soft edge')
  expect(effect(state.current())).toEqual({
    kind: 'softEdge',
    ...(radius === '' ? {} : { rad: 0 }),
  })
})

it.each(['element', 'slide', 'multiple'])('guards soft-edge controls for %s', (guard) => {
  const deck = fixture()
  const callback = vi.fn()
  render(
    inspector(deck, callback, {
      element: { ...deck.slides[0].elements[0], locked: guard === 'element' },
      slideLocked: guard === 'slide',
      selectedElementIds: guard === 'multiple' ? ['i1', 'i2'] : ['i1'],
    })
  )
  expect(screen.getByLabelText(label).disabled).toBe(true)
  edit('0')
  for (const name of [
    'Remove native soft edge',
    'Switch to native glow',
    'Switch to native inner shadow',
    'Switch to native outer shadow',
  ]) {
    expect(screen.getByRole('button', { name }).disabled).toBe(true)
    click(name)
  }
  expect(callback).not.toHaveBeenCalled()
})

it.each(
  ['-1', '27273042316901', '1.5', '1e3', '9007199254740992'].flatMap((raw) =>
    [1, 2].map((schema) => [raw, schema])
  )
)('retains invalid %s in schema %s until Discard', (raw, schema) => {
  const state = mount(fixture(schema))
  edit('19050')
  fireEvent.blur(screen.getByLabelText(label))
  const before = structuredClone(state.current())
  const count = state.emitted.length
  edit(raw)
  const input = screen.getByLabelText(label)
  fireEvent.blur(input)
  expect(input.value).toBe(raw)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
  expect(state.current()).toEqual(before)
  expect(state.emitted).toHaveLength(count)
  click('Discard invalid draft')
  expect(input.value).toBe('19050')
  expect(input.getAttribute('aria-invalid')).toBe('false')
})

it('resets invalid drafts on occurrence and source identity changes', () => {
  const initial = fixture()
  const callback = vi.fn()
  const view = render(inspector(initial, callback))
  edit('-1')
  view.rerender(inspector(initial, callback, { element: initial.slides[1].elements[0] }))
  expect(screen.getByLabelText(label).value).toBe('9525')
  view.rerender(inspector(initial, callback))
  edit('-1')
  const changed = fixture(2, 19050)
  changed.pptxSemantic.definitions.definition.source.nativeId = 'replacement'
  view.rerender(inspector(changed, callback))
  expect(screen.getByLabelText(label).value).toBe('19050')
  expect(screen.queryByRole('alert')).toBeNull()
})

it('shows real reducer undo and redo after valid blur', () => {
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
