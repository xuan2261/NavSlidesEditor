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
const symbolic = { kind: 'scheme', value: 'accent1', transforms: [{ kind: 'alpha', value: 50000 }] }
function fixture(schema = 2, color = symbolic) {
  const deck = geometryProjectionFixture()
  const effect = { kind: 'glow', color, rad: 9525 }
  if (schema === 2) {
    deck.pptxSemantic = inheritedGeometryStyleFixture()
    deck.pptxSemantic.styles.provider.payload.properties.effects = authored({
      kind: 'list', effects: [authored({
        kind: 'glow', rad: authored(9525),
        color: authored({
          ...color, transforms: color.transforms.map((transform) => authored(transform)),
        }),
      })],
    })
  } else {
    deck.pptxSemantic.definitions.definition.content.geometry.style = {
      effects: { kind: 'list', effects: [effect] },
    }
  }
  return deck
}
function inspector(deck, callback, extra = {}) {
  return <GeometryProperties element={deck.slides[0].elements[0]}
    pptxSemantic={deck.pptxSemantic} selectedElementIds={['i1']} onUpdate={callback} {...extra} />
}
function mount(initial = fixture()) {
  let current = initial
  const emitted = []
  function Harness() {
    const [deck, setDeck] = useState(initial)
    useLayoutEffect(() => { current = deck }, [deck])
    return inspector(deck, (patch) => {
      emitted.push(patch.pptxProjectionOperation)
      setDeck((previous) =>
        operations.applyPresentationProjectionOperation(previous, patch.pptxProjectionOperation))
    })
  }
  render(<Harness />)
  return { current: () => current, emitted }
}
const edit = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const glow = (deck) => geometryCore.geometryGlow(
  resolution.materializeGeometry(deck.pptxSemantic, 'i1'))

it('edits inherited radius without flattening symbolic color or changing source and sibling', () => {
  const initial = fixture()
  const before = structuredClone(initial)
  const state = mount(initial)
  expect(screen.getByLabelText('Native glow RGB').value).toBe('FF0000')
  expect(screen.getAllByLabelText(/^Native glow/, { selector: 'input,select' })).toHaveLength(2)
  edit('Native glow radius (EMU)', '27273042316900')
  expect(state.emitted.at(-1)).toEqual({
    type: 'geometry.edit', instanceId: 'i1', componentId: 'geometry',
    command: { type: 'glow', glow: { kind: 'glow', rad: 27273042316900, color: symbolic } },
  })
  edit('Native glow radius (EMU)', '')
  expect(Object.hasOwn(glow(state.current()), 'rad')).toBe(false)
  edit('Native glow radius (EMU)', '0')
  expect(glow(state.current()).rad).toBe(0)
  edit('Native glow RGB', 'abc123')
  expect(glow(state.current()).color).toEqual({
    kind: 'srgb', value: 'abc123', transforms: symbolic.transforms,
  })
  expect(state.current().pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  expect(state.current().pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(state.current().pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(initial).toEqual(before)
})

it.each([
  { kind: 'srgb', value: '102030' },
  { kind: 'preset', value: 'tomato' },
  { kind: 'scrgb', value: { r: 50000, g: 20000, b: 10000 } },
  { kind: 'hsl', value: { hue: 60000, sat: 50000, lum: 20000 } },
])('edits schema 1 glow with native color %j through real operations', (color) => {
  const state = mount(fixture(1, color))
  edit('Native glow radius (EMU)', '0')
  expect(glow(state.current())).toEqual({ kind: 'glow', color, rad: 0 })
  fireEvent.click(screen.getByRole('button', { name: 'Remove native glow' }))
  expect(glow(state.current())).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Add native glow' }))
  expect(glow(state.current()).kind).toBe('glow')
})

it('suppresses inherited glow and switches single effects without shadow-only attributes', () => {
  const state = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Remove native glow' }))
  expect(state.emitted.at(-1).command).toEqual({ type: 'glow', glow: null })
  expect(state.current().pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.effects)
    .toEqual({ kind: 'list', effects: [] })
  fireEvent.click(screen.getByRole('button', { name: 'Add native glow' }))
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native inner shadow' }))
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native glow' }))
  expect(Object.keys(glow(state.current())).sort()).toEqual(['color', 'kind', 'rad'])
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native outer shadow' }))
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native glow' }))
  expect(glow(state.current()).kind).toBe('glow')
  expect(state.current().pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.effects.effects)
    .toHaveLength(1)
})

it('switches schema 1 effects without leaking shadow fields or defaulting absent radius', () => {
  const color = { kind: 'srgb', value: '102030' }
  const state = mount(fixture(1, color))
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native inner shadow' }))
  edit('Native inner shadow blur (EMU)', '')
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native glow' }))
  expect(glow(state.current())).toEqual({ kind: 'glow', color })
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native outer shadow' }))
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native glow' }))
  expect(glow(state.current())).toEqual({ kind: 'glow', color, rad: 38100 })
})

it.each(['element', 'slide', 'multiple'])('guards glow controls for %s', (guard) => {
  const deck = fixture()
  const callback = vi.fn()
  render(inspector(deck, callback, {
    element: { ...deck.slides[0].elements[0], locked: guard === 'element' },
    slideLocked: guard === 'slide',
    selectedElementIds: guard === 'multiple' ? ['i1', 'i2'] : ['i1'],
  }))
  for (const input of screen.getAllByLabelText(/^Native glow/, { selector: 'input,select' })) {
    expect(input.disabled).toBe(true)
    fireEvent.change(input, { target: { value: '0' } })
  }
  for (const name of ['Remove native glow', 'Switch to native outer shadow', 'Switch to native inner shadow']) {
    const button = screen.getByRole('button', { name })
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
  }
  expect(callback).not.toHaveBeenCalled()
})

it.each([
  ['radius (EMU)', '-1'], ['radius (EMU)', '27273042316901'],
  ['radius (EMU)', '1.5'], ['radius (EMU)', '1e3'], ['RGB', 'GG0000'],
].flatMap(([field, value]) => [1, 2].map((schema) => [field, value, schema])))(
  'retains invalid %s=%s drafts and discards to committed schema %s value', (field, value, schema) => {
  const state = mount(fixture(schema, schema === 1 ? { kind: 'srgb', value: '102030' } : symbolic))
  edit('Native glow radius (EMU)', '19050')
  fireEvent.blur(screen.getByLabelText('Native glow radius (EMU)'))
  const before = structuredClone(state.current())
  const count = state.emitted.length
  const input = screen.getByLabelText(`Native glow ${field}`)
  const committed = input.value
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
  expect(input.value).toBe(value)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
  expect(state.current()).toEqual(before)
  expect(state.emitted).toHaveLength(count)
  fireEvent.click(screen.getByRole('button', { name: 'Discard invalid draft' }))
  expect(input.value).toBe(committed)
  expect(input.getAttribute('aria-invalid')).toBe('false')
})

it.each([1, 2])('shows canonical schema %s undo and redo radius values after valid blur', (schema) => {
  const initial = fixture(schema, schema === 1 ? { kind: 'srgb', value: '102030' } : symbolic)
  const callback = vi.fn()
  const view = render(inspector(initial, callback))
  edit('Native glow radius (EMU)', '0')
  const changed = operations.applyPresentationProjectionOperation(
    initial, callback.mock.calls[0][0].pptxProjectionOperation)
  view.rerender(inspector(changed, callback))
  fireEvent.blur(screen.getByLabelText('Native glow radius (EMU)'))
  view.rerender(inspector(initial, callback))
  expect(screen.getByLabelText('Native glow radius (EMU)').value).toBe('9525')
  view.rerender(inspector(changed, callback))
  expect(screen.getByLabelText('Native glow radius (EMU)').value).toBe('0')
})
