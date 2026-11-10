// @vitest-environment jsdom
import React, { useLayoutEffect, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import GeometryProperties from '../../client/src/components/properties/geometry-properties'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import { authored, inheritedGeometryStyleFixture } from './geometry-style-fixture'
import operations from '../../shared/src/pptx-projection-operation'
import resolution from '../../shared/src/pptx-geometry-style-resolution'
import { normalizeSemanticPresentation } from '../../shared/src/pptx-semantic-presentation'

afterEach(cleanup)
const label = 'Native effect program'
const wrapped = ({ kind, effects, ...fields }) => ({
  kind,
  ...(effects ? { effects: effects.map((node) => authored(wrapped(node))) } : {}),
  ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, authored(value)])),
})
function fixture(schema) {
  const deck = geometryProjectionFixture()
  const program = {
    kind: 'dag',
    type: 'sib',
    effects: [
      { kind: 'effect', ref: 'later' },
      {
        kind: 'cont',
        name: 'later',
        type: 'tree',
        effects: [
          {
            kind: 'glow',
            rad: 0,
            color:
              schema === 2
                ? { kind: 'scheme', value: 'accent1' }
                : { kind: 'srgb', value: '123456' },
          },
          { kind: 'reflection', dist: 0, stA: 0, rotWithShape: false },
        ],
      },
    ],
  }
  if (schema === 2) {
    deck.pptxSemantic = inheritedGeometryStyleFixture()
    deck.pptxSemantic.styles.provider.payload.properties.effects = authored(wrapped(program))
  } else deck.pptxSemantic.definitions.definition.content.geometry.style = { effects: program }
  return { deck: normalizeSemanticPresentation(deck), program }
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
function mount(initial) {
  let current = initial
  const emitted = []
  function Harness() {
    const [deck, setDeck] = useState(initial)
    useLayoutEffect(() => {
      current = deck
    }, [deck])
    return inspector(deck, (patch) => {
      const next = operations.applyPresentationProjectionOperation(
        current,
        patch.pptxProjectionOperation
      )
      emitted.push(patch.pptxProjectionOperation)
      setDeck(next)
    })
  }
  render(<Harness />)
  return { current: () => current, emitted }
}
const programOf = (deck) =>
  deck.pptxSemantic.schemaVersion === 2
    ? resolution.resolveGeometryStyle(deck.pptxSemantic, 'i1').properties.effects.authored
    : resolution.materializeGeometry(deck.pptxSemantic, 'i1').style.effects
const edit = (value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

it.each([1, 2])(
  'edits the authored schema %s program without replacing sibling effects or source',
  (schema) => {
    const { deck, program } = fixture(schema)
    const before = structuredClone(deck)
    const state = mount(deck)
    expect(JSON.parse(screen.getByLabelText(label).value)).toEqual(program)
    expect(
      screen.queryByRole('button', { name: /Add (?:native )?(?:glow|shadow|blur|soft edge)/ })
    ).toBeNull()
    const next = structuredClone(program)
    next.effects[1].effects[1].dist = 9525
    edit(JSON.stringify(next))
    expect(state.emitted).toEqual([
      {
        type: 'geometry.edit',
        instanceId: 'i1',
        componentId: 'geometry',
        command: { type: 'effects', effects: next },
      },
    ])
    expect(programOf(state.current())).toEqual(next)
    expect(
      programOf(normalizeSemanticPresentation(JSON.parse(JSON.stringify(state.current()))))
    ).toEqual(next)
    expect(state.current().pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(state.current().pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(state.current().pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    expect(state.current().slides[1]).toEqual(before.slides[1])
    expect(deck).toEqual(before)
  }
)

it.each(['{', JSON.stringify({ kind: 'dag', effects: [{ kind: 'effect', ref: 'absent' }] })])(
  'keeps invalid program draft local and lets Discard restore the actual program: %s',
  (raw) => {
    const { deck, program } = fixture(2)
    const state = mount(deck)
    edit(raw)
    fireEvent.blur(screen.getByLabelText(label))
    expect(screen.getByLabelText(label).value).toBe(raw)
    expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText(label).getAttribute('aria-describedby')).toBeTruthy()
    expect(state.current()).toBe(deck)
    expect(state.emitted).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Discard effect program draft' }))
    expect(JSON.parse(screen.getByLabelText(label).value)).toEqual(program)
    expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBe('false')
  }
)

it.each([{ slideLocked: true }, { selectedElementIds: ['i1', 'i2'] }])(
  'does not dispatch from a readonly program inspector: %j',
  (extra) => {
    const { deck } = fixture(2)
    const update = vi.fn()
    render(inspector(deck, update, extra))
    expect(screen.getByLabelText(label).disabled).toBe(true)
    edit('null')
    expect(update).not.toHaveBeenCalled()
  }
)

it('clears a program explicitly instead of restoring inherited source effects', () => {
  const { deck } = fixture(2)
  const state = mount(deck)
  edit('null')
  expect(state.emitted.at(-1).command).toEqual({ type: 'effects', effects: null })
  expect(programOf(state.current())).toEqual({ kind: 'list', effects: [] })
})
