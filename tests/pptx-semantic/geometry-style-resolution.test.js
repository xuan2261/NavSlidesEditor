import { describe, expect, it } from 'vitest'
import semantic from '../../shared/src/pptx-semantic-document.js'
import resolution from '../../shared/src/pptx-geometry-style-resolution.js'
import geometryModule from '../../shared/src/pptx-geometry-document.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { geometryStyleFixture, authored, styleLocation } from './geometry-style-fixture.js'

const normalize = semantic.normalizePptxSemanticDocument
const { resolveGeometryStyle, materializeGeometry, resolveGeometryTransform } = resolution
const sparse = (document, style, structural) => {
  document.instances.i1.overrides.components = {
    geometry: {
      ...(style ? { geometryStyle: style } : {}),
      ...(structural ? { geometryDocument: structural } : {}),
    },
  }
}
const changedTheme = (document, color = '0000FF') => {
  document.styles.projectTheme = {
    kind: 'theme-override',
    origin: 'project',
    baseStyleId: 'theme',
    values: { colors: { accent2: { kind: 'srgb', value: color } } },
  }
  return document
}
describe('occurrence geometry style materialization', () => {
  it('derives different host paints from one unchanged shared source geometry', () => {
    const document = normalize(geometryStyleFixture()),
      before = JSON.stringify(document)
    const first = resolveGeometryStyle(document, 'i1'),
      second = resolveGeometryStyle(document, 'i2')
    expect(first.style.fill.color).toEqual({ kind: 'srgb', value: 'FF0000' })
    expect(second.style.fill.color).toEqual({ kind: 'srgb', value: '00FF00' })
    expect(first.properties.fill.dependencyIds).toContain('map1:values.accent1')
    expect(first.properties.fill.dependencyIds).toContain('theme:colors.accent2')
    expect(JSON.stringify(document)).toBe(before)
  })
  it('keeps a structural point edit while recomputing inherited fill, line and shadow', () => {
    const document = geometryStyleFixture()
    const structural = structuredClone(document.definitions.definition.content.geometry)
    structural.paths[0].commands[0].points[0].x = 4
    sparse(document, undefined, structural)
    const result = materializeGeometry(normalize(changedTheme(document)), 'i1')
    expect(result.paths[0].commands[0].points[0].x).toBe(4)
    expect(result.style.fill.color.value).toBe('0000FF')
    expect(result.style.stroke.color.value).toBe('0000FF')
    expect(result.style.effects.effects[0]).toMatchObject({
      color: { value: '0000FF' },
      dist: 0,
      rotWithShape: false,
    })
    expect(
      document.instances.i1.overrides.components.geometry.geometryDocument.style
    ).toBeUndefined()
  })
  it('treats visible-equal RGB as intentional override instead of diffing resolved snapshots', () => {
    const document = geometryStyleFixture()
    sparse(document, { fill: { color: { kind: 'srgb', value: 'FF0000' } } })
    const result = resolveGeometryStyle(normalize(changedTheme(document)), 'i1')
    expect(result.style.fill.color.value).toBe('FF0000')
    expect(result.properties.fill.dependencyIds).not.toContain('theme:colors.accent2')
    expect(result.style.stroke.color.value).toBe('0000FF')
  })
  it('retains theme dependence for an intentional scheme color override', () => {
    const document = geometryStyleFixture()
    sparse(document, { fill: { color: { kind: 'scheme', value: 'accent1' } } })
    const result = resolveGeometryStyle(normalize(changedTheme(document)), 'i1')
    expect(result.style.fill.color.value).toBe('0000FF')
    expect(result.properties.fill.authored).toEqual({ color: { kind: 'scheme', value: 'accent1' } })
    expect(result.properties.fill.dependencyIds).toContain('theme:colors.accent2')
  })
  it('does not freeze inherited stroke color or other leaves after a cap edit', () => {
    const document = geometryStyleFixture()
    sparse(document, { stroke: { cap: 'flat' } })
    const result = materializeGeometry(normalize(changedTheme(document)), 'i1')
    expect(result.style.stroke).toMatchObject({
      color: { value: '0000FF' },
      width: 38100,
      cap: 'flat',
      dash: { kind: 'preset', value: 'dash' },
    })
    expect(document.instances.i1.overrides.components.geometry.geometryStyle).toEqual({
      stroke: { cap: 'flat' },
    })
  })
  it('distinguishes explicit native-default null from absent override inheritance', () => {
    const document = geometryStyleFixture()
    sparse(document, { stroke: { cap: null } })
    const result = materializeGeometry(normalize(document), 'i1')
    expect(result.style.stroke.cap).toBeUndefined()
    expect(materializeGeometry(normalize(document), 'i2').style.stroke.cap).toBe('rnd')
  })
  it('keeps explicit noFill and empty effects independent from source theme changes', () => {
    const document = geometryStyleFixture()
    sparse(document, { fill: { color: { kind: 'none' } }, effects: { kind: 'list', effects: [] } })
    const result = resolveGeometryStyle(normalize(changedTheme(document)), 'i1')
    expect(result.style.fill).toEqual({ color: { kind: 'none' } })
    expect(result.style.effects).toEqual({ kind: 'list', effects: [] })
    expect(result.properties.effects.dependencyIds).not.toContain('theme:colors.accent2')
  })
  it('resolves all ordered source color transforms once including alpha zero', () => {
    const document = geometryStyleFixture()
    document.styles.provider.payload.properties.fill.value.color = authored({
      kind: 'srgb',
      value: '2468AC',
      transforms: [
        authored({ kind: 'tint', value: 50000 }),
        authored({ kind: 'alpha', value: 50000 }),
        authored({ kind: 'alphaMod', value: 50000 }),
      ],
    })
    const geometry = materializeGeometry(normalize(document), 'i1')
    expect(geometryModule.geometryFillPaint(geometry)).toEqual({
      fill: '#BDC7DB',
      fillOpacity: 0.25,
    })
    expect(geometry.style.fill.color.value).toBe('2468AC')
    document.styles.provider.payload.properties.fill.value.color.value.transforms.push(
      authored({ kind: 'alpha', value: 0 })
    )
    expect(
      geometryModule.geometryFillPaint(materializeGeometry(normalize(document), 'i1')).fillOpacity
    ).toBe(0)
  })
  it('substitutes phClr with reference, palette and matrix transforms in authored order', () => {
    const document = geometryStyleFixture(),
      themePart = 'ppt/theme/theme1.xml'
    delete document.styles.provider.payload.properties.fill
    document.styles.provider.payload.styleRefs.fillRef = authored({
      index: 1,
      color: authored({
        kind: 'srgb',
        value: '2468AC',
        transforms: [authored({ kind: 'alpha', value: 50000 })],
      }),
    })
    const entry = authored(
      {
        color: authored(
          {
            kind: 'scheme',
            value: 'phClr',
            transforms: [authored({ kind: 'alphaMod', value: 50000 }, themePart)],
          },
          themePart
        ),
      },
      themePart
    )
    document.styles.theme.payload.fillStyles = [entry]
    for (const id of ['context1', 'context2'])
      document.styles[id].payload.matrixBindings.fillRef = {
        declarationId: 'provider',
        index: 1,
        themeId: 'theme',
        list: 'fillStyles',
        entryIndex: 0,
        source: entry.source,
      }
    const geometry = materializeGeometry(normalize(document), 'i1')
    expect(geometryModule.geometryFillPaint(geometry)).toEqual({
      fill: '#2468AC',
      fillOpacity: 0.25,
    })
    expect(resolveGeometryStyle(normalize(document), 'i1').properties.fill.dependencyIds).toContain(
      'theme:fillStyles.0'
    )
  })
  it('rejects unbound phClr and missing theme colors without supported fallthrough', () => {
    const document = geometryStyleFixture()
    document.styles.provider.payload.properties.fill.value.color = authored({
      kind: 'scheme',
      value: 'phClr',
    })
    expect(() => materializeGeometry(normalize(document), 'i1')).toThrow()
    document.styles.provider.payload.properties.fill.value.color = authored({
      kind: 'scheme',
      value: 'accent6',
    })
    expect(() => materializeGeometry(normalize(document), 'i1')).toThrow()
  })
  it('preserves authored zero/false transform and native extent without changing editable placement', () => {
    const document = geometryStyleFixture()
    document.styles.provider.payload.transform.value.ext.value.cx = authored(0)
    const normalized = normalize(document),
      placement = [...normalized.instances.i1.localTransform]
    const result = resolveGeometryTransform(normalized, 'i1')
    expect(result.transform).toEqual({
      off: { x: 0, y: -9525 },
      ext: { cx: 0, cy: 80 },
      rot: 0,
      flipH: false,
    })
    expect(materializeGeometry(normalized, 'i1').width).toBe(0)
    expect(normalized.instances.i1.localTransform).toEqual(placement)
  })
  it('honors masterClrMapping reset without falling through a layout map', () => {
    const document = geometryStyleFixture(),
      part = 'ppt/slideMasters/slideMaster1.xml'
    document.styles.map1.payload = { kind: 'master', values: {} }
    document.styles.masterMap = {
      kind: 'color-map',
      origin: 'source',
      source: styleLocation(part),
      payload: { kind: 'mapping', values: { accent1: authored('accent3', part) } },
    }
    for (const id of ['context1', 'context2'])
      document.styles[id].payload.colorMapIds.push('masterMap')
    expect(materializeGeometry(normalize(document), 'i1').style.fill.color.value).toBe('00FF00')
  })
  it('rejects a master mapping reset with no later master map instead of looping', () => {
    const document = geometryStyleFixture()
    document.styles.map1.payload = { kind: 'master', values: {} }
    expect(() => materializeGeometry(normalize(document), 'i1')).toThrow()
  })
  it('retains schema one whole styled replacements without inferring a new intent mask', () => {
    const document = geometryProjectionFixture().pptxSemantic
    const geometry = structuredClone(document.definitions.definition.content.geometry)
    geometry.style = { fill: { color: { kind: 'srgb', value: '123456' } } }
    sparse(document, undefined, geometry)
    expect(materializeGeometry(normalize(document), 'i1')).toEqual(geometry)
  })

  it('resolves geometry style and transforms on schemaVersion 3 models preserving provenance traces', () => {
    const document = geometryStyleFixture()
    document.schemaVersion = 3
    const first = resolveGeometryStyle(document, 'i1')
    expect(first.style.fill.color).toEqual({ kind: 'srgb', value: 'FF0000' })
    expect(first.properties.fill.dependencyIds).toContain('map1:values.accent1')
    expect(first.properties.fill.dependencyIds).toContain('theme:colors.accent2')
    const transform = resolveGeometryTransform(document, 'i1')
    expect(transform.transform.off).toBeDefined()
    expect(transform.transform.ext).toBeDefined()
  })
})
