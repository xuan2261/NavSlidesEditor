import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { authored, styleLocation, inheritedGeometryStyleFixture } from './geometry-style-fixture.js'
import { collectProjectMediaEntries, rewriteProjectMediaUrls } from '../../client/src/utils/project-media-utils.js'
const require = createRequire(import.meta.url)
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')
const { GEOMETRY_EDIT } = require('../../shared/src/pptx-projection-capabilities')
const { collectMediaUrls, rewritePresentationMedia } = require('../../server/services/project-import-presentation')
const { materializeGeometry } = require('../../shared/src/pptx-geometry-style-resolution')
const layout = 'ppt/slideLayouts/slideLayout1.xml'
function fixture() {
  const presentation = { ...geometryProjectionFixture(), pptxSemantic: inheritedGeometryStyleFixture() }
  const document = presentation.pptxSemantic
  const source = { partUri: 'ppt/media/source.png', preconditionHash: 'b'.repeat(64), byteLength: 68,
    width: 4, height: 1, format: 'png', src: '/uploads/source.png' }
  document.styles.imageBinding = { kind: 'geometry-blip-binding', origin: 'source',
    source: styleLocation(layout, [0, 0, 0]), payload: {
      edge: { fromPartUri: layout, toPartUri: source.partUri, relationshipId: 'imageOne',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        source: styleLocation('ppt/slideLayouts/_rels/slideLayout1.xml.rels') }, asset: source,
      derivedAssets: { lighten: { src: '/uploads/lighten.png', width: 4, height: 1, format: 'png',
        sha256: 'c'.repeat(64), byteLength: 70, sourceHash: source.preconditionHash, algorithm: 'ooxml-blip-source-rgb-v1' } },
    } }
  document.styles.provider.payload.properties.fill = authored({ blip: authored({ embed: authored('imageOne'),
    bindingId: 'imageBinding', srcRect: authored({ l: authored(10000) }), tile: authored({}) }) })
  return presentation
}
it('projects render assets independently, preserves source ownership and occurrence edits through save/reopen', () => {
  const before = fixture(), styles = structuredClone(before.pptxSemantic.styles)
  const normalized = normalizeSemanticPresentation(before)
  const next = applyPresentationProjectionOperation(normalized, { type: GEOMETRY_EDIT, instanceId: 'i1',
    componentId: 'geometry', command: { type: 'fill-blip', blip: { srcRect: { l: 25000 }, tile: null, stretch: {} } } })
  const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(next)))
  expect(reopened.pptxSemantic.styles).toEqual(styles)
  const leaves = reopened.slides.flatMap(slide => slide.elements)
  for (const leaf of leaves.filter(leaf => ['i1', 'i2'].includes(leaf.pptxInstanceId))) {
    expect(leaf.pptxBlipAsset).toEqual(styles.imageBinding.payload.asset)
    expect(leaf.pptxBlipDerivedAssets).toEqual(styles.imageBinding.payload.derivedAssets)
    expect(JSON.stringify(materializeGeometry(reopened.pptxSemantic, leaf.pptxInstanceId))).not.toContain('/uploads/')
  }
  expect(reopened.pptxSemantic.instances.i2).toEqual(normalized.pptxSemantic.instances.i2)
  expect(before.pptxSemantic.styles).toEqual(styles)
})
it('enumerates and rebinds canonical original plus derived textures in editable portable backups', () => {
  const input = fixture(), map = { '/uploads/source.png': '/uploads/rebound-source.png',
    '/uploads/lighten.png': '/uploads/rebound-lighten.png' }
  const urls = collectProjectMediaEntries(input).map(entry => entry.originalUrl)
  expect(urls).toEqual(Object.keys(map))
  expect(collectMediaUrls(input)).toEqual(Object.keys(map))
  for (const result of [rewriteProjectMediaUrls(input, map), rewritePresentationMedia(input, map)]) {
    expect(collectProjectMediaEntries(result).map(entry => entry.originalUrl)).toEqual(Object.values(map))
    const payload = result.pptxSemantic.styles.imageBinding.payload
    expect(payload.asset.preconditionHash).toBe('b'.repeat(64))
    expect(payload.derivedAssets.lighten.sourceHash).toBe('b'.repeat(64))
  }
  expect(input.pptxSemantic.styles.imageBinding.payload.asset.src).toBe('/uploads/source.png')
})
it('regenerates forged leaf assets from canonical bindings and removes stale variants', () => {
  const input = fixture(), leaf = input.slides[0].elements[0]
  leaf.pptxBlipAsset = { src: '/uploads/forged.png' }
  leaf.pptxBlipDerivedAssets = { darken: { src: '/uploads/forged-darken.png' } }
  const normalized = normalizeSemanticPresentation(input)
  expect(normalized.slides[0].elements[0].pptxBlipDerivedAssets)
    .toEqual(input.pptxSemantic.styles.imageBinding.payload.derivedAssets)
  expect(normalized.slides[0].elements[0].pptxBlipAsset)
    .toEqual(input.pptxSemantic.styles.imageBinding.payload.asset)
  const unshaded = structuredClone(normalized)
  delete unshaded.pptxSemantic.styles.imageBinding.payload.derivedAssets
  const normOnly = normalizeSemanticPresentation(unshaded)
  expect(normOnly.slides[0].elements[0]).not.toHaveProperty('pptxBlipDerivedAssets')
  const noBlip = fixture()
  noBlip.slides[0].elements[0].pptxBlipAsset = { src: '/uploads/stale.png' }
  noBlip.slides[0].elements[0].pptxBlipDerivedAssets = { lighten: { src: '/uploads/stale-shade.png' } }
  noBlip.pptxSemantic.styles.provider.payload.properties.fill = authored({ color: authored({ kind: 'srgb', value: '123456' }) })
  const replaced = normalizeSemanticPresentation(noBlip)
  expect(replaced.slides[0].elements[0]).not.toHaveProperty('pptxBlipAsset')
  expect(replaced.slides[0].elements[0]).not.toHaveProperty('pptxBlipDerivedAssets')
})
it('includes projected child, fixed, layout and override asset records in resource rebinding', () => {
  const input = fixture(), variant = input.pptxSemantic.styles.imageBinding.payload.derivedAssets.lighten
  const leaf = src => ({ type: 'shape', pptxBlipDerivedAssets: { lighten: { ...variant, src } } })
  input.slides[0].children = [{ elements: [], fixedElements: [leaf('/uploads/child-fixed.png')] }]
  input.slides[0].layoutOverrides = { elementPatches: { shape: leaf('/uploads/override.png') } }
  input.layoutMasters = [{ elements: [leaf('/uploads/master.png')], fixedElements: [leaf('/uploads/fixed.png')] }]
  const urls = ['/uploads/source.png', '/uploads/lighten.png', '/uploads/child-fixed.png',
    '/uploads/override.png', '/uploads/master.png', '/uploads/fixed.png']
  expect(new Set(collectMediaUrls(input))).toEqual(new Set(urls))
  expect(new Set(collectProjectMediaEntries(input).map(entry => entry.originalUrl))).toEqual(new Set(urls))
  const map = Object.fromEntries(urls.map((url, index) => [url, `/uploads/rebound-${index}.png`]))
  for (const result of [rewriteProjectMediaUrls(input, map), rewritePresentationMedia(input, map)])
    expect(new Set(collectMediaUrls(result))).toEqual(new Set(Object.values(map)))
})
