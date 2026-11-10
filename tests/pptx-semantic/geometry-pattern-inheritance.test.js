import { describe, expect, it } from 'vitest'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import operations from '../../shared/src/pptx-projection-operation.js'
import capabilities from '../../shared/src/pptx-projection-capabilities.js'
import records from '../../shared/src/pptx-geometry-style-records.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { authored, inheritedGeometryStyleFixture } from './geometry-style-fixture.js'

function fixture() {
  const presentation = {
    ...geometryProjectionFixture(),
    pptxSemantic: inheritedGeometryStyleFixture(),
  }
  presentation.pptxSemantic.styles.provider.payload.properties.fill = authored({
    pattern: authored({
      preset: authored('pct25'),
      foreground: authored({
        kind: 'scheme',
        value: 'accent1',
        transforms: [authored({ kind: 'alpha', value: 0 })],
      }),
      background: authored({
        kind: 'scrgb',
        value: { r: 50000, g: 50000, b: 50000 },
      }),
    }),
  })
  return presentation
}

describe('linked source pattern fill', () => {
  it.each(['declaration', 'line matrix', 'hidden outline'])(
    'does not admit a pattern into an otherwise valid %s',
    (scope) => {
      const document = inheritedGeometryStyleFixture()
      records.validateGeometryStyleRecords(document)
      const uri =
        scope === 'line matrix' ? 'ppt/theme/theme1.xml' : 'ppt/slideLayouts/slideLayout1.xml'
      const stroke =
        scope === 'line matrix'
          ? authored(
              {
                color: authored({ kind: 'srgb', value: '123456' }, uri),
                width: authored(9525, uri),
              },
              uri
            )
          : structuredClone(document.styles.provider.payload.properties.stroke)
      if (scope === 'declaration') document.styles.provider.payload.properties.stroke = stroke
      else if (scope === 'hidden outline') document.styles.provider.payload.hiddenStroke = stroke
      else document.styles.theme.payload.lineStyles = [stroke]
      records.validateGeometryStyleRecords(document)
      stroke.value.pattern = authored({ preset: authored('pct25', uri) }, uri)
      expect(() => records.validateGeometryStyleRecords(document)).toThrow()
    }
  )
  it.each([
    {},
    { preset: authored('pct5') },
    { foreground: authored({ kind: 'preset', value: 'red' }) },
    { background: authored({ kind: 'scrgb', value: { r: 50000, g: 50000, b: 50000 } }) },
  ])('preserves sparse source pattern %j through normalization and wire reload', (pattern) => {
    const presentation = fixture()
    presentation.pptxSemantic.styles.provider.payload.properties.fill = authored({
      pattern: authored(pattern),
    })
    const before = structuredClone(presentation.pptxSemantic.styles)
    const normalized = semantic.normalizeSemanticPresentation(presentation)
    const reopened = semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(normalized)))
    expect(reopened.pptxSemantic.styles).toEqual(before)
    expect(
      Object.keys(styles.materializeGeometry(reopened.pptxSemantic, 'i1').style.fill.pattern)
    ).toEqual(Object.keys(pattern))
  })
  it('keeps inherited color dependencies live after a preset-only edit', () => {
    const before = fixture()
    const next = operations.applyPresentationProjectionOperation(before, {
      type: capabilities.GEOMETRY_EDIT,
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-pattern', pattern: { preset: 'diagCross' } },
    })
    expect(next.pptxSemantic.instances.i1.overrides.components.geometry).toEqual({
      geometryStyle: { fill: { pattern: { preset: 'diagCross' } } },
    })
    const saved = structuredClone(next)
    saved.pptxSemantic.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent2: { kind: 'preset', value: 'blue' } } },
    }
    const reopened = semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(saved)))
    const pattern = styles.materializeGeometry(reopened.pptxSemantic, 'i1').style.fill.pattern
    expect(pattern.preset).toBe('diagCross')
    expect(pattern.foreground).toEqual({
      kind: 'preset',
      value: 'blue',
      transforms: [{ kind: 'alpha', value: 0 }],
    })
    expect(pattern.background).toEqual({
      kind: 'scrgb',
      value: { r: 50000, g: 50000, b: 50000 },
    })
    expect(reopened.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(reopened.pptxSemantic.styles.provider).toEqual(before.pptxSemantic.styles.provider)
    expect(reopened.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  })

  it('explicitly removes an optional color without borrowing the older declaration', () => {
    const before = fixture()
    const next = operations.applyPresentationProjectionOperation(before, {
      type: capabilities.GEOMETRY_EDIT,
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-pattern', pattern: { foreground: null } },
    })
    expect(next.pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.fill).toEqual(
      {
        pattern: { foreground: null },
      }
    )
    expect(
      styles.materializeGeometry(next.pptxSemantic, 'i1').style.fill.pattern
    ).not.toHaveProperty('foreground')
    expect(styles.materializeGeometry(next.pptxSemantic, 'i2').style.fill.pattern).toHaveProperty(
      'foreground'
    )
  })

  it('resolves both colors per occurrence without mutating the source pattern', () => {
    const presentation = fixture()
    const before = structuredClone(presentation)
    const first = styles.materializeGeometry(presentation.pptxSemantic, 'i1').style.fill.pattern
    const second = styles.materializeGeometry(presentation.pptxSemantic, 'i2').style.fill.pattern
    expect(first).toEqual({
      preset: 'pct25',
      foreground: {
        kind: 'srgb',
        value: 'FF0000',
        transforms: [{ kind: 'alpha', value: 0 }],
      },
      background: { kind: 'scrgb', value: { r: 50000, g: 50000, b: 50000 } },
    })
    expect(second.foreground.value).toBe('00FF00')
    expect(presentation).toEqual(before)
    const restored = semantic.normalizeSemanticPresentation(
      JSON.parse(JSON.stringify(presentation))
    )
    expect(styles.materializeGeometry(restored.pptxSemantic, 'i1').style.fill.pattern).toEqual(
      first
    )
  })

  it('stores an explicit pattern edit on only the selected occurrence through reload', () => {
    const before = fixture()
    const pattern = {
      preset: 'diagCross',
      foreground: { kind: 'preset', value: 'red', transforms: [{ kind: 'alpha', value: 50000 }] },
      background: { kind: 'hsl', value: { hue: 0, sat: 0, lum: 0 } },
    }
    const next = operations.applyPresentationProjectionOperation(before, {
      type: capabilities.GEOMETRY_EDIT,
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-pattern', pattern },
    })
    expect(next.pptxSemantic.instances.i1.overrides.components.geometry).toEqual({
      geometryStyle: { fill: { pattern } },
    })
    expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(next.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    const reopened = semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(next)))
    expect(styles.materializeGeometry(reopened.pptxSemantic, 'i1').style.fill.pattern).toEqual(
      pattern
    )
    expect(styles.materializeGeometry(reopened.pptxSemantic, 'i2').style.fill.pattern.preset).toBe(
      'pct25'
    )
  })

  it.each([
    { preset: 'not-a-pattern' },
    { preset: 'pct25', foreground: { kind: 'srgb', value: 'bad' } },
    { preset: 'pct25', background: { kind: 'preset', value: 'not-a-color' } },
    { preset: 'pct25', extra: 1 },
  ])('rejects invalid pattern edits atomically: %j', (pattern) => {
    const before = fixture()
    expect(() => semantic.normalizeSemanticPresentation(before)).not.toThrow()
    const original = JSON.stringify(before)
    expect(() =>
      operations.applyPresentationProjectionOperation(before, {
        type: capabilities.GEOMETRY_EDIT,
        instanceId: 'i1',
        componentId: 'geometry',
        command: { type: 'fill-pattern', pattern },
      })
    ).toThrow()
    expect(JSON.stringify(before)).toBe(original)
  })
})
