// @vitest-environment node
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { hashRecord } = require('../../server/services/pptx-import/package-store/schemas')
const { canonicalSaveSnapshot, canonicalEditableSnapshot } = require('../../server/services/pptx-import/canonical-snapshot')
const { queueCompatibilityUpsert } = require('../../server/services/pptx-import/compatibility-outbox')
const { PackageStore } = require('../../server/services/pptx-import/package-store')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const { semanticSourceDomainPair } = require('../../server/services/pptx-import/semantic-source-domain')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph.js')

describe('native save server ownership and admission', () => {
  it('admits per-request candidates without trusting stale hints or retaining mutable request data', () => {
    const { updatePresentationSchemaWithCandidate, admittedUpdatePresentationBody } = require('../../server/middleware/schemas')
    const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document.js')
    const predecessor = normalizePptxSemanticDocument({
      schemaVersion: 1, definitions: {}, instances: {}, styles: {}, fonts: {},
    })
    const schema = updatePresentationSchemaWithCandidate(predecessor)
    const raw = { slides: [], pptxSemantic: structuredClone(predecessor), custom: { value: 'before' } }
    const admitted = schema.parse(raw)
    expect(admitted.pptxSemantic.definitions).toBe(predecessor.definitions)
    expect(admittedUpdatePresentationBody(admitted)).toBe(admitted)
    raw.custom.value = 'after'
    raw.pptxSemantic.definitions.invalid = {}
    expect(admitted.custom.value).toBe('before')
    expect(admitted.pptxSemantic.definitions).toEqual({})
    expect(schema.safeParse(raw).success).toBe(false)
    expect(() => normalizePptxSemanticDocument(admitted.pptxSemantic, { maxBytes: 1 }, { predecessor })).toThrow(/budget/)
    for (const bad of [
      { ...structuredClone(predecessor), schemaVersion: 999 },
      { ...structuredClone(predecessor), unknown: true },
      { ...structuredClone(predecessor), instances: { missing: {} } },
    ]) expect(schema.safeParse({ slides: [], pptxSemantic: bad }).success).toBe(false)
    const changed = { ...structuredClone(predecessor), schemaVersion: 2 }
    const withHint = schema.safeParse({ slides: [], pptxSemantic: changed })
    const withoutHint = updatePresentationSchemaWithCandidate().safeParse({ slides: [], pptxSemantic: changed })
    expect(withHint.success).toBe(withoutHint.success)
    if (withHint.success) expect(withHint.data).toEqual(withoutHint.data)
  })

  it('hands admission-owned semantics to canonical save without caching mutable raw input', () => {
    const { updatePresentationSchema, admittedUpdatePresentationBody } = require('../../server/middleware/schemas')
    const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document.js')
    const raw = {
      slides: [], title: 'original', custom: { nested: ['original'] },
      pptxSemantic: { schemaVersion: 1, definitions: {}, instances: {}, styles: {}, fonts: {} },
    }
    const admitted = updatePresentationSchema.parse(raw)
    const semantic = admitted.pptxSemantic
    expect(semantic).not.toBe(raw.pptxSemantic)
    expect(Object.isFrozen(admitted.custom.nested)).toBe(true)
    raw.custom.nested[0] = 'later middleware mutation'
    raw.title = 'changed'
    raw.pptxSemantic.unknown = true
    expect(admittedUpdatePresentationBody(admitted)).toBe(admitted)
    expect(admitted.custom.nested).toEqual(['original'])
    expect(canonicalSaveSnapshot(admitted).pptxSemantic).toBe(semantic)
    const { sanitizeClientEditableData } = require('../../server/services/pptx-import/authority-sanitizer')
    const { normalizePresentationGames } = require('revealjs-shared')
    const sanitized = sanitizeClientEditableData(admitted)
    expect(canonicalSaveSnapshot(normalizePresentationGames(sanitized)).pptxSemantic).toBe(semantic)
    // Ownership alone must not change the pre-existing request identity contract.
    expect(hashRecord(sanitized)).toBe(hashRecord(sanitizeClientEditableData(structuredClone(admitted))))
    expect(() => normalizePptxSemanticDocument(semantic, { maxBytes: 1 })).toThrow(/budget/)
    expect(() => canonicalSaveSnapshot(admitted, { maxStringBytes: 1 })).toThrow(/budget/)
    expect(() => admittedUpdatePresentationBody(raw)).toThrow()
    expect(() => { admitted.custom.nested[0] = 'mutation' }).toThrow()
    const replacement = { ...admitted, title: 'replacement' }
    expect(admittedUpdatePresentationBody(replacement).title).toBe('replacement')
  })

  it('audits original whole-body descriptors before Zod can erase hidden authority or invoke accessors', () => {
    const fs = require('node:fs')
    const { Module } = require('node:module')
    const filename = require.resolve('../../server/middleware/schemas')
    // Compare the actual pre-wrapper Zod chains (passthrough, defaults and
    // refinements), not an invented stricter JSON-value admission contract.
    const original = new Module(filename)
    original.filename = filename
    original.paths = Module._nodeModulePaths(require('node:path').dirname(filename))
    original._compile(fs.readFileSync(filename, 'utf8')
      .replace('const createPresentationSchema = ownedPresentationSchema(createPresentationInputSchema)',
        'const createPresentationSchema = createPresentationInputSchema')
      .replace('const updatePresentationSchema = ownedPresentationSchema(updatePresentationInputSchema)',
        'const updatePresentationSchema = updatePresentationInputSchema'), filename)
    const { validate } = require('../../server/middleware/validate')
    const current = require(filename)
    const body = () => ({ title: 'Deck', slides: [{ id: 's', elements: [{ id: 'e', type: 'text' }] }] })
    const targets = raw => [raw, raw.slides[0], raw.slides[0].elements[0]]
    const outcome = (schema, raw) => {
      const req = { body: raw }
      let status, response, proceeded = false, error
      const res = { status(value) { status = value; return this }, json(value) { response = value } }
      validate(schema)(req, res, err => { proceeded = true; error = err })
      return { req, status, response, proceeded, error }
    }
    for (const name of ['createPresentationSchema', 'updatePresentationSchema']) {
      for (let index = 0; index < 3; index++) {
        const raw = body()
        Object.defineProperty(targets(raw)[index], '_pptxAuthority', { value: { forged: true } })
        // Hidden unknown keys were already discarded by Zod before this work;
        // do not mislabel that legacy behavior as a new raw-hash regression.
        expect(original.exports[name].safeParse(raw).success).toBe(true)
        expect(current[name].safeParse(raw).success).toBe(false)
        const rejected = outcome(current[name], raw)
        expect(rejected.status).toBe(400)
        expect(rejected.response.error).toBe('Validation failed')
        expect(rejected.proceeded).toBe(false)
        expect(rejected.req.body).toBe(raw)
        const accessorBody = body()
        let calls = 0
        Object.defineProperty(targets(accessorBody)[index], 'metadata', {
          enumerable: true, get() { calls++; throw new Error('must not invoke getter') },
        })
        const accessor = outcome(current[name], accessorBody)
        expect(calls).toBe(0)
        expect(accessor.status).toBe(400)
        expect(accessor.proceeded).toBe(false)
      }
      const raw = body()
      for (const entry of targets(raw)) {
        entry.metadata = { tags: ['ordinary'], optional: undefined }
        entry.optionalUnknown = undefined
      }
      const expected = original.exports[name].safeParse(raw)
      expect(expected.success).toBe(true)
      const accepted = outcome(current[name], raw)
      expect(accepted.status).toBeUndefined()
      expect(accepted.proceeded).toBe(true)
      expect(accepted.error).toBeUndefined()
      expect(accepted.req.body).toEqual(expected.data)
      raw.metadata.tags.push('later mutation')
      expect(accepted.req.body.metadata.tags).toEqual(['ordinary'])
    }
  })

  it('rejects hidden and prototype semantic fields before publishing admission', () => {
    const { updatePresentationSchema } = require('../../server/middleware/schemas')
    const semantic = () => ({ schemaVersion: 1, definitions: {}, instances: {}, styles: {}, fonts: {} })
    const hidden = semantic()
    Object.defineProperty(hidden, 'hidden', { value: 'bad', enumerable: false })
    expect(() => updatePresentationSchema.parse({ slides: [], pptxSemantic: hidden })).toThrow()
    const inherited = Object.assign(Object.create({ hidden: 'bad' }), semantic())
    expect(() => updatePresentationSchema.parse({ slides: [], pptxSemantic: inherited })).toThrow()
    const unknown = { ...semantic(), unknown: true }
    expect(() => updatePresentationSchema.parse({ slides: [], pptxSemantic: unknown })).toThrow()
  })

  it('compares independent admitted source domains once and excludes equal wires from decoding', () => {
    const definitions = {}, instances = {}, hash = 'a'.repeat(64)
    for (let i = 0; i < 1000; i++) {
      definitions[`def:${i}`] = {
        id: `def:${i}`, kind: 'text',
        source: { partUri: 'ppt/slides/slide1.xml', nativeId: String(i), preconditionHash: hash },
        components: [{ id: `comp:${i}`, kind: 'property', locator: { path: [i], preconditionHash: hash } }],
        content: { text: `source ${i}` },
      }
      instances[`inst:${i}`] = {
        id: `inst:${i}`, slideId: 'slide1', definitionId: `def:${i}`, parentInstanceId: null,
        localTransform: [1, 0, 0, 1, 0, 0], paintIndex: i, overrides: {},
      }
    }
    const raw = { slides: [{ id: 'slide1', elements: Object.keys(instances).map((id) => ({ id, type: 'text', pptxInstanceId: id })) }], pptxSemantic: compactSemanticGraph({
      schemaVersion: 1, definitions, instances, styles: {}, fonts: {},
    }) }
    expect(semanticSourceDomainPair(Object.freeze(raw), Object.freeze(structuredClone(raw)))).toBeNull()
    const before = canonicalSaveSnapshot(raw)
    const after = canonicalSaveSnapshot(JSON.parse(JSON.stringify(before)))
    expect(before.pptxSemantic.definitions).not.toBe(after.pptxSemantic.definitions)
    const start = performance.now()
    assertSemanticBaseline(before, after)
    const firstMs = performance.now() - start
    const receipt = semanticSourceDomainPair(before, after)
    expect(receipt.equal.definitions).toBe(true)
    expect(receipt.identicalInstances.size).toBe(2000)
    // These are precisely the raw-wire predicates consumed by semanticInstances;
    // no equal instance reaches its decoding step in either direction.
    for (const doc of [before.pptxSemantic, after.pptxSemantic]) {
      expect(Object.values(doc.instances).filter((wire) => !receipt.identicalInstances.has(wire))).toHaveLength(0)
    }
    const cachedStart = performance.now()
    assertSemanticBaseline(before, after)
    console.log(JSON.stringify({ sourceRecords: 1000, firstMs, cachedMs: performance.now() - cachedStart, decodedUnchanged: 0 }))
    expect(semanticSourceDomainPair(before, after)).toBe(receipt)
    const changed = JSON.parse(JSON.stringify(after))
    Object.values(changed.pptxSemantic.definitions)[0].content.text = 'changed source'
    const mismatch = canonicalSaveSnapshot(changed)
    expect(semanticSourceDomainPair(before, mismatch).equal.definitions).toBe(false)
    expect(() => assertSemanticBaseline(before, mismatch)).toThrow(/immutable/)
    expect(() => canonicalSaveSnapshot(after, { maxStringBytes: 1 })).toThrow(/budget/)
  })
  it('hashes mutations below a shallow frozen record', () => {
    const record = Object.freeze({ slides: [{ title: 'before' }] })
    const before = hashRecord(record)
    record.slides[0].title = 'after'
    expect(hashRecord(record)).not.toBe(before)
    expect(hashRecord(record)).toBe(hashRecord(structuredClone(record)))
  })

  it('cannot launder oversized edits through an admitted save output', () => {
    const admitted = canonicalSaveSnapshot({ slides: [], title: 'small' })
    expect(() => { admitted.title = 'x'.repeat(1000) }).toThrow()
    const changed = { ...admitted, title: 'x'.repeat(1000) }
    expect(() => canonicalSaveSnapshot(changed, { maxStringBytes: 100 })).toThrow(/budget/)
    expect(() => canonicalSaveSnapshot(admitted, { maxStringBytes: 1 })).toThrow(/budget/)
    const editable = canonicalEditableSnapshot(admitted)
    editable.title = 'editable'
    editable.slides.push({ id: 'new', elements: [] })
    expect(admitted.title).toBe('small')
    expect(admitted.slides).toEqual([])
  })

  it('owns queued data and rejects stale or altered captured writes', () => {
    const store = new PackageStore('unused')
    const state = { heads: [], compatibilityOutbox: [] }
    store.metadata.state = state
    const presentation = { id: 'deck', slides: [], title: 'queued' }
    queueCompatibilityUpsert(state, { presentationId: 'deck', generation: 1, presentation })
    presentation.title = 'caller edit'
    expect(state.compatibilityOutbox[0].presentation.title).toBe('queued')
    const removal = { id: 'remove', operation: 'remove', presentationId: 'deck', generation: 2 }
    state.compatibilityOutbox.push(structuredClone(removal))
    expect(store.isCompatibilityWriteCurrent(removal)).toBe(true)
    expect(store.isCompatibilityWriteCurrent({ ...removal, generation: 3 })).toBe(false)
    state.heads.push({ presentationId: 'deck', generation: 3 })
    expect(store.isCompatibilityWriteCurrent(removal)).toBe(false)
  })
})
