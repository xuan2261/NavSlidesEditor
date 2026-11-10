import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  normalizePptxSemanticDocument,
  PptxSemanticValidationError,
} = require('../../shared/src/pptx-semantic-document.js')
const {
  semanticDefinition,
  semanticInstance,
} = require('../../shared/src/pptx-semantic-records.js')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph.js')
const { moveSemanticInstance } = require('../../shared/src/pptx-semantic-groups.js')
describe('semantic graph resolution, cycles, and catalog admission', () => {
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
        content: {},
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

  it('rejects declaration scope cycles in schemaVersion 3 graph documents', () => {
    const doc = {
      schemaVersion: 3,
      definitions: {
        '0': {
          id: 0,
          kind: 'text',
          source: { sourceId: 0 },
          components: [{ id: 0, kind: 'property', locator: { locatorId: 0 } }],
          content: {},
        },
      },
      instances: {
        '0': {
          id: 0,
          slideId: 'slide1',
          definitionId: 0,
          parentInstanceId: null,
          localTransform: [1, 0, 0, 1, 0, 0],
          paintIndex: 0,
          overrides: {},
        },
      },
      styles: {},
      fonts: {},
      declarationScopes: [
        { declaration: 'record-1', parent: 1 },
        { declaration: 'record-2', parent: 0 },
      ],
      sourceParts: [{ partUri: { partId: 0 }, preconditionHash: hash }],
      sourceLocations: [{ part: 0, path: [0] }],
      textShapes: [],
      textInventories: [],
      sourceIdentities: ['comp:1'],
      typedPropertyValues: [],
      sourceRelationships: [],
      fontDescriptors: [],
      partUris: ['ppt/slides/slide1.xml'],
    }
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(/Semantic scope cycle\/depth exceeded/)
  })

  it('rejects missing or non-array top-level graph catalogs in schemaVersion 3', () => {
    const doc = {
      schemaVersion: 3,
      definitions: {},
      instances: {},
      styles: {},
      fonts: {},
      declarationScopes: 'not-an-array',
      sourceParts: [],
      sourceLocations: [],
      textShapes: [],
      textInventories: [],
      sourceIdentities: [],
      typedPropertyValues: [],
      sourceRelationships: [],
      fontDescriptors: [],
      partUris: [],
    }
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(/Invalid semantic declarationScopes catalog/)
  })

  it('rejects instance parent cycles in schemaVersion 3 graph documents', () => {
    const doc = {
      schemaVersion: 3,
      definitions: {
        '0': {
          id: 0,
          kind: 'text',
          source: { sourceId: 0 },
          components: [{ id: 0, kind: 'property', locator: { locatorId: 0 } }],
          content: {},
        },
      },
      instances: {
        '0': {
          id: 0,
          slideId: 'slide1',
          definitionId: 0,
          parentInstanceId: 1,
          localTransform: [1, 0, 0, 1, 0, 0],
          paintIndex: 0,
          overrides: {},
        },
        '1': {
          id: 1,
          slideId: 'slide1',
          definitionId: 0,
          parentInstanceId: 0,
          localTransform: [1, 0, 0, 1, 0, 0],
          paintIndex: 1,
          overrides: {},
        },
      },
      styles: {},
      fonts: {},
      declarationScopes: [],
      sourceParts: [{ partUri: { partId: 0 }, preconditionHash: hash }],
      sourceLocations: [{ part: 0, path: [0] }],
      textShapes: [],
      textInventories: [],
      sourceIdentities: ['comp:1'],
      typedPropertyValues: [],
      sourceRelationships: [],
      fontDescriptors: [],
      partUris: ['ppt/slides/slide1.xml'],
    }
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(/Semantic parent cycle/)
  })

  it('resolves semantic definitions and instances correctly for schemaVersion 1/2 documents', () => {
    const doc = baseDocument()
    const def = semanticDefinition(doc, 'def:1')
    expect(def).toBeDefined()
    expect(def.id).toBe('def:1')
    expect(def.kind).toBe('text')

    const inst = semanticInstance(doc, 'inst:1')
    expect(inst).toBeDefined()
    expect(inst.id).toBe('inst:1')
    expect(inst.definitionId).toBe('def:1')
  })

  it.each(['0', '2'])('keeps wire references distinct from literal numeric component identity %s', (componentId) => {
    const source = baseDocument()
    source.definitions['def:1'].source.componentLocator = { path: [0, 0], preconditionHash: hash }
    source.definitions['def:1'].components[0].id = componentId
    const graph = compactSemanticGraph(source)
    const before = structuredClone(graph)
    const normalized = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(graph)))
    expect(semanticDefinition(normalized, 'def:1').components[0].id).toBe(componentId)
    expect(semanticInstance(normalized, 'inst:1').definitionId).toBe('def:1')

    const moved = moveSemanticInstance(normalized, 'inst:1', { x: 7, y: 9 })
    const reopened = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(moved)))
    expect(semanticInstance(reopened, 'inst:1').localTransform).toEqual([1, 0, 0, 1, 7, 9])
    expect(reopened.definitions).toEqual(normalized.definitions)
    expect(graph).toEqual(before)
  })

  it('rejects dangling declaration scope parent references', () => {
    const doc = {
      schemaVersion: 3,
      definitions: {},
      instances: {},
      styles: {},
      fonts: {},
      declarationScopes: [{ declaration: 'record-1', parent: 999 }],
      sourceParts: [{ partUri: { partId: 0 }, preconditionHash: hash }],
      sourceLocations: [{ part: 0, path: [0] }],
      textShapes: [],
      textInventories: [],
      sourceIdentities: [],
      typedPropertyValues: [],
      sourceRelationships: [],
      fontDescriptors: [],
      partUris: ['ppt/slides/slide1.xml'],
    }
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(/Dangling declaration scope parent/)
  })

  it('bounds evaluation budget during decodeValue recursion', () => {
    const { decodeValue } = require('../../shared/src/pptx-semantic-records.js')
    const cyclicRelation = {
      schemaVersion: 3,
      sourceRelationships: [{ kind: 'edges', value: [0] }],
    }
    expect(() => decodeValue(cyclicRelation, [0], 'edges')).toThrow(/evaluation depth/)
  })
})
