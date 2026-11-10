// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ShapeRenderer } from '../../client/src/components/canvas/element-renderers/shape-element-renderer'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import tree from '../../shared/src/pptx-semantic-render-tree.js'
import { compactSemanticGraph } from '../../shared/src/pptx-semantic-source-graph.js'
import operations from '../../shared/src/pptx-projection-operation.js'
import shape from '../../shared/src/shapeUtils.js'
import svg from '../../shared/src/pptx-geometry-svg.js'
import documents from '../../shared/src/pptx-semantic-document.js'
import programs from '../../shared/src/pptx-geometry-effect-program.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture.js'
import { authored, styleLocation, inheritedGeometryStyleFixture } from './geometry-style-fixture.js'

afterEach(cleanup)
const owner = 'ppt/slideLayouts/slideLayout1.xml'
function fixture(group = false) {
  const presentation = group
    ? geometryGroupFillFixture()
    : {
        ...geometryProjectionFixture(),
        pptxSemantic: inheritedGeometryStyleFixture(),
      }
  const document = presentation.pptxSemantic
  const overlay = (id) =>
    authored({
      kind: 'fillOverlay',
      blend: authored('over'),
      fill: authored({
        blip: authored({
          embed: authored(id),
          bindingId: id,
          stretch: authored({}),
        }),
      }),
    })
  for (const id of ['imageOne', 'imageTwo']) {
    document.styles[id] = {
      kind: 'geometry-blip-binding',
      origin: 'source',
      source: styleLocation(owner, [0, 0, 0]),
      payload: {
        edge: {
          fromPartUri: owner,
          toPartUri: `ppt/media/${id}.png`,
          relationshipId: id,
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
          source: styleLocation('ppt/slideLayouts/_rels/slideLayout1.xml.rels'),
        },
        asset: {
          partUri: `ppt/media/${id}.png`,
          preconditionHash: 'b'.repeat(64),
          byteLength: 68,
          width: 1,
          height: 1,
          format: 'png',
          src: `/uploads/${id}.png`,
        },
      },
    }
  }
  document.styles.provider.payload.properties.effects = authored({
    kind: 'dag',
    type: authored('tree'),
    effects: [
      authored({
        kind: 'cont',
        type: authored('tree'),
        effects: [overlay('imageOne'), overlay('imageTwo')],
      }),
    ],
  })
  return presentation
}
function projected(presentation) {
  let node = tree.semanticRenderTree(presentation.pptxSemantic, presentation.slides[0])[0]
  while (node.children.length) node = node.children[0]
  return node.element
}
it('regenerates multiple nested overlay assets from canonical bindings after edit and JSON restore', () => {
  const input = fixture()
  input.slides[0].elements[0].pptxEffectFillAssets = {
    imageOne: { src: '/uploads/forged.png', width: 12, height: 12 },
    foreign: { src: '/uploads/foreign.png', width: 12, height: 12 },
  }
  const before = structuredClone(input)
  const normalized = semantic.normalizeSemanticPresentation(input)
  const next = operations.applyPresentationProjectionOperation(normalized, {
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'adjustment', name: 'adj', value: 50000 },
  })
  delete next.slides[0].elements[0].pptxEffectFillAssets
  const reopened = semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(next)))
  const element = projected(reopened)
  expect(element.pptxEffectFillAssets).toEqual({
    imageOne: reopened.pptxSemantic.styles.imageOne.payload.asset,
    imageTwo: reopened.pptxSemantic.styles.imageTwo.payload.asset,
  })
  expect(element.pptxEffectFillAssets.imageOne).not.toBe(
    reopened.pptxSemantic.styles.imageOne.payload.asset
  )
  expect(reopened.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  expect(reopened.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(reopened.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(input).toEqual(before)
})
it.each(['missing', 'embed', 'source'])(
  'rejects a %s source overlay binding even with a client asset cache',
  (kind) => {
    const input = fixture()
    const blip =
      input.pptxSemantic.styles.provider.payload.properties.effects.value.effects[0].value
        .effects[0].value.fill.value.blip.value
    if (kind === 'missing') blip.bindingId = 'missing'
    if (kind === 'embed') blip.embed.value = 'different'
    if (kind === 'source') input.pptxSemantic.styles.imageOne.source.componentLocator.path = [9]
    input.slides[0].elements[0].pptxEffectFillAssets = {
      missing: input.pptxSemantic.styles.imageOne.payload.asset,
    }
    expect(() => semantic.normalizeSemanticPresentation(input)).toThrow(/blip binding/i)
    expect(() => documents.normalizePptxSemanticDocument(input.pptxSemantic)).toThrow(
      /blip binding/i
    )
  }
)
it('regenerates standalone render-tree assets without trusting a compatibility cache', () => {
  const input = fixture()
  input.slides[0].elements[0].pptxEffectFillAssets = {
    foreign: { src: '/uploads/forged.png', width: 1, height: 1 },
  }
  const before = structuredClone(input)
  const element = projected(input)
  expect(element.pptxEffectFillAssets).toEqual({
    imageOne: input.pptxSemantic.styles.imageOne.payload.asset,
    imageTwo: input.pptxSemantic.styles.imageTwo.payload.asset,
  })
  expect(element.pptxEffectFillAssets.imageOne).not.toBe(
    input.pptxSemantic.styles.imageOne.payload.asset
  )
  expect(input).toEqual(before)
})
it('rejects an occurrence overlay whose embed differs from its immutable binding', () => {
  const input = semantic.normalizeSemanticPresentation(fixture())
  const before = structuredClone(input)
  const effects = programs.unwrapGeometryEffectValue(
    input.pptxSemantic.styles.provider.payload.properties.effects.value
  )
  effects.effects[0].effects[0].fill.blip.embed = 'different'
  expect(() =>
    operations.applyPresentationProjectionOperation(input, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'effects', effects },
    })
  ).toThrow()
  expect(input).toEqual(before)
})
it.each([1, 2])(
  'drops stale render-tree overlay cache without canonical overlays in schema %s',
  (schema) => {
    const input = schema === 1 ? geometryProjectionFixture() : fixture()
    if (schema === 2)
      input.pptxSemantic.styles.provider.payload.properties.effects = authored({
        kind: 'list',
        effects: [],
      })
    input.slides[0].elements[0].pptxEffectFillAssets = {
      foreign: { src: '/uploads/forged.png', width: 1, height: 1 },
    }
    expect(projected(input)).not.toHaveProperty('pptxEffectFillAssets')
  }
)
it('removes stale overlay assets when the canonical program has no image overlays', () => {
  const input = fixture()
  input.pptxSemantic.styles.provider.payload.properties.effects = authored({
    kind: 'list',
    effects: [],
  })
  input.slides[0].elements[0].pptxEffectFillAssets = {
    imageOne: input.pptxSemantic.styles.imageOne.payload.asset,
  }
  expect(semantic.normalizeSemanticPresentation(input).slides[0].elements[0]).not.toHaveProperty(
    'pptxEffectFillAssets'
  )
})
it('keeps transient asset mutations separate from source and sibling occurrences', () => {
  const normalized = semantic.normalizeSemanticPresentation(fixture())
  const first = normalized.slides[0].elements[0].pptxEffectFillAssets
  const sibling = normalized.slides[1].elements[0].pptxEffectFillAssets
  first.imageOne.src = '/uploads/changed.png'
  expect(sibling.imageOne.src).toBe('/uploads/imageOne.png')
  expect(normalized.pptxSemantic.styles.imageOne.payload.asset.src).toBe('/uploads/imageOne.png')
})
it('renders the same verified overlay definitions through canvas and shared SVG callers', () => {
  const input = semantic.normalizeSemanticPresentation(fixture())
  const element = projected(input)
  const { container } = render(<ShapeRenderer element={element} isSelected={false} />)
  const shared = new DOMParser().parseFromString(shape.shapeSvgString(element), 'text/html')
  expect(
    [...container.querySelectorAll('image')].map((image) => image.getAttribute('href'))
  ).toEqual(['/uploads/imageOne.png', '/uploads/imageTwo.png'])
  expect([...shared.querySelectorAll('image')].map((image) => image.getAttribute('href'))).toEqual([
    '/uploads/imageOne.png',
    '/uploads/imageTwo.png',
  ])
  const serialize = (root) =>
    [...root.querySelectorAll('pattern')].map((pattern) =>
      new XMLSerializer().serializeToString(pattern)
    )
  expect(serialize(container)).toEqual(serialize(shared))
})
it('does not apply the inherited group base-fill frame to a leaf overlay', () => {
  const input = semantic.normalizeSemanticPresentation(fixture(true))
  const element = projected(input)
  expect(element.pptxFillFrame.ownerInstanceId).toBe('g1')
  const options = {
    width: element.width,
    height: element.height,
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
    occurrenceMatrix: element.pptxOccurrenceMatrix,
    effectFillAssets: {
      imageOne: input.pptxSemantic.styles.imageOne.payload.asset,
      imageTwo: input.pptxSemantic.styles.imageTwo.payload.asset,
    },
  }
  const withGroup = svg.geometrySvgPathsString(element.pptxGeometry, {
    ...options,
    fillFrame: element.pptxFillFrame,
  })
  const leaf = svg.geometrySvgPathsString(element.pptxGeometry, options)
  const patterns = (value) =>
    [
      ...new DOMParser()
        .parseFromString(`<svg>${value}</svg>`, 'image/svg+xml')
        .querySelectorAll('pattern'),
    ].map((pattern) => [
      pattern.getAttribute('width'),
      pattern.getAttribute('height'),
      pattern.getAttribute('patternTransform'),
    ])
  expect(patterns(withGroup)).toEqual(patterns(leaf))
})

it('validates overlay blip bindings and resolves assets on schemaVersion 3 models', () => {
  const input = fixture()
  const expectedAsset = structuredClone(input.pptxSemantic.styles.imageOne.payload.asset)
  input.pptxSemantic = compactSemanticGraph(input.pptxSemantic)
  expect(() => tree.semanticRenderTree(input.pptxSemantic, input.slides[0])).not.toThrow()
  const element = projected(input)
  expect(element.pptxEffectFillAssets).toBeDefined()
  expect(element.pptxEffectFillAssets.imageOne).toEqual(expectedAsset)
})
