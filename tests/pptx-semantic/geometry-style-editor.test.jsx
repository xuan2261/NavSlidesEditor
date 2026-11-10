// @vitest-environment jsdom
import React, { useLayoutEffect, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import themeConfig from '../../client/tailwind.config.js'
import GeometryProperties from '../../client/src/components/properties/geometry-properties.jsx'
import {
  applySemanticGeometry,
  semanticCompatibility,
  semanticElement,
} from '../../client/src/utils/pptx-semantic-geometry-bridge.js'
import operations from '../../shared/src/pptx-projection-operation.js'
import resolution from '../../shared/src/pptx-geometry-style-resolution.js'
import semanticDocument from '../../shared/src/pptx-semantic-document.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { authored, inheritedGeometryStyleFixture } from './geometry-style-fixture.js'

afterEach(cleanup)
const fixture = () => ({
  ...geometryProjectionFixture(),
  pptxSemantic: inheritedGeometryStyleFixture(),
})
describe('native geometry color editor intent', () => {
  const colors = [
    [
      {
        kind: 'scrgb',
        value: { r: 50000, g: 25000, b: 10000 },
        transforms: [{ kind: 'alpha', value: 50000 }],
      },
      'red (1/1000%)',
      '75000',
      { r: 75000, g: 25000, b: 10000 },
    ],
    [
      {
        kind: 'hsl',
        value: { hue: 12600000, sat: 50000, lum: 40000 },
        transforms: [{ kind: 'alpha', value: 50000 }],
      },
      'hue (1/60000 deg)',
      '10800000',
      { hue: 10800000, sat: 50000, lum: 40000 },
    ],
    [
      { kind: 'preset', value: 'cornflowerBlue', transforms: [{ kind: 'alpha', value: 50000 }] },
      'preset',
      'tomato',
      'tomato',
    ],
  ]
  function mountColor(color, scope = 'fill', guard = null) {
    const initial = fixture()
    initial.pptxSemantic.styles.theme.payload.colors.accent2 = authored(
      {
        ...color,
        transforms: color.transforms.map((transform) =>
          authored(transform, 'ppt/theme/theme1.xml')
        ),
      },
      'ppt/theme/theme1.xml'
    )
    if (scope === 'gradient') {
      initial.pptxSemantic.instances.i1.overrides.components = {
        geometry: {
          geometryStyle: {
            fill: {
              gradient: {
                kind: 'linear',
                angle: 0,
                scaled: true,
                rotWithShape: true,
                stops: [
                  { pos: 0, color },
                  { pos: 100000, color: { kind: 'srgb', value: 'FFFFFF' } },
                ],
              },
            },
          },
        },
      }
    }
    semanticDocument.normalizePptxSemanticDocument(initial.pptxSemantic)
    let current = initial
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
          onUpdate={(patch) =>
            setDeck(
              operations.applyPresentationProjectionOperation(
                current,
                patch.pptxProjectionOperation
              )
            )
          }
        />
      )
    }
    render(<Harness />)
    return { initial, current: () => current }
  }
  it.each(
    colors.flatMap((color) =>
      ['fill', 'stroke', 'gradient', 'shadow'].map((scope) => [scope, ...color])
    )
  )('edits %s %j with transforms and source untouched', (scope, color, field, value, expected) => {
    const state = mountColor(color, scope)
    const before = structuredClone(state.initial)
    const prefix = {
      fill: 'Native fill',
      stroke: 'Native stroke',
      gradient: 'Gradient stop 1',
      shadow: 'Native shadow',
    }[scope]
    const input = screen.getByLabelText(`${prefix} ${field}`)
    expect(input.disabled).toBe(false)
    expect(input.value).toBe(
      String(
        typeof color.value === 'object'
          ? color.value[color.kind === 'scrgb' ? 'r' : 'hue']
          : color.value
      )
    )
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    fireEvent.change(input, { target: { value } })
    const next = state.current()
    const style = resolution.materializeGeometry(next.pptxSemantic, 'i1').style
    const updated =
      scope === 'gradient'
        ? style.fill.gradient.stops[0].color
        : scope === 'shadow'
          ? style.effects.effects[0].color
          : style[scope].color
    expect(updated).toEqual({ ...color, value: expected })
    if (scope === 'stroke') {
      expect(
        next.pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.stroke
      ).toEqual({
        color: { ...color, value: expected },
      })
    }
    expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(next.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })
  it.each(
    ['element', 'slide', 'multiple'].flatMap((guard) => colors.map((color) => [guard, ...color]))
  )('keeps native color readonly under %s for %j', (guard, color, field) => {
    const state = mountColor(color, 'fill', guard)
    const input = screen.getByLabelText(`Native fill ${field}`)
    expect(input.disabled).toBe(true)
    fireEvent.change(input, { target: { value: color.kind === 'preset' ? 'tomato' : '1' } })
    expect(state.current()).toEqual(state.initial)
  })
  it.each(['1.5', '2147483648', '-2147483649', ''])(
    'keeps invalid integer draft %s out of the document and permits correction',
    (draft) => {
      const state = mountColor(colors[0][0])
      const before = structuredClone(state.initial)
      const input = screen.getByLabelText('Native fill red (1/1000%)')
      fireEvent.change(input, { target: { value: draft } })
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(state.current()).toEqual(before)
      fireEvent.change(input, { target: { value: '75000' } })
      expect(input.getAttribute('aria-invalid')).toBe('false')
      expect(screen.queryByRole('alert')).toBeNull()
    }
  )
})
describe('inherited geometry editor intent', () => {
  it('accepts round compound caps and reports coordinate rejection without losing state', async () => {
    const initial = fixture()
    const source = initial.pptxSemantic.definitions.definition.content.geometry
    source.width = 952500
    source.height = 762000
    Object.assign(source.paths[0], {
      width: 100,
      height: 80,
      commands: [
        { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
        { kind: 'lnTo', points: [{ componentId: 'control', x: 100, y: 0 }] },
        { kind: 'lnTo', points: [{ componentId: 'second', x: 100, y: 80 }] },
        { kind: 'lnTo', points: [{ componentId: 'end', x: 0, y: 80 }] },
        { kind: 'close' },
      ],
    })
    const provider = initial.pptxSemantic.styles.provider.payload
    provider.transform.value.ext = authored({
      cx: authored(952500),
      cy: authored(762000),
    })
    Object.assign(provider.properties.stroke.value, {
      cap: authored('flat'),
      compound: authored('tri'),
      alignment: authored('in'),
      dash: authored({ kind: 'preset', value: 'solid' }),
      join: authored({ kind: 'miter', limit: authored(800000) }),
    })
    let current = initial
    function Harness({ selected = 'i1' }) {
      const [deck, setDeck] = useState(initial)
      useLayoutEffect(() => {
        current = deck
      }, [deck])
      return (
        <GeometryProperties
          element={deck.slides[selected === 'i1' ? 0 : 1].elements[0]}
          pptxSemantic={deck.pptxSemantic}
          selectedElementIds={[selected]}
          onUpdate={(patch) => {
            const next = operations.applyPresentationProjectionOperation(
              current,
              patch.pptxProjectionOperation
            )
            setDeck(next)
          }}
        />
      )
    }
    const mounted = render(<Harness />)
    const before = structuredClone(initial)
    expect(resolution.materializeGeometry(initial.pptxSemantic, 'i1').style.stroke).toMatchObject({
      cap: 'flat',
      compound: 'tri',
      alignment: 'in',
    })
    const rounded = operations.applyPresentationProjectionOperation(initial, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'stroke-cap', cap: 'rnd' },
    })
    expect(resolution.materializeGeometry(rounded.pptxSemantic, 'i1').style.stroke.cap).toBe('rnd')
    expect(() =>
      operations.applyPresentationProjectionOperation(initial, {
        type: 'geometry.edit',
        instanceId: 'i1',
        componentId: 'geometry',
        command: { type: 'control-point', componentId: 'start', x: 1000000000000001 },
      })
    ).toThrow(TypeError)
    fireEvent.change(screen.getByLabelText('Geometry point X'), {
      target: { value: '1000000000000001' },
    })
    expect(screen.getByRole('alert')).toBeTruthy()
    const alertCss = await postcss([
      tailwindcss({
        ...themeConfig,
        content: [{ raw: screen.getByRole('alert').outerHTML, extension: 'html' }],
      }),
    ]).process('@tailwind utilities;', { from: undefined })
    const alertBackgrounds = []
    alertCss.root.walkDecls('background-color', (declaration) =>
      alertBackgrounds.push(declaration.value)
    )
    expect(alertBackgrounds).toEqual(['var(--bg-secondary)'])
    expect(screen.getByLabelText('Native stroke cap').value).toBe('flat')
    expect(current).toEqual(before)
    mounted.rerender(<Harness selected="i2" />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('Geometry point X').value).toBe('0')
    mounted.rerender(<Harness />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('Geometry point X').value).toBe('0')
    fireEvent.change(screen.getByLabelText('Geometry point X'), {
      target: { value: '1000000000000001' },
    })
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Geometry point X'), { target: { value: '5' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.paths[0]
        .commands[0].points[0].x
    ).toBe(5)
    expect(current.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(current.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(current.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  })
  it('offers native controls on a source template and persists only intentional cap editing', () => {
    const initial = fixture()
    const source = initial.pptxSemantic.definitions.definition.content.geometry
    source.schemaVersion = 2
    delete source.width
    delete source.height
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
    expect(screen.getByLabelText('Native stroke cap').value).toBe('rnd')
    fireEvent.change(screen.getByLabelText('Native stroke cap'), { target: { value: 'flat' } })
    expect(current.pptxSemantic.instances.i1.overrides.components.geometry).toEqual({
      geometryStyle: { stroke: { cap: 'flat' } },
    })
    expect(current.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
    expect(current.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
    expect(current.pptxSemantic.definitions.definition.content.geometry).not.toHaveProperty('width')
  })
  it('shows the provider native controls and stores only the selected cap override', () => {
    const initial = fixture()
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
    expect(screen.getByLabelText('Native stroke cap').value).toBe('rnd')
    fireEvent.change(screen.getByLabelText('Native stroke cap'), { target: { value: 'flat' } })
    expect(current.pptxSemantic.instances.i1.overrides.components.geometry).toEqual({
      geometryStyle: { stroke: { cap: 'flat' } },
    })
    expect(current.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
    expect(current.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
  })
  it.each(['element', 'slide', 'multiple'])(
    'keeps inherited native controls readonly for %s guards',
    (guard) => {
      const initial = fixture()
      render(
        <GeometryProperties
          element={{ ...initial.slides[0].elements[0], locked: guard === 'element' }}
          pptxSemantic={initial.pptxSemantic}
          slideLocked={guard === 'slide'}
          selectedElementIds={guard === 'multiple' ? ['i1', 'i2'] : ['i1']}
          onUpdate={() => {
            throw new Error('Readonly inherited style edit')
          }}
        />
      )
      expect(screen.getByLabelText('Native stroke cap').disabled).toBe(true)
      expect(screen.getByLabelText('Native stroke dash').disabled).toBe(true)
    }
  )
  it('routes generic fill and stroke updates to sparse declarations instead of compatibility-only edits', () => {
    const initial = fixture()
    const next = applySemanticGeometry(initial.pptxSemantic, initial.slides[0], [
      { id: 'i1', fill: '#654321', stroke: '#2468AC', strokeWidth: 4 },
    ])
    expect(next.instances.i1.overrides.components.geometry).toEqual({
      geometryStyle: {
        fill: { color: { kind: 'srgb', value: '654321' } },
        stroke: { color: { kind: 'srgb', value: '2468AC' }, width: 38100 },
      },
    })
    expect(next.definitions).toEqual(initial.pptxSemantic.definitions)
    expect(next.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
  })
  it('does not convert inherited stroke color into an override when only width changes', () => {
    const initial = fixture()
    const next = applySemanticGeometry(initial.pptxSemantic, initial.slides[0], [
      { id: 'i1', strokeWidth: 8 },
    ])
    expect(next.instances.i1.overrides.components.geometry).toEqual({
      geometryStyle: { stroke: { width: 76200 } },
    })
    const changed = structuredClone(next)
    changed.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent2: { kind: 'srgb', value: '0000FF' } } },
    }
    expect(resolution.materializeGeometry(changed, 'i1').style.stroke.color.value).toBe('0000FF')
  })
  it('uses inherited native extent for selection without replacing authored zero', () => {
    const initial = fixture()
    initial.pptxSemantic.styles.provider.payload.transform.value.ext.value.cx.value = 0
    const element = semanticElement(initial.pptxSemantic, 'i1', initial.slides[0].elements[0])
    expect(element.width).toBe(0)
    expect(element.height).toBe(80 / 9525)
  })
  it('recomputes compatibility paint even when the editable occurrence placement is unchanged', () => {
    const initial = fixture()
    const next = applySemanticGeometry(initial.pptxSemantic, initial.slides[0], [
      { id: 'i1', fill: '#654321' },
    ])
    const slide = semanticCompatibility(next, initial.slides[0], initial.pptxSemantic)
    expect(slide.elements[0].fill).toBe('#654321')
    expect(slide.elements[0].stroke).toBe('#FF0000')
    expect(slide.elements[0].x).toBe(initial.slides[0].elements[0].x)
  })
})
