import { describe, expect, it } from 'vitest'
import operation from '../../shared/src/pptx-projection-operation.js'
import capabilities from '../../shared/src/pptx-projection-capabilities.js'
import presentationModule from '../../shared/src/pptx-semantic-presentation.js'
import renderModule from '../../shared/src/pptx-semantic-render-tree.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { authored, inheritedGeometryStyleFixture } from './geometry-style-fixture.js'

const fixture = () => ({
  ...geometryProjectionFixture(),
  pptxSemantic: inheritedGeometryStyleFixture(),
})
const apply = (presentation, command) =>
  operation.applyPresentationProjectionOperation(presentation, {
    type: capabilities.GEOMETRY_EDIT,
    instanceId: 'i1',
    componentId: 'geometry',
    command,
  })
describe('linked geometry command intent and consumers', () => {
  it.each([
    ['schema-1', geometryProjectionFixture],
    ['linked schema-2', fixture],
  ])('reopens %s geometry alongside an ordinary editable sibling', (_label, create) => {
    const deck = create()
    const sibling = { id: 'ordinary-text', type: 'text', content: '<p>Unlinked sibling</p>' }
    deck.slides[0].elements.push(sibling)
    const before = structuredClone(deck)
    const reopened = presentationModule.normalizeSemanticPresentation(JSON.parse(JSON.stringify(deck)))
    expect(reopened.slides[0].elements.find(element => element.id === sibling.id)).toEqual(sibling)
    expect(reopened.pptxSemantic).toEqual(deck.pptxSemantic)
    expect(deck).toEqual(before)
  })
  it.each([
    ['outer-shadow', 'outerShdw'],
    ['inner-shadow', 'innerShdw'],
    ['glow', 'glow'],
  ])('retains matrix placeholder color when editing %s', (type, kind) => {
    const before = fixture()
    const model = before.pptxSemantic
    const wrap = (value) => authored(value, 'ppt/theme/theme1.xml')
    model.styles.theme.payload.effectStyles = [
      wrap({
        effects: wrap({
          kind: 'list',
          effects: [wrap({ kind, color: wrap({ kind: 'scheme', value: 'phClr' }) })],
        }),
      }),
    ]
    delete model.styles.provider.payload.properties.effects
    model.styles.provider.payload.styleRefs.effectRef = authored({
      index: 1,
      color: authored({ kind: 'scheme', value: 'accent1' }),
    })
    for (const key of ['context1', 'context2'])
      model.styles[key].payload.matrixBindings.effectRef = {
        declarationId: 'provider',
        index: 1,
        themeId: 'theme',
        list: 'effectStyles',
        entryIndex: 0,
        source: model.styles.theme.payload.effectStyles[0].source,
      }
    const snapshot = structuredClone(before)
    const effect = {
      kind,
      color: { kind: 'scheme', value: 'phClr' },
      ...(type === 'glow' ? { rad: 285750 } : { dist: 19050 }),
    }
    const next = apply(before, { type, [type === 'glow' ? 'glow' : 'shadow']: effect })
    expect(
      next.pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.effects
    ).toEqual({ kind: 'list', effects: [effect] })
    expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(next.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    const changed = structuredClone(next)
    changed.pptxSemantic.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent2: { kind: 'srgb', value: '0000FF' } } },
    }
    const reopened = presentationModule.normalizeSemanticPresentation(
      JSON.parse(JSON.stringify(changed))
    )
    const geometry = renderModule.semanticRenderTree(reopened.pptxSemantic, reopened.slides[0])[0]
      .element.pptxGeometry
    expect(geometry.style.effects.effects[0].color.value).toBe('0000FF')
    expect(before).toEqual(snapshot)
  })
  it('offers geometry editing for the exact inherited provider with no fabricated local component', () => {
    const presentation = fixture()
    expect(
      capabilities.getProjectionCapabilities(presentation.pptxSemantic, 'i1').operations
    ).toContain(capabilities.GEOMETRY_EDIT)
    expect(presentation.pptxSemantic.definitions.local1.content.geometry).toBeUndefined()
  })
  it.each([
    ['outer-shadow', 'outerShdw'],
    ['inner-shadow', 'innerShdw'],
    ['glow', 'glow'],
  ])('rejects unbound placeholder color in %s atomically', (type, kind) => {
    const before = fixture()
    const snapshot = structuredClone(before)
    expect(() =>
      apply(before, {
        type,
        [type === 'glow' ? 'glow' : 'shadow']: {
          kind,
          color: { kind: 'scheme', value: 'phClr' },
        },
      })
    ).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([
    [{ type: 'stroke-cap', cap: 'flat' }, { stroke: { cap: 'flat' } }],
    [{ type: 'stroke-cap', cap: null }, { stroke: { cap: null } }],
    [
      { type: 'stroke-dash', dash: { kind: 'preset', value: 'dot' } },
      { stroke: { dash: { kind: 'preset', value: 'dot' } } },
    ],
    [{ type: 'stroke-join', join: { kind: 'bevel' } }, { stroke: { join: { kind: 'bevel' } } }],
    [
      { type: 'stroke-end', end: 'tailEnd', value: { type: 'triangle' } },
      { stroke: { tailEnd: { type: 'triangle' } } },
    ],
    [
      { type: 'fill-paint', color: { kind: 'srgb', value: 'FF0000' } },
      { fill: { color: { kind: 'srgb', value: 'FF0000' } } },
    ],
    [{ type: 'outer-shadow', shadow: null }, { effects: { kind: 'list', effects: [] } }],
    [{ type: 'inner-shadow', shadow: null }, { effects: { kind: 'list', effects: [] } }],
    [{ type: 'glow', glow: null }, { effects: { kind: 'list', effects: [] } }],
    [{ type: 'blur', blur: null }, { effects: { kind: 'list', effects: [] } }],
    [
      { type: 'blur', blur: { kind: 'blur', rad: 285750, grow: false } },
      { effects: { kind: 'list', effects: [{ kind: 'blur', rad: 285750, grow: false }] } },
    ],
    [
      { type: 'blur', blur: { kind: 'blur', rad: 0 } },
      { effects: { kind: 'list', effects: [{ kind: 'blur', rad: 0 }] } },
    ],
    [
      { type: 'blur', blur: { kind: 'blur', grow: true } },
      { effects: { kind: 'list', effects: [{ kind: 'blur', grow: true }] } },
    ],
    [
      {
        type: 'glow',
        glow: { kind: 'glow', color: { kind: 'scheme', value: 'accent2' }, rad: 285750 },
      },
      {
        effects: {
          kind: 'list',
          effects: [{ kind: 'glow', color: { kind: 'scheme', value: 'accent2' }, rad: 285750 }],
        },
      },
    ],
    [
      {
        type: 'inner-shadow',
        shadow: {
          kind: 'innerShdw',
          color: { kind: 'scheme', value: 'accent2' },
          blurRad: 28575,
          dist: 152400,
          dir: 2700000,
        },
      },
      {
        effects: {
          kind: 'list',
          effects: [
            {
              kind: 'innerShdw',
              color: { kind: 'scheme', value: 'accent2' },
              blurRad: 28575,
              dist: 152400,
              dir: 2700000,
            },
          ],
        },
      },
    ],
    [
      { type: 'stroke-paint', color: { kind: 'none' }, width: 0 },
      { stroke: { color: { kind: 'none' }, width: 0 } },
    ],
    [
      {
        type: 'stroke-color',
        color: {
          kind: 'preset',
          value: 'cornflowerBlue',
          transforms: [{ kind: 'alpha', value: 50000 }],
        },
      },
      {
        stroke: {
          color: {
            kind: 'preset',
            value: 'cornflowerBlue',
            transforms: [{ kind: 'alpha', value: 50000 }],
          },
        },
      },
    ],
  ])('stores only intentional leaves for %j', (command, style) => {
    const before = fixture(),
      next = apply(before, command)
    expect(next.pptxSemantic.instances.i1.overrides.components.geometry).toEqual({
      geometryStyle: style,
    })
    expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(next.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  })
  it('preserves sparse style across a structural point edit without persisting inherited paint', () => {
    const colored = apply(fixture(), { type: 'stroke-cap', cap: 'flat' })
    const next = apply(colored, { type: 'control-point', componentId: 'control', x: 22 })
    const override = next.pptxSemantic.instances.i1.overrides.components.geometry
    expect(override.geometryStyle).toEqual({ stroke: { cap: 'flat' } })
    expect(override.geometryDocument.style).toBeUndefined()
    expect(override.geometryDocument.paths[0].commands[1].points[0].x).toBe(22)
    expect(next.slides[0].elements[0].stroke).toBe('#FF0000')
  })
  it.each(['outer-shadow', 'inner-shadow'])(
    'retains symbolic effect color through %s and JSON reopen',
    (type) => {
      const before = fixture()
      const shadow = {
        kind: type === 'inner-shadow' ? 'innerShdw' : 'outerShdw',
        color: { kind: 'scheme', value: 'accent2' },
        dir: 0,
      }
      const next = apply(before, { type, shadow })
      const reopened = presentationModule.normalizeSemanticPresentation(
        JSON.parse(JSON.stringify(next))
      )
      expect(reopened.pptxSemantic.instances.i1.overrides.components.geometry).toEqual({
        geometryStyle: { effects: { kind: 'list', effects: [shadow] } },
      })
      const derived = renderModule.semanticRenderTree(reopened.pptxSemantic, reopened.slides[0])[0]
        .element.pptxGeometry.style.effects.effects[0]
      expect(derived.kind).toBe(shadow.kind)
      expect(derived.color.kind).toBe('srgb')
      expect(shadow.color.kind).toBe('scheme')
      expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
      expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
      expect(next.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    }
  )
  it.each([
    {
      type: 'inner-shadow',
      shadow: { kind: 'outerShdw', color: { kind: 'srgb', value: '123456' } },
    },
    {
      type: 'outer-shadow',
      shadow: { kind: 'innerShdw', color: { kind: 'srgb', value: '123456' } },
    },
    { type: 'inner-shadow', shadow: null, extra: true },
    { type: 'inner-shadow', shadow: { kind: 'innerShdw', color: { kind: 'none' } } },
    {
      type: 'inner-shadow',
      shadow: {
        kind: 'innerShdw',
        color: { kind: 'scheme', value: 'accent2' },
        rotWithShape: false,
      },
    },
    {
      type: 'inner-shadow',
      shadow: { kind: 'innerShdw', color: { kind: 'scheme', value: 'accent2' }, blurRad: -1 },
    },
  ])('rejects invalid source-shadow intent atomically: %j', (command) => {
    const before = fixture()
    const snapshot = structuredClone(before)
    expect(() => apply(before, command)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('recomputes inherited paint after theme changes while retaining point and cap edits through reload', () => {
    const pointed = apply(apply(fixture(), { type: 'stroke-cap', cap: 'flat' }), {
      type: 'control-point',
      componentId: 'control',
      x: 22,
    })
    const saved = structuredClone(pointed)
    saved.pptxSemantic.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent2: { kind: 'srgb', value: '0000FF' } } },
    }
    const reopened = presentationModule.normalizeSemanticPresentation(
      JSON.parse(JSON.stringify(saved))
    )
    const rendered = renderModule.semanticRenderTree(reopened.pptxSemantic, reopened.slides[0])[0]
      .element
    expect(rendered.pptxGeometry.paths[0].commands[1].points[0].x).toBe(22)
    expect(rendered.pptxGeometry.style.stroke.cap).toBe('flat')
    expect(rendered.fill).toBe('#0000FF')
    expect(rendered.stroke).toBe('#0000FF')
    expect(reopened.slides[0].elements[0].fill).toBe('#0000FF')
    expect(reopened.slides[0].elements[0].stroke).toBe('#0000FF')
  })
  it('regenerates derived compatibility paint rather than accepting client cache as authority', () => {
    const before = fixture()
    before.slides[0].elements[0].fill = '#FAFAFA'
    before.slides[0].elements[0].stroke = '#AAAAAA'
    const next = presentationModule.normalizeSemanticPresentation(before)
    expect(next.slides[0].elements[0]).toMatchObject({
      fill: '#FF0000',
      stroke: '#FF0000',
      strokeWidth: 4,
    })
    expect(before.slides[0].elements[0].fill).toBe('#FAFAFA')
  })
  it('rejects locked or unsupported materialization without changing the previous document', () => {
    const before = fixture()
    before.pptxSemantic.instances.i1.overrides.locked = true
    const original = JSON.stringify(before)
    expect(() => apply(before, { type: 'stroke-cap', cap: 'flat' })).toThrow()
    expect(JSON.stringify(before)).toBe(original)
  })
})
