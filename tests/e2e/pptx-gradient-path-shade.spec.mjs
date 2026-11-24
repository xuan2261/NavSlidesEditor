// Synthetic renderer/operation regressions, not native fidelity qualification.
import { createRequire } from 'node:module'
import { expect, test as it } from '@playwright/test'
import { geometryProjectionFixture } from '../pptx-semantic/geometry-projection-fixture.js'
const require = createRequire(import.meta.url)
const { normalizeGeometryDocument } = require('../../shared/src/pptx-geometry-document')
const { geometrySvgPathsString } = require('../../shared/src/pptx-geometry-svg')
const { gradientPaintStops, gradientPaintId } = require('../../shared/src/pptx-geometry-gradient')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const {
  applyPresentationProjectionOperation,
} = require('../../shared/src/pptx-projection-operation')

const gradients = [
  { kind: 'linear', angle: 0, scaled: true, rotWithShape: true },
  {
    kind: 'path',
    path: 'circle',
    rotWithShape: true,
    fillToRect: { l: 50000, t: 50000, r: 50000, b: 50000 },
  },
].map((parameters) => ({
  ...parameters,
  stops: [
    { pos: 0, color: { kind: 'srgb', value: 'FFFFFF' } },
    { pos: 100000, color: { kind: 'srgb', value: 'FFFFFF' } },
  ],
}))
function rectangle(componentId, x, fill) {
  const points = [
    [x, 0],
    [x + 40, 0],
    [x + 40, 40],
    [x, 40],
  ].map(([px, py], index) => ({
    componentId: `${componentId}-${index}`,
    x: px * 9525,
    y: py * 9525,
  }))
  return {
    componentId,
    fill,
    commands: points
      .map((point, index) => ({
        kind: index === 0 ? 'moveTo' : 'lnTo',
        points: [point],
      }))
      .concat({ kind: 'close' }),
  }
}
function geometry(gradient) {
  return {
    schemaVersion: 1,
    componentId: 'geometry',
    kind: 'custom',
    width: 100 * 9525,
    height: 40 * 9525,
    adjustments: [],
    guides: [],
    handles: [],
    paths: [rectangle('normal', 0, 'norm'), rectangle('shaded', 50, 'darken')],
    style: { fill: { gradient } },
  }
}
async function sample(page, input) {
  const body = geometrySvgPathsString(normalizeGeometryDocument(input), {
    width: 100,
    height: 40,
    fill: 'none',
    stroke: 'none',
    strokeWidth: 0,
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40">${body}</svg>`
  await page.setContent(svg)
  const data = await page.evaluate(async (source) => {
    const { Image, btoa, document } = globalThis
    const image = new Image()
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
    })
    image.src = 'data:image/svg+xml;base64,' + btoa(source)
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 40
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    return [...context.getImageData(0, 0, 100, 40).data]
  }, svg)
  return { body, pixel: (x, y) => data.slice((y * 100 + x) * 4, (y * 100 + x) * 4 + 4) }
}

for (const gradient of gradients) {
  it(`renders normal and darkened ${gradient.kind} gradient paths independently`, async ({
    page,
  }) => {
    const input = geometry(gradient),
      before = globalThis.structuredClone(input)
    const normalized = normalizeGeometryDocument(input)
    const { pixel } = await sample(page, normalized)
    expect(pixel(20, 20)).toEqual([255, 255, 255, 255])
    expect(pixel(70, 20)).toEqual([153, 153, 153, 255])
    expect(normalized.style.fill.gradient).toEqual(gradient)
    expect(input).toEqual(before)
  })
}

const modeColors = [
  ['lighten', [162, 192, 222], [200, 157, 221]],
  ['lightenLess', [130, 171, 211], [181, 123, 210]],
  ['darken', [60, 90, 120], [98, 55, 119]],
  ['darkenLess', [80, 121, 161], [131, 73, 160]],
]
for (const gradient of gradients)
  for (const [mode, rgb] of modeColors) {
    it(`shades ${gradient.kind} ${mode} fill without shading line or normal paint`, async ({
      page,
    }) => {
      const input = geometry({
        ...gradient,
        stops: gradient.stops.map((stop) => ({
          ...stop,
          color: { kind: 'srgb', value: '6496C8' },
        })),
      })
      input.paths[1].fill = mode
      input.style.stroke = { color: { kind: 'srgb', value: '0000FF' }, width: 19050 }
      const before = globalThis.structuredClone(input),
        { pixel } = await sample(page, input)
      expect(pixel(20, 20)).toEqual([100, 150, 200, 255])
      expect(pixel(70, 20)).toEqual([...rgb, 255])
      expect(pixel(50, 20)).toEqual([0, 0, 255, 255])
      expect(input).toEqual(before)
    })
  }

for (const [mode, rgb, heldout] of modeColors) {
  it(`preserves ordered alpha/hard-stop data for ${mode}`, () => {
    const gradient = {
      ...gradients[0],
      stops: [
        {
          pos: 0,
          color: { kind: 'srgb', value: 'A35BC7', transforms: [{ kind: 'alpha', value: 0 }] },
        },
        {
          pos: 50000,
          color: { kind: 'srgb', value: 'A35BC7', transforms: [{ kind: 'alpha', value: 25000 }] },
        },
        {
          pos: 50000,
          color: { kind: 'srgb', value: '6496C8', transforms: [{ kind: 'alpha', value: 75000 }] },
        },
        { pos: 100000, color: { kind: 'srgb', value: '6496C8' } },
      ],
    }
    const before = globalThis.structuredClone(gradient)
    const normal = gradientPaintStops(gradient),
      paint = gradientPaintStops(gradient, mode)
    expect(paint.map(({ pos, alpha }) => [pos, alpha])).toEqual(
      normal.map(({ pos, alpha }) => [pos, alpha])
    )
    expect(paint.filter((stop) => stop.pos === 0.5)).toEqual([
      { pos: 0.5, rgb: heldout, alpha: 64 },
      { pos: 0.5, rgb, alpha: 191 },
    ])
    expect(paint.every((stop) => stop.rgb.every(Number.isFinite))).toBe(true)
    expect(gradient).toEqual(before)
  })
}

it('lightens resolved source endpoints before nonlinear paint replay', () => {
  const gradient = {
    ...gradients[0],
    stops: [
      { pos: 0, color: { kind: 'srgb', value: '000000' } },
      { pos: 100000, color: { kind: 'srgb', value: 'FFFFFF' } },
    ],
  }
  // Parameter128/255 differs from the native midpoint's pixel coordinate.
  expect(gradientPaintStops(gradient)[128].rgb).toEqual([187, 187, 187])
  expect(gradientPaintStops(gradient, 'lighten')[128].rgb).toEqual([197, 197, 197])
})

it('deduplicates modifier definitions without replacing normal paint identity', async ({
  page,
}) => {
  const input = geometry(gradients[0])
  input.paths.push(rectangle('another-shaded', 0, 'darken'), rectangle('unpainted', 0, 'none'))
  const normal = gradientPaintId(input),
    { body } = await sample(page, input)
  expect(body.split(`id="${normal}"`).length - 1).toBe(1)
  expect(body.split(`id="${normal}-darken"`).length - 1).toBe(1)
  expect(body).toContain(`style="fill:url(#${normal});stroke:none;`)
  expect(body).not.toContain(`${normal}-none`)
})

for (const gradient of [
  ...gradients,
  ...['rect', 'shape'].map((path) => ({ ...gradients[1], path })),
]) {
  it(`keeps shaded ${gradient.kind}/${gradient.path ?? 'linear'} paint and line visible through an effect source image`, async ({
    page,
  }) => {
    const input = geometry(gradient)
    input.style.stroke = { color: { kind: 'srgb', value: '0000FF' }, width: 19050 }
    input.style.effects = { kind: 'dag', effects: [{ kind: 'effect', ref: 'fillLine' }] }
    const { pixel } = await sample(page, input)
    expect(pixel(20, 20)).toEqual([255, 255, 255, 255])
    expect(pixel(70, 20)).toEqual([153, 153, 153, 255])
    expect(pixel(50, 20)).toEqual([0, 0, 255, 255])
  })
}

it('does not transfer path shading to a separate gradient fill overlay', async ({ page }) => {
  const input = geometry(gradients[1])
  input.style.effects = {
    kind: 'list',
    effects: [
      {
        kind: 'fillOverlay',
        blend: 'over',
        fill: {
          gradient: {
            ...gradients[0],
            stops: gradients[0].stops.map((stop) => ({
              ...stop,
              color: { kind: 'srgb', value: 'FF0000' },
            })),
          },
        },
      },
    ],
  }
  const { pixel } = await sample(page, input)
  expect(pixel(20, 20)).toEqual([255, 0, 0, 255])
  expect(pixel(70, 20)).toEqual([255, 0, 0, 255])
})

for (const gradient of gradients) {
  it(`edits and reopens a shaded ${gradient.kind} gradient without changing source or sibling`, () => {
    const initial = geometryProjectionFixture()
    initial.pptxSemantic.definitions.definition.content.geometry.paths[0].fill = 'darken'
    const before = globalThis.structuredClone(initial)
    const changed = applyPresentationProjectionOperation(initial, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-gradient', gradient },
    })
    const changedGeometry =
      changed.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument
    expect(changedGeometry.paths[0].fill).toBe('darken')
    expect(changedGeometry.style.fill.gradient).toEqual(gradient)
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(changed)))
    expect(reopened.pptxSemantic).toEqual(changed.pptxSemantic)
    expect(changed.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(changed.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    expect(initial).toEqual(before)
  })
}
