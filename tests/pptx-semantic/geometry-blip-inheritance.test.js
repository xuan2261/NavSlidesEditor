import { describe, expect, it } from 'vitest'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import records from '../../shared/src/pptx-geometry-style-records.js'
import operations from '../../shared/src/pptx-projection-operation.js'
import capabilities from '../../shared/src/pptx-projection-capabilities.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { authored, styleLocation, inheritedGeometryStyleFixture } from './geometry-style-fixture.js'

const layout = 'ppt/slideLayouts/slideLayout1.xml'
function fixture() {
  const presentation = {
    ...geometryProjectionFixture(),
    pptxSemantic: inheritedGeometryStyleFixture(),
  }
  const document = presentation.pptxSemantic
  document.styles.imageBinding = {
    kind: 'geometry-blip-binding',
    origin: 'source',
    source: styleLocation(layout, [0, 0, 0]),
    payload: {
      edge: {
        fromPartUri: layout,
        toPartUri: 'ppt/media/source.png',
        relationshipId: 'imageOne',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        source: styleLocation('ppt/slideLayouts/_rels/slideLayout1.xml.rels'),
      },
      asset: {
        partUri: 'ppt/media/source.png',
        preconditionHash: 'b'.repeat(64),
        byteLength: 68,
        width: 1,
        height: 1,
        format: 'png',
        src: '/uploads/source.png',
      },
    },
  }
  document.styles.provider.payload.properties.fill = authored({
    blip: authored({
      embed: authored('imageOne'),
      bindingId: 'imageBinding',
      dpi: authored(0),
      rotWithShape: authored(false),
      srcRect: authored({ l: authored(10000) }),
      tile: authored({}),
    }),
  })
  return presentation
}
describe('linked source blip fill', () => {
  it('edits only occurrence parameters and preserves immutable image identity through reload', () => {
    const before = fixture()
    const next = operations.applyPresentationProjectionOperation(before, {
      type: capabilities.GEOMETRY_EDIT,
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-blip', blip: { srcRect: { l: 25000 }, tile: null, stretch: {} } },
    })
    expect(next.pptxSemantic.instances.i1.overrides.components.geometry).toEqual({
      geometryStyle: { fill: { blip: { srcRect: { l: 25000 }, tile: null, stretch: {} } } },
    })
    const reopened = semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(next)))
    expect(styles.materializeGeometry(reopened.pptxSemantic, 'i1').style.fill.blip).toEqual({
      bindingId: 'imageBinding',
      dpi: 0,
      rotWithShape: false,
      srcRect: { l: 25000 },
      stretch: {},
    })
    expect(reopened.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(reopened.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(reopened.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    expect(styles.materializeGeometry(reopened.pptxSemantic, 'i2').style.fill.blip).toHaveProperty(
      'tile'
    )
  })
  it('removes authored optional parameters without borrowing older fill declarations', () => {
    const before = fixture()
    const next = operations.applyPresentationProjectionOperation(before, {
      type: capabilities.GEOMETRY_EDIT,
      instanceId: 'i1',
      componentId: 'geometry',
      command: {
        type: 'fill-blip',
        blip: { dpi: null, rotWithShape: null, srcRect: null, tile: null },
      },
    })
    expect(styles.materializeGeometry(next.pptxSemantic, 'i1').style.fill.blip).toEqual({
      bindingId: 'imageBinding',
    })
    expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  })
  it.each([
    { bindingId: 'missing' },
    { embed: 'different' },
    { src: '/uploads/different.png' },
    { tile: {}, stretch: {} },
    { srcRect: { l: 12.5 } },
    { srcRect: { l: 100000 } },
    { stretch: { fillRect: { t: 60000, b: 40000 } }, tile: null },
    { tile: { sx: 0 } },
    { tile: { sy: 0 } },
  ])('rejects forged identity or malformed occurrence parameters %j', (blip) => {
    const before = fixture()
    semantic.normalizeSemanticPresentation(before)
    expect(() =>
      operations.applyPresentationProjectionOperation(before, {
        type: capabilities.GEOMETRY_EDIT,
        instanceId: 'i1',
        componentId: 'geometry',
        command: { type: 'fill-blip', blip },
      })
    ).toThrow()
  })
  it('normalizes and reloads immutable source media binding without asset cache in geometry', () => {
    const presentation = fixture()
    const before = structuredClone(presentation.pptxSemantic)
    const normalized = semantic.normalizeSemanticPresentation(presentation)
    const reopened = semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(normalized)))
    const geometry = styles.materializeGeometry(reopened.pptxSemantic, 'i1')
    expect(geometry.style.fill).toEqual({
      blip: {
        bindingId: 'imageBinding',
        dpi: 0,
        rotWithShape: false,
        srcRect: { l: 10000 },
        tile: {},
      },
    })
    expect(reopened.pptxSemantic.styles).toEqual(before.styles)
    expect(presentation.pptxSemantic).toEqual(before)
    expect(JSON.stringify(geometry)).not.toContain('/uploads/')
    expect(JSON.stringify(geometry)).not.toContain('imageOne')
  })
  it.each([
    [
      'missing intrinsic height',
      (document) => {
        delete document.styles.imageBinding.payload.asset.height
      },
    ],
    [
      'zero intrinsic width',
      (document) => {
        document.styles.imageBinding.payload.asset.width = 0
      },
    ],
    [
      'unknown image format',
      (document) => {
        document.styles.imageBinding.payload.asset.format = 'unknown'
      },
    ],
    [
      'unknown binding',
      (document) => {
        document.styles.provider.payload.properties.fill.value.blip.value.bindingId = 'missing'
      },
    ],
    [
      'wrong embed identity',
      (document) => {
        document.styles.imageBinding.payload.edge.relationshipId = 'other'
      },
    ],
    [
      'wrong declaration owner',
      (document) => {
        document.styles.imageBinding.payload.edge.fromPartUri = 'ppt/slides/slide1.xml'
      },
    ],
    [
      'wrong asset target',
      (document) => {
        document.styles.imageBinding.payload.asset.partUri = 'ppt/media/other.png'
      },
    ],
    [
      'foreign relationship type',
      (document) => {
        document.styles.imageBinding.payload.edge.type = 'urn:foreign/image'
      },
    ],
    [
      'wrong relationship source',
      (document) => {
        document.styles.imageBinding.payload.edge.source = styleLocation(
          'ppt/slides/_rels/slide1.xml.rels'
        )
      },
    ],
    [
      'remote asset cache',
      (document) => {
        document.styles.imageBinding.payload.asset.src = 'https://example.invalid/image.png'
      },
    ],
  ])('rejects invalid source binding: %s', (_name, mutate) => {
    const presentation = fixture()
    records.validateGeometryStyleRecords(presentation.pptxSemantic)
    mutate(presentation.pptxSemantic)
    expect(() => records.validateGeometryStyleRecords(presentation.pptxSemantic)).toThrow()
  })
})
