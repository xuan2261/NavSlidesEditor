import { describe, expect, it } from 'vitest'

import canonicalModule from './canonical.js'
import diffModule from './diff.js'
import inventoryModule from './inventory.js'
import matcherModule from './matcher.js'
import nativeAdapterModule from './native-adapter.js'
import unitsModule from './units.js'

const { canonicalReport, reportHash } = canonicalModule
const { reconcileInventories } = diffModule
const { createInventory } = inventoryModule
const { matchObjects } = matcherModule
const { adaptNativeSceneGraph } = nativeAdapterModule
const { emuToPixels, emuToPoints, pixelsToEmu, pointsToEmu } = unitsModule

function object(overrides = {}) {
  return {
    slidePart: 'ppt/slides/slide1.xml',
    kind: 'shape',
    nativeId: '7',
    name: 'Box',
    ancestry: [],
    zOrder: 0,
    transform: { emu: { x: 0, y: 0, width: 9525, height: 9525 } },
    style: {},
    relationships: [],
    lineage: { source: 'native', method: 'scene-graph', confidence: 1, warnings: [] },
    ...overrides,
  }
}

describe('exact unit boundary', () => {
  it('converts the canonical Office units exactly', () => {
    expect(emuToPoints(914400)).toBe(72)
    expect(emuToPixels(914400)).toBe(96)
    expect(pointsToEmu(72)).toBe(914400)
    expect(pixelsToEmu(96)).toBe(914400)
  })

  it('round-trips integer EMUs accepted by each exact denominator', () => {
    for (let value = -100000; value <= 100000; value += 12700) {
      expect(pointsToEmu(emuToPoints(value))).toBe(value)
    }
    for (let value = -100000; value <= 100000; value += 9525) {
      expect(pixelsToEmu(emuToPixels(value))).toBe(value)
    }
  })
})

describe('normalized inventories and native adapter', () => {
  it('retains native identity, ancestry, raw geometry, relationships, and style origin', () => {
    const graph = {
      slides: [{
        index: 0,
        path: 'ppt/slides/slide1.xml',
        rels: [{ id: 'rId1', target: '../media/image1.png', type: 'image' }],
        nodes: [
          { id: '5', name: 'Group', kind: 'grpSp', parentId: null, depth: 0 },
          {
            id: '7', name: 'Box', kind: 'shape', parentId: '5', depth: 1,
            xfrm: { x: 1, y: 2, cx: 3, cy: 4, rot: 0 },
            rels: { blipEmbed: 'rId1' }, style: { fill: '#fff' }, styleOrigin: 'layout',
          },
        ],
      }],
      masters: ['ppt/slideMasters/slideMaster1.xml'],
      layouts: ['ppt/slideLayouts/slideLayout1.xml'],
      theme: { path: 'ppt/theme/theme1.xml' },
    }
    const inventory = adaptNativeSceneGraph(graph, { canvas: { width: 960, height: 540 } })
    expect(inventory.schemaVersion).toBe(1)
    expect(inventory.slides[0].objects[1]).toMatchObject({
      nativeId: '7',
      ancestry: ['5'],
      transform: {
        emu: { x: 9525, y: 19050, width: 28575, height: 38100 },
        pixels96: { x: 1, y: 2, width: 3, height: 4 },
      },
      style: { origin: 'layout', value: { fill: '#fff' } },
    })
    expect(inventory.package.layoutParts).toEqual(['ppt/slideLayouts/slideLayout1.xml'])
  })

  it('rejects malformed inventory records instead of silently normalizing them', () => {
    expect(() => createInventory({ source: 'native', slides: [{ part: '', objects: [] }] }))
      .toThrow(/slide part/)
  })
})

describe('deterministic reconciliation', () => {
  it('matches exact native ids only within slide and ancestry', () => {
    const native = [object({ ancestry: ['1'] }), object({ nativeId: '8', ancestry: [] })]
    const shadow = [object({ lineage: { source: 'officecli' }, ancestry: ['1'] })]
    const result = matchObjects(native, shadow)
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].method).toBe('native-id')
    expect(result.matches[0].patchAuthority).toBe(false)
  })

  it('records duplicate heuristic candidates as ambiguity and never authorizes patches', () => {
    const native = [object({ nativeId: null }), object({ nativeId: null, zOrder: 1 })]
    const shadow = [object({ nativeId: null, lineage: { source: 'officecli' } })]
    const result = matchObjects(native, shadow)
    expect(result.ambiguities).toHaveLength(1)
    expect(result.matches).toHaveLength(0)
    expect(result.ambiguities[0].patchAuthority).toBe(false)
  })

  it('emits all typed discrepancy families with lineage and no patch authority', () => {
    const native = createInventory({
      source: 'native',
      slides: [{ part: 'ppt/slides/slide1.xml', objects: [
        object({
          kind: 'shape',
          transform: { emu: { x: 0, y: 0, width: 1, height: 1 } },
          style: { fill: 'red' },
          relationships: [{ id: 'r1', target: 'a' }],
          unknown: { classification: 'ole' },
        }),
        object({ nativeId: '9', name: 'Native only' }),
      ] }],
    })
    const shadow = createInventory({
      source: 'officecli',
      slides: [{ part: 'ppt/slides/slide1.xml', objects: [
        object({
          kind: 'image',
          transform: { emu: { x: 2, y: 0, width: 1, height: 1 } },
          style: { fill: 'blue' },
          relationships: [{ id: 'r1', target: 'b' }],
          unknown: null,
          lineage: { source: 'officecli', method: 'get', confidence: 1, warnings: [] },
        }),
        object({ nativeId: '10', name: 'Shadow only', lineage: { source: 'officecli' } }),
      ] }],
    })
    const report = reconcileInventories(native, shadow)
    expect(new Set(report.diffs.map((diff) => diff.type))).toEqual(new Set([
      'kind', 'geometry', 'style', 'relationship', 'unknown', 'missing',
    ]))
    expect(report.diffs.every((diff) => diff.patchAuthority === false)).toBe(true)
  })

  it('sorts canonically and hashes equivalent reports identically', () => {
    const a = { diffs: [{ type: 'style', slidePart: 'b' }, { type: 'missing', slidePart: 'a' }] }
    const b = { diffs: [...a.diffs].reverse() }
    expect(canonicalReport(a)).toEqual(canonicalReport(b))
    expect(reportHash(a)).toBe(reportHash(b))
  })
})
