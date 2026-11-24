// @vitest-environment node
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { geometryStyleFixture } from './geometry-style-fixture.js'

const require = createRequire(import.meta.url)
const { normalizePptxSemanticDocument: normalize } = require('../../shared/src/pptx-semantic-document')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
const { certifyImmutableSemanticDocument: certify, replaceSemanticRecords, semanticInstance, isCheckedImmutableSemanticValue } = require('../../shared/src/pptx-semantic-records')
const clone = (value) => JSON.parse(JSON.stringify(value))
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
const fixture = () => ({
  schemaVersion: 1,
  definitions: Object.fromEntries(Array.from({ length: 4 }, (_, index) => {
    const id = `d${index}`
    return [id, {
      id, kind: 'shape',
      source: { partUri: 'ppt/slides/slide1.xml', nativeId: String(index), preconditionHash: 'a'.repeat(64) },
      components: Array.from({ length: 2 }, (_, n) => ({
        id: `c${n}`, kind: 'path', partUri: 'ppt/slides/slide1.xml',
        locator: { path: [n], preconditionHash: 'a'.repeat(64) },
      })),
      content: {},
    }]
  })),
  instances: Object.fromEntries(['i1', 'i2'].map(id => [id, {
    id, definitionId: 'd0', slideId: 'slide1', parentInstanceId: null,
    localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0,
    overrides: { components: { c0: {} } },
  }])),
  styles: {}, fonts: {},
})

describe('semantic normalization successful immutable receipts', () => {
  for (const version of [1, 2, 3]) {
    it(`interns only exact checked wire predecessors for schema ${version}`, () => {
      const raw = version === 2 ? geometryStyleFixture() : fixture()
      const base = normalize(version === 3 ? compactSemanticGraph(raw) : raw)
      expect(normalize(clone(base))).not.toBe(base)
      expect(normalize(clone(base), {}, { predecessor: base })).toBe(base)
      const changed = clone(base)
      const key = Object.keys(changed.instances)[0]
      changed.instances[key].paintIndex++
      const baseline = normalize(clone(changed))
      const next = normalize(changed, {}, { predecessor: base })
      expect(next).toEqual(baseline)
      expect(JSON.stringify(next)).toBe(JSON.stringify(baseline))
      expect(next.definitions).toBe(base.definitions)
      expect(next.instances).not.toBe(base.instances)
      expect(next.instances[key]).not.toBe(base.instances[key])
      expect(next.instances[key].localTransform).toBe(base.instances[key].localTransform)
      expect(() => normalize(clone(base), { maxBytes: 1 }, { predecessor: base })).toThrow(/budget/)
      expect(() => normalize(clone(base), { maxDepth: 1 }, { predecessor: base })).toThrow(/budget/)
      expect(() => normalize({ ...clone(base), unused: true }, {}, { predecessor: base })).toThrow(/schema/)
      const { validateSemanticPresentationBindings: admit } = require('../../shared/src/pptx-semantic-presentation')
      expect(admit({ pptxSemantic: clone(base) }, { predecessor: base })).toBe(base)
    })
  }

  it('preserves exact raw/owned byte boundaries and invalid error contracts', () => {
    const { PptxSemanticValidationError } = require('../../shared/src/pptx-semantic-document')
    const { measureSemanticBudget } = require('../../shared/src/pptx-semantic-budget-receipts')
    const raw = fixture()
    raw.definitions.d0.content.text = 'é漢😀\ud800\n'
    const checked = normalize(raw)
    const metrics = measureSemanticBudget(checked)
    expect(metrics.jsonBytes).toBe(Buffer.byteLength(JSON.stringify(checked)))
    const reject = (input, options, message) => {
      let caught
      try { normalize(input, options) } catch (error) { caught = error }
      expect(caught).toBeInstanceOf(PptxSemanticValidationError)
      expect(caught).toMatchObject({ name: 'PptxSemanticValidationError',
        code: 'INVALID_PPTX_SEMANTIC_DOCUMENT', message })
    }
    let calls = 0
    const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { calls++; return 1 } })
    const cycle = {}; cycle.self = cycle
    const invalid = [[accessor, 'Semantic content must use enumerable data property'],
      [cycle, 'Semantic content cycle'],
      ...[NaN, Infinity, -Infinity].map(value => [value, 'Invalid numeric value in semantic data/transform'])]
    for (const key of ['__proto__', 'constructor', 'prototype', 'sourceAuthority', 'sourceRef', 'sourceMap',
      'packagePath', 'originalPath', 'packageRevisionId', 'aggregateGeneration', 'fencingEpoch',
      'adapterQualified', 'transactionEligible', 'level4Promoted', 'controlCapabilityHash', 'capabilityHash'])
      invalid.push([Object.fromEntries([[key, true]]), 'Forbidden semantic authority key'])
    for (const input of [raw, checked, { ...checked }, checked]) {
      expect(normalize(input, { maxBytes: metrics.jsonBytes })).toEqual(checked)
      reject(input, { maxBytes: metrics.jsonBytes - 1 }, 'Semantic byte budget exceeded')
      expect(normalize(input, { maxDepth: metrics.maxRelativeDepth })).toEqual(checked)
      reject(input, { maxDepth: metrics.maxRelativeDepth - 1 }, 'Semantic data budget exceeded')
      expect(normalize(input, { maxComponents: 8 })).toEqual(checked)
      reject(input, { maxComponents: 5 }, 'Semantic array budget exceeded')
      for (const [payload, message] of invalid) {
        // Clone failures precede output schema and byte failures; no getter runs.
        reject({ ...input, unexpected: payload }, { maxBytes: 1 }, message)
        reject({ ...input, unexpected: payload }, { maxBytes: 1 }, message)
      }
    }
    expect(calls).toBe(0)
    reject({ ...raw, unexpected: 1 }, { maxBytes: 1 }, 'Unsupported semantic schema')
  })

  const structuralFixture = () => ({
    schemaVersion: 3, definitions: {}, instances: {}, styles: {}, fonts: {},
    ...Object.fromEntries(require('../../shared/src/pptx-semantic-records').CATALOGS.map(key => [key, []])),
    partUris: ['ppt/slides/slide1.xml'],
    sourceParts: [{ partUri: { partId: 0 }, preconditionHash: 'a'.repeat(64) }],
    sourceLocations: [{ part: 0, path: [0] }],
    declarationScopes: [{ parent: null }, { parent: 0 }],
  })

  for (const [field, mutate, error] of [
    ['sourceParts', value => { value[0].preconditionHash = 'bad' }, /preconditionHash/],
    ['sourceParts', value => { value[0].partUri.partId = 99 }, /part URI/],
    ['sourceLocations', value => { value[0].part = 99 }, /source part/],
    ['sourceLocations', value => { value[0].path = [-1] }, /path/],
    ['declarationScopes', value => { value[0].parent = 1 }, /cycle/],
    ['declarationScopes', value => { value[1].parent = 99 }, /parent/],
  ]) {
    it(`rechecks changed ${field} after successful graph admission`, () => {
      const base = normalize(structuralFixture())
      const changed = clone(base[field])
      mutate(changed)
      const input = { ...base, [field]: changed }
      expect(() => normalize(input)).toThrow(error)
      expect(() => normalize(input)).toThrow(error)
      expect(normalize({ ...base }).sourceParts).toBe(base.sourceParts)
    })
  }

  it('graph validation subsumes scope ancestry checks at the fixed 256-edge boundary', () => {
    const { validateGraphStructure } = require('../../shared/src/pptx-semantic-records')
    const chain = edges => Array.from({ length: edges + 1 }, (_, i) => ({ parent: i ? i - 1 : null }))
    const valid = { ...structuralFixture(), declarationScopes: chain(256) }
    expect(() => validateGraphStructure(valid)).not.toThrow()
    const warm = normalize(valid)
    expect(normalize({ ...warm }).declarationScopes).toBe(warm.declarationScopes)
    for (const scopes of [chain(257), [{ parent: 1 }, { parent: 2 }, { parent: 1 }],
      [{ parent: 99 }], [{ parent: -1 }], [{ parent: 0.5 }], [null]]) {
      const raw = { ...valid, declarationScopes: scopes }
      expect(() => validateGraphStructure(raw)).toThrow()
      expect(() => normalize(raw)).toThrow()
      expect(() => normalize({ ...warm, declarationScopes: scopes })).toThrow()
    }
  })

  it('keeps structural receipts separate from semantic admission and caller budgets', () => {
    const base = normalize(structuralFixture())
    // Schema 3 validates project overrides here, not arbitrary source wire kinds.
    // A real override with a missing provider must fail even with warm catalogs.
    const styles = { bad: {
      kind: 'inheritance-override', origin: 'project',
      baseDefinitionId: 'missing', values: {},
    } }
    expect(() => normalize({ ...structuralFixture(), styles })).toThrow(/inheritance override target definition/)
    const invalidStyle = { ...base, styles }
    expect(() => normalize(invalidStyle)).toThrow(/inheritance override target definition/)
    expect(() => normalize(invalidStyle)).toThrow(/inheritance override target definition/)
    expect(() => normalize({ ...base, definitions: { bad: { kind: 'invalid' } } })).toThrow()
    expect(() => normalize({ ...base, textInventories: {} })).toThrow(/catalog/)
    const next = normalize({ ...base, instances: {} }, { maxDepth: 64 })
    for (const key of require('../../shared/src/pptx-semantic-records').CATALOGS)
      expect(next[key]).toBe(base[key])
    expect(() => normalize({ ...next }, { maxDepth: 1 })).toThrow(/budget/)
  })

  it('never trusts clone ownership, certification, or raw identities as structural success', () => {
    const { validateGraphStructure: validate, cloneImmutableSemanticDocument: checkedClone } =
      require('../../shared/src/pptx-semantic-records')
    const invalid = structuralFixture()
    invalid.declarationScopes[0].parent = 1
    const checked = certify(checkedClone(invalid, { maxDepth: 256, maxInstances: 100000, maxComponents: 100000 }))
    expect(() => validate(checked)).toThrow(/cycle/)
    expect(() => validate({ ...checked })).toThrow(/cycle/)
    for (const shallow of [false, true]) {
      const input = structuralFixture()
      if (shallow) Object.freeze(input)
      validate(input)
      normalize(input)
      input.sourceLocations[0].part = 99
      expect(() => validate(input)).toThrow(/source part/)
      expect(() => normalize(input)).toThrow(/source part/)
    }
  })

  for (const version of [1, 2, 3]) {
    for (const shallow of [false, true]) {
      it(`freezes retained ${shallow ? 'shallow-frozen' : 'mutable'} patch descendants before schema ${version} receipts`, () => {
        const raw = version === 2 ? geometryStyleFixture() : fixture()
        const base = normalize(version === 3 ? compactSemanticGraph(raw) : raw)
        const componentId = version === 2 ? 'geometry' : 'c0'
        const overrides = { components: { [componentId]: {} } }
        const record = { ...semanticInstance(base, 'i1'), overrides }
        if (shallow) Object.freeze(record)
        const patched = replaceSemanticRecords(base, { instances: { i1: record } })
        // Deep-freeze proof must not become checked-clone ownership: the
        // normalizer still has to charge the entire raw patched subtree.
        expect(isCheckedImmutableSemanticValue(patched)).toBe(false)
        expect(isCheckedImmutableSemanticValue(overrides)).toBe(false)
        const output = normalize(patched)
        expect(normalize(patched)).toBe(output)
        expect(Object.isFrozen(overrides.components[componentId])).toBe(true)
        expect(() => { overrides.components.missing = {} }).toThrow(TypeError)
        expect(normalize(patched)).toBe(output)
        expect(() => normalize(patched, { maxBytes: 1 })).toThrow(/byte budget/)
      })
    }

    it(`rejects cyclic/accessor/proxy patches without reading getters for schema ${version}`, () => {
      const raw = version === 2 ? geometryStyleFixture() : fixture()
      const base = normalize(version === 3 ? compactSemanticGraph(raw) : raw)
      const patch = (overrides) => replaceSemanticRecords(base, { instances: {
        i1: Object.freeze({ ...semanticInstance(base, 'i1'), overrides }),
      } })
      const cycle = {}
      cycle.self = cycle
      expect(() => patch(cycle)).toThrow(/cycle/)
      let reads = 0
      const result = {}
      const accessor = Object.defineProperty({}, 'components', {
        enumerable: true, get() { reads++; return result },
      })
      expect(() => patch(accessor)).toThrow(/data properties/)
      expect(reads).toBe(0)
      expect(Object.isFrozen(result)).toBe(false)
      const proxy = new Proxy({}, { preventExtensions() { throw new Error('proxy refused') } })
      expect(() => patch(proxy)).toThrow(/proxy refused/)
    })
  }

  it('rejects a stricter warm aggregate component limit even when every array fits', () => {
    const warm = normalize(fixture(), { maxComponents: 8 })
    expect(normalize(warm, { maxComponents: 8 })).toBe(warm)
    // Eight components in four two-element arrays; the six-element matrix fits.
    expect(() => normalize(warm, { maxComponents: 7 })).toThrow(/component budget/)
    expect(() => normalize({ ...warm }, { maxComponents: 7 })).toThrow(/component budget/)
    expect(normalize(warm, { maxComponents: 8 })).toBe(warm)
  })

  it('caches certified producer input only after validation and returns the checked output', () => {
    const input = certify(freeze(fixture()))
    const output = normalize(input)
    expect(normalize(input)).toBe(output)
    expect(normalize(output)).toBe(output)
    expect(() => normalize(input, { maxBytes: 1 })).toThrow(/byte budget/)
    const invalid = clone(fixture())
    invalid.instances.i2.localTransform[0] = 0
    const certified = certify(freeze(invalid))
    expect(() => normalize(certified)).toThrow(/transform/)
    expect(() => normalize(certified)).toThrow(/transform/)
  })

  it('does not cache mutable or externally frozen lookalikes by raw identity', () => {
    const input = fixture()
    normalize(input)
    input.instances.i1.paintIndex = -1
    expect(() => normalize(input)).toThrow(/paint/)
    const frozen = freeze(fixture())
    expect(normalize(frozen)).not.toBe(normalize(frozen))
  })

  it('preserves unchanged immutable instances on a matching-context local edit', () => {
    const warm = normalize(fixture())
    const edited = normalize({ ...warm, instances: {
      ...warm.instances, i1: { ...warm.instances.i1, paintIndex: 1 },
    } })
    expect(edited.instances.i2).toBe(warm.instances.i2)
    expect(edited.definitions).toBe(warm.definitions)
    expect(edited.instances.i1.paintIndex).toBe(1)
  })

  it('revalidates the same instances against changed definitions', () => {
    const warm = normalize(fixture())
    const definitions = clone(warm.definitions)
    definitions.d0.components.shift()
    const changed = { ...warm, definitions }
    expect(changed.instances).toBe(warm.instances)
    expect(() => normalize(changed)).toThrow(/unknown component/)
  })

  it('revalidates the same definitions and instances against changed source catalogs', () => {
    const warm = normalize(compactSemanticGraph(fixture()))
    const changed = { ...warm, partUris: warm.partUris.map(() => '../forged.xml') }
    expect(changed.instances).toBe(warm.instances)
    expect(changed.definitions).toBe(warm.definitions)
    expect(() => normalize(changed)).toThrow(/part URI|source definition location/)
  })

  it('revalidates the same instances against changed style providers', () => {
    const warm = normalize(geometryStyleFixture())
    const styles = clone(warm.styles)
    delete styles.context1
    const changed = { ...warm, styles }
    expect(changed.instances).toBe(warm.instances)
    expect(() => normalize(changed)).toThrow(/context|binding/i)
  })

  it('rejects changed inheritance styles, targets, catalogs and theme providers cold and warm', () => {
    const raw = compactSemanticGraph(fixture())
    raw.styles = {
      inherited: { kind: 'inheritance-override', origin: 'project', baseDefinitionId: 'd0', values: { label: 'Shared' } },
      theme: { kind: 'theme', origin: 'source' },
      themed: { kind: 'theme-override', origin: 'project', baseStyleId: 'theme', values: { colors: { dk1: { kind: 'srgb', value: '112233' } } } },
    }
    const warm = normalize(raw)
    const mutations = [
      value => { value.styles.inherited.values.label = 42 },
      value => { value.definitions = {} ; value.instances = {} },
      value => { value.partUris[0] = '../forged.xml' },
      value => { delete value.styles.theme },
    ]
    for (const mutate of mutations) {
      const cold = clone(warm)
      mutate(cold)
      expect(() => normalize(cold)).toThrow()
      expect(() => normalize(cold)).toThrow()
      // Preserve every unaffected checked root on the incremental path.
      const changed = { ...warm }
      for (const key of Object.keys(cold))
        if (JSON.stringify(cold[key]) !== JSON.stringify(warm[key])) changed[key] = cold[key]
      expect(() => normalize(changed)).toThrow()
      expect(() => normalize(changed)).toThrow()
    }
  })

  it('reuses admitted style roots for instances-only text updates without bypassing budgets or global checks', () => {
    const raw = compactSemanticGraph(fixture())
    raw.styles = { inherited: { kind: 'inheritance-override', origin: 'project', baseDefinitionId: 'd0', values: { label: 'Shared' } } }
    const warm = normalize(raw)
    const key = Object.keys(warm.instances)[0]
    const instance = semanticInstance(warm, key)
    const edited = normalize(replaceSemanticRecords(warm, { instances: { [instance.id]: {
      ...instance, overrides: { components: { c0: { textDocument: {
        schemaVersion: 1, componentId: 'c0', paragraphs: [],
      } } } },
    } } }))
    expect(edited.styles).toBe(warm.styles)
    expect(edited.definitions).toBe(warm.definitions)
    for (const options of [{ maxBytes: 1 }, { maxDepth: 1 }, { maxComponents: 7 }, { maxInstances: 1 }, { maxDefinitions: 1 }])
      expect(() => normalize({ ...edited }, options)).toThrow(/budget/)
    const broken = { ...edited, instances: { ...edited.instances,
      [key]: { ...edited.instances[key], parentInstanceId: key },
    } }
    expect(() => normalize(broken)).toThrow(/cycle/)
    expect(() => normalize(broken)).toThrow(/cycle/)
  })

  it('does not transfer instance receipts across schema versions', () => {
    const input = fixture()
    input.instances.i1.sourceBinding = { contextId: 'missing' }
    const warm = normalize(input)
    expect(() => normalize({ ...warm, schemaVersion: 2 })).toThrow(/context|binding/i)
  })
})
