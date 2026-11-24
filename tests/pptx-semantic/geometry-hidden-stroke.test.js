import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import semantic from '../../shared/src/pptx-semantic-document.js'
import presentation from '../../shared/src/pptx-semantic-presentation.js'
import operations from '../../shared/src/pptx-projection-operation.js'
import capabilities from '../../shared/src/pptx-projection-capabilities.js'
import renderers from '../../shared/src/element-renderers.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { inheritedGeometryStyleFixture, authored } from './geometry-style-fixture.js'
const require = createRequire(import.meta.url)
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const {
  collectTrustedImportMetadata,
} = require('../../server/services/pptx-import/trusted-import-metadata')

function fixture() {
  const deck = geometryProjectionFixture()
  deck.pptxSemantic = inheritedGeometryStyleFixture()
  const source = deck.pptxSemantic.styles.provider.payload
  source.properties.stroke.value.color = authored({ kind: 'none' })
  source.hiddenStroke = authored({
    color: authored({
      kind: 'scheme',
      value: 'accent1',
      transforms: [authored({ kind: 'shade', value: 50000 })],
    }),
    width: authored(12700),
    cap: authored('flat'),
    compound: authored('sng'),
    alignment: authored('ctr'),
    dash: authored({ kind: 'preset', value: 'solid' }),
    join: authored({ kind: 'miter', limit: authored(800000) }),
  })
  return deck
}
const apply = (deck, command, extra = {}) =>
  operations.applyPresentationProjectionOperation(deck, {
    type: capabilities.GEOMETRY_EDIT,
    instanceId: 'i1',
    componentId: 'geometry',
    command,
    ...extra,
  })

describe('source native latent outline restoration', () => {
  it('protects the complete latent source record in server baselines while allowing sparse restoration', () => {
    const before = fixture()
    const metadata = collectTrustedImportMetadata(before, 'original')
    const restored = apply(before, { type: 'stroke-restore' })
    expect(() => assertSemanticBaseline(before, restored)).not.toThrow()
    expect(collectTrustedImportMetadata(restored, 'original').projection.immutableSourceHash).toBe(
      metadata.projection.immutableSourceHash
    )
    for (const mutate of [
      (s) => {
        delete s.hiddenStroke
      },
      (s) => {
        s.hiddenStroke.value.width.value = 38100
      },
      (s) => {
        s.hiddenStroke.value.color.value.value = 'accent2'
      },
      (s) => {
        s.hiddenStroke.source.componentLocator.path.push(0)
      },
    ]) {
      const forged = structuredClone(restored)
      mutate(forged.pptxSemantic.styles.provider.payload)
      expect(() => assertSemanticBaseline(before, forged)).toThrow()
    }
  })
  it.each(['element', 'slide', 'visible', 'component'])(
    'rejects %s restoration atomically',
    (state) => {
      const deck = fixture()
      if (state === 'element') deck.slides[0].elements[0].locked = true
      if (state === 'slide') deck.slides[0].locked = true
      if (state === 'visible')
        deck.pptxSemantic.styles.provider.payload.properties.stroke.value.color = authored({
          kind: 'scheme',
          value: 'accent1',
        })
      const before = structuredClone(deck)
      expect(() =>
        apply(
          deck,
          { type: 'stroke-restore' },
          state === 'component' ? { componentId: 'foreign' } : {}
        )
      ).toThrow()
      expect(deck).toEqual(before)
    }
  )
  it('never paints the hidden outline before an explicit occurrence command', () => {
    const deck = presentation.normalizeSemanticPresentation(fixture())
    expect(styles.materializeGeometry(deck.pptxSemantic, 'i1').style.stroke.color).toEqual({
      kind: 'none',
    })
    expect(
      renderers.renderSlideElements(deck.slides[0], { pptxSemantic: deck.pptxSemantic })
    ).toContain('stroke:none')
    const themed = structuredClone(deck)
    themed.pptxSemantic.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent2: { kind: 'srgb', value: 'ABCDEF' } } },
    }
    expect(
      styles.materializeGeometry(
        presentation.normalizeSemanticPresentation(themed).pptxSemantic,
        'i1'
      ).style.stroke.color
    ).toEqual({ kind: 'none' })
  })
  it('restores symbolic own intent, paints through the host, and survives reload without changing source or sibling', () => {
    const before = fixture(),
      snapshot = structuredClone(before)
    const next = apply(before, { type: 'stroke-restore' })
    const stroke = next.pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.stroke
    expect(stroke).toEqual({
      color: { kind: 'scheme', value: 'accent1', transforms: [{ kind: 'shade', value: 50000 }] },
      width: 12700,
      cap: 'flat',
      compound: 'sng',
      alignment: 'ctr',
      dash: { kind: 'preset', value: 'solid' },
      join: { kind: 'miter', limit: 800000 },
    })
    expect(styles.materializeGeometry(next.pptxSemantic, 'i1').style.stroke.color).toEqual({
      kind: 'srgb',
      value: 'FF0000',
      transforms: [{ kind: 'shade', value: 50000 }],
    })
    expect(styles.materializeGeometry(next.pptxSemantic, 'i2').style.stroke.color).toEqual({
      kind: 'none',
    })
    const reopened = presentation.normalizeSemanticPresentation(JSON.parse(JSON.stringify(next)))
    expect(reopened.pptxSemantic).toEqual(next.pptxSemantic)
    expect(reopened.slides[0].elements[0].stroke).not.toBe('none')
    expect(next.pptxSemantic.definitions).toEqual(snapshot.pptxSemantic.definitions)
    expect(next.pptxSemantic.styles).toEqual(snapshot.pptxSemantic.styles)
    expect(next.pptxSemantic.instances.i2).toEqual(snapshot.pptxSemantic.instances.i2)
    expect(before).toEqual(snapshot)
    const removed = apply(reopened, { type: 'stroke-paint', color: { kind: 'none' }, width: 12700 })
    expect(styles.materializeGeometry(removed.pptxSemantic, 'i1').style.stroke.color).toEqual({
      kind: 'none',
    })
  })
  it('preserves own zero/null/end overrides and structural edits during restoration', () => {
    const deck = fixture()
    deck.pptxSemantic.instances.i1.overrides.components = {
      geometry: {
        geometryStyle: {
          stroke: {
            width: 0,
            cap: null,
            join: null,
            compound: null,
            alignment: null,
            tailEnd: { type: 'triangle' },
          },
        },
      },
    }
    const pointed = apply(deck, { type: 'control-point', componentId: 'control', x: 22 })
    const restored = apply(pointed, { type: 'stroke-restore' })
    const component = restored.pptxSemantic.instances.i1.overrides.components.geometry
    expect(component.geometryDocument).toEqual(
      pointed.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument
    )
    expect(component.geometryStyle.stroke).toMatchObject({
      width: 0,
      cap: null,
      join: null,
      compound: null,
      alignment: null,
      tailEnd: { type: 'triangle' },
    })
    expect(component.geometryDocument).not.toHaveProperty('style')
  })
  it('removes only a color mask when an originally visible source outline was removed', () => {
    const deck = fixture()
    delete deck.pptxSemantic.styles.provider.payload.hiddenStroke
    deck.pptxSemantic.styles.provider.payload.properties.stroke.value.color = authored({
      kind: 'scheme',
      value: 'accent1',
    })
    deck.pptxSemantic.instances.i1.overrides.components = {
      geometry: {
        geometryStyle: {
          fill: { color: { kind: 'srgb', value: 'ABCDEF' } },
          stroke: { color: { kind: 'none' }, width: 0, cap: null },
        },
      },
    }
    const restored = apply(deck, { type: 'stroke-restore' })
    expect(restored.pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle).toEqual({
      fill: { color: { kind: 'srgb', value: 'ABCDEF' } },
      stroke: { width: 0, cap: null },
    })
    expect(styles.materializeGeometry(restored.pptxSemantic, 'i1').style.stroke.color.value).toBe(
      'FF0000'
    )
  })
  it('does not borrow an ancestor latent outline when nearer source None governs', () => {
    const deck = fixture()
    deck.pptxSemantic.styles.local1.payload.properties.stroke = authored(
      { color: authored({ kind: 'none' }, 'ppt/slides/slide1.xml') },
      'ppt/slides/slide1.xml'
    )
    expect(
      styles.geometryOutlineRestoration(
        semantic.normalizePptxSemanticDocument(deck.pptxSemantic),
        'i1'
      )
    ).toBeNull()
    const before = structuredClone(deck)
    expect(() => apply(deck, { type: 'stroke-restore' })).toThrow(/restor/)
    expect(deck).toEqual(before)
  })
  it.each(['uninstantiated', 'hidden', 'tombstoned', 'masked'])(
    'rejects unresolved latent source color even when %s',
    (state) => {
      const deck = fixture()
      deck.pptxSemantic.styles.provider.payload.hiddenStroke.value.color.value.value = 'accent6'
      if (state === 'uninstantiated') deck.pptxSemantic.instances = {}
      if (state === 'hidden') deck.pptxSemantic.instances.i1.hidden = true
      if (state === 'tombstoned') deck.pptxSemantic.instances.i1.lineage = { tombstone: true }
      if (state === 'masked')
        deck.pptxSemantic.instances.i1.overrides.components = {
          geometry: { geometryStyle: { stroke: { color: { kind: 'none' } } } },
        }
      const before = structuredClone(deck)
      expect(() => semantic.normalizePptxSemanticDocument(deck.pptxSemantic)).toThrow(
        /missing theme color/
      )
      expect(deck).toEqual(before)
    }
  )
  it.each([
    { type: 'stroke-restore', color: { kind: 'srgb', value: 'FFFFFF' } },
    { type: 'stroke-restore', source: 'provider' },
  ])('rejects supplied restoration authority atomically: %j', (command) => {
    const deck = fixture(),
      before = structuredClone(deck)
    expect(() => apply(deck, command)).toThrow()
    expect(deck).toEqual(before)
  })
})
