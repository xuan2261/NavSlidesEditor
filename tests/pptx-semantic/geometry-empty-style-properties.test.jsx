// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import PropertiesPanel from '../../client/src/components/PropertiesPanel'
import CommonElementControls from '../../client/src/components/properties/common-element-controls'
import GeometryProperties from '../../client/src/components/properties/geometry-properties'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import { inheritedGeometryStyleFixture, authored } from './geometry-style-fixture'
import operations from '../../shared/src/pptx-projection-operation'
import renderers from '../../shared/src/element-renderers'

afterEach(cleanup)

function hiddenOutlineFixture() {
  const deck = geometryProjectionFixture()
  deck.pptxSemantic = inheritedGeometryStyleFixture()
  const source = deck.pptxSemantic.styles.provider.payload
  source.properties.stroke.value.color = authored({ kind: 'none' })
  source.hiddenStroke = authored({
    color: authored({ kind: 'scheme', value: 'accent1' }),
    width: authored(12700),
  })
  return deck
}
it('restores a real source-native outline through a parameterless canonical command', () => {
  const deck = hiddenOutlineFixture(),
    onUpdate = vi.fn(),
    before = structuredClone(deck)
  render(inspector(deck, onUpdate))
  fireEvent.click(screen.getByRole('button', { name: 'Restore native outline' }))
  const command = onUpdate.mock.calls[0][0].pptxProjectionOperation
  expect(command.command).toEqual({ type: 'stroke-restore' })
  const next = operations.applyPresentationProjectionOperation(deck, command)
  expect(
    renderers.renderSlideElements(next.slides[0], { pptxSemantic: next.pptxSemantic })
  ).toContain('stroke:#FF0000')
  expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  expect(next.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
})
it.each(['element', 'slide', 'multiple'])(
  'disables source-native outline restoration for %s',
  (guard) => {
    const deck = hiddenOutlineFixture(),
      onUpdate = vi.fn()
    if (guard === 'element') deck.slides[0].elements[0].locked = true
    render(
      inspector(deck, onUpdate, {
        slideLocked: guard === 'slide',
        selectedElementIds: guard === 'multiple' ? ['i1', 'i2'] : ['i1'],
      })
    )
    const button = screen.getByRole('button', { name: 'Restore native outline' })
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onUpdate).not.toHaveBeenCalled()
  }
)
it('does not offer guessed outline paint with no native restoration candidate', () => {
  const onUpdate = vi.fn()
  render(inspector(emptyStyleFixture(), onUpdate))
  expect(screen.queryByRole('button', { name: 'Restore native outline' })).toBeNull()
  expect(onUpdate).not.toHaveBeenCalled()
})

function emptyStyleFixture() {
  const deck = structuredClone(geometryProjectionFixture())
  deck.pptxSemantic.definitions.definition.content.geometry.style = {
    fill: { color: { kind: 'srgb', value: '123456' } },
    stroke: { color: { kind: 'none' } },
    effects: { kind: 'list', effects: [] },
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

it.each([1, 2])('hides legacy shadows for inherited source geometry version %s', (version) => {
  const deck = geometryProjectionFixture()
  deck.pptxSemantic = inheritedGeometryStyleFixture()
  if (version === 2) {
    const source = deck.pptxSemantic.definitions.definition.content.geometry
    source.schemaVersion = 2
    delete source.width
    delete source.height
  }
  render(
    <PropertiesPanel
      presentation={deck}
      slide={deck.slides[0]}
      selectedElement={deck.slides[0].elements[0]}
      selectedElementIds={['i1']}
      onUpdateElement={vi.fn()}
    />
  )
  for (const label of [
    'Shadow horizontal offset',
    'Shadow vertical offset',
    'Shadow blur',
    'Shadow color',
  ])
    expect(screen.queryByLabelText(label)).toBeNull()
  expect(screen.getByLabelText('Native stroke cap').value).toBe('rnd')
  expect(screen.getByRole('button', { name: 'Remove native shadow' }).disabled).toBe(false)
  expect(screen.queryByLabelText('Shape kind')).toBeNull()
  expect(screen.queryByLabelText('Shape corner radius')).toBeNull()
})

it.each([1, 2])(
  'hides mixed legacy shadows when an inherited provider has geometry version %s',
  (version) => {
    const deck = geometryProjectionFixture()
    deck.pptxSemantic = inheritedGeometryStyleFixture()
    if (version === 2) {
      const source = deck.pptxSemantic.definitions.definition.content.geometry
      source.schemaVersion = 2
      delete source.width
      delete source.height
    }
    const ordinary = { id: 'ordinary', type: 'shape', x: 0, y: 0, width: 100, height: 80 }
    render(
      <CommonElementControls
        element={ordinary}
        elements={[ordinary, deck.slides[0].elements[0]]}
        selectedElementIds={['ordinary', 'i1']}
        pptxSemantic={deck.pptxSemantic}
        onUpdate={vi.fn()}
      />
    )
    expect(screen.queryByLabelText('Shadow horizontal offset')).toBeNull()
  }
)

it('routes the full native geometry panel away from legacy shadow cache controls', () => {
  const deck = emptyStyleFixture()
  render(
    <PropertiesPanel
      presentation={deck}
      slide={deck.slides[0]}
      selectedElement={deck.slides[0].elements[0]}
      selectedElementIds={['i1']}
      onUpdateElement={vi.fn()}
    />
  )
  for (const label of [
    'Shadow horizontal offset',
    'Shadow vertical offset',
    'Shadow blur',
    'Shadow color',
  ])
    expect(screen.queryByLabelText(label)).toBeNull()
  expect(screen.getByRole('button', { name: 'Add native shadow' }).disabled).toBe(false)
})

it('does not expose legacy shadows for a mixed selection containing native geometry', () => {
  const deck = emptyStyleFixture()
  const legacy = { ...deck.slides[0].elements[0], id: 'legacy', pptxInstanceId: undefined }
  render(
    <CommonElementControls
      element={legacy}
      elements={[legacy, deck.slides[0].elements[0]]}
      selectedElementIds={['legacy', 'i1']}
      pptxSemantic={deck.pptxSemantic}
      onUpdate={vi.fn()}
    />
  )
  expect(screen.queryByLabelText('Shadow horizontal offset')).toBeNull()
})

it('keeps ordinary element shadow editing available', () => {
  const element = { id: 'ordinary', type: 'shape', x: 0, y: 0, width: 100, height: 80 }
  const onUpdate = vi.fn()
  render(<CommonElementControls element={element} onUpdate={onUpdate} />)
  fireEvent.change(screen.getByLabelText('Shadow horizontal offset'), { target: { value: '12' } })
  expect(onUpdate).toHaveBeenCalledWith({ shadowX: 12 })
})

it('adds a canonical shadow without manufacturing an omitted outline width', () => {
  const initial = emptyStyleFixture()
  const before = structuredClone(initial)
  const onUpdate = vi.fn()
  render(inspector(initial, onUpdate))
  fireEvent.click(screen.getByRole('button', { name: 'Add native shadow' }))
  const operation = onUpdate.mock.calls[0][0].pptxProjectionOperation
  expect(operation.command).toEqual({
    type: 'outer-shadow',
    shadow: {
      kind: 'outerShdw',
      blurRad: 38100,
      dist: 152400,
      dir: 5400000,
      color: { kind: 'srgb', value: '000000', transforms: [{ kind: 'alpha', value: 50000 }] },
    },
  })
  const edited = operations.applyPresentationProjectionOperation(initial, operation)
  const style =
    edited.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style
  expect(style.stroke).toEqual({ color: { kind: 'none' } })
  expect(style.fill).toEqual(before.pptxSemantic.definitions.definition.content.geometry.style.fill)
  expect(style.effects).toEqual({ kind: 'list', effects: [operation.command.shadow] })
  expect(edited.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(edited.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(initial).toEqual(before)
  const html = renderers.renderSlideElements(edited.slides[0], {
    pptxSemantic: edited.pptxSemantic,
  })
  expect(html).toContain('data-pptx-geometry-shadow=')
  expect(html).toContain('stroke:none;')
  expect(html).not.toContain('<image')
})

it('clears a native outline while retaining its authored width and other styles', () => {
  const initial = emptyStyleFixture()
  initial.pptxSemantic.definitions.definition.content.geometry.style.stroke = {
    color: { kind: 'srgb', value: '654321' },
    width: 38100,
    cap: 'sq',
    dash: { kind: 'preset', value: 'dashDot' },
  }
  const before = structuredClone(initial)
  const onUpdate = vi.fn()
  render(inspector(initial, onUpdate))
  fireEvent.click(screen.getByRole('button', { name: 'Remove native outline' }))
  const operation = onUpdate.mock.calls[0][0].pptxProjectionOperation
  expect(operation.command).toEqual({
    type: 'stroke-paint',
    color: { kind: 'none' },
    width: 38100,
  })
  const edited = operations.applyPresentationProjectionOperation(initial, operation)
  const style =
    edited.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style
  expect(style.stroke).toEqual({
    ...before.pptxSemantic.definitions.definition.content.geometry.style.stroke,
    color: { kind: 'none' },
  })
  expect(style.fill).toEqual(before.pptxSemantic.definitions.definition.content.geometry.style.fill)
  expect(style.effects).toEqual({ kind: 'list', effects: [] })
  expect(edited.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(edited.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(initial).toEqual(before)
  const html = renderers.renderSlideElements(edited.slides[0], {
    pptxSemantic: edited.pptxSemantic,
  })
  expect(html).toContain('stroke:none;')
  expect(html).not.toContain('<filter')
})

it.each(['element', 'slide', 'multiple'])(
  'guards canonical add/clear style actions for %s',
  (guard) => {
    const deck = emptyStyleFixture()
    deck.pptxSemantic.definitions.definition.content.geometry.style.stroke = {
      color: { kind: 'srgb', value: '654321' },
      width: 38100,
    }
    if (guard === 'element') deck.slides[0].elements[0].locked = true
    const onUpdate = vi.fn()
    render(
      inspector(deck, onUpdate, {
        slideLocked: guard === 'slide',
        selectedElementIds: guard === 'multiple' ? ['i1', 'i2'] : ['i1'],
      })
    )
    for (const name of ['Add native shadow', 'Remove native outline']) {
      const button = screen.getByRole('button', { name })
      expect(button.disabled).toBe(true)
      fireEvent.click(button)
    }
    expect(onUpdate).not.toHaveBeenCalled()
  }
)

it('does not offer shadow replacement for retained opaque effects', () => {
  const deck = emptyStyleFixture()
  deck.pptxSemantic.definitions.definition.content.geometry.style.effects = [
    { kind: 'outerShadow' },
  ]
  render(inspector(deck, vi.fn()))
  expect(screen.queryByRole('button', { name: 'Add native shadow' })).toBeNull()
})
