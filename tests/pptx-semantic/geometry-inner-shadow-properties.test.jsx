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
function fixture(kind = 'innerShdw') {
  const deck = geometryProjectionFixture()
  deck.pptxSemantic = inheritedGeometryStyleFixture()
  deck.pptxSemantic.styles.provider.payload.properties.effects = authored({
    kind: 'list',
    effects: [
      authored({
        kind,
        color: authored({
          kind: 'scheme',
          value: 'accent1',
          transforms: [authored({ kind: 'alpha', value: 50000 })],
        }),
        blurRad: authored(9525),
      }),
    ],
  })
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
const edit = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const shadow = (deck) =>
  geometryCore.geometryInnerShadow(resolution.materializeGeometry(deck.pptxSemantic, 'i1'))

it.each(['outerShdw', 'innerShdw'])(
  'keeps symbolic source color when changing %s parameters and switching effects',
  (kind) => {
    const initial = fixture(kind)
    const state = mount(initial)
    const label =
      kind === 'innerShdw' ? 'Native inner shadow distance (EMU)' : 'Native shadow distance'
    edit(label, '0')
    const color = {
      kind: 'scheme',
      value: 'accent1',
      transforms: [{ kind: 'alpha', value: 50000 }],
    }
    const effects = () =>
      state.current().pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.effects
    expect(effects().effects[0].color).toEqual(color)
    fireEvent.click(
      screen.getByRole('button', {
        name:
          kind === 'innerShdw' ? 'Switch to native outer shadow' : 'Switch to native inner shadow',
      })
    )
    expect(effects().effects[0].color).toEqual(color)
    const changedTheme = structuredClone(state.current())
    changedTheme.pptxSemantic.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent2: { kind: 'srgb', value: '0000FF' } } },
    }
    expect(
      resolution.materializeGeometry(changedTheme.pptxSemantic, 'i1').style.effects.effects[0].color
        .value
    ).toBe('0000FF')
    expect(state.current().pptxSemantic.styles).toEqual(initial.pptxSemantic.styles)
    expect(state.current().pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
    expect(state.current().pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
  }
)

it.each([
  { kind: 'srgb', value: '102030', transforms: [{ kind: 'alpha', value: 50000 }] },
  { kind: 'preset', value: 'tomato' },
  { kind: 'scrgb', value: { r: 50000, g: 20000, b: 10000 } },
])('edits and clears schema 1 inner effects with native color %j', (color) => {
  const deck = geometryProjectionFixture()
  deck.pptxSemantic.definitions.definition.content.geometry.style = {
    effects: { kind: 'list', effects: [{ kind: 'innerShdw', color, blurRad: 9525 }] },
  }
  const before = structuredClone(deck)
  const state = mount(deck)
  edit('Native inner shadow distance (EMU)', '19050')
  expect(shadow(state.current())).toEqual({ kind: 'innerShdw', color, blurRad: 9525, dist: 19050 })
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native outer shadow' }))
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native inner shadow' }))
  expect(shadow(state.current()).color).toEqual(color)
  fireEvent.click(screen.getByRole('button', { name: 'Remove native inner shadow' }))
  expect(shadow(state.current())).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Add native inner shadow' }))
  expect(shadow(state.current()).dist).toBe(152400)
  expect(state.current().pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(state.current().pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(deck).toEqual(before)
})

it('edits an inherited symbolic inner effect through real targeting without mutating source or sibling', () => {
  const initial = fixture()
  const before = structuredClone(initial)
  const state = mount(initial)
  expect(screen.getByLabelText('Native inner shadow RGB').value).toBe('FF0000')
  for (const label of ['scale X', 'scale Y', 'skew X', 'skew Y', 'alignment', 'rotates'])
    expect(screen.queryByLabelText(`Native inner shadow ${label}`)).toBeNull()
  edit('Native inner shadow blur (EMU)', '27273042316900')
  fireEvent.blur(screen.getByLabelText('Native inner shadow blur (EMU)'))
  edit('Native inner shadow distance (EMU)', '0')
  edit('Native inner shadow direction (1/60000 deg)', '21599999')
  edit('Native inner shadow RGB', 'abc123')
  expect(state.emitted.at(-1)).toMatchObject({
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: {
      type: 'inner-shadow',
      shadow: {
        kind: 'innerShdw',
        blurRad: 27273042316900,
        dist: 0,
        dir: 21599999,
        color: { kind: 'srgb', value: 'abc123', transforms: [{ kind: 'alpha', value: 50000 }] },
      },
    },
  })
  expect(shadow(state.current()).color.value).toBe('abc123')
  expect(state.current().pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  expect(state.current().pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(state.current().pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(initial).toEqual(before)
  edit('Native inner shadow blur (EMU)', '')
  expect(shadow(state.current()).blurRad).toBeUndefined()
})

it('explicitly suppresses inherited effects, adds again, and switches without exceeding one effect', () => {
  const state = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Remove native inner shadow' }))
  expect(state.emitted.at(-1).command).toEqual({ type: 'inner-shadow', shadow: null })
  expect(
    state.current().pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.effects
  ).toEqual({ kind: 'list', effects: [] })
  expect(shadow(state.current())).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Add native inner shadow' }))
  expect(shadow(state.current()).kind).toBe('innerShdw')
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native outer shadow' }))
  expect(
    geometryCore.geometryOuterShadow(
      resolution.materializeGeometry(state.current().pptxSemantic, 'i1')
    ).kind
  ).toBe('outerShdw')
  fireEvent.click(screen.getByRole('button', { name: 'Switch to native inner shadow' }))
  expect(shadow(state.current()).kind).toBe('innerShdw')
  expect(
    state.current().pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.effects
      .effects
  ).toHaveLength(1)
})

it.each(['element', 'slide', 'multiple'])('disables inner effect controls for %s', (guard) => {
  const deck = fixture()
  const callback = vi.fn()
  render(
    inspector(deck, callback, {
      element: { ...deck.slides[0].elements[0], locked: guard === 'element' },
      slideLocked: guard === 'slide',
      selectedElementIds: guard === 'multiple' ? ['i1', 'i2'] : ['i1'],
    })
  )
  for (const input of screen.getAllByLabelText(/^Native inner shadow/, {
    selector: 'input,select',
  })) {
    expect(input.disabled).toBe(true)
    fireEvent.change(input, { target: { value: '0' } })
  }
  for (const name of ['Remove native inner shadow', 'Switch to native outer shadow']) {
    const button = screen.getByRole('button', { name })
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
  }
  expect(callback).not.toHaveBeenCalled()
})

it.each([
  ['blur (EMU)', '-1'],
  ['blur (EMU)', '27273042316901'],
  ['distance (EMU)', '1.5'],
  ['distance (EMU)', '1e3'],
  ['direction (1/60000 deg)', '21600000'],
  ['RGB', 'GG0000'],
])('retains invalid %s drafts without changing committed data', (field, value) => {
  const state = mount()
  const before = structuredClone(state.current())
  const input = screen.getByLabelText(`Native inner shadow ${field}`)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
  expect(input.value).toBe(value)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
  expect(state.current()).toEqual(before)
  expect(state.emitted).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Discard invalid draft' }))
  expect(input.getAttribute('aria-invalid')).toBe('false')
})

it('shows undo and redo values after valid drafts blur', () => {
  const initial = fixture()
  const callback = vi.fn()
  const view = render(inspector(initial, callback))
  edit('Native inner shadow blur (EMU)', '0')
  const changed = operations.applyPresentationProjectionOperation(
    initial,
    callback.mock.calls[0][0].pptxProjectionOperation
  )
  view.rerender(inspector(changed, callback))
  fireEvent.blur(screen.getByLabelText('Native inner shadow blur (EMU)'))
  view.rerender(inspector(initial, callback))
  expect(screen.getByLabelText('Native inner shadow blur (EMU)').value).toBe('9525')
  view.rerender(inspector(changed, callback))
  expect(screen.getByLabelText('Native inner shadow blur (EMU)').value).toBe('0')
})
