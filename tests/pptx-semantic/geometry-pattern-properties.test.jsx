// @vitest-environment jsdom
import React, { useLayoutEffect, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import GeometryProperties from '../../client/src/components/properties/geometry-properties'
import operations from '../../shared/src/pptx-projection-operation.js'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { authored, inheritedGeometryStyleFixture } from './geometry-style-fixture.js'

afterEach(cleanup)
function mountPattern(guard = null) {
  const initial = {
    ...geometryProjectionFixture(),
    pptxSemantic: inheritedGeometryStyleFixture(),
  }
  initial.pptxSemantic.styles.provider.payload.properties.fill = authored({
    pattern: authored({
      preset: authored('pct25'),
      foreground: authored({
        kind: 'scheme',
        value: 'accent1',
        transforms: [authored({ kind: 'alpha', value: 50000 })],
      }),
      background: authored({ kind: 'scrgb', value: { r: 50000, g: 25000, b: 10000 } }),
    }),
  })
  const commands = []
  let current
  function Harness() {
    const [deck, setDeck] = useState(initial)
    useLayoutEffect(() => {
      current = deck
    }, [deck])
    return (
      <GeometryProperties
        element={{ ...deck.slides[0].elements[0], locked: guard === 'element' }}
        pptxSemantic={deck.pptxSemantic}
        slideLocked={guard === 'slide'}
        selectedElementIds={guard === 'multiple' ? ['i1', 'i2'] : ['i1']}
        onUpdate={(patch) => {
          const next = operations.applyPresentationProjectionOperation(
            deck,
            patch.pptxProjectionOperation
          )
          commands.push(patch.pptxProjectionOperation.command)
          setDeck(next)
        }}
      />
    )
  }
  render(<Harness />)
  return { initial, commands, getCurrent: () => current }
}

it('edits only requested pattern parameters with source and sibling preserved', () => {
  const harness = mountPattern()
  const before = structuredClone(harness.initial)
  const preset = screen.getByLabelText('Native pattern preset')
  expect(preset.disabled).toBe(false)
  expect(preset.options.length).toBe(55)
  fireEvent.change(preset, { target: { value: 'wave' } })
  expect(harness.commands[0]).toEqual({ type: 'fill-pattern', pattern: { preset: 'wave' } })
  expect(harness.getCurrent().pptxSemantic.instances.i1.overrides.components.geometry).toEqual({
    geometryStyle: { fill: { pattern: { preset: 'wave' } } },
  })
  fireEvent.change(screen.getByLabelText('Pattern foreground RGB'), { target: { value: '123456' } })
  fireEvent.change(screen.getByLabelText('Pattern background red (1/1000%)'), {
    target: { value: '125000' },
  })
  const current = harness.getCurrent()
  expect(styles.materializeGeometry(current.pptxSemantic, 'i1').style.fill.pattern).toEqual({
    preset: 'wave',
    foreground: { kind: 'srgb', value: '123456', transforms: [{ kind: 'alpha', value: 50000 }] },
    background: { kind: 'scrgb', value: { r: 125000, g: 25000, b: 10000 } },
  })
  expect(current.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(current.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  expect(current.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(harness.initial).toEqual(before)
})

it('makes optional fields absent without seeding hidden source defaults', () => {
  const harness = mountPattern()
  fireEvent.change(screen.getByLabelText('Native pattern preset'), { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Remove foreground color' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove background color' }))
  expect(
    styles.materializeGeometry(harness.getCurrent().pptxSemantic, 'i1').style.fill.pattern
  ).toEqual({})
  expect(harness.commands).toEqual([
    { type: 'fill-pattern', pattern: { preset: null } },
    { type: 'fill-pattern', pattern: { foreground: null } },
    { type: 'fill-pattern', pattern: { background: null } },
  ])
  fireEvent.click(screen.getByRole('button', { name: 'Add foreground color' }))
  expect(harness.commands.at(-1)).toEqual({
    type: 'fill-pattern',
    pattern: { foreground: { kind: 'srgb', value: '000000' } },
  })
})

it.each([
  ['Pattern foreground RGB', 'bad'],
  ['Pattern background red (1/1000%)', '1.5'],
  ['Pattern background green (1/1000%)', '2147483648'],
])('retains invalid draft %s without emitting a command', (label, value) => {
  const harness = mountPattern()
  const before = JSON.stringify(harness.getCurrent())
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(harness.commands).toEqual([])
  expect(JSON.stringify(harness.getCurrent())).toBe(before)
  fireEvent.click(screen.getByRole('button', { name: 'Discard invalid draft' }))
  expect(screen.queryByRole('alert')).toBeNull()
})

it.each(['element', 'slide', 'multiple'])('guards pattern controls for %s', (guard) => {
  const harness = mountPattern(guard)
  for (const label of [
    'Native pattern preset',
    'Pattern foreground RGB',
    'Pattern background red (1/1000%)',
  ]) {
    const input = screen.getByLabelText(label)
    expect(input.disabled).toBe(true)
    fireEvent.change(input, { target: { value: label === 'Native pattern preset' ? 'wave' : '1' } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Remove foreground color' }))
  expect(harness.commands).toEqual([])
})
