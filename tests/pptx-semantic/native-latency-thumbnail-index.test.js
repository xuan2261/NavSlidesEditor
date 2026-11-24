import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
const require = createRequire(import.meta.url)
const { normalizePptxSemanticDocument: normalize } = require('../../shared/src/pptx-semantic-document.js')
const { replaceSemanticRecords, semanticRecordPredecessor } = require('../../shared/src/pptx-semantic-records.js')
const { projectionEnvelope, sameEnvelope, semanticSlideOccurrences } = require('../../shared/src/pptx-slide-projection-cache.js')
const { createSemanticInstanceReader, semanticInstanceTree } = require('../../shared/src/pptx-semantic-groups.js')
const { immutableSemanticRenderTree: tree, semanticRenderTree } = require('../../shared/src/pptx-semantic-render-tree.js')

describe('certified thumbnail occurrence index (real documents, no mocks)', () => {
  it('cold-projects all 39 slides / 665 occurrences with one shared enumeration', () => {
    const deck = geometryProjectionFixture()
    const seed = deck.pptxSemantic.instances.i1
    const element = deck.slides[0].elements[0]
    deck.pptxSemantic.instances = {}
    deck.slides = Array.from({ length: 39 }, (_, s) => {
      const slide = { id: `cold-${s}`, elements: [] }
      for (let n = 0; n < (s === 0 ? 19 : 17); n++) {
        const id = `cold-${s}-${n}`
        deck.pptxSemantic.instances[id] = { ...seed, id, slideId: slide.id,
          paintIndex: n % 3, overrides: { hidden: n === 3 },
          lineage: { tombstone: n === 4 } }
        if (n !== 4) slide.elements.push({ ...element, id, pptxInstanceId: id })
      }
      return slide
    })
    // Own a separate oracle root: raw-input normalization is memoized, and group
    // tree construction indexes its normalized root even with field context.
    // Reusing deck.pptxSemantic here would legitimately warm the measured root.
    const oracle = structuredClone(deck.pptxSemantic)
    const expected = deck.slides.map(slide => semanticRenderTree(oracle, slide, {}))
    const keys = Object.keys
    const scans = []
    const spy = vi.spyOn(Object, 'keys').mockImplementation(value => {
      const result = keys(value)
      scans.push({ value, keys: result })
      return result
    })
    try {
      // Normalization warms wire membership, not the slide-occurrence index.
      // Count actual iteration of its owned keys, not redundant Object.keys
      // allocation: the membership cache is legitimately reused by indexing.
      const document = normalize(deck.pptxSemantic)
      const reader = createSemanticInstanceReader(document)
      const instanceKeys = new Set(scans.filter(({ value }) => value === document.instances)
        .map(({ keys }) => keys))
      const iteratorDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator)
      const iterate = iteratorDescriptor.value
      let enumerations = 0, visited = 0
      // Vitest's spy wrapper itself iterates argument arrays: spying on this
      // primitive would recursively re-enter that wrapper before our counter.
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        ...iteratorDescriptor,
        value: function () {
          if (instanceKeys.has(this)) { enumerations++; visited += this.length }
          return iterate.call(this)
        },
      })
      try {
      for (const [i, slide] of deck.slides.entries()) {
        // Tree is deliberately first: render-envelope admission must reuse it.
        expect(reader.semanticInstanceTree(slide.id)).toEqual(semanticInstanceTree(document, slide.id))
        expect(tree(document, slide)).toEqual(expected[i])
        const local = semanticSlideOccurrences(document, slide.id)
        expect(Object.isFrozen(local)).toBe(true)
        expect(Object.isFrozen(local[0])).toBe(true)
        expect(() => local[0].push('corrupt')).toThrow(TypeError)
      }
      expect(enumerations).toBe(1)
      expect(visited).toBe(665)
      } finally { Object.defineProperty(Array.prototype, Symbol.iterator, iteratorDescriptor) }
    } finally { spy.mockRestore() }
  })

  it('validates raw and mutable group readers before indexing, including off-slide duplicate IDs', () => {
    const deck = geometryProjectionFixture()
    expect(() => semanticSlideOccurrences(deck.pptxSemantic, 's1')).toThrow(TypeError)
    const before = semanticInstanceTree(deck.pptxSemantic, 's1')
    deck.pptxSemantic.instances.i1.localTransform[4] += 9525
    expect(semanticInstanceTree(deck.pptxSemantic, 's1')).not.toEqual(before)
    deck.pptxSemantic.instances.badKey = { ...deck.pptxSemantic.instances.i2 }
    expect(() => semanticInstanceTree(deck.pptxSemantic, 's1')).toThrow()
    expect(() => createSemanticInstanceReader(deck.pptxSemantic)).toThrow()
    expect(() => tree(deck.pptxSemantic, deck.slides[0], {})).toThrow()
  })

  it('does not invalidate an unrelated slide or hide a local edit', () => {
    const deck = geometryProjectionFixture()
    const document = normalize(deck.pptxSemantic)
    const slide = deck.slides[0]
    const first = tree(document, slide)
    const envelope = projectionEnvelope(document, slide)
    const unrelated = replaceSemanticRecords(document, { instances: {
      i2: { ...document.instances.i2, paintIndex: 25 },
    } })
    expect(sameEnvelope(envelope, projectionEnvelope(unrelated, slide))).toBe(true)
    expect(tree(unrelated, slide)).toBe(first)
    const edited = replaceSemanticRecords(unrelated, { instances: {
      i1: { ...document.instances.i1, localTransform: [1, 0, 0, 1, 1905000, 0] },
    } })
    expect(sameEnvelope(envelope, projectionEnvelope(edited, slide))).toBe(false)
    const actual = tree(edited, slide)
    expect(actual).not.toBe(first)
    expect(actual).toEqual(semanticRenderTree(edited, slide, {}))
    expect(actual[0].transform).toContain('200,0)')
  })

  it('transfers read-only ID provenance through checked normalization and renders relocation/deletion', () => {
    const deck = geometryProjectionFixture()
    const document = normalize(deck.pptxSemantic)
    tree(document, deck.slides[0])
    tree(document, deck.slides[1])
    const patch = { i1: { ...document.instances.i1, slideId: deck.slides[1].id } }
    const successor = replaceSemanticRecords(document, { instances: patch })
    const moved = normalize(successor)
    const receipt = semanticRecordPredecessor(moved)
    expect(receipt.previous).toBe(document)
    expect(receipt.instanceIds).toEqual(['i1'])
    expect(Object.isFrozen(receipt)).toBe(true)
    expect(Object.isFrozen(receipt.instanceIds)).toBe(true)
    expect(semanticRecordPredecessor(moved)).not.toBe(receipt)
    expect(() => { receipt.previous = moved }).toThrow(TypeError)
    expect(() => receipt.instanceIds.push('i2')).toThrow(TypeError)
    expect(semanticRecordPredecessor(moved).previous).toBe(document)
    const source = { ...deck.slides[0], elements: [] }
    const destination = { ...deck.slides[1], elements: [...deck.slides[1].elements, ...deck.slides[0].elements] }
    expect(tree(moved, source)).toEqual([])
    expect(tree(moved, destination)).toEqual(semanticRenderTree(moved, destination, {}))
    expect(tree(moved, destination)).toHaveLength(2)
    const deleted = normalize(replaceSemanticRecords(moved, { instances: { i1: null } }))
    expect(tree(deleted, deck.slides[1])).toEqual(semanticRenderTree(deleted, deck.slides[1], {}))
    expect(tree(deleted, deck.slides[1])).toHaveLength(1)
    const raw = structuredClone(document)
    expect(semanticRecordPredecessor(replaceSemanticRecords(raw, { instances: { i1: null } }))).toBeUndefined()
    const before = semanticRenderTree(raw, deck.slides[0])
    raw.instances.i1.localTransform[4] += 9525
    expect(semanticRenderTree(raw, deck.slides[0])).not.toEqual(before)
  })

  it('uses full indexing without lineage when WeakRef is unavailable', () => {
    const deck = geometryProjectionFixture()
    const document = normalize(deck.pptxSemantic)
    const slide = deck.slides[0]
    const before = projectionEnvelope(document, slide)
    let successor
    vi.stubGlobal('WeakRef', undefined)
    try {
      successor = normalize(replaceSemanticRecords(document, { instances: {
        i1: { ...document.instances.i1, localTransform: [1, 0, 0, 1, 1905000, 0] },
      } }))
      expect(semanticRecordPredecessor(successor)).toBeUndefined()
      expect(sameEnvelope(before, projectionEnvelope(successor, slide))).toBe(false)
      expect(tree(successor, slide)).toEqual(semanticRenderTree(successor, slide, {}))
    } finally {
      vi.unstubAllGlobals()
    }
    expect(semanticRecordPredecessor(successor)).toBeUndefined()
  })

  it('fully indexes inserted occurrences and invalidates changed non-instance context', () => {
    const deck = geometryProjectionFixture()
    const document = normalize(deck.pptxSemantic)
    const slide = deck.slides[0]
    const before = projectionEnvelope(document, slide)
    tree(document, slide)
    const inserted = normalize(replaceSemanticRecords(document, { instances: {
      i3: { ...document.instances.i1, id: 'i3', paintIndex: 2 },
    } }))
    const expandedSlide = { ...slide, elements: [
      ...slide.elements, { ...slide.elements[0], id: 'i3', pptxInstanceId: 'i3' },
    ] }
    expect(projectionEnvelope(inserted, slide).occurrences.map(([id]) => id)).toEqual(['i1', 'i3'])
    expect(sameEnvelope(before, projectionEnvelope(inserted, slide))).toBe(false)
    expect(tree(inserted, expandedSlide)).toEqual(semanticRenderTree(inserted, expandedSlide, {}))
    expect(tree(inserted, expandedSlide)).toHaveLength(2)

    const definition = document.definitions.definition
    const changed = normalize(replaceSemanticRecords(document, { definitions: {
      definition: { ...definition, content: { ...definition.content, extent: { cx: 1905000, cy: 762000 } } },
    } }))
    expect(changed.instances).toBe(document.instances)
    expect(sameEnvelope(before, projectionEnvelope(changed, slide))).toBe(false)
    expect(tree(changed, slide)).toEqual(semanticRenderTree(changed, slide, {}))
  })

  it('rejects mutable documents and detects nested mutable slide changes', () => {
    const deck = geometryProjectionFixture()
    const slide = deck.slides[0]
    expect(projectionEnvelope(deck.pptxSemantic, slide)).toBeNull()
    const document = normalize(deck.pptxSemantic)
    slide.custom = { nested: ['before'] }
    const before = projectionEnvelope(document, slide)
    slide.custom.nested[0] = 'after'
    expect(sameEnvelope(before, projectionEnvelope(document, slide))).toBe(false)
    expect(projectionEnvelope(document, slide, {})).toBeNull()
  })
})
