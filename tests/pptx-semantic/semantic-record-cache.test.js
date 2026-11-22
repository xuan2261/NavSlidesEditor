import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  normalizePptxSemanticDocument,
} = require('../../shared/src/pptx-semantic-document.js')
const {
  semanticDefinition,
  semanticInstance,
  semanticStyle,
  semanticRecords,
  replaceSemanticRecords,
  certifyImmutableSemanticDocument,
  isCertifiedSemanticDocument,
  cloneImmutableSemanticDocument,
  isOwnedDecodedSemanticValue,
} = require('../../shared/src/pptx-semantic-records.js')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph.js')

describe('exact predecessor clone and decode boundaries', () => {
  const limits = { maxDepth: 256, maxInstances: 100000, maxComponents: 100000 }
  const json = value => JSON.parse(JSON.stringify(value))
  const clone = (value, predecessor) => cloneImmutableSemanticDocument(value, limits, TypeError, predecessor)
  it('preserves key order and Object.is, requires ownership and validates all descriptors', () => {
    const base = clone({ a: { x: 0 }, b: [1, 2] })
    expect(clone(json(base), base)).toBe(base)
    expect(isCertifiedSemanticDocument(base)).toBe(false)
    const reordered = clone({ b: [1, 2], a: { x: 0 } }, base)
    expect(Object.keys(reordered)).toEqual(['b', 'a'])
    expect(reordered).not.toBe(base)
    expect(reordered.a).toBe(base.a)
    const signed = clone({ a: { x: -0 }, b: [1, 2] }, base)
    expect(Object.is(signed.a.x, -0)).toBe(true)
    expect(signed.a).not.toBe(base.a)
    const frozen = certifyImmutableSemanticDocument(Object.freeze({ a: Object.freeze({ x: 0 }) }))
    expect(clone({ a: { x: 0 } }, frozen)).not.toBe(frozen)
    let reads = 0
    const hidden = Object.defineProperty({}, 'hidden', { value: 1 })
    const getter = Object.defineProperty({}, 'x', { enumerable: true, get() { reads++; return 1 } })
    const cycle = {}; cycle.self = cycle
    const proxy = new Proxy({}, { ownKeys() { throw new Error('proxy refused') } })
    for (const a of [hidden, getter, cycle, proxy, new Array(1), { constructor: 1 }, Infinity])
      expect(() => clone({ a, b: [1, 2] }, base)).toThrow()
    expect(reads).toBe(0)
    const shared = { value: 1 }
    const aliases = clone({ a: shared, b: shared })
    expect(aliases.a).not.toBe(aliases.b)
  })
  it('retains only matching records under the complete catalog/style identity tuple', () => {
    const { CATALOGS } = require('../../shared/src/pptx-semantic-records')
    const raw = { schemaVersion: 3, definitions: { 0: { id: 0, kind: 'shape' } },
      instances: { 1: { id: 1, paintIndex: 0 }, 2: { id: 2, paintIndex: 1 } }, styles: {},
      ...Object.fromEntries(CATALOGS.map(key => [key, []])), sourceIdentities: ['d', 'a', 'b'] }
    const base = clone(raw)
    const oldA = semanticInstance(base, 1), oldB = semanticInstance(base, 2)
    const oldD = semanticDefinition(base, 0)
    const changed = json(base)
    changed.instances[1].paintIndex++
    const next = clone(changed, base)
    expect(semanticInstance(next, 1)).not.toBe(oldA)
    expect(semanticInstance(next, 2)).toBe(oldB)
    expect(semanticDefinition(next, 0)).toBe(oldD)
    expect(isCertifiedSemanticDocument(next)).toBe(false)
    delete changed.instances[2]
    expect(semanticInstance(clone(changed, base), 2)).toBeUndefined()
    for (const field of ['styles', ...CATALOGS]) {
      const input = json(base)
      if (field === 'styles') input.styles.extra = { kind: 'unused' }
      else if (field === 'sourceIdentities') input[field].push('extra')
      else input[field].push(null)
      expect(semanticInstance(clone(input, base), 1)).not.toBe(oldA)
    }
    const changedDefinition = json(base)
    changedDefinition.definitions[0].unused = true
    const output = clone(changedDefinition, base)
    expect(semanticDefinition(output, 0)).not.toBe(oldD)
    expect(semanticInstance(output, 1)).toBe(oldA)
  })
})

describe('owned wire kind membership', () => {
  const limits = { maxDepth: 30, maxInstances: 100, maxComponents: 100 }
  const clone = (value) => cloneImmutableSemanticDocument(value, limits)
  const entries = (document, filter) => [...semanticRecords(document, 'styles', filter)]
  const fixture = (schemaVersion) => ({
    schemaVersion, sourceIdentities: ['zero', 'one', 'two'], partUris: ['old.xml'],
    styles: { 2: { kind: 'theme', source: { partId: 0 } },
      0: { kind: 'override' }, 1: { kind: 'theme' }, tail: { kind: 'theme' } },
    instances: {},
  })
  for (const schemaVersion of [1, 2, 3]) {
    it(`preserves schema ${schemaVersion} key and predicate order`, () => {
      const document = clone(fixture(schemaVersion))
      const expected = schemaVersion === 3 ? ['zero', 'one', 'two', 'tail'] : ['0', '1', '2', 'tail']
      for (let repeat = 0; repeat < 2; repeat++) {
        expect(entries(document).map(([id]) => id)).toEqual(expected)
        expect(entries(document, { kind: 'theme' }).map(([id]) => id)).toEqual(expected.slice(1))
        expect(entries(document, { kind: 'missing' })).toEqual([])
        const calls = []
        entries(document, (wire) => { calls.push(wire); return wire.kind === 'theme' })
        expect(calls).toEqual(Object.values(document.styles))
      }
      expect(isCertifiedSemanticDocument(document)).toBe(false)
    })
  }
  it('shares wire membership but decodes against the current catalog and changed styles', () => {
    const document = certifyImmutableSemanticDocument(clone(fixture(3)))
    expect(entries(document, { kind: 'theme' })[1][1].source).toBe('old.xml')
    const changedCatalog = certifyImmutableSemanticDocument(clone({ ...document, partUris: ['new.xml'] }))
    expect(changedCatalog.styles).toBe(document.styles)
    expect(entries(changedCatalog, { kind: 'theme' })[1][1].source).toBe('new.xml')
    const instancesPatch = replaceSemanticRecords(document, { instances: { instance: { kind: 'shape' } } })
    expect(instancesPatch.styles).toBe(document.styles)
    expect(entries(instancesPatch, { kind: 'theme' })).toEqual(entries(document, { kind: 'theme' }))
    const changed = replaceSemanticRecords(document, { styles: { one: { kind: 'override' } } })
    for (const next of [changed, clone(changed)]) {
      expect(entries(next, { kind: 'theme' }).map(([id]) => id)).toEqual(['two', 'tail'])
      expect(entries(next, { kind: 'override' }).map(([id]) => id)).toEqual(['zero', 'one'])
    }
  })
  it('never trusts raw frozen or proxied dictionary identity', () => {
    const wire = { kind: 'theme' }
    const styles = Object.freeze({ wire })
    const document = { schemaVersion: 2, styles }
    expect(entries(document, { kind: 'theme' })).toHaveLength(1)
    wire.kind = 'override'
    expect(entries(document, { kind: 'theme' })).toEqual([])
    expect(entries(document, { kind: 'override' })).toHaveLength(1)
    let current = { kind: 'theme' }
    const target = Object.freeze(Object.defineProperty({}, 'wire', { enumerable: true, get: () => current }))
    document.styles = new Proxy(target, {})
    expect(entries(document, { kind: 'theme' })).toHaveLength(1)
    current = { kind: 'override' }
    expect(entries(document, { kind: 'theme' })).toEqual([])
    expect(() => clone(document)).toThrow(/data property/)
  })
  it('does not skip decoding failures or evaluation budgets for selected records', () => {
    const document = clone({ schemaVersion: 3, sourceIdentities: ['style'],
      styles: { 0: { kind: 'theme', source: { partId: 0 } } }, partUris: [] })
    for (let repeat = 0; repeat < 2; repeat++) {
      expect(() => entries(document, { kind: 'theme' })).toThrow(/part URI reference/)
      expect(entries(document, { kind: 'missing' })).toEqual([])
    }
    const oversized = clone({ schemaVersion: 3, sourceIdentities: ['style'],
      styles: { 0: { kind: 'theme', value: 'x'.repeat(8388608) } } })
    expect(() => entries(oversized, { kind: 'theme' })).toThrow(/evaluation byte budget/)
  })
})

describe('semantic decoder primitive byte measurements', () => {
  const byteLimit = 8388608
  const oracle = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8')
  const unusual = 'é中😀\ud800x\udc00\u0000\b\t\n\f\r\u001f"\\/\u2028\u2029'
  function fixture(padding = '') {
    const uri = `ppt/${unusual}/slide.xml`
    const identity = `${uri}#${unusual}:1`
    const key = `key:${unusual}`
    const values = [null, true, false, 0, -0, 1.25, 1e30, Number.MIN_VALUE, Number.MAX_VALUE, unusual]
    return {
      document: {
        schemaVersion: 3, sourceIdentities: [[0, unusual, 1]], partUris: [uri],
        definitions: { 0: { id: 0, source: { partId: 0 }, [key]: values, padding } },
      },
      expected: { id: identity, source: uri, [key]: values, padding },
    }
  }
  it('matches the old UTF-8 oracle at the exact expanded Unicode/URI byte boundary', () => {
    const remaining = byteLimit - oracle(fixture().expected)
    for (const delta of [-1, 0, 1]) {
      const { document, expected } = fixture('x'.repeat(remaining + delta))
      expect(oracle(expected)).toBe(byteLimit + delta)
      if (delta <= 0) expect(semanticDefinition(document, 0)).toEqual(expected)
      else expect(() => semanticDefinition(document, 0)).toThrow(/evaluation byte budget/)
    }
  })
  it('still charges every resolved URI expansion occurrence', () => {
    const uri = unusual.repeat(50000)
    const document = {
      schemaVersion: 3, sourceIdentities: ['definition'], partUris: [uri],
      definitions: { 0: { references: Array.from({ length: 4 }, () => ({ partId: 0 })) } },
    }
    expect(oracle(document.definitions[0])).toBeLessThan(byteLimit)
    expect(oracle({ references: Array(4).fill(uri) })).toBeGreaterThan(byteLimit)
    expect(() => semanticDefinition(document, 0)).toThrow(/evaluation byte budget/)
  })
  it('retains unsupported primitive failures and nonfinite JSON fallback', () => {
    for (const value of [undefined, () => {}, Symbol('value'), 1n]) {
      const document = { schemaVersion: 3, sourceIdentities: ['definition'], definitions: { 0: { value } } }
      expect(() => oracle(value)).toThrow(TypeError)
      expect(() => semanticDefinition(document, 0)).toThrow(TypeError)
    }
    for (const value of [NaN, Infinity, -Infinity]) {
      const document = { schemaVersion: 3, sourceIdentities: ['definition'], definitions: { 0: { value } } }
      expect(semanticDefinition(document, 0).value).toBe(value)
    }
  })
})

describe('pptx semantic record cache immutability and certification boundaries', () => {
  const cloneLimits = { maxDepth: 20, maxInstances: 20, maxComponents: 20 }
  it('rejects sparse arrays disguised by numeric extras, symbols, or accessors', () => {
    for (const key of ['4294967295', '9007199254740992', '01', '-0', '1e0', 'extra']) {
      const array = new Array(1)
      array[key] = 'not index zero'
      expect(() => cloneImmutableSemanticDocument({ array }, cloneLimits)).toThrow(/array/)
    }
    for (const array of [new Array(1), Object.assign([1], { extra: 2 }),
      Object.assign([1], { [Symbol('extra')]: 2 })]) {
      expect(() => cloneImmutableSemanticDocument(array, cloneLimits)).toThrow()
    }
    let reads = 0
    const accessor = Object.defineProperty([], '0', { enumerable: true, get() { reads++; return 1 } })
    expect(() => cloneImmutableSemanticDocument(accessor, cloneLimits)).toThrow(/data property/)
    expect(reads).toBe(0)
    const input = [[], [null, false, 0, '😀'], { values: [1, 2] }]
    const output = cloneImmutableSemanticDocument(input, cloneLimits)
    expect(output).toEqual(input)
    expect(output).not.toBe(input)
    for (const array of [output, output[0], output[1], output[2].values]) {
      expect(Object.isFrozen(array)).toBe(true)
      expect(Reflect.ownKeys(array)).toEqual([...Array.from({ length: array.length }, (_, i) => String(i)), 'length'])
    }
  })
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

  function checkedResources(graph = resourceGraph()) {
    const { CATALOGS } = require('../../shared/src/pptx-semantic-records.js')
    return cloneImmutableSemanticDocument({
      ...Object.fromEntries(CATALOGS.map((key) => [key, []])), ...graph,
    }, { maxDepth: 256, maxInstances: 2000000, maxComponents: 2000000 })
  }

  it('reuses successful checked resource and record decodes before certification only', () => {
    const graph = checkedResources()
    const first = semanticStyle(graph, 'first')
    expect(semanticStyle(graph, 'first')).toBe(first)
    expect(semanticStyle(graph, 'second').payload.fontRequests[0]).toBe(first.payload.fontRequests[0])
    expect(isCertifiedSemanticDocument(graph)).toBe(false)
    // Decode success must not grant whole-document validation authority.
    for (let repeat = 0; repeat < 2; repeat++) expect(() => normalizePptxSemanticDocument(graph)).toThrow()
    expect(isCertifiedSemanticDocument(graph)).toBe(false)
  })

  it.each(['font', 'color', 'properties', 'invalid'])('drops all warm dependent contexts after a %s pool patch', change => {
    const raw = resourceGraph()
    raw.styles[0].payload.records['record-2'] = { kind: 'declaration', value: { properties: { fontSize: 12 } } }
    raw.declarationScopes = [{ parent: null, declaration: 2 }]
    raw.textShapes.forEach(shape => { shape.body.scope = 0 })
    const base = certifyImmutableSemanticDocument(checkedResources(raw))
    const before = ['first', 'second'].map(id => semanticStyle(base, id))
    const instanceOnly = replaceSemanticRecords(base, { instances: { instance: { paintIndex: 0 } } })
    expect(semanticStyle(instanceOnly, 'first')).toBe(before[0])
    const pool = structuredClone(base.styles[0])
    if (change === 'font') pool.payload.records['record-1'].value.typeface = 'Changed'
    if (change === 'color') pool.payload.records['record-0'].value.colors.dk1 = 'ABCDEF'
    if (change === 'properties') pool.payload.records['record-2'].value.properties.fontSize = 42
    if (change === 'invalid') pool.payload.records['record-0'].kind = 'font'
    const next = replaceSemanticRecords(base, { styles: { pool } })
    expect(Object.isFrozen(pool.payload.records['record-2'].value.properties)).toBe(true)
    const cold = JSON.parse(JSON.stringify(next))
    const cloned = cloneImmutableSemanticDocument(next,
      { maxDepth: 256, maxInstances: 2000000, maxComponents: 2000000 }, TypeError, next)
    for (const id of ['first', 'second']) {
      if (change === 'invalid') {
        for (const doc of [next, cloned, cold]) expect(() => semanticStyle(doc, id)).toThrow(/resource kind/)
      } else {
        expect(semanticStyle(next, id)).not.toBe(before[id === 'first' ? 0 : 1])
        for (const doc of [next, cloned]) expect(semanticStyle(doc, id)).toEqual(semanticStyle(cold, id))
      }
    }
  })

  it('invalidates checked decodes for replaced catalog dependencies', () => {
    const raw = resourceGraph(1, { descriptorId: 0 })
    raw.fontDescriptors = [{ typeface: 'First' }]
    const first = checkedResources(raw)
    expect(semanticStyle(first, 'first').payload.fontRequests[0].typeface).toBe('First')
    const second = checkedResources({ ...first, fontDescriptors: [{ typeface: 'Second' }] })
    expect(second.styles).toBe(first.styles)
    expect(semanticStyle(second, 'first').payload.fontRequests[0].typeface).toBe('Second')
    const bad = checkedResources({ ...first, fontDescriptors: [] })
    for (let repeat = 0; repeat < 2; repeat++)
      expect(() => semanticStyle(bad, 'first')).toThrow(/font descriptor reference/)
  })

  it('replays every resource charge during first checked admission and rejects unused invalid wire', () => {
    for (const [references, value, error] of [
      [40, { data: Array(30000).fill(0) }, /evaluation visited-value budget/],
      [4, { typeface: 'x'.repeat(2200000) }, /evaluation byte budget/],
    ]) {
      const graph = checkedResources(resourceGraph(references, value))
      semanticStyle(graph, 'first')
      for (let repeat = 0; repeat < 2; repeat++) expect(() => semanticStyle(graph, 'second')).toThrow(error)
      expect(isCertifiedSemanticDocument(graph)).toBe(false)
    }
    const raw = resourceGraph()
    raw.styles[0].payload.records['record-1'].unused = { partId: 999 }
    const graph = checkedResources(raw)
    semanticStyle(graph, 'first') // Warm the valid resource, not pool admission.
    for (let repeat = 0; repeat < 2; repeat++) expect(() => semanticStyle(graph, 'pool')).toThrow(/part URI reference/)
    expect(() => normalizePptxSemanticDocument(graph)).toThrow()
  })

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

  it('admits every pool wire field even when resource expansion discards it', () => {
    for (const field of ['unused', 'value']) {
      const graph = resourceGraph()
      graph.styles[0].payload.records['record-1'][field] = { partId: 999 }
      expect(() => semanticStyle(graph, 'pool')).toThrow(/part URI reference/)
      expect(() => semanticStyle(certify(graph), 'pool')).toThrow(/part URI reference/)
    }
  })

  it('preserves the exact combined wire-admission and expansion byte boundary', () => {
    const graph = resourceGraph(1, { typeface: '' })
    const pool = graph.styles[0]
    const jsonBytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8')
    const overhead = jsonBytes(pool) + Object.values(pool.payload.records)
      .reduce((total, record) => total + jsonBytes(record.value), 0)
    const padding = Math.floor((8388608 - overhead) / 2)
    for (const delta of [0, 1]) {
      const input = resourceGraph(1, { typeface: 'x'.repeat(padding + delta) })
      if (delta === 0) expect(semanticStyle(input, 'pool').payload.records['record-1'].value.typeface.length).toBe(padding)
      else expect(() => semanticStyle(input, 'pool')).toThrow(/evaluation byte budget/)
    }
  })

  it('retains wire visit charges and unused-field byte charges for pools', () => {
    const visits = resourceGraph(1, { data: Array(550000).fill(0) })
    expect(() => semanticStyle(visits, 'pool')).toThrow(/evaluation visited-value budget/)
    const unused = resourceGraph()
    unused.styles[0].payload.records['record-1'].unused = 'x'.repeat(8388608)
    expect(() => semanticStyle(certify(unused), 'pool')).toThrow(/evaluation byte budget/)
  })

  it('does not cache raw pool admission or grant schema admission by certification', () => {
    const raw = resourceGraph()
    expect(semanticStyle(raw, 'pool').payload.records['record-1'].value.typeface).toBe('Inherited')
    raw.styles[0].payload.records['record-1'].unused = { valueId: 0 }
    raw.typedPropertyValues = [{ kind: 'wrong', value: {} }]
    expect(() => semanticStyle(raw, 'pool')).toThrow(/property kind/)
    expect(() => semanticStyle(certify(raw), 'pool')).toThrow(/property kind/)
    expect(() => normalizePptxSemanticDocument(raw)).toThrow()
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


describe('text lazy CommonJS bindings', () => {
  it.each(['text-first', 'records-first'])('resolves once after initialization in %s order', (order) => {
    const result = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict')
      const Module = require('node:module')
      const load = Module._load
      const counts = new Map()
      Module._load = function (request, parent, ...args) {
        if (parent?.filename.endsWith('pptx-text-document.js'))
          counts.set(request, (counts.get(request) || 0) + 1)
        return load.call(this, request, parent, ...args)
      }
      if (${JSON.stringify(order)} === 'records-first') require('./shared/src/pptx-semantic-records.js')
      const text = require('./shared/src/pptx-text-document.js')
      assert.equal(counts.size, 0)
      const records = require('./shared/src/pptx-semantic-records.js')
      const input = { schemaVersion: 1, componentId: 'text', paragraphs: [{
        componentId: 'paragraph', runs: [{
          componentId: 'run', kind: 'equation', hyperlinks: { click: { componentId: 'link', relationshipId: 'rId1', action: null } },
          properties: { color: { kind: 'preset', value: 'red' }, outline: { dash: { kind: 'preset', value: 'dash' } } },
          ommlDocument: { schemaVersion: 1, root: {
            componentId: 'math', namespaceUri: 'http://schemas.openxmlformats.org/officeDocument/2006/math',
            type: 'oMath', attributes: [], children: [],
          } },
        }],
      }] }
      for (let i = 0; i < 3; i++) {
        assert.deepEqual(text.normalizeTextDocument(input), input)
        const owned = records.semanticStyle({ schemaVersion: 3, styles: { x: { nested: { bold: true } } } }, 'x')
        assert.notEqual(text.cloneOwnedTextData(owned), owned)
        assert.equal(text.cloneOwnedTextData(owned), owned)
        const caller = Object.freeze({ nested: Object.freeze({ bold: true }) })
        assert.notEqual(text.cloneOwnedTextData(caller), caller)
        assert.notEqual(text.cloneOwnedTextData(caller), caller)
      }
      for (const name of ['pptx-semantic-records', 'pptx-omml-document', 'pptx-geometry-color', 'pptx-geometry-document', 'pptx-text-hyperlinks'])
        assert.equal(counts.get('./' + name), 1, name + ' must resolve once')
    `], { cwd: process.cwd(), encoding: 'utf8' })
    expect(result.stderr).toBe('')
    expect(result.status, result.stdout + result.stderr).toBe(0)
  })
})

describe('private decoded text ownership bridge', () => {
  const { cloneOwnedTextData, cloneTextData } = require('../../shared/src/pptx-text-document.js')
  const decoded = (value) => semanticStyle({ schemaVersion: 3, styles: { x: value } }, 'x')
  it('reuses the original decoder producer only after complete text admission', () => {
    const value = decoded({ nested: { properties: { bold: false } } })
    expect(isOwnedDecodedSemanticValue(value)).toBe(true)
    expect(isOwnedDecodedSemanticValue(value.nested)).toBe(true)
    const first = cloneOwnedTextData(value)
    expect(first).not.toBe(value)
    // Identity verifies reuse only; unit tests do not establish performance.
    expect(cloneOwnedTextData(value)).toBe(value)
    expect(cloneOwnedTextData(value.nested)).toBe(value.nested)
    expect(cloneTextData(value).nested).not.toBe(value.nested)
    expect(first).toEqual(value)
  })
  it('does not promote frozen caller patches or certificates', () => {
    const raw = Object.freeze({ nested: Object.freeze({ bold: true }) })
    certifyImmutableSemanticDocument(raw)
    const doc = certifyImmutableSemanticDocument(Object.freeze({ schemaVersion: 2, styles: Object.freeze({}) }))
    replaceSemanticRecords(doc, { styles: { raw } })
    expect(isOwnedDecodedSemanticValue(raw)).toBe(false)
    expect(isOwnedDecodedSemanticValue(raw.nested)).toBe(false)
    expect(cloneOwnedTextData(raw)).not.toBe(raw)
    expect(cloneOwnedTextData(raw)).not.toBe(raw)
  })
  it('proves allocated arrays and descendants during freezing without promoting raw passthroughs', () => {
    const raw = { nested: { bold: true } }
    const value = semanticStyle({ schemaVersion: 3, partUris: [raw], styles: {
      x: { before: [{ properties: { italic: true } }], raw: { partId: 0 }, after: { bold: false } },
    } }, 'x')
    expect(Object.isFrozen(raw.nested)).toBe(true)
    expect(isOwnedDecodedSemanticValue(raw)).toBe(false)
    expect(isOwnedDecodedSemanticValue(raw.nested)).toBe(false)
    expect(isOwnedDecodedSemanticValue(value)).toBe(false)
    for (const child of [value.before, value.before[0], value.before[0].properties, value.after]) {
      expect(isOwnedDecodedSemanticValue(child)).toBe(true)
      expect(Object.isFrozen(child)).toBe(true)
    }
    expect(cloneOwnedTextData(value)).not.toBe(value)
    expect(cloneOwnedTextData(value)).not.toBe(value)
  })
  it('does not turn checked raw passthroughs into decoder ownership', () => {
    const raw = cloneImmutableSemanticDocument({ nested: { bold: true } },
      { maxDepth: 30, maxInstances: 100, maxComponents: 100 })
    const value = semanticStyle({ schemaVersion: 3, partUris: [raw], styles: {
      x: { raw: { partId: 0 }, allocated: { bold: false } },
    } }, 'x')
    expect(isOwnedDecodedSemanticValue(value)).toBe(false)
    expect(isOwnedDecodedSemanticValue(raw)).toBe(false)
    expect(isOwnedDecodedSemanticValue(value.allocated)).toBe(true)
    expect(isOwnedDecodedSemanticValue(raw.nested)).toBe(false)
    const document = certifyImmutableSemanticDocument(cloneImmutableSemanticDocument(
      { schemaVersion: 3, styles: {} },
      { maxDepth: 30, maxInstances: 100, maxComponents: 100 }))
    const patch = { nested: { bold: true } }
    const next = replaceSemanticRecords(document, { styles: { patch } })
    for (const child of [patch, patch.nested, next, next.styles]) {
      expect(isOwnedDecodedSemanticValue(child)).toBe(false)
    }
    expect(isOwnedDecodedSemanticValue(semanticStyle(next, 'patch'))).toBe(true)
  })
  it('publishes no partial receipts after failed aggregate admission', () => {
    const value = decoded({ nested: { bold: true } })
    expect(() => cloneOwnedTextData({ value, bad: undefined })).toThrow()
    expect(cloneOwnedTextData(value)).not.toBe(value)
    expect(cloneOwnedTextData(value)).toBe(value)
  })
  it('charges every alias and relative depth even after producer admission', () => {
    const value = decoded({ text: 'x'.repeat(1500000) })
    cloneOwnedTextData(value)
    expect(() => cloneOwnedTextData({ a: value, b: value, c: value })).toThrow(/JSON bytes/)
    let nested = decoded({ leaf: true })
    cloneOwnedTextData(nested)
    for (let i = 0; i < 24; i++) nested = { nested }
    expect(() => cloneOwnedTextData(nested)).toThrow(/JSON budget/)
  })
})
