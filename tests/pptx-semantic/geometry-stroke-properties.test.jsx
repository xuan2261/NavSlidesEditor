// @vitest-environment jsdom
import React, { useLayoutEffect, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import GeometryProperties from '../../client/src/components/properties/geometry-properties'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import operations from '../../shared/src/pptx-projection-operation'
import capabilities from '../../shared/src/pptx-projection-capabilities'
import renderers from '../../shared/src/element-renderers'

afterEach(cleanup)

it('edits each native arrow attribute in the inspector without materializing omitted source sizes', () => {
  const initial = strokeFixture()
  initial.pptxSemantic.definitions.definition.content.geometry.style.stroke.headEnd = {
    type: 'triangle',
    w: 'sm',
  }
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
        onUpdate={(patch) =>
          setDeck((previous) =>
            operations.applyPresentationProjectionOperation(previous, patch.pptxProjectionOperation)
          )
        }
      />
    )
  }
  render(<Harness />)
  expect(screen.getByLabelText('Native start arrow').value).toBe('triangle')
  expect(screen.getByLabelText('Start arrow width').value).toBe('sm')
  expect(screen.getByLabelText('Start arrow length').value).toBe('')
  expect(screen.getByLabelText('Native end arrow').value).toBe('absent')
  fireEvent.change(screen.getByLabelText('Start arrow length'), { target: { value: 'lg' } })
  fireEvent.change(screen.getByLabelText('Native start arrow'), { target: { value: 'arrow' } })
  const stroke = () =>
    current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.stroke
  expect(stroke().headEnd).toEqual({ type: 'arrow', w: 'sm', len: 'lg' })
  fireEvent.change(screen.getByLabelText('Start arrow width'), { target: { value: '' } })
  expect(stroke().headEnd).toEqual({ type: 'arrow', len: 'lg' })
  fireEvent.change(screen.getByLabelText('Native end arrow'), { target: { value: 'diamond' } })
  expect(stroke().tailEnd).toEqual({ type: 'diamond' })
  fireEvent.change(screen.getByLabelText('End arrow width'), { target: { value: 'med' } })
  expect(stroke().tailEnd).toEqual({ type: 'diamond', w: 'med' })
  fireEvent.change(screen.getByLabelText('Native end arrow'), { target: { value: '' } })
  expect(stroke().tailEnd).toEqual({ w: 'med' })
  fireEvent.change(screen.getByLabelText('End arrow width'), { target: { value: '' } })
  expect(stroke().tailEnd).toEqual({})
  fireEvent.change(screen.getByLabelText('Native end arrow'), { target: { value: 'absent' } })
  expect(stroke()).not.toHaveProperty('tailEnd')
  const expected = {
    ...initial.pptxSemantic.definitions.definition.content.geometry.style.stroke,
    headEnd: { type: 'arrow', len: 'lg' },
  }
  expect(stroke()).toEqual(expected)
  expect(current.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
  expect(current.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
})

it.each(['element', 'slide', 'multiple'])(
  'keeps native arrow controls readonly for %s guards',
  (guard) => {
    const deck = strokeFixture()
    deck.pptxSemantic.definitions.definition.content.geometry.style.stroke.headEnd = {
      type: 'arrow',
    }
    const element = { ...deck.slides[0].elements[0], locked: guard === 'element' }
    render(
      <GeometryProperties
        element={element}
        pptxSemantic={deck.pptxSemantic}
        slideLocked={guard === 'slide'}
        selectedElementIds={guard === 'multiple' ? ['i1', 'i2'] : ['i1']}
        onUpdate={() => {
          throw new Error('Readonly arrow edit')
        }}
      />
    )
    for (const label of [
      'Native start arrow',
      'Start arrow width',
      'Start arrow length',
      'Native end arrow',
    ])
      expect(screen.getByLabelText(label).disabled).toBe(true)
  }
)

function strokeFixture() {
  const deck = geometryProjectionFixture()
  deck.pptxSemantic.definitions.definition.content.geometry.style = {
    stroke: {
      color: { kind: 'srgb', value: '2468AC' },
      width: 38100,
      cap: 'flat',
      join: { kind: 'round' },
      dash: { kind: 'custom', stops: [{ dash: 200000, space: 100000 }] },
    },
  }
  return deck
}

it.each(['headEnd', 'tailEnd'])(
  'edits and clears native %s without changing other ink or occurrence',
  (end) => {
    const initial = strokeFixture()
    initial.pptxSemantic.definitions.definition.content.geometry.style.stroke.headEnd = {
      type: 'triangle',
      w: 'sm',
    }
    initial.pptxSemantic.definitions.definition.content.geometry.style.stroke.tailEnd = {}
    const before = structuredClone(initial)
    const value = { type: 'arrow', len: 'lg' }
    const edit = (deck, nextValue) =>
      operations.applyPresentationProjectionOperation(deck, {
        type: capabilities.GEOMETRY_EDIT,
        instanceId: 'i1',
        componentId: 'geometry',
        command: { type: 'stroke-end', end, value: nextValue },
      })
    const changed = edit(initial, value)
    const stroke =
      changed.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.stroke
    expect(stroke).toEqual({
      ...initial.pptxSemantic.definitions.definition.content.geometry.style.stroke,
      [end]: value,
    })
    expect(initial).toEqual(before)
    expect(changed.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
    expect(changed.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
    const cleared = edit(JSON.parse(JSON.stringify(changed)), null)
    const expected = { ...stroke }
    delete expected[end]
    expect(
      cleared.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.stroke
    ).toEqual(expected)
    expect(
      edit(cleared, {}).pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument
        .style.stroke[end]
    ).toEqual({})
  }
)

it.each([
  { end: 'start', value: { type: 'arrow' } },
  { end: 'headEnd', value: false },
  { end: 'tailEnd', value: 'triangle' },
  { end: 'headEnd', value: [] },
  { end: 'headEnd', value: { type: 'circle' } },
  { end: 'tailEnd', value: { w: 'wide' } },
  { end: 'tailEnd', value: { len: 3 } },
  { end: 'headEnd', value: { type: 'arrow', size: 'lg' } },
  { end: 'headEnd', value: {}, extra: true },
  { end: 'tailEnd' },
])('rejects malformed native end edits atomically: %j', (patch) => {
  const initial = strokeFixture()
  const before = structuredClone(initial)
  expect(() =>
    operations.applyPresentationProjectionOperation(initial, {
      type: capabilities.GEOMETRY_EDIT,
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'stroke-end', ...patch },
    })
  ).toThrow()
  expect(initial).toEqual(before)
})

it('does not invent a native stroke for an end edit', () => {
  const initial = geometryProjectionFixture()
  const before = structuredClone(initial)
  expect(() =>
    operations.applyPresentationProjectionOperation(initial, {
      type: capabilities.GEOMETRY_EDIT,
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'stroke-end', end: 'headEnd', value: { type: 'arrow' } },
    })
  ).toThrow()
  expect(initial).toEqual(before)
})

it('edits native dash through the real projection operation without changing source or another occurrence', () => {
  const initial = strokeFixture()
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
        onUpdate={(patch) =>
          setDeck((previous) =>
            operations.applyPresentationProjectionOperation(previous, patch.pptxProjectionOperation)
          )
        }
      />
    )
  }
  render(<Harness />)
  const dashSelect = screen.getByLabelText('Native stroke dash')
  expect(dashSelect.value).toBe('custom')
  fireEvent.change(dashSelect, { target: { value: 'lgDashDot' } })
  const edited = current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument
  expect(edited.style.stroke).toEqual({
    ...initial.pptxSemantic.definitions.definition.content.geometry.style.stroke,
    dash: { kind: 'preset', value: 'lgDashDot' },
  })
  expect(
    renderers.renderSlideElements(current.slides[0], { pptxSemantic: current.pptxSemantic })
  ).toContain('stroke-dasharray="32 12 4 12"')
  expect(current.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
  expect(current.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
  fireEvent.change(dashSelect, { target: { value: 'custom' } })
  expect(
    current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.stroke
      .dash
  ).toEqual(initial.pptxSemantic.definitions.definition.content.geometry.style.stroke.dash)
})

it.each([false, null, 'dash', { kind: 'preset', value: 'unknown' }])(
  'rejects an invalid dash edit atomically: %j',
  (dash) => {
    const initial = strokeFixture()
    const before = structuredClone(initial)
    expect(() =>
      operations.applyPresentationProjectionOperation(initial, {
        type: capabilities.GEOMETRY_EDIT,
        instanceId: 'i1',
        componentId: 'geometry',
        command: { type: 'stroke-dash', dash },
      })
    ).toThrow()
    expect(initial).toEqual(before)
  }
)

it('edits native cap and join in the inspector with isolated occurrence geometry', () => {
  const initial = strokeFixture()
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
        onUpdate={(patch) =>
          setDeck((previous) =>
            operations.applyPresentationProjectionOperation(previous, patch.pptxProjectionOperation)
          )
        }
      />
    )
  }
  render(<Harness />)
  expect(screen.getByLabelText('Native stroke cap').value).toBe('flat')
  expect(screen.getByLabelText('Native stroke join').value).toBe('round')
  fireEvent.change(screen.getByLabelText('Native stroke cap'), { target: { value: 'rnd' } })
  fireEvent.change(screen.getByLabelText('Native stroke join'), { target: { value: 'bevel' } })
  expect(
    current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.stroke
  ).toEqual({
    ...initial.pptxSemantic.definitions.definition.content.geometry.style.stroke,
    cap: 'rnd',
    join: { kind: 'bevel' },
  })
  const svg = renderers.renderSlideElements(current.slides[0], {
    pptxSemantic: current.pptxSemantic,
  })
  expect(svg).toContain('stroke-linecap="round"')
  expect(svg).toContain('stroke-linejoin="bevel"')
  expect(svg).toContain('stroke-dasharray="8 4"')
  expect(current.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
  expect(current.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
})

it.each([
  [{ type: 'stroke-cap', cap: 'flat' }, 'stroke-linecap="butt"'],
  [{ type: 'stroke-cap', cap: 'rnd' }, 'stroke-linecap="round"'],
  [{ type: 'stroke-cap', cap: 'sq' }, 'stroke-linecap="square"'],
  [{ type: 'stroke-cap', cap: null }, 'stroke-linecap="square"'],
  [{ type: 'stroke-join', join: { kind: 'round' } }, 'stroke-linejoin="round"'],
  [{ type: 'stroke-join', join: { kind: 'bevel' } }, 'stroke-linejoin="bevel"'],
  [{ type: 'stroke-join', join: { kind: 'miter' } }, 'stroke-linejoin="miter"'],
  [{ type: 'stroke-join', join: { kind: 'miter', limit: 800000 } }, 'stroke-miterlimit="8"'],
  [{ type: 'stroke-join', join: { kind: 'miter', limit: 0 } }, 'stroke-linejoin="bevel"'],
  [{ type: 'stroke-join', join: null }, null],
])(
  'applies native stroke command %j without changing source or another occurrence',
  (command, ink) => {
    const initial = strokeFixture()
    const changed = operations.applyPresentationProjectionOperation(initial, {
      type: capabilities.GEOMETRY_EDIT,
      instanceId: 'i1',
      componentId: 'geometry',
      command,
    })
    const stroke =
      changed.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.stroke
    const expected = {
      ...initial.pptxSemantic.definitions.definition.content.geometry.style.stroke,
    }
    const field = command.type === 'stroke-cap' ? 'cap' : 'join'
    if (command[field] === null) delete expected[field]
    else expected[field] = command[field]
    expect(stroke).toEqual(expected)
    const svg = renderers.renderSlideElements(changed.slides[0], {
      pptxSemantic: changed.pptxSemantic,
    })
    if (ink) expect(svg).toContain(ink)
    else expect(svg).not.toContain('stroke-linejoin=')
    expect(changed.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
    expect(changed.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
  }
)

it.each([
  { type: 'stroke-cap', cap: false },
  { type: 'stroke-cap', cap: 'round' },
  { type: 'stroke-cap', cap: 'rnd', extra: true },
  { type: 'stroke-join', join: 'bevel' },
  { type: 'stroke-join', join: { kind: 'unknown' } },
  { type: 'stroke-join', join: { kind: 'bevel', extra: true } },
  { type: 'stroke-join', join: { kind: 'bevel', limit: 800000 } },
  { type: 'stroke-join', join: { kind: 'miter', limit: -1 } },
  { type: 'stroke-join', join: { kind: 'miter', limit: 2147483648 } },
  { type: 'stroke-join', join: { kind: 'miter', limit: '800000' } },
  { type: 'stroke-join', join: { kind: 'miter', limit: 1.5 } },
])('rejects invalid native stroke command atomically: %j', (command) => {
  const initial = strokeFixture()
  const before = structuredClone(initial)
  expect(() =>
    operations.applyPresentationProjectionOperation(initial, {
      type: capabilities.GEOMETRY_EDIT,
      instanceId: 'i1',
      componentId: 'geometry',
      command,
    })
  ).toThrow()
  expect(initial).toEqual(before)
})

it('edits and clears native miter limit without inventing a default or changing other ink', () => {
  const initial = strokeFixture()
  initial.pptxSemantic.definitions.definition.content.geometry.style.stroke.join = {
    kind: 'miter',
    limit: 800000,
  }
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
        onUpdate={(patch) =>
          setDeck((previous) =>
            operations.applyPresentationProjectionOperation(previous, patch.pptxProjectionOperation)
          )
        }
      />
    )
  }
  render(<Harness />)
  const limit = screen.getByLabelText('Native miter limit')
  expect(limit.value).toBe('800000')
  fireEvent.change(limit, { target: { value: '400000' } })
  const expectedStroke = {
    ...initial.pptxSemantic.definitions.definition.content.geometry.style.stroke,
    join: { kind: 'miter', limit: 400000 },
  }
  expect(
    current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.stroke
  ).toEqual(expectedStroke)
  expect(
    renderers.renderSlideElements(current.slides[0], { pptxSemantic: current.pptxSemantic })
  ).toContain('stroke-miterlimit="4"')
  const valid = current
  for (const invalid of ['-1', '1.5', '2147483648', 'NaN']) {
    fireEvent.change(limit, { target: { value: invalid } })
    expect(limit.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert')).not.toBeNull()
    expect(current).toBe(valid)
  }
  fireEvent.change(limit, { target: { value: '' } })
  expect(limit.getAttribute('aria-invalid')).toBe('false')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(
    current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.stroke
      .join
  ).toEqual({ kind: 'miter' })
  expect(current.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
  expect(current.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
  fireEvent.change(screen.getByLabelText('Native stroke join'), { target: { value: 'round' } })
  expect(screen.queryByLabelText('Native miter limit')).toBeNull()
  fireEvent.change(screen.getByLabelText('Native stroke join'), { target: { value: 'miter' } })
  expect(screen.getByLabelText('Native miter limit').value).toBe('')
})

it.each([{ elementLocked: true }, { slideLocked: true }, { selectedElementIds: ['i1', 'i2'] }])(
  'keeps native stroke controls readonly for %j',
  (guard) => {
    const deck = strokeFixture()
    deck.pptxSemantic.definitions.definition.content.geometry.style.stroke.join = {
      kind: 'miter',
      limit: 800000,
    }
    render(
      <GeometryProperties
        element={{ ...deck.slides[0].elements[0], locked: guard.elementLocked }}
        pptxSemantic={deck.pptxSemantic}
        slideLocked={guard.slideLocked}
        selectedElementIds={guard.selectedElementIds ?? ['i1']}
        onUpdate={() => {
          throw new Error('Readonly inspector must not issue operations')
        }}
      />
    )
    expect(screen.getByLabelText('Native stroke dash').disabled).toBe(true)
    expect(screen.getByLabelText('Native stroke cap').disabled).toBe(true)
    expect(screen.getByLabelText('Native stroke join').disabled).toBe(true)
    expect(screen.getByLabelText('Native miter limit').disabled).toBe(true)
  }
)
