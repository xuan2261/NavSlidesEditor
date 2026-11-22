import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'

const require = createRequire(import.meta.url)
const semantic = require('../../shared/src/pptx-semantic-document.js')
const records = require('../../shared/src/pptx-semantic-records.js')
const resolution = require('../../shared/src/pptx-geometry-style-resolution.js')
function instrumentedTree(run) {
  const spy = vi.spyOn(resolution, 'materializeGeometry')
  const path = require.resolve('../../shared/src/pptx-semantic-render-tree.js')
  delete require.cache[path]
  try { run(require(path), spy) } finally {
    spy.mockRestore()
    delete require.cache[path]
  }
}
const normalize = semantic.normalizePptxSemanticDocument

describe('owned thumbnail projection reuse across occurrence edits', () => {
  it('validates mutable slide values without allocating replacement snapshots on warm reads', () => {
    instrumentedTree((tree) => {
      const { slideProjections } = require('../../shared/src/pptx-slide-projection-cache.js')
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      const slide = deck.slides[0]
      slide.elements.push({ id: 'legacy', nested: { values: ['before'] } })
      const first = tree.immutableSemanticRenderTree(input, slide)
      const snapshot = slideProjections.get(slide.id).envelope.snapshot
      expect(tree.immutableSemanticRenderTree(input, slide)).toBe(first)
      expect(slideProjections.get(slide.id).envelope.snapshot).toBe(snapshot)
      expect(tree.immutableSemanticRenderTree(input, structuredClone(slide))).toBe(first)
      expect(slideProjections.get(slide.id).envelope.snapshot).toBe(snapshot)
      slide.elements[1].nested.values[0] = 'after'
      const changed = tree.immutableSemanticRenderTree(input, slide)
      expect(changed).not.toBe(first)
      expect(changed[1].element.nested.values).toEqual(['after'])
      expect(first[1].element.nested.values).toEqual(['before'])
      expect(slideProjections.get(slide.id).envelope.snapshot).not.toBe(snapshot)
    })
  })

  it('rejects newly exotic slide values without invoking getters during admission', () => {
    instrumentedTree((tree) => {
      const { projectionEnvelope } = require('../../shared/src/pptx-slide-projection-cache.js')
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      const slide = deck.slides[0]
      slide.extra = { value: 'plain' }
      tree.immutableSemanticRenderTree(input, slide)
      const getter = vi.fn(() => 'plain')
      Object.defineProperty(slide.extra, 'value', { get: getter, enumerable: true, configurable: true })
      expect(projectionEnvelope(input, slide)).toBeNull()
      expect(getter).not.toHaveBeenCalled()
      slide.extra = new Date(0)
      expect(projectionEnvelope(input, slide)).toBeNull()
      slide.extra = slide
      expect(projectionEnvelope(input, slide)).toBeNull()
      slide.extra = Object.create({ inherited: true })
      expect(projectionEnvelope(input, slide)).toBeNull()
      slide.extra = ['plain']
      Object.setPrototypeOf(slide.extra, Object.create(Array.prototype))
      expect(projectionEnvelope(input, slide)).toBeNull()
      delete slide.extra
      expect(projectionEnvelope(input, slide, { now: new Date(0) })).toBeNull()
    })
  })

  it('rejects lookalike object prototypes instead of trusting their property names', () => {
    instrumentedTree((tree) => {
      const { projectionEnvelope } = require('../../shared/src/pptx-slide-projection-cache.js')
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      const slide = deck.slides[0]
      slide.extra = { value: 'plain' }
      tree.immutableSemanticRenderTree(input, slide)
      const getter = vi.fn(() => 'poison')
      const prototype = Object.create(null, Object.getOwnPropertyDescriptors(Object.prototype))
      Object.defineProperty(prototype, 'toString', { get: getter, configurable: true })
      Object.setPrototypeOf(slide.extra, prototype)
      expect(projectionEnvelope(input, slide)).toBeNull()
      expect(getter).not.toHaveBeenCalled()
    })
  })

  it('uses descriptors for proxy slide IDs and array lengths without invoking get traps', () => {
    instrumentedTree(() => {
      const { projectionEnvelope } = require('../../shared/src/pptx-slide-projection-cache.js')
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      const get = vi.fn(() => { throw new Error('Unexpected property read') })
      const slide = new Proxy({ ...deck.slides[0], elements: new Proxy(deck.slides[0].elements, { get }) }, { get })
      expect(projectionEnvelope(input, slide)).not.toBeNull()
      expect(get).not.toHaveBeenCalled()
      const revoked = Proxy.revocable({}, {})
      revoked.revoke()
      expect(projectionEnvelope(input, { ...deck.slides[0], extra: revoked.proxy })).toBeNull()
      expect(projectionEnvelope(input, new Proxy(deck.slides[0], {
        ownKeys() { throw new Error('Uninspectable') },
      }))).toBeNull()
    })
  })

  it('projects only the owned descriptor snapshot, never a mutable proxy get view', () => {
    instrumentedTree((tree) => {
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      const slide = deck.slides[0]
      slide.elements.push({ id: 'legacy', nested: { fill: 'red' } })
      let fill = 'poison'
      const get = vi.fn((target, key, receiver) => key === 'elements'
        ? [target.elements[0], { id: 'legacy', nested: { fill } }]
        : Reflect.get(target, key, receiver))
      const proxy = new Proxy(slide, { get })
      const first = tree.semanticRenderTree(input, proxy)
      expect(first[1].element.nested.fill).toBe('red')
      fill = 'changed proxy view'
      expect(tree.semanticRenderTree(input, proxy)).toEqual(first)
      expect(tree.semanticRenderTree(input, slide)).toEqual(first)
      expect(get).not.toHaveBeenCalled()
      first[1].element.nested.fill = 'caller mutation'
      slide.elements[1].nested.fill = 'blue'
      expect(tree.semanticRenderTree(input, proxy)[1].element.nested.fill).toBe('blue')
      expect(slide.elements[1].nested.fill).toBe('blue')
      expect(get).not.toHaveBeenCalled()
    })
  })

  it('keeps uncacheable public render values and getter behavior on the fallback path', () => {
    instrumentedTree((tree) => {
      const { projectionEnvelope } = require('../../shared/src/pptx-slide-projection-cache.js')
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      const slide = deck.slides[0]
      const callback = () => 'legacy callback'
      const legacy = { id: 'legacy', callback }
      const getter = vi.fn(() => [deck.slides[0].elements[0], legacy])
      const exotic = { id: slide.id, get elements() { return getter() } }
      expect(projectionEnvelope(input, exotic)).toBeNull()
      expect(getter).not.toHaveBeenCalled()
      const result = tree.semanticRenderTree(input, exotic)
      expect(result[1].element).toBe(legacy)
      expect(result[1].element.callback).toBe(callback)
      expect(getter).toHaveBeenCalledTimes(1)
    })
  })

  it('explicit immutable API owns and freezes values once, without cloning warm hits', () => {
    instrumentedTree((tree, geometry) => {
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      const slide = deck.slides[0]
      slide.elements.push({ id: 'legacy', nested: { fill: 'red' } })
      const first = tree.immutableSemanticRenderTree(input, slide)
      const calls = geometry.mock.calls.length
      const clone = vi.spyOn(globalThis, 'structuredClone')
      try {
        const next = records.replaceSemanticRecords(input, { instances: {
          i2: { ...input.instances.i2, paintIndex: 9 },
        } })
        clone.mockClear()
        expect(tree.immutableSemanticRenderTree(next, slide)).toBe(first)
        expect(clone).not.toHaveBeenCalled()
        expect(geometry.mock.calls.length).toBe(calls)
        expect(Object.isFrozen(first[0].element.pptxGeometry.paths[0].commands)).toBe(true)
        expect(Object.isFrozen(first[1].element.nested)).toBe(true)
        expect(Object.isFrozen(slide.elements[1].nested)).toBe(false)
        slide.elements[1].nested.fill = 'blue'
        const changed = tree.immutableSemanticRenderTree(next, slide)
        expect(changed[1].element.nested.fill).toBe('blue')
        expect(first[1].element.nested.fill).toBe('red')
        const publicValue = tree.semanticRenderTree(next, slide)
        publicValue[1].element.nested.fill = 'poison'
        expect(tree.immutableSemanticRenderTree(next, slide)).toBe(changed)
        expect(changed[1].element.nested.fill).toBe('blue')
      } finally { clone.mockRestore() }
    })
  })

  it('does not hide duplicate occurrences introduced by an inherited array iterator', () => {
    instrumentedTree((tree) => {
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      const slide = deck.slides[0]
      tree.semanticRenderTree(input, slide)
      const prototype = Object.create(Array.prototype)
      prototype[Symbol.iterator] = function* () { yield this[0]; yield this[0] }
      Object.setPrototypeOf(slide.elements, prototype)
      expect(() => tree.semanticRenderTree(input, slide)).toThrow('Invalid or duplicate semantic render occurrence')
    })
  })

  it('skips geometry for an unchanged slide, but never shares output ownership', () => {
    instrumentedTree((tree, spy) => {
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      const slide = deck.slides[0]
      slide.elements.push({ id: 'legacy', type: 'shape', nested: { fill: 'red' } })
      const first = tree.semanticRenderTree(input, slide)
      const calls = spy.mock.calls.length
      expect(calls).toBeGreaterThan(0)
      first[0].element.pptxGeometry.paths[0].commands[0].points[0].x = 999
      first[1].element.nested.fill = 'poison'
      const next = records.replaceSemanticRecords(input, { instances: {
        i2: { ...input.instances.i2, localTransform: [1, 0, 0, 1, 123, 0] },
      } })
      const actual = tree.semanticRenderTree(next, structuredClone(slide))
      expect(spy.mock.calls.length).toBe(calls)
      expect(actual[0].element.pptxGeometry.paths[0].commands[0].points[0].x).toBe(0)
      expect(actual[1].element.nested.fill).toBe('red')
      actual[0].children.push({ poison: true })
      expect(tree.semanticRenderTree(next, slide)[0].children).toEqual([])
    })
  })

  it('refreshes nested mutable slide values and checks duplicate/missing leaves on every changed value', () => {
    instrumentedTree((tree, spy) => {
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      const slide = deck.slides[0]
      slide.elements[0].custom = { label: 'before' }
      tree.semanticRenderTree(input, slide)
      const calls = spy.mock.calls.length
      slide.elements[0].custom.label = 'after'
      expect(tree.semanticRenderTree(input, slide)[0].element.custom.label).toBe('after')
      expect(spy.mock.calls.length).toBeGreaterThan(calls)
      slide.elements.push({ ...slide.elements[0] })
      expect(() => tree.semanticRenderTree(input, slide)).toThrow(/duplicate/)
      slide.elements = []
      expect(() => tree.semanticRenderTree(input, slide)).toThrow(/Missing/)
    })
  })

  it('includes occurrences absent from the compatibility element list, additions and deletion', () => {
    instrumentedTree((tree, spy) => {
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      const slide = deck.slides[0]
      tree.semanticRenderTree(input, slide)
      const group = { ...input.instances.i1, id: 'group', definitionId: 'groupDef', paintIndex: 1 }
      const groupDef = { ...input.definitions.definition, id: 'groupDef', kind: 'group', content: {} }
      const grouped = records.replaceSemanticRecords(input, {
        definitions: { groupDef }, instances: {
          group, i1: { ...input.instances.i1, parentInstanceId: 'group' },
        },
      })
      const before = tree.semanticRenderTree(grouped, slide)
      expect(before[0].kind).toBe('group')
      expect(before[0].children[0].instanceId).toBe('i1')
      const calls = spy.mock.calls.length
      const hidden = records.replaceSemanticRecords(grouped, { instances: {
        group: { ...group, overrides: { hidden: true } },
      } })
      expect(tree.semanticRenderTree(hidden, slide)[0].hidden).toBe(true)
      expect(spy.mock.calls.length).toBeGreaterThan(calls)
      const removed = records.replaceSemanticRecords(hidden, { instances: {
        group: null, i1: input.instances.i1,
      } })
      expect(tree.semanticRenderTree(removed, slide)[0].instanceId).toBe('i1')
      const added = records.replaceSemanticRecords(input, { instances: {
        newLeaf: { ...input.instances.i1, id: 'newLeaf' },
      } })
      expect(() => tree.semanticRenderTree(added, slide)).toThrow(/Missing/)
    })
  })

  it('does not admit raw documents or field contexts, and validates certified patches before lookup', () => {
    instrumentedTree((tree, spy) => {
      const deck = geometryProjectionFixture()
      const slide = deck.slides[0]
      tree.semanticRenderTree(deck.pptxSemantic, slide)
      deck.pptxSemantic.instances.i1.localTransform[4] = 1905000
      expect(tree.semanticRenderTree(deck.pptxSemantic, slide)[0].transform).toContain('200,0)')
      const input = normalize(deck.pptxSemantic)
      tree.semanticRenderTree(input, slide)
      const calls = spy.mock.calls.length
      tree.semanticRenderTree(input, slide, { slideNumber: 2 })
      expect(spy.mock.calls.length).toBeGreaterThan(calls)
      const invalid = records.replaceSemanticRecords(input, { instances: {
        i2: { ...input.instances.i2, localTransform: [1, 0, 0, 0, 0, 0] },
      } })
      expect(() => tree.semanticRenderTree(invalid, slide)).toThrow()
    })
  })

  it('invalidates all non-occurrence roots, including font metadata', () => {
    instrumentedTree((tree, spy) => {
      const deck = geometryProjectionFixture()
      const input = normalize(deck.pptxSemantic)
      tree.semanticRenderTree(input, deck.slides[0])
      const calls = spy.mock.calls.length
      const next = normalize({ ...input, fonts: { changed: { name: 'Font metadata' } } })
      tree.semanticRenderTree(next, deck.slides[0])
      expect(spy.mock.calls.length).toBeGreaterThan(calls)
    })
  })
})
