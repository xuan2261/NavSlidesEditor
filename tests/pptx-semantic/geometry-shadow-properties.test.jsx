// @vitest-environment jsdom
import React, { useLayoutEffect, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import GeometryProperties from '../../client/src/components/properties/geometry-properties'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import operations from '../../shared/src/pptx-projection-operation'
import geometryCore from '../../shared/src/pptx-geometry-document'

afterEach(cleanup)

function shadowFixture() {
  const deck = structuredClone(geometryProjectionFixture())
  deck.pptxSemantic.definitions.definition.content.geometry.style = {
    fill: { color: { kind: 'srgb', value: '123456' } },
    stroke: { color: { kind: 'srgb', value: '654321' }, width: 9525 },
    effects: {
      kind: 'list',
      effects: [
        {
          kind: 'outerShdw',
          blurRad: 9525,
          dist: 19050,
          dir: 5400000,
          color: {
            kind: 'srgb',
            value: '102030',
            transforms: [
              { kind: 'tint', value: 10000 },
              { kind: 'alpha', value: 50000 },
              { kind: 'alphaMod', value: 80000 },
              { kind: 'alphaOff', value: -10000 },
              { kind: 'alpha', value: 70000 },
            ],
          },
        },
      ],
    },
  }
  return deck
}

function inspector(deck, onUpdate, extra = {}) {
  return (
    <GeometryProperties
      element={deck.slides[0].elements[0]}
      pptxSemantic={deck.pptxSemantic}
      selectedElementIds={['i1']}
      onUpdate={onUpdate}
      {...extra}
    />
  )
}
const edit = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const style = (deck) =>
  deck.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style
const apply = (deck, callback, index = 0) =>
  operations.applyPresentationProjectionOperation(
    deck,
    callback.mock.calls[index][0].pptxProjectionOperation
  )

it('applies atomic shadow edits while preserving source, other occurrence, styles and transform order', () => {
  const initial = shadowFixture()
  const before = structuredClone(initial)
  const emitted = []
  let current
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
  for (const [label, value] of [
    ['Native shadow blur', '27273042316900'],
    ['Native shadow distance', '0'],
    ['Native shadow direction', '21599999'],
    ['Native shadow scale X', '-2147483648'],
    ['Native shadow scale Y', '2147483647'],
    ['Native shadow skew X', '-5399999'],
    ['Native shadow skew Y', '5399999'],
    ['Native shadow alignment', 'br'],
    ['Native shadow rotates', 'false'],
    ['Native shadow RGB', 'abc123'],
    ['Native shadow alpha transform 2', '100000'],
    ['Native shadow alphaMod transform 3', '1000000'],
    ['Native shadow alphaOff transform 4', '-100000'],
    ['Native shadow alpha transform 5', '0'],
  ])
    edit(label, value)
  const expected = structuredClone(
    before.pptxSemantic.definitions.definition.content.geometry.style
  )
  Object.assign(expected.effects.effects[0], {
    blurRad: 27273042316900,
    dist: 0,
    dir: 21599999,
    sx: -2147483648,
    sy: 2147483647,
    kx: -5399999,
    ky: 5399999,
    algn: 'br',
    rotWithShape: false,
  })
  expected.effects.effects[0].color.value = 'abc123'
  ;[100000, 1000000, -100000, 0].forEach((value, index) => {
    expected.effects.effects[0].color.transforms[index + 1].value = value
  })
  expect(emitted).toHaveLength(14)
  expect(emitted.at(-1)).toEqual({
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'outer-shadow', shadow: expected.effects.effects[0] },
  })
  expect(style(current)).toEqual(expected)
  expect(current.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(current.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(initial).toEqual(before)
})

it('retains absent attributes, clears only the blank attribute and preserves explicit zero and false', () => {
  const initial = shadowFixture()
  const callback = vi.fn()
  const view = render(inspector(initial, callback))
  for (const label of ['scale X', 'scale Y', 'skew X', 'skew Y', 'alignment', 'rotates']) {
    expect(screen.getByLabelText(`Native shadow ${label}`).value).toBe('')
  }
  edit('Native shadow blur', '')
  let changed = apply(initial, callback)
  expect(style(changed).effects.effects[0]).toEqual(
    Object.fromEntries(
      Object.entries(
        initial.pptxSemantic.definitions.definition.content.geometry.style.effects.effects[0]
      ).filter(([key]) => key !== 'blurRad')
    )
  )
  view.rerender(inspector(changed, callback))
  edit('Native shadow blur', '0')
  changed = apply(changed, callback, 1)
  expect(style(changed).effects.effects[0].blurRad).toBe(0)
  view.rerender(inspector(changed, callback))
  edit('Native shadow rotates', 'false')
  changed = apply(changed, callback, 2)
  expect(style(changed).effects.effects[0].rotWithShape).toBe(false)
  view.rerender(inspector(changed, callback))
  edit('Native shadow rotates', '')
  changed = apply(changed, callback, 3)
  expect(Object.hasOwn(style(changed).effects.effects[0], 'rotWithShape')).toBe(false)
})

it.each(['element', 'slide', 'multiple'])('guards all shadow controls for %s', (guard) => {
  const deck = shadowFixture()
  const callback = vi.fn()
  render(
    inspector(deck, callback, {
      element: { ...deck.slides[0].elements[0], locked: guard === 'element' },
      slideLocked: guard === 'slide',
      selectedElementIds: guard === 'multiple' ? ['i1', 'i2'] : ['i1'],
    })
  )
  for (const input of screen.getAllByLabelText(/^Native shadow/, { selector: 'input,select' })) {
    expect(input.disabled).toBe(true)
    fireEvent.change(input, { target: { value: input.tagName === 'SELECT' ? 'false' : '0' } })
  }
  const button = screen.getByRole('button', { name: 'Remove native shadow' })
  expect(button.disabled).toBe(true)
  fireEvent.click(button)
  expect(callback).not.toHaveBeenCalled()
})

it.each([
  ...Object.entries(geometryCore.OUTER_SHADOW_RANGES).flatMap(([field, [min, max]]) => {
    const names = {
      blurRad: 'blur',
      dist: 'distance',
      dir: 'direction',
      sx: 'scale X',
      sy: 'scale Y',
      kx: 'skew X',
      ky: 'skew Y',
    }
    return [String(min - 1), String(max + 1), '1.5'].map((value) => [
      `Native shadow ${names[field]}`,
      value,
    ])
  }),
  ['Native shadow RGB', '#123456'],
  ['Native shadow RGB', ''],
  ['Native shadow RGB', 'GG0000'],
  ['Native shadow alpha transform 2', '100001'],
  ['Native shadow alpha transform 2', ''],
  ['Native shadow alphaMod transform 3', '-1'],
  ['Native shadow alphaOff transform 4', '-100001'],
])('rejects invalid %s=%s with accessible alert and no callback', (label, value) => {
  const deck = shadowFixture()
  const before = structuredClone(deck)
  const callback = vi.fn()
  render(inspector(deck, callback))
  const input = screen.getByLabelText(label)
  edit(label, value)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  const alert = screen.getByRole('alert')
  expect(input.getAttribute('aria-describedby')).toBe(alert.id)
  expect(alert.textContent.length).toBeGreaterThan(0)
  fireEvent.blur(input)
  expect(input.value).toBe(value)
  fireEvent.click(screen.getByRole('button', { name: 'Discard invalid draft' }))
  expect(input.getAttribute('aria-invalid')).toBe('false')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(callback).not.toHaveBeenCalled()
  expect(deck).toEqual(before)
})

it('removes native effects atomically while retaining fill, stroke, source and other occurrence', () => {
  const deck = shadowFixture()
  const before = structuredClone(deck)
  const callback = vi.fn()
  const view = render(inspector(deck, callback))
  fireEvent.click(screen.getByRole('button', { name: 'Remove native shadow' }))
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback.mock.calls[0][0].pptxProjectionOperation.command).toEqual({
    type: 'outer-shadow',
    shadow: null,
  })
  const changed = apply(deck, callback)
  const { effects, ...expected } = before.pptxSemantic.definitions.definition.content.geometry.style
  expect(effects.effects).toHaveLength(1)
  expect(style(changed)).toEqual({ ...expected, effects: { kind: 'list', effects: [] } })
  expect(changed.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(changed.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(deck).toEqual(before)
  view.rerender(inspector(changed, callback))
  expect(screen.queryByLabelText('Native shadow RGB')).toBeNull()
})

it.each([
  ['Native shadow blur', '0', '9525'],
  ['Native shadow RGB', '654321', '102030'],
  ['Native shadow alpha transform 2', '0', '50000'],
])('shows canonical Undo and Redo values after valid blur for %s', (label, edited, original) => {
  const initial = shadowFixture()
  const callback = vi.fn()
  const view = render(inspector(initial, callback))
  const input = screen.getByLabelText(label)
  edit(label, edited)
  const changed = apply(initial, callback)
  view.rerender(inspector(changed, callback))
  fireEvent.blur(input)
  view.rerender(inspector(initial, callback))
  expect(input.value).toBe(original)
  view.rerender(inspector(changed, callback))
  expect(input.value).toBe(edited)
})
