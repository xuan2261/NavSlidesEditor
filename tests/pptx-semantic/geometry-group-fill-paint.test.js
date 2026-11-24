// Synthetic affine/paint plumbing tests, not native pixel qualification.
import { describe, expect, it } from 'vitest'
import svg from '../../shared/src/pptx-geometry-svg.js'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import trees from '../../shared/src/pptx-semantic-render-tree.js'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import affine from '../../shared/src/pptx-affine.js'
import { createRequire } from 'node:module'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture.js'
import { styleLocation } from './geometry-style-fixture.js'
const require = createRequire(import.meta.url)
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
function fixture(fillKind = 'gradient') {
  const presentation = geometryGroupFillFixture()
  const document = presentation.pptxSemantic
  const wrap = (value) => ({
    source: structuredClone(document.styles.groupProvider.payload.properties.fill.source),
    value,
  })
  document.styles.groupProvider.payload.properties.fill = wrap({
    gradient: wrap({
      kind: 'linear',
      angle: wrap(0),
      scaled: wrap(true),
      rotWithShape: wrap(true),
      stops: [
        wrap({ pos: wrap(0), color: wrap({ kind: 'srgb', value: 'F01E3C' }) }),
        wrap({ pos: wrap(100000), color: wrap({ kind: 'srgb', value: '1E50F0' }) }),
      ],
    }),
  })
  if (fillKind === 'blip') {
    const layout = 'ppt/slideLayouts/slideLayout1.xml'
    document.styles.imageBinding = {
      kind: 'geometry-blip-binding',
      origin: 'source',
      source: styleLocation(layout, [0, 1]),
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
    document.styles.groupProvider.payload.properties.fill = wrap({
      blip: wrap({ embed: wrap('imageOne'), bindingId: 'imageBinding', stretch: wrap({}) }),
    })
  }
  delete document.styles.provider.payload.properties.stroke
  delete document.styles.provider.payload.properties.effects
  const geometry = document.definitions.definition.content.geometry
  Object.assign(geometry, {
    width: 48,
    height: 72,
    paths: [
      {
        componentId: 'path',
        commands: [
          { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
          { kind: 'lnTo', points: [{ componentId: 'control', x: 48, y: 0 }] },
          { kind: 'lnTo', points: [{ componentId: 'second', x: 48, y: 72 }] },
          { kind: 'lnTo', points: [{ componentId: 'end', x: 0, y: 72 }] },
          { kind: 'close' },
        ],
      },
    ],
  })
  document.styles.provider.payload.transform.value.ext.value.cx.value = 48
  document.styles.provider.payload.transform.value.ext.value.cy.value = 72
  const group = document.styles.groupProvider.payload.transform.value
  group.ext.value.cx.value = 128
  group.ext.value.cy.value = 96
  group.chExt.value.cx.value = 128
  group.chExt.value.cy.value = 96
  document.instances.g1.localTransform = [1, 0, 0, 1, 0, 0]
  document.instances.g2.localTransform = [1, 0, 0, 1, 0, 0]
  document.instances.i1.localTransform = [1, 0, 0, 1, 0, 12]
  document.instances.i3 = {
    ...structuredClone(document.instances.i1),
    id: 'i3',
    paintIndex: 1,
    localTransform: [1, 0, 0, 1, 64, 12],
  }
  presentation.slides[0].elements.push({
    ...presentation.slides[0].elements[0],
    id: 'i3',
    pptxInstanceId: 'i3',
    zIndex: 1,
  })
  return semantic.normalizeSemanticPresentation(presentation)
}
function nodes(xml) {
  const visit = (node) => [node, ...node.children.flatMap(visit)]
  return parseXml(`<svg xmlns="http://www.w3.org/2000/svg">${xml}</svg>`).flatMap(visit)
}
const attribute = (node, name) => node.attrs.find((entry) => entry.name === name)?.value
function render(document, id) {
  const geometry = styles.materializeGeometry(document, id)
  return svg.geometrySvgPathsString(geometry, {
    width: 48,
    height: 72,
    fill: 'none',
    stroke: 'none',
    strokeWidth: 0,
    fillFrame: styles.geometryFillFrame(document, id),
    blipAsset: geometry.style?.fill?.blip
      ? document.styles[geometry.style.fill.blip.bindingId].payload.asset
      : undefined,
  })
}
describe('group owner paint through existing leaf paths', () => {
  it.each(['base', 'explicit', 'hidden', 'rotated'])(
    'uses occupied native image bounds for %s descendants',
    (variant) => {
      const presentation = structuredClone(fixture('blip'))
      const document = presentation.pptxSemantic
      if (variant === 'rotated') document.instances.i3.localTransform = [0, 1, -1, 0, 124, 24]
      if (variant === 'explicit' || variant === 'hidden') {
        document.instances.far = {
          ...structuredClone(document.instances.i1),
          id: 'far',
          hidden: variant === 'hidden',
          localTransform: [1, 0, 0, 1, 180, 12],
          overrides: {
            components: {
              geometry: { geometryStyle: { fill: { color: { kind: 'srgb', value: '112233' } } } },
            },
          },
        }
        presentation.slides[0].elements.push({
          ...presentation.slides[0].elements[0],
          id: 'far',
          pptxInstanceId: 'far',
        })
      }
      const checked = semantic.normalizeSemanticPresentation(presentation).pptxSemantic
      const before = JSON.stringify(checked)
      expect(styles.geometryFillFrame(checked, 'i1')).toMatchObject({
        width: variant === 'explicit' ? 228 : variant === 'rotated' ? 124 : 112,
        height: 72,
        paintToWorld: [1, 0, 0, 1, 0, 12],
      })
      expect(JSON.stringify(checked)).toBe(before)
    }
  )
  it('threads source group image frames into real shared leaf SVG without canonical paint caches', () => {
    const presentation = fixture('blip')
    const document = presentation.pptxSemantic
    const before = structuredClone(presentation)
    const pattern = nodes(render(document, 'i3')).find((node) => node.local === 'pattern')
    expect(attribute(pattern, 'width')).toBe('112')
    expect(attribute(pattern, 'height')).toBe('72')
    expect(attribute(pattern, 'patternTransform')).toBe('matrix(1 0 0 1 -64 0)')
    const root = trees.semanticRenderTree(document, presentation.slides[0])[0]
    const leaf = root.children.find((node) => node.instanceId === 'i3')
    expect(leaf.element.pptxFillFrame).toEqual(styles.geometryFillFrame(document, 'i3'))
    expect(leaf.element.pptxBlipAsset).toEqual(document.styles.imageBinding.payload.asset)
    expect(presentation).toEqual(before)
  })
  it.each([
    { angle: 90, scaled: true, start: [56, 0], end: [56, 72] },
    { angle: 45, scaled: false, start: [10, -10], end: [102, 82] },
    {
      angle: 45,
      scaled: true,
      start: [221447.65625 / 9525, -142359.203125 / 9525],
      end: [
        (221447.65625 + 1024 * 609.2819213867188) / 9525,
        (-142359.203125 + 1024 * 947.7719116210938) / 9525,
      ],
    },
  ])('matches genuine native brush endpoints at $angle degrees (scaled $scaled)', (entry) => {
    const presentation = structuredClone(fixture())
    const gradient =
      presentation.pptxSemantic.styles.groupProvider.payload.properties.fill.value.gradient.value
    gradient.angle.value = entry.angle * 60000
    gradient.scaled.value = entry.scaled
    const document = semantic.normalizeSemanticPresentation(presentation).pptxSemantic
    const before = JSON.stringify(document)
    const definition = nodes(render(document, 'i1')).find((node) => node.local === 'linearGradient')
    const matrix = attribute(definition, 'gradientTransform').slice(7, -1).split(' ').map(Number)
    for (const [number, expected] of [
      [1, entry.start],
      [2, entry.end],
    ]) {
      const point = affine.transformPoint(matrix, {
        x: Number(attribute(definition, 'x' + number)),
        y: Number(attribute(definition, 'y' + number)),
      })
      expect(point.x).toBeCloseTo(expected[0], 4)
      expect(point.y).toBeCloseTo(expected[1], 4)
    }
    const start = {
      x: Number(attribute(definition, 'x1')),
      y: Number(attribute(definition, 'y1')),
    }
    const direction = {
      x: Number(attribute(definition, 'x2')) - start.x,
      y: Number(attribute(definition, 'y2')) - start.y,
    }
    const physicalDirection = {
      x: entry.end[0] - entry.start[0],
      y: entry.end[1] - entry.start[1],
    }
    // SVG transforms a scalar field, not just its two endpoints. Nonuniform
    // scaling changes the normal by inverse transpose.
    for (const point of [
      { x: 4, y: 4 },
      { x: 44, y: 64 },
    ]) {
      const local = affine.transformPoint(affine.invert(matrix), point)
      const actual =
        ((local.x - start.x) * direction.x + (local.y - start.y) * direction.y) /
        (direction.x ** 2 + direction.y ** 2)
      const expected =
        ((point.x - entry.start[0]) * physicalDirection.x +
          (point.y - entry.start[1]) * physicalDirection.y) /
        (physicalDirection.x ** 2 + physicalDirection.y ** 2)
      expect(actual).toBeCloseTo(expected, 6)
    }
    expect(JSON.stringify(document)).toBe(before)
  })
  it('uses the owner gradient frame rather than restarting at leaf bounds', () => {
    const { pptxSemantic: document } = fixture()
    const gradient = nodes(render(document, 'i3')).find((node) => node.local === 'linearGradient')
    const matrix = attribute(gradient, 'gradientTransform').slice(7, -1).split(' ').map(Number)
    expect(matrix).toEqual([1, 0, 0, 1, -64, 0])
    expect(attribute(gradient, 'x1')).toBe('0')
    expect(attribute(gradient, 'x2')).toBe('112')
    const rendered = nodes(render(document, 'i3'))
    expect(rendered.filter((node) => node.local === 'rect')).toHaveLength(0)
    expect(
      rendered.some(
        (node) =>
          node.local === 'path' &&
          attribute(node, 'style')
            ?.split(';')
            .includes(`fill:url(#${attribute(gradient, 'id')})`)
      )
    ).toBe(true)
  })
  it.each([false, true])(
    'includes an explicit painted descendant but excludes a hidden far child (%s)',
    (hidden) => {
      const presentation = structuredClone(fixture())
      const document = presentation.pptxSemantic
      document.instances.far = {
        ...structuredClone(document.instances.i1),
        id: 'far',
        hidden,
        localTransform: [1, 0, 0, 1, 180, 12],
        overrides: {
          components: {
            geometry: {
              geometryStyle: {
                fill: {
                  color: { kind: 'srgb', value: '112233' },
                },
              },
            },
          },
        },
      }
      presentation.slides[0].elements.push({
        ...presentation.slides[0].elements[0],
        id: 'far',
        pptxInstanceId: 'far',
      })
      const checked = semantic.normalizeSemanticPresentation(presentation).pptxSemantic
      expect(styles.geometryFillFrame(checked, 'i1')).toMatchObject({
        width: hidden ? 112 : 228,
        height: 72,
        paintToWorld: [1, 0, 0, 1, 0, 12],
      })
    }
  )
  it('uses transformed descendant frames for a rotated child without changing authored group extent', () => {
    const presentation = structuredClone(fixture())
    presentation.pptxSemantic.instances.i3.localTransform = [0, 1, -1, 0, 124, 24]
    const document = semantic.normalizeSemanticPresentation(presentation).pptxSemantic
    expect(styles.geometryFillFrame(document, 'i1')).toMatchObject({
      width: 124,
      height: 72,
      paintToWorld: [1, 0, 0, 1, 0, 12],
    })
    expect(document.styles.groupProvider.payload.transform.value.ext.value.cx.value).toBe(128)
    expect(document.styles.groupProvider.payload.transform.value.ext.value.cy.value).toBe(96)
  })
  it('gives separated leaves distinct paint server IDs when their owner-to-leaf frames differ', () => {
    const { pptxSemantic: document } = fixture()
    const first = nodes(render(document, 'i1')).find((node) => node.local === 'linearGradient')
    const second = nodes(render(document, 'i3')).find((node) => node.local === 'linearGradient')
    expect(attribute(first, 'id')).not.toBe(attribute(second, 'id'))
  })
  it('forwards the transient frame on render DTOs without writing it into canonical/source data', () => {
    const presentation = fixture()
    const before = structuredClone(presentation)
    const root = trees.semanticRenderTree(presentation.pptxSemantic, presentation.slides[0])[0]
    const leaf = root.children.find((node) => node.instanceId === 'i3')
    expect(root.element).toBeUndefined()
    expect(leaf.element.pptxFillFrame).toEqual(
      styles.geometryFillFrame(presentation.pptxSemantic, 'i3')
    )
    expect(presentation).toEqual(before)
    expect(presentation.pptxSemantic.instances.i3.overrides).toEqual({})
  })
})
