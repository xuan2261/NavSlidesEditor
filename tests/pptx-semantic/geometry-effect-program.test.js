// Derived SVG behavior, not a PowerPoint/native visual qualification.
import { describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import effects from '../../shared/src/pptx-geometry-effects.js'
import model from '../../shared/src/pptx-geometry-document.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'

const color = { kind: 'srgb', value: 'ff0000' }
const shadow = { kind: 'outerShdw', color, dist: 190500, dir: 0 }
const base = {
  width: 60,
  height: 60,
  bounds: [20, 20, 60, 60],
  ink: '<rect x="20" y="20" width="40" height="40" fill="#00ff00" fill-opacity=".5"/>',
}
const geometry = (program) => ({
  ...geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry,
  style: { effects: program },
})
const result = (program, options = base) => effects.geometryEffectResult(geometry(program), options)
const pixel = async (body) => {
  const image = await loadImage(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">${body}</svg>`)
  )
  const ctx = createCanvas(180, 180).getContext('2d')
  ctx.drawImage(image, 0, 0)
  return (x, y) => [...ctx.getImageData(x, y, 1, 1).data]
}
describe('source effect program', () => {
  it('retains a recursive program and replaces it immutably without seeding defaults', () => {
    const program = {
      kind: 'dag',
      type: 'tree',
      effects: [
        { kind: 'cont', name: 'shadow', effects: [shadow] },
        { kind: 'effect', ref: 'shadow' },
        { kind: 'blur', rad: 28575 },
      ],
    }
    const original = geometry({ kind: 'list', effects: [] })
    expect(
      model.editGeometryDocument(original, { type: 'effects', effects: program }).style.effects
    ).toEqual(program)
    expect(original.style.effects.effects).toEqual([])
    expect(
      model.editGeometryDocument(original, { type: 'effects', effects: null }).style.effects
    ).toEqual({ kind: 'list', effects: [] })
  })
  it('applies tree effects to raw preceding output, not the original shape', async () => {
    const out = result({ kind: 'dag', type: 'tree', effects: [shadow, shadow] })
    const sample = await pixel(out.ink)
    expect(sample(25, 40)[3]).toBe(0)
    expect(sample(65, 40)).toEqual([255, 0, 0, 128])
    expect(out.bounds[2]).toBeGreaterThanOrEqual(100)
  })
  it('keeps sibling effects independent rather than growing the shadow chain', async () => {
    const out = result({ kind: 'dag', type: 'sib', effects: [shadow, shadow] })
    const sample = await pixel(out.ink)
    expect(sample(95, 40)[3]).toBe(0)
    expect(sample(65, 40)[3]).toBeGreaterThan(128)
    expect(out.bounds[2]).toBeLessThan(90)
  })
  it('references the captured named image instead of reapplying its program', async () => {
    const out = result({
      kind: 'dag',
      type: 'tree',
      effects: [
        { kind: 'cont', name: 'shifted', type: 'tree', effects: [shadow] },
        shadow,
        { kind: 'effect', ref: 'shifted' },
      ],
    })
    const sample = await pixel(out.ink)
    expect(sample(45, 40)[3]).toBe(128)
    expect(sample(95, 40)[3]).toBe(0)
  })
  it.each([
    { kind: 'dag', effects: [{ kind: 'effect', ref: 'missing' }] },
    { kind: 'dag', name: 'cycle', effects: [{ kind: 'effect', ref: 'cycle' }] },
    {
      kind: 'dag',
      effects: [
        { kind: 'cont', name: 'same', effects: [] },
        { kind: 'cont', name: 'same', effects: [] },
      ],
    },
    {
      kind: 'dag',
      type: 'tree',
      effects: [
        { kind: 'effect', ref: 'later' },
        { kind: 'cont', name: 'later', type: 'tree', effects: [shadow] },
      ],
    },
  ])('rejects invalid dependencies atomically: %j', (program) => {
    expect(() => model.normalizeGeometryDocument(geometry(program))).toThrow()
  })
  it('propagates expanded support through a later blur', () => {
    const out = result({
      kind: 'dag',
      type: 'tree',
      effects: [shadow, { kind: 'blur', rad: 28575 }],
    })
    expect(out.bounds[2]).toBeGreaterThanOrEqual(85)
    expect(out.ink).toContain('width="52"')
  })
  it('resolves a forward reference to its authored sibling input, not the reference input', async () => {
    const out = result({
      kind: 'dag',
      effects: [
        { kind: 'effect', ref: 'later' },
        { kind: 'cont', name: 'later', type: 'tree', effects: [shadow] },
      ],
    })
    const sample = await pixel(out.ink)
    expect(sample(45, 40)[3]).toBeGreaterThan(128)
    expect(sample(95, 40)[3]).toBe(0)
  })
  it('rejects an invalid reference even when a later reference bypasses its output', () => {
    expect(() =>
      result({
        kind: 'dag',
        type: 'tree',
        effects: [
          { kind: 'effect', ref: 'missing' },
          { kind: 'effect', ref: 'fillLine' },
        ],
      })
    ).toThrow(/effect program/)
  })
  it('preserves source alpha under a solid fill overlay and preserves holes', async () => {
    const out = result(
      { kind: 'list', effects: [{ kind: 'fillOverlay', blend: 'over', fill: { color } }] },
      { ...base, sourceImages: { fill: base, line: { ink: '', bounds: null } } }
    )
    const sample = await pixel(out.ink)
    expect(sample(40, 40)).toEqual([255, 0, 0, 128])
    expect(sample(10, 40)[3]).toBe(0)
  })
  it('reflects source colors with authored opacity endpoints and expanded support', async () => {
    const out = result({
      kind: 'list',
      effects: [{ kind: 'reflection', sy: -100000, algn: 'b', stA: 100000, endA: 100000 }],
    })
    const sample = await pixel(out.ink)
    expect(sample(40, 80)).toEqual([0, 255, 0, 128])
    expect(out.bounds[3]).toBeGreaterThanOrEqual(100)
  })
  it('uses the fixed list graph, so reflection includes the outer shadow', async () => {
    const out = result({
      kind: 'list',
      effects: [shadow, { kind: 'reflection', sy: -100000, stA: 100000, endA: 100000 }],
    })
    const sample = await pixel(out.ink)
    expect(sample(75, 80)).toEqual([255, 0, 0, 128])
  })
  it('expands the documented large preset without changing the source parameters', () => {
    const program = { kind: 'list', effects: [{ kind: 'prstShdw', prst: 'shdw10', color }] }
    const before = structuredClone(program)
    const out = result(program)
    expect(out.ink).toContain('matrix(1.25 0 0 1.25 -15 -15)')
    expect(program).toEqual(before)
  })
  it('uses authored DAG built-in fill and line images without repainting the other input', async () => {
    const out = result(
      { kind: 'dag', type: 'tree', effects: [{ kind: 'effect', ref: 'line' }, shadow] },
      {
        ...base,
        sourceImages: {
          fill: base,
          line: {
            ink: '<rect x="5" y="5" width="5" height="5" fill="blue"/>',
            bounds: [5, 5, 10, 10],
          },
        },
      }
    )
    const sample = await pixel(out.ink)
    expect(sample(27, 7)).toEqual([255, 0, 0, 255])
    expect(sample(50, 40)[3]).toBe(0)
    expect(() => result({ kind: 'dag', effects: [{ kind: 'effect', ref: 'line' }] })).toThrow(
      /Missing effect source image/
    )
  })
  it('does not let fill-overlay recolor the authored line', async () => {
    const line = {
      ink: '<rect x="30" y="30" width="5" height="20" fill="blue"/>',
      bounds: [30, 30, 35, 50],
    }
    const out = result(
      { kind: 'list', effects: [{ kind: 'fillOverlay', blend: 'over', fill: { color } }] },
      { ...base, sourceImages: { fill: base, line } }
    )
    const sample = await pixel(out.ink)
    expect(sample(32, 40)).toEqual([0, 0, 255, 255])
    expect(sample(45, 40)).toEqual([255, 0, 0, 128])
  })
  it.each([
    ['over', [255, 0, 0, 128]],
    ['mult', [0, 0, 0, 128]],
    ['screen', [255, 255, 0, 128]],
    ['darken', [0, 0, 0, 128]],
    ['lighten', [255, 255, 0, 128]],
  ])('preserves alpha with the %s fill blend', async (blend, expected) => {
    const out = result({
      kind: 'dag',
      type: 'tree',
      effects: [{ kind: 'fillOverlay', blend, fill: { color } }],
    })
    expect((await pixel(out.ink))(40, 40)).toEqual(expected)
  })
  it('preserves fractional source alpha under a translucent overlay', async () => {
    const out = result({
      kind: 'dag',
      effects: [
        {
          kind: 'fillOverlay',
          blend: 'over',
          fill: {
            color: { ...color, transforms: [{ kind: 'alpha', value: 50000 }] },
          },
        },
      ],
    })
    const sample = (await pixel(out.ink))(40, 40)
    expect(sample[0]).toBeGreaterThanOrEqual(126)
    expect(sample[1]).toBeGreaterThanOrEqual(126)
    expect(sample[3]).toBe(128)
  })
  it('rejects exponential reflection reuse before rendering or committing', () => {
    const program = {
      kind: 'dag',
      type: 'tree',
      effects: Array.from({ length: 13 }, () => ({ kind: 'reflection', sy: -100000 })),
    }
    expect(() => model.normalizeGeometryDocument(geometry(program))).toThrow()
    expect(() => result(program)).toThrow()
  })
  it('expands double shadows from the normative distance and per-channel color rules', async () => {
    const out = result({
      kind: 'dag',
      effects: [
        {
          kind: 'prstShdw',
          prst: 'shdw13',
          color: { kind: 'srgb', value: '000000' },
          dist: 190500,
        },
      ],
    })
    const sample = await pixel(out.ink)
    expect(sample(95, 40)).toEqual([102, 102, 102, 128])
    expect(sample(45, 40)).toEqual([0, 0, 0, 128])
  })
  it.each(['shdw19', 'shdw20'])('requires the painted source envelope for %s', (prst) => {
    const program = { kind: 'list', effects: [{ kind: 'prstShdw', prst, color }] }
    expect(model.normalizeGeometryDocument(geometry(program)).style.effects).toEqual(program)
    expect(() => result(program)).toThrow(/Source ink envelope is required/)
  })
})
