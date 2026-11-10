// @vitest-environment jsdom
import React, { useLayoutEffect, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import GeometryProperties from '../../client/src/components/properties/geometry-properties'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import operations from '../../shared/src/pptx-projection-operation'
import geometryStyles from '../../shared/src/pptx-geometry-style-resolution'
import { geometryStyleFixture, authored } from './geometry-style-fixture'

afterEach(cleanup)

function gradientFixture() {
  const deck = geometryProjectionFixture()
  deck.pptxSemantic.definitions.definition.content.geometry.style = {
    fill: {
      gradient: {
        kind: 'linear',
        angle: 2700000,
        scaled: true,
        rotWithShape: true,
        tileRect: {},
        flip: 'none',
        stops: [
          {
            pos: 0,
            color: {
              kind: 'srgb',
              value: 'FF0000',
              transforms: [
                { kind: 'tint', value: 10000 },
                { kind: 'alpha', value: 50000 },
                { kind: 'alphaMod', value: 80000 },
                { kind: 'alphaOff', value: -10000 },
                { kind: 'alpha', value: 70000 },
              ],
            },
          },
          { pos: 50000, color: { kind: 'srgb', value: '00FF00' } },
          { pos: 50000, color: { kind: 'srgb', value: '0000FF' } },
          { pos: 100000, color: { kind: 'srgb', value: 'FFFFFF' } },
        ],
      },
    },
  }
  return deck
}

it('emits and applies atomic gradient edits while retaining source, other occurrence and transform order', () => {
  const initial = gradientFixture()
  const before = structuredClone(initial)
  const emitted = []
  let current
  function Harness() {
    const [deck, setDeck] = useState(initial)
    useLayoutEffect(() => {
      current = deck
    }, [deck])
    return (
      <GeometryProperties
        element={deck.slides[0].elements[0]}
        pptxSemantic={deck.pptxSemantic}
        selectedElementIds={['i1']}
        onUpdate={(patch) => {
          emitted.push(patch.pptxProjectionOperation)
          setDeck((previous) =>
            operations.applyPresentationProjectionOperation(previous, patch.pptxProjectionOperation)
          )
        }}
      />
    )
  }
  render(<Harness />)
  const edit = (label, value) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  edit('Native gradient angle', '21599999')
  edit('Native gradient scaled', 'false')
  edit('Gradient stop 2 position', '0')
  edit('Gradient stop 1 RGB', '123abc')
  edit('Gradient stop 1 alpha transform 2', '100000')
  edit('Gradient stop 1 alphaMod transform 3', '1000000')
  edit('Gradient stop 1 alphaOff transform 4', '1000000')
  edit('Gradient stop 1 alpha transform 5', '0')
  const expected = structuredClone(
    before.pptxSemantic.definitions.definition.content.geometry.style.fill.gradient
  )
  expected.angle = 21599999
  expected.scaled = false
  expected.stops[1].pos = 0
  expected.stops[0].color.value = '123abc'
  expected.stops[0].color.transforms[1].value = 100000
  expected.stops[0].color.transforms[2].value = 1000000
  expected.stops[0].color.transforms[3].value = 1000000
  expected.stops[0].color.transforms[4].value = 0
  expect(emitted).toHaveLength(8)
  expect(emitted.at(-1)).toEqual({
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'fill-gradient', gradient: expected },
  })
  expect(
    current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.fill
  ).toEqual({ gradient: expected })
  expect(current.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(current.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(initial).toEqual(before)
  expect(screen.queryByLabelText('Native fill RGB')).toBeNull()
})

it.each(
  ['circle', 'rect', 'shape'].flatMap((path) =>
    [false, true].map((sourceBound) => ({ path, sourceBound }))
  )
)(
  'edits $path path focus and signed tile axes with sourceBound=$sourceBound',
  ({ path, sourceBound }) => {
    const initial = gradientFixture(),
      gradient = initial.pptxSemantic.definitions.definition.content.geometry.style.fill.gradient
    delete gradient.angle
    delete gradient.scaled
    Object.assign(gradient, { kind: 'path', path, tileRect: { l: 10000, r: 20000 } })
    if (sourceBound) {
      initial.pptxSemantic = geometryStyleFixture()
      initial.pptxSemantic.styles.provider.payload.properties.fill = authored({
        gradient: authored({
          kind: 'path',
          path: authored(path),
          rotWithShape: authored(true),
          tileRect: authored({ l: authored(10000), r: authored(20000) }),
          stops: [
            [0, 'FF0000'],
            [100000, '0000FF'],
          ].map(([pos, value]) =>
            authored({
              pos: authored(pos),
              color: authored({ kind: 'srgb', value }),
            })
          ),
        }),
      })
    }
    const before = structuredClone(initial)
    let current = initial
    function Harness() {
      const [deck, setDeck] = useState(initial)
      useLayoutEffect(() => {
        current = deck
      }, [deck])
      return (
        <GeometryProperties
          element={deck.slides[0].elements[0]}
          pptxSemantic={deck.pptxSemantic}
          selectedElementIds={['i1']}
          onUpdate={(patch) =>
            setDeck((previous) =>
              operations.applyPresentationProjectionOperation(
                previous,
                patch.pptxProjectionOperation
              )
            )
          }
        />
      )
    }
    render(<Harness />)
    expect(screen.queryByLabelText('Native gradient angle')).toBeNull()
    expect(screen.queryByLabelText('Native gradient scaled')).toBeNull()
    const edit = (label, value) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    edit('Native gradient path', path === 'circle' ? 'rect' : 'circle')
    edit('Gradient focus left', '25000')
    edit('Gradient tile left', '-25000')
    edit('Gradient tile top', '10000')
    const changed = geometryStyles.materializeGeometry(current.pptxSemantic, 'i1').style.fill
      .gradient
    expect(changed).toMatchObject({
      kind: 'path',
      path: path === 'circle' ? 'rect' : 'circle',
      fillToRect: { l: 25000, t: 50000, r: 50000, b: 50000 },
      tileRect: { l: -25000, t: 10000, r: 20000 },
    })
    expect(current.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(current.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(current.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    expect(initial).toEqual(before)
  }
)

it.each([
  ['Native gradient angle', '-1'],
  ['Native gradient angle', '21600000'],
  ['Native gradient angle', '1.5'],
  ['Native gradient angle', ''],
  ['Gradient stop 2 position', '50001'],
  ['Gradient stop 3 position', '49999'],
  ['Gradient stop 1 position', '-1'],
  ['Gradient stop 4 position', '100001'],
  ['Gradient stop 1 RGB', '#FF0000'],
  ['Gradient stop 1 alpha transform 2', '100001'],
  ['Gradient stop 1 alphaMod transform 3', '-1'],
  ['Gradient stop 1 alphaMod transform 3', '1000001'],
  ['Gradient stop 1 alphaOff transform 4', '-100001'],
  ['Gradient stop 1 alphaOff transform 4', '1000001'],
  ['Gradient stop 1 alphaOff transform 4', '0.5'],
  ['Gradient tile left', '-2147483649'],
  ['Gradient tile top', '2147483648'],
])('rejects invalid draft %s=%s without emitting or changing canonical data', (label, value) => {
  const deck = gradientFixture()
  const before = structuredClone(deck)
  const onUpdate = vi.fn()
  render(
    <GeometryProperties
      element={deck.slides[0].elements[0]}
      pptxSemantic={deck.pptxSemantic}
      selectedElementIds={['i1']}
      onUpdate={onUpdate}
    />
  )
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(onUpdate).not.toHaveBeenCalled()
  expect(deck).toEqual(before)
})

it.each(['element', 'slide', 'multiple'])(
  'disables all gradient controls for %s guard',
  (guard) => {
    const deck = gradientFixture()
    const onUpdate = vi.fn()
    render(
      <GeometryProperties
        element={{ ...deck.slides[0].elements[0], locked: guard === 'element' }}
        pptxSemantic={deck.pptxSemantic}
        slideLocked={guard === 'slide'}
        selectedElementIds={guard === 'multiple' ? ['i1', 'i2'] : ['i1']}
        onUpdate={onUpdate}
      />
    )
    for (const input of screen.getAllByLabelText(
      /^(Native gradient|Gradient (?:stop|focus|tile))/,
      {
        selector: 'input, select',
      }
    )) {
      expect(input.disabled).toBe(true)
      fireEvent.change(input, { target: { value: '0' } })
    }
    for (const button of screen.getAllByRole('button', { name: /^(Add stop after|Remove stop)/ })) {
      expect(button.disabled).toBe(true)
      fireEvent.click(button)
    }
    expect(onUpdate).not.toHaveBeenCalled()
  }
)

it.each([
  ['Native gradient angle', '5400000', '2700000'],
  ['Gradient stop 1 RGB', '654321', 'FF0000'],
  ['Gradient tile left', '-25000', '0'],
])('shows the restored canonical value after editing and undoing %s', (label, edited, original) => {
  const initial = gradientFixture()
  const onUpdate = vi.fn()
  const props = (deck) => (
    <GeometryProperties
      element={deck.slides[0].elements[0]}
      pptxSemantic={deck.pptxSemantic}
      selectedElementIds={['i1']}
      onUpdate={onUpdate}
    />
  )
  const view = render(props(initial))
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value: edited } })
  const changed = operations.applyPresentationProjectionOperation(
    initial,
    onUpdate.mock.calls[0][0].pptxProjectionOperation
  )
  view.rerender(props(changed))
  expect(input.value).toBe(edited)
  fireEvent.blur(input)
  view.rerender(props(initial))
  expect(input.value).toBe(original)
  view.rerender(props(changed))
  expect(input.value).toBe(edited)
})

it('inserts and removes an explicit gradient stop atomically without changing source or other occurrences', () => {
  const initial = gradientFixture()
  const before = structuredClone(initial)
  const onUpdate = vi.fn()
  const props = (deck) => (
    <GeometryProperties
      element={deck.slides[0].elements[0]}
      pptxSemantic={deck.pptxSemantic}
      selectedElementIds={['i1']}
      onUpdate={onUpdate}
    />
  )
  const view = render(props(initial))
  fireEvent.click(screen.getByRole('button', { name: 'Add stop after 1' }))
  expect(onUpdate).toHaveBeenCalledTimes(1)
  const added = operations.applyPresentationProjectionOperation(
    initial,
    onUpdate.mock.calls[0][0].pptxProjectionOperation
  )
  const expected = structuredClone(
    before.pptxSemantic.definitions.definition.content.geometry.style.fill.gradient
  )
  expected.stops.splice(1, 0, structuredClone(expected.stops[0]))
  expect(
    added.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.fill
  ).toEqual({ gradient: expected })
  expect(added.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(added.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  view.rerender(props(added))
  fireEvent.click(screen.getByRole('button', { name: 'Remove stop 2' }))
  const removed = operations.applyPresentationProjectionOperation(
    added,
    onUpdate.mock.calls[1][0].pptxProjectionOperation
  )
  expect(
    removed.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.fill
  ).toEqual(before.pptxSemantic.definitions.definition.content.geometry.style.fill)
  expect(removed.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(removed.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(initial).toEqual(before)
})

it('does not reuse an invalid draft for a different stop after removal', () => {
  const initial = gradientFixture()
  const onUpdate = vi.fn()
  const props = (deck) => (
    <GeometryProperties
      element={deck.slides[0].elements[0]}
      pptxSemantic={deck.pptxSemantic}
      selectedElementIds={['i1']}
      onUpdate={onUpdate}
    />
  )
  const view = render(props(initial))
  fireEvent.change(screen.getByLabelText('Gradient stop 1 RGB'), { target: { value: 'bad' } })
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(onUpdate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Remove stop 1' }))
  const removed = operations.applyPresentationProjectionOperation(
    initial,
    onUpdate.mock.calls[0][0].pptxProjectionOperation
  )
  view.rerender(props(removed))
  expect(screen.getByLabelText('Gradient stop 1 RGB').value).toBe('00FF00')
  expect(screen.queryByRole('alert')).toBeNull()
})

it.each([2, 256])(
  'honors the native stop count boundary %i without emitting invalid edits',
  (count) => {
    const initial = gradientFixture()
    const native = initial.pptxSemantic.definitions.definition.content.geometry.style.fill.gradient
    native.stops = Array.from({ length: count }, (_, index) => ({
      pos: Math.floor((index * 100000) / (count - 1)),
      color: { kind: 'srgb', value: '123456' },
    }))
    const onUpdate = vi.fn()
    render(
      <GeometryProperties
        element={initial.slides[0].elements[0]}
        pptxSemantic={initial.pptxSemantic}
        selectedElementIds={['i1']}
        onUpdate={onUpdate}
      />
    )
    const button = screen.getByRole('button', {
      name: count === 2 ? 'Remove stop 1' : 'Add stop after 1',
    })
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onUpdate).not.toHaveBeenCalled()
  }
)

it('does not invent a gradient for geometry with no native fill declaration', () => {
  const deck = geometryProjectionFixture()
  render(
    <GeometryProperties
      element={deck.slides[0].elements[0]}
      pptxSemantic={deck.pptxSemantic}
      onUpdate={vi.fn()}
    />
  )
  expect(screen.queryByLabelText('Native gradient angle')).toBeNull()
})
