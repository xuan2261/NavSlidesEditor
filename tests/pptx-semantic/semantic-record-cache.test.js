import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  normalizePptxSemanticDocument,
} = require('../../shared/src/pptx-semantic-document.js')
const {
  semanticDefinition,
  semanticInstance,
  semanticStyle,
  certifyImmutableSemanticDocument,
  isCertifiedSemanticDocument,
  cloneImmutableSemanticDocument,
} = require('../../shared/src/pptx-semantic-records.js')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph.js')

describe('pptx semantic record cache immutability and certification boundaries', () => {
  const cloneLimits = { maxDepth: 20, maxInstances: 20, maxComponents: 20 }
  it('keeps checked clones isolated and uncertified until explicit certification', () => {
    const input = { nested: { text: 'before' } }
    const cloned = cloneImmutableSemanticDocument(input, cloneLimits)
    input.nested.text = 'after'
    expect(cloned.nested.text).toBe('before')
    expect(isCertifiedSemanticDocument(cloned)).toBe(false)
    expect(Object.isFrozen(cloned.nested)).toBe(true)
    certifyImmutableSemanticDocument(cloned)
    expect(isCertifiedSemanticDocument(cloned)).toBe(true)
    expect(() => certifyImmutableSemanticDocument(Object.freeze({ nested: {} }))).toThrow()
  })
  it('rejects accessor input without invoking it and enforces each clone budget', () => {
    let reads = 0
    const input = Object.defineProperty({}, 'nested', {
      enumerable: true,
      get() { reads++; return {} },
    })
    expect(() => cloneImmutableSemanticDocument(input, cloneLimits)).toThrow()
    expect(reads).toBe(0)
    expect(() => cloneImmutableSemanticDocument({ nested: {} }, { ...cloneLimits, maxDepth: 0 })).toThrow()
    expect(() => cloneImmutableSemanticDocument([1, 2], { ...cloneLimits, maxComponents: 1 })).toThrow()
  })
  const hash = 'a'.repeat(64)
  const baseDocument = () => ({
    schemaVersion: 1,
    definitions: {
      'def:1': {
        id: 'def:1',
        kind: 'text',
        source: {
          partUri: 'ppt/slides/slide1.xml',
          nativeId: '1',
          preconditionHash: hash,
        },
        components: [
          {
            id: 'comp:1',
            kind: 'property',
            locator: { path: [0], preconditionHash: hash },
          },
        ],
        content: { text: 'initial text' },
      },
    },
    instances: {
      'inst:1': {
        id: 'inst:1',
        slideId: 'slide1',
        definitionId: 'def:1',
        parentInstanceId: null,
        localTransform: [1, 0, 0, 1, 0, 0],
        paintIndex: 0,
        overrides: {},
      },
    },
    styles: {},
    fonts: {},
  })

  it('does not return stale cached decoded record when shallow-frozen wire record is mutated', () => {
    const graph = compactSemanticGraph(baseDocument())
    const shallowDoc = Object.freeze({
      ...graph,
      definitions: {
        ...graph.definitions,
        '0': {
          ...graph.definitions['0'],
          content: { text: 'initial text' },
        },
      },
    })

    expect(Object.isFrozen(shallowDoc)).toBe(true)
    expect(isCertifiedSemanticDocument(shallowDoc)).toBe(false)

    const def1 = semanticDefinition(shallowDoc, 'def:1')
    expect(def1).toBeDefined()
    expect(def1.content.text).toBe('initial text')

    // Mutate the mutable wire record
    shallowDoc.definitions['0'] = {
      ...shallowDoc.definitions['0'],
      content: { text: 'mutated text' },
    }

    const def2 = semanticDefinition(shallowDoc, 'def:1')
    expect(def2).toBeDefined()
    expect(def2.content.text).toBe('mutated text')
    expect(def2).not.toBe(def1)
  })

  it('does not return stale cached decoded record when referenced catalog is mutated', () => {
    const graph = compactSemanticGraph(baseDocument())
    const shallowDoc = Object.freeze({
      ...graph,
      partUris: [...graph.partUris],
    })

    expect(Object.isFrozen(shallowDoc)).toBe(true)
    expect(isCertifiedSemanticDocument(shallowDoc)).toBe(false)

    const def1 = semanticDefinition(shallowDoc, 'def:1')
    expect(def1).toBeDefined()
    expect(def1.source.partUri).toBe('ppt/slides/slide1.xml')

    // Mutate the referenced partUris catalog
    shallowDoc.partUris[0] = 'ppt/slides/slide99.xml'

    const def2 = semanticDefinition(shallowDoc, 'def:1')
    expect(def2).toBeDefined()
    expect(def2.source.partUri).toBe('ppt/slides/slide99.xml')
    expect(def2).not.toBe(def1)
  })

  it('rejects certification grants for mutable and shallow-frozen documents', () => {
    const graph = compactSemanticGraph(baseDocument())
    const shallowDoc = Object.freeze({
      ...graph,
      definitions: { ...graph.definitions },
    })

    // Mutable document rejected
    expect(() => certifyImmutableSemanticDocument(graph)).toThrow(TypeError)
    expect(() => certifyImmutableSemanticDocument(graph)).toThrow(
      /Cannot certify mutable or shallow-frozen semantic document as immutable/
    )
    expect(isCertifiedSemanticDocument(graph)).toBe(false)

    // Shallow-frozen document with mutable child dictionaries rejected
    expect(() => certifyImmutableSemanticDocument(shallowDoc)).toThrow(TypeError)
    expect(() => certifyImmutableSemanticDocument(shallowDoc)).toThrow(
      /Cannot certify mutable or shallow-frozen semantic document as immutable/
    )
    expect(isCertifiedSemanticDocument(shallowDoc)).toBe(false)

    // Non-object or array rejected
    expect(() => certifyImmutableSemanticDocument(null)).toThrow(TypeError)
    expect(() => certifyImmutableSemanticDocument([])).toThrow(TypeError)

    // Object with accessor properties rejected
    const getterDoc = Object.freeze({
      get schemaVersion() {
        return 3
      },
    })
    expect(() => certifyImmutableSemanticDocument(getterDoc)).toThrow(TypeError)
  })

  it('certifies deeply immutable normalizer graphs and uses fast cache on repeated reads', () => {
    const graph = compactSemanticGraph(baseDocument())
    const normalized = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(graph)))

    expect(Object.isFrozen(normalized)).toBe(true)
    expect(isCertifiedSemanticDocument(normalized)).toBe(true)

    // Decoded definition cached and identity-stable
    const def1 = semanticDefinition(normalized, 'def:1')
    const def2 = semanticDefinition(normalized, 'def:1')
    expect(def1).toBeDefined()
    expect(def1).toBe(def2)

    // Decoded instance cached and identity-stable
    const inst1 = semanticInstance(normalized, 'inst:1')
    const inst2 = semanticInstance(normalized, 'inst:1')
    expect(inst1).toBeDefined()
    expect(inst1).toBe(inst2)

    // Re-normalizing already-normalized document preserves certification and cache
    const reNormalized = normalizePptxSemanticDocument(normalized)
    expect(reNormalized).toBe(normalized)
    expect(isCertifiedSemanticDocument(reNormalized)).toBe(true)
    expect(semanticDefinition(reNormalized, 'def:1')).toBe(def1)
  })

  it('certifies deeply cloned document so validator reads use cache, but does not register failed documents', () => {
    const graph = compactSemanticGraph(baseDocument())
    // Create an invalid document that fails during validator stage (e.g. invalid connector binding)
    const invalidGraph = JSON.parse(JSON.stringify(graph))
    // Introduce an invalid instance override or connection that fails in late validators
    invalidGraph.instances['0'] = {
      ...invalidGraph.instances['0'],
      connectors: [{ startInstanceId: 'non-existent-instance', endInstanceId: 'inst:1' }],
    }

    // Normalization should throw validation error
    expect(() => normalizePptxSemanticDocument(invalidGraph)).toThrow()

    // Re-normalizing the same raw object must still throw and never be treated as normalizedDocuments
    expect(() => normalizePptxSemanticDocument(invalidGraph)).toThrow()
  })
  function resourceGraph(fontReferences = 1, value = { typeface: 'Inherited' }) {
    return {
      schemaVersion: 3,
      sourceIdentities: ['pool', 'first', 'second'],
      styles: {
        0: { kind: 'text-context-resources', origin: 'source', payload: { records: {
          'record-0': { kind: 'theme', value: { colors: { dk1: '102030' } } },
          'record-1': { kind: 'font', value },
        } } },
        1: { kind: 'text-context', payload: { shape: 0, provenance: [] } },
        2: { kind: 'text-context', payload: { shape: 1, provenance: [] } },
      },
      textShapes: [
        { resourcesId: 0, theme: 0, body: { scope: null }, paragraphs: [], fontRequests: [0] },
        { resourcesId: 0, theme: 0, body: { scope: null }, paragraphs: [], fontRequests: [1] },
      ],
      textInventories: [
        { kind: 'fontRequests', records: [1] },
        { kind: 'fontRequests', records: Array(fontReferences).fill(1) },
      ],
    }
  }

  function certify(graph) {
    function deepFreeze(value) {
      if (!value || typeof value !== 'object') return
      for (const child of Object.values(value)) deepFreeze(child)
      Object.freeze(value)
    }
    deepFreeze(graph)
    return certifyImmutableSemanticDocument(graph)
  }

  it('keeps inherited resources immutable and mutable graphs fresh across occurrences', () => {
    const mutable = resourceGraph()
    expect(semanticStyle(mutable, 'first').payload.fontRequests[0].typeface).toBe('Inherited')
    mutable.styles[0].payload.records['record-1'].value.typeface = 'Changed'
    expect(semanticStyle(mutable, 'second').payload.fontRequests[0].typeface).toBe('Changed')
    const immutable = certify(resourceGraph())
    const first = semanticStyle(immutable, 'first').payload
    const second = semanticStyle(immutable, 'second').payload
    expect(first.fontRequests[0]).toEqual({ typeface: 'Inherited' })
    expect(second.fontRequests[0]).toEqual(first.fontRequests[0])
    expect(Object.isFrozen(second.fontRequests[0])).toBe(true)
    expect(immutable.styles[0].payload.records['record-1'].value.typeface).toBe('Inherited')
  })

  it('resolves shared frozen resource pools against each document catalog', () => {
    const first = resourceGraph(1, { descriptorId: 0 })
    first.fontDescriptors = [{ typeface: 'First' }]
    const second = { ...first, fontDescriptors: [{ typeface: 'Second' }] }
    certify(first)
    certify(second)
    expect(semanticStyle(first, 'first').payload.fontRequests[0].typeface).toBe('First')
    expect(semanticStyle(second, 'first').payload.fontRequests[0].typeface).toBe('Second')
  })

  it('enforces expanded visit limits even after a resource was read by another occurrence', () => {
    const graph = certify(resourceGraph(40, { data: Array(30000).fill(0) }))
    expect(semanticStyle(graph, 'first').payload.fontRequests[0].data[29999]).toBe(0)
    expect(() => semanticStyle(graph, 'second')).toThrow(/evaluation visited-value budget/)
  })

  it('enforces expanded byte limits even after a resource was read by another occurrence', () => {
    const graph = certify(resourceGraph(4, { typeface: 'x'.repeat(2200000) }))
    expect(semanticStyle(graph, 'first').payload.fontRequests[0].typeface).toBe('x'.repeat(2200000))
    expect(() => semanticStyle(graph, 'second')).toThrow(/evaluation byte budget/)
  })
})
