// @vitest-environment jsdom
import React, { useLayoutEffect, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import GeometryProperties from '../../client/src/components/properties/geometry-properties'
import operations from '../../shared/src/pptx-projection-operation.js'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { authored, styleLocation, inheritedGeometryStyleFixture } from './geometry-style-fixture.js'
afterEach(cleanup)
function mountBlip(guard = null) {
  const initial = { ...geometryProjectionFixture(), pptxSemantic: inheritedGeometryStyleFixture() }
  const owner = 'ppt/slideLayouts/slideLayout1.xml'
  initial.pptxSemantic.styles.imageBinding = {
    kind: 'geometry-blip-binding',
    origin: 'source',
    source: styleLocation(owner, [0, 0, 0]),
    payload: {
      edge: {
        fromPartUri: owner,
        toPartUri: 'ppt/media/source.png',
        relationshipId: 'imageOne',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        source: styleLocation('ppt/slideLayouts/_rels/slideLayout1.xml.rels'),
      },
      asset: {
        partUri: 'ppt/media/source.png',
        preconditionHash: 'b'.repeat(64),
        byteLength: 68,
        src: '/uploads/source.png',
        width: 1,
        height: 1,
        format: 'png',
      },
    },
  }
  initial.pptxSemantic.styles.provider.payload.properties.fill = authored({
    blip: authored({
      embed: authored('imageOne'),
      bindingId: 'imageBinding',
      dpi: authored(96),
      srcRect: authored({ l: authored(10000) }),
      tile: authored({}),
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
it('edits native image parameters without freezing inherited defaults or source media', () => {
  const harness = mountBlip()
  fireEvent.change(screen.getByLabelText('Native image crop left (1/1000%)'), {
    target: { value: '25000' },
  })
  fireEvent.change(screen.getByLabelText('Native image rotate with shape'), {
    target: { value: 'false' },
  })
  fireEvent.change(screen.getByLabelText('Native image placement'), {
    target: { value: 'stretch' },
  })
  expect(harness.commands).toEqual([
    { type: 'fill-blip', blip: { srcRect: { l: 25000 } } },
    { type: 'fill-blip', blip: { rotWithShape: false } },
    { type: 'fill-blip', blip: { tile: null, stretch: {} } },
  ])
  const document = harness.getCurrent().pptxSemantic
  expect(styles.materializeGeometry(document, 'i1').style.fill.blip).toEqual({
    bindingId: 'imageBinding',
    dpi: 96,
    srcRect: { l: 25000 },
    rotWithShape: false,
    stretch: {},
  })
  expect(document.styles).toEqual(harness.initial.pptxSemantic.styles)
  expect(document.definitions).toEqual(harness.initial.pptxSemantic.definitions)
  expect(document.instances.i2).toEqual(harness.initial.pptxSemantic.instances.i2)
})
it('removes optional authored values with tombstones and preserves unspecified placement', () => {
  const harness = mountBlip()
  fireEvent.change(screen.getByLabelText('Native image DPI'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Native image placement'), { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Remove source crop' }))
  expect(
    styles.materializeGeometry(harness.getCurrent().pptxSemantic, 'i1').style.fill.blip
  ).toEqual({
    bindingId: 'imageBinding',
  })
  expect(harness.commands).toEqual([
    { type: 'fill-blip', blip: { dpi: null } },
    { type: 'fill-blip', blip: { tile: null, stretch: null } },
    { type: 'fill-blip', blip: { srcRect: null } },
  ])
})
it.each(['12.5', '4294967296'])(
  'retains invalid image numeric draft %s without writes',
  (value) => {
    const harness = mountBlip()
    const before = JSON.stringify(harness.getCurrent())
    const input = screen.getByLabelText('Native image DPI')
    fireEvent.change(input, { target: { value } })
    fireEvent.blur(input)
    expect(input.value).toBe(value)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(harness.commands).toEqual([])
    expect(JSON.stringify(harness.getCurrent())).toBe(before)
    fireEvent.click(screen.getByRole('button', { name: 'Discard invalid draft' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(input.value).toBe('96')
  }
)
it.each(['element', 'slide', 'multiple'])('guards native image controls for %s', (guard) => {
  const harness = mountBlip(guard)
  for (const label of [
    'Native image DPI',
    'Native image crop left (1/1000%)',
    'Native image placement',
  ]) {
    const input = screen.getByLabelText(label)
    expect(input.disabled).toBe(true)
    fireEvent.change(input, {
      target: { value: label === 'Native image placement' ? 'stretch' : '25000' },
    })
  }
  expect(harness.commands).toEqual([])
})
