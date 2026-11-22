// @vitest-environment node
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
const require = createRequire(import.meta.url)
const { PackageStore } = require('../../server/services/pptx-import/package-store')

function fixture() {
  const store = new PackageStore('unused')
  const head = { presentationId: 'deck', packageRevisionId: 'revision', generation: 1 }
  const projection = {
    id: 'deck', title: 'before', slides: [{ id: 's1', elements: [] }],
    packagePath: 'x'.repeat(300),
  }
  store.metadata.state.heads.push(head)
  store.metadata.state.mutationResults.push({
    presentationId: 'deck', packageRevisionId: 'revision', sourceMap: {}, projection,
  })
  return { store, head: structuredClone(head), projection }
}

describe('serialized save publication ownership', () => {
  it('seeds first PUT admission from authoritative GET and isolates candidates across active stores', async () => {
    const runtime = require('../../server/services/pptx-import/package-store-runtime')
    const reads = require('../../server/services/package-backed-presentation-read')
    const { normalizePptxSemanticDocument } = require('revealjs-shared/src/pptx-semantic-document.js')
    const semantic = normalizePptxSemanticDocument({
      schemaVersion: 1, definitions: {}, instances: {}, styles: {}, fonts: {},
    })
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'semantic-candidates-'))
    const filename = require.resolve('../../server/routes/presentations-crud')
    const originalRead = reads.readAuthoritativePresentation
    const originalModule = require.cache[filename]
    try {
      await runtime.initializePackageStore({ rootDir: path.join(dir, 'first') })
      reads.readAuthoritativePresentation = async () => ({
        presentation: { id: 'candidate-deck', slides: [], pptxSemantic: semantic }, generation: null,
      })
      delete require.cache[filename]
      const router = require(filename)
      const get = router.stack.find(layer => layer.route?.path === '/:id' && layer.route.methods.get).route.stack[0].handle
      const admit = router.stack.find(layer => layer.route?.path === '/:id' && layer.route.methods.put).route.stack[0].handle
      const response = { json: vi.fn(), status() { return this } }
      await get({ params: { id: 'candidate-deck' } }, response)
      expect(response.json).toHaveBeenCalledOnce()
      const request = () => ({ params: { id: 'candidate-deck' }, body: { slides: [], pptxSemantic: structuredClone(semantic) } })
      const first = request()
      const next = vi.fn()
      admit(first, response, next)
      expect(next).toHaveBeenCalledWith(undefined)
      expect(first.body.pptxSemantic.definitions).toBe(semantic.definitions)
      // Editor DTO mutation cannot poison the retained checked root.
      const clientDto = JSON.parse(JSON.stringify(response.json.mock.calls[0][0]))
      clientDto.pptxSemantic.definitions.poison = {}
      expect(semantic.definitions).toEqual({})
      await runtime.shutdownPackageStore()
      await runtime.initializePackageStore({ rootDir: path.join(dir, 'second') })
      const otherStore = request()
      admit(otherStore, response, next)
      expect(otherStore.body.pptxSemantic.definitions).not.toBe(semantic.definitions)
      expect(otherStore.body.pptxSemantic).toEqual(semantic)
    } finally {
      reads.readAuthoritativePresentation = originalRead
      delete require.cache[filename]
      if (originalModule) require.cache[filename] = originalModule
      await runtime.shutdownPackageStore()
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('saves and replays without public history cloning or predecessor mutation, then reloads durably', async () => {
    const { initializePackageStore, shutdownPackageStore } = require('../../server/services/pptx-import/package-store-runtime')
    const { savePackageProjection } = require('../../server/services/generation-safe-save')
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'owned-save-'))
    const store = await initializePackageStore({ rootDir: dir })
    try {
      const zip = new JSZip()
      zip.file('[Content_Types].xml', '<Types/>')
      zip.file('ppt/presentation.xml', '<p:presentation/>')
      const projection = { id: 'owned-save', title: 'Original', slides: [] }
      const { head } = await store.commitImport(await zip.generateAsync({ type: 'nodebuffer' }), {
        jobId: 'owned-save-job', presentationId: projection.id, projection, sourceMap: { entries: {} },
      })
      const before = store.getOwnedAuthorityState()
      const detached = structuredClone(before)
      const request = {
        presentationId: projection.id, expectedGeneration: head.generation,
        baseRevisionId: head.packageRevisionId, idempotencyKey: 'owned-save-key',
        after: { title: 'Edited' }, loadStored: async () => projection,
      }
      const publicRead = vi.spyOn(store, 'getState').mockImplementation(() => {
        throw new Error('Save must not clone public history')
      })
      try {
        expect(await savePackageProjection(request)).toMatchObject({ ok: true, generation: 2 })
        expect(await savePackageProjection(request)).toMatchObject({ ok: true, idempotent: true, generation: 2 })
        expect(await savePackageProjection({ ...request, after: { title: 'Conflict' } }))
          .toMatchObject({ ok: false, reason: 'IDEMPOTENCY_KEY_CONFLICT' })
        expect(await savePackageProjection({ ...request, idempotencyKey: 'stale-key' }))
          .toMatchObject({ ok: false, reason: 'STALE_GENERATION' })
      } finally { publicRead.mockRestore() }
      expect(before).toEqual(detached)
      expect(Object.isFrozen(before.heads[0])).toBe(true)
      expect(before.heads[0].generation).toBe(1)
      await store.reload()
      expect(store.getPresentationHead(projection.id).generation).toBe(2)
      expect(store.getOwnedAuthorityState().mutationResults.at(-1).projection.title).toBe('Edited')
    } finally {
      await shutdownPackageStore()
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('owned durable publication', () => {
  it('shares certified semantic roots, but isolates raw mutations and digests and still requires admission', async () => {
    const { normalizePptxSemanticDocument } = require('revealjs-shared/src/pptx-semantic-document.js')
    const { certifyImmutableSemanticDocument, isCertifiedSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
    const { canonicalSaveSnapshot } = require('../../server/services/pptx-import/canonical-snapshot')
    const { hashRecord } = require('../../server/services/pptx-import/package-store/schemas')
    const semantic = normalizePptxSemanticDocument({
      schemaVersion: 1, definitions: {}, instances: {}, styles: {}, fonts: {},
    })
    // An immutability certificate is deliberately not a validation receipt.
    const invalidCertified = certifyImmutableSemanticDocument(Object.freeze({ schemaVersion: 999 }))
    const raw = Object.freeze({ schemaVersion: 999, nested: { value: 'before' } })
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'owned-semantic-seal-'))
    const store = await new PackageStore(dir).init()
    try {
      await store.acquireWriter()
      // Ownership certification is not a canonical-serialization receipt: the serializer
      // may inspect certified graphs to exclude proxies and custom array dispatch.
      // Assert observable sharing, exact digest bytes and isolation, not traversal counts.
      await store.mutate((next) => {
        next.mutationResults.push(...[semantic, raw, invalidCertified].map((pptxSemantic, index) => ({
          schemaVersion: 1, presentationId: 'seal-test', idempotencyKey: `seal-${index}`,
          projection: { slides: [], pptxSemantic },
        })))
      })
      const results = store.getOwnedAuthorityState().mutationResults
      expect(results[0].projection.pptxSemantic).toBe(semantic)
      expect(normalizePptxSemanticDocument(results[0].projection.pptxSemantic)).toBe(semantic)
      const publishedRaw = results[1].projection.pptxSemantic
      expect(publishedRaw).not.toBe(raw)
      expect(isCertifiedSemanticDocument(publishedRaw)).toBe(false)
      expect(Object.isFrozen(publishedRaw.nested)).toBe(true)
      const expectedRawDigest = createHash('sha256')
        .update('{"nested":{"value":"before"},"schemaVersion":999}').digest('hex')
      expect(hashRecord(publishedRaw)).toBe(expectedRawDigest)
      const semanticDigest = hashRecord(semantic)
      raw.nested.value = 'retained edit'
      expect(publishedRaw.nested.value).toBe('before')
      expect(hashRecord(publishedRaw)).toBe(expectedRawDigest)
      expect(hashRecord(raw)).not.toBe(expectedRawDigest)
      expect(() => canonicalSaveSnapshot(results[1].projection)).toThrow(/semantic schema/)
      expect(() => canonicalSaveSnapshot(results[2].projection)).toThrow(/semantic schema/)
      const editable = store.getState()
      expect(editable.mutationResults[0].projection.pptxSemantic).not.toBe(semantic)
      editable.mutationResults[0].projection.pptxSemantic.fonts.changed = true
      expect(semantic.fonts.changed).toBeUndefined()
      expect(hashRecord(results[0].projection.pptxSemantic)).toBe(semanticDigest)
      expect(hashRecord(editable.mutationResults[0].projection.pptxSemantic)).not.toBe(semanticDigest)
    } finally {
      await store.releaseWriter()
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  for (const fault of [undefined, 'faultAfterIndex', 'faultAfterRoot', 'faultAfterCompletion']) {
    it(`detaches retained drafts and follows durable outcome (${fault || 'success'})`, async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'owned-publication-'))
      const store = await new PackageStore(dir).init()
      try {
        await store.acquireWriter()
        const before = store.getOwnedAuthorityState()
        let draft
        const publication = store.mutate((next) => { draft = next }, fault ? { [fault]: true } : {})
        if (fault) await expect(publication).rejects.toThrow(/Injected fault/)
        else await publication
        const published = fault !== 'faultAfterIndex'
        const owned = store.getOwnedAuthorityState()
        expect(owned.generation).toBe(before.generation + (published ? 1 : 0))
        expect(store.getOwnedAuthorityState()).toBe(owned)
        expect(Object.isFrozen(store.metadata.state.owners)).toBe(true)
        draft.owners.push({ ownerId: 'retained-forgery' })
        expect(store.getState().owners).toEqual([])
        const editable = store.getState()
        editable.owners.push({ ownerId: 'editable' })
        expect(store.getOwnedAuthorityState()).toBe(owned)
        await store.reload()
        expect(store.getOwnedAuthorityState().owners).toEqual([])
        expect(store.getOwnedAuthorityState().generation).toBe(owned.generation)
      } finally {
        await store.releaseWriter()
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  }
})

describe('verified journal dependency ownership', () => {
  it('records the exact owned tuple repeatedly without cloning or reproving checked graphs', () => {
    const { cloneImmutableSemanticDocument, isCertifiedSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
    const { recordVerifiedJournal } = require('../../server/services/pptx-import/package-authority-snapshot')
    const semantic = cloneImmutableSemanticDocument({
      schemaVersion: 999,
      rows: Array.from({ length: 256 }, (_, index) => ({ index, values: [index, null, true] })),
    }, { maxDepth: 16, maxInstances: 10000, maxComponents: 10000 })
    // Checked ownership deliberately says nothing about semantic validity.
    expect(isCertifiedSemanticDocument(semantic)).toBe(false)
    const tuple = {
      presentationId: 'owned-journal-work', generation: 2,
      packageRevisionId: 'revision', matrixAuthorityEpoch: 1,
      previousProjection: Object.freeze({ pptxSemantic: semantic }),
      currentProjection: Object.freeze({ pptxSemantic: semantic, title: 'after' }),
      previousSourceMap: Object.freeze({}), journal: Object.freeze({}),
      operationIds: Object.freeze(['operation']),
    }
    const checkedNodes = new Set([semantic, semantic.rows,
      ...semantic.rows.flatMap((row) => [row, row.values])])
    const dependencyNodes = new Set([
      ...checkedNodes, tuple.previousProjection, tuple.currentProjection,
      tuple.previousSourceMap, tuple.journal, tuple.operationIds,
    ])
    const descriptors = vi.spyOn(Object, 'getOwnPropertyDescriptors')
    const clone = vi.spyOn(globalThis, 'structuredClone')
    try {
      recordVerifiedJournal(tuple)
      // Incidental containers are not checked graph traversal or dependency clones.
      expect(descriptors.mock.calls.filter(([value]) => checkedNodes.has(value))).toEqual([])
      descriptors.mockClear()
      recordVerifiedJournal(tuple)
      expect(descriptors.mock.calls.filter(([value]) => dependencyNodes.has(value))).toEqual([])
      expect(clone.mock.calls.filter(([value]) => dependencyNodes.has(value))).toEqual([])
      // Every dependency still needs its own proof; matching projection identities
      // never authorize a different, hidden-field journal in the same scope.
      expect(() => recordVerifiedJournal({
        ...tuple, journal: Object.freeze(Object.defineProperty({}, 'hidden', { value: 1 })),
      })).toThrow(/plain own enumerable/)
    } finally {
      descriptors.mockRestore()
      clone.mockRestore()
    }
  })

  it('still detaches shallow freezes and rejects proxies around checked values', () => {
    const { cloneImmutableSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
    const { recordVerifiedJournal } = require('../../server/services/pptx-import/package-authority-snapshot')
    const checked = cloneImmutableSemanticDocument({ rows: [1] }, {
      maxDepth: 16, maxInstances: 100, maxComponents: 100,
    })
    const raw = Object.freeze({ nested: { value: 'before' } })
    const tuple = {
      presentationId: 'raw-journal-work', generation: 2,
      packageRevisionId: 'revision', matrixAuthorityEpoch: 1,
      previousProjection: raw, currentProjection: checked,
      previousSourceMap: Object.freeze({}), journal: Object.freeze({}),
      operationIds: Object.freeze([]),
    }
    const clone = vi.spyOn(globalThis, 'structuredClone')
    try {
      recordVerifiedJournal(tuple)
      expect(clone.mock.calls.filter(([value]) => value === raw)).toEqual([[raw]])
      raw.nested.value = 'after'
      expect(() => recordVerifiedJournal({
        ...tuple, previousProjection: new Proxy(checked, {}),
      })).toThrow(/plain own enumerable/)
    } finally { clone.mockRestore() }
  })
})

describe('authoritative save snapshot admission', () => {
  it('reuses sealed admission while public state remains editable and detached', () => {
    const { store, head, projection } = fixture()
    const admitted = store.getAuthoritativeSaveSnapshot('deck', head)
    expect(store.getAuthoritativeSaveSnapshot('deck', head)).toBe(admitted)
    expect(() => { admitted.slides[0].elements.push({ id: 'bad' }) }).toThrow()
    const editable = store.getState()
    editable.mutationResults[0].projection.slides[0].elements.push({ id: 'edit' })
    editable.mutationResults[0].projection.title = 'editable'
    expect(projection.title).toBe('before')
    expect(store.getAuthoritativeSaveSnapshot('deck', head).slides[0].elements).toEqual([])
    projection.title = 'retained mutator edit'
    expect(admitted.title).toBe('before')
    expect(store.getAuthoritativeSaveSnapshot('deck', head).title).toBe('retained mutator edit')
  })

  it('reuses only full equal owned states, not frozen shells or equal-generation roots', () => {
    const { store, projection } = fixture()
    const first = store.getOwnedAuthorityState()
    expect(store.getOwnedAuthorityState()).toBe(first)
    Object.freeze(projection)
    projection.slides[0].elements.push({ id: 'retained-edit' })
    const changed = store.getOwnedAuthorityState()
    expect(changed).not.toBe(first)
    expect(first.mutationResults[0].projection.slides[0].elements).toEqual([])
    expect(changed.mutationResults[0].projection.slides[0].elements).toEqual([{ id: 'retained-edit' }])
    store.metadata.root = { transactionId: 'same-generation-reload' }
    const reloaded = store.getOwnedAuthorityState()
    expect(reloaded).not.toBe(changed)
    expect(store.getOwnedAuthorityState()).toBe(reloaded)
    store.metadata.state.owners.push({ ownerId: 'forged' })
    expect(store.getOwnedAuthorityState()).not.toBe(reloaded)
  })

  it('rechecks guarded canonical dispatch after warming immutable branches', () => {
    const { store } = fixture()
    store.metadata.state.extra = Object.freeze({ values: Object.freeze(['before']) })
    const first = store.getOwnedAuthorityState()
    const join = Object.getOwnPropertyDescriptor(Array.prototype, 'join')
    let changed
    try {
      Object.defineProperty(Array.prototype, 'join', {
        ...join, value: function (...args) { return `${join.value.apply(this, args)} ` },
      })
      changed = store.getOwnedAuthorityState()
    } finally {
      Object.defineProperty(Array.prototype, 'join', join)
    }
    expect(changed).not.toBe(first)
    expect(changed.extra).toEqual(first.extra)
  })

  it('rejects proxies with legal observable inherited dispatch, even when frozen', () => {
    const { store } = fixture()
    const target = Object.freeze(['before'])
    let changed = false
    const proxy = new Proxy(target, {
      get(object, key, receiver) {
        // map is inherited, so this changing trap obeys frozen-target invariants.
        if (key === 'map' && changed) return () => ['after']
        return Reflect.get(object, key, receiver)
      },
    })
    expect(proxy.map((value) => value)).toEqual(['before'])
    store.metadata.state.extra = { nested: proxy }
    expect(() => store.getOwnedAuthorityState()).toThrow(/plain own enumerable/)
    changed = true
    expect(proxy.map((value) => value)).toEqual(['after'])
    expect(() => store.getOwnedAuthorityState()).toThrow(/plain own enumerable/)
  })

  for (const field of ['generation', 'packageRevisionId']) {
    it(`rejects nonenumerable head ${field} mutations after warming`, () => {
      const { store } = fixture()
      const first = store.getOwnedAuthorityState()
      const head = store.metadata.state.heads[0]
      Object.defineProperty(head, field, { enumerable: false })
      expect(() => store.getOwnedAuthorityState()).toThrow(/plain own enumerable/)
      head[field] = field === 'generation' ? 2 : 'changed'
      expect(() => store.getOwnedAuthorityState()).toThrow(/plain own enumerable/)
      expect(first.heads[0][field]).not.toBe(head[field])
    })
  }

  it('rejects hidden root/state fields, accessors, unsupported values and sparse/custom arrays', () => {
    const invalid = [
      () => Object.defineProperty({}, 'generation', { value: 1 }),
      () => ({ get generation() { throw new Error('must not invoke getter') } }),
      () => ({ value: Symbol('hidden') }),
      () => ({ value: 1n }),
      () => ({ value: () => {} }),
      () => ({ [Symbol('hidden')]: 1 }),
      () => new Date(),
      () => Object.freeze(Array(1)),
      () => Object.freeze(Object.assign([], { extra: 1 })),
    ]
    for (const makeInvalid of invalid) {
      const { store } = fixture()
      store.getOwnedAuthorityState()
      store.metadata.state.extra = makeInvalid()
      expect(() => store.getOwnedAuthorityState()).toThrow(/plain own enumerable/)
    }
    const { store } = fixture()
    store.getOwnedAuthorityState()
    store.metadata.root = Object.defineProperty({}, 'generation', { value: 2 })
    expect(() => store.getOwnedAuthorityState()).toThrow(/plain own enumerable/)
  })

  it('retains certified semantics from the owned admitted predecessor without weakening budgets', () => {
    const { normalizePptxSemanticDocument } = require('revealjs-shared/src/pptx-semantic-document.js')
    const { store, head, projection } = fixture()
    projection.pptxSemantic = normalizePptxSemanticDocument({
      schemaVersion: 1, definitions: {}, instances: {}, styles: {}, fonts: {},
    })
    const { retainPublishedSaveReceipts } = require('../../server/services/pptx-import/package-authority-snapshot')
    const { canonicalSaveSnapshot } = require('../../server/services/pptx-import/canonical-snapshot')
    const admitted = canonicalSaveSnapshot(projection)
    store.metadata.state.mutationResults[0].projection = admitted
    retainPublishedSaveReceipts(store, [admitted])
    const owned = store.getOwnedAuthorityState().mutationResults[0].projection
    expect(store.getAuthoritativeSaveSnapshot('deck', head)).toBe(owned)
    expect(store.getAuthoritativeSaveSnapshot('deck', head).pptxSemantic).toBe(admitted.pptxSemantic)
    expect(() => store.getAuthoritativeSaveSnapshot('deck', head, { maxStringBytes: 1 }))
      .toThrow(/budget/)
  })

  it('recharges complete raw metadata under tighter budgets even after sanitization', () => {
    const { store, head } = fixture()
    expect(store.getAuthoritativeSaveSnapshot('deck', head).packagePath).toBeUndefined()
    expect(() => store.getAuthoritativeSaveSnapshot('deck', head, { maxStringBytes: 100 }))
      .toThrow(/budget/)
    expect(store.getAuthoritativeSaveSnapshot('deck', head).title).toBe('before')
  })

  it('invalidates on same-generation reload and authority changes', () => {
    const { store, head } = fixture()
    const before = store.getAuthoritativeSaveSnapshot('deck', head)
    store.metadata.state = structuredClone(store.metadata.state)
    store.metadata.root = { transactionId: 'reloaded' }
    store.metadata.state.mutationResults[0].projection.title = 'reloaded'
    expect(store.getAuthoritativeSaveSnapshot('deck', head).title).toBe('reloaded')
    expect(before.title).toBe('before')
    store.metadata.state.mutationResults.push({
      presentationId: 'deck', packageRevisionId: 'revision', sourceMap: {},
      projection: { slides: [], title: 'new authority' },
    })
    expect(store.getAuthoritativeSaveSnapshot('deck', head).title).toBe('new authority')
    store.metadata.state.heads[0].generation++
    expect(() => store.getAuthoritativeSaveSnapshot('deck', head)).toThrow(/head changed/)
  })

  it('rejects invalid semantic mutations instead of inheriting a prior receipt', () => {
    const { store, head, projection } = fixture()
    const before = store.getAuthoritativeSaveSnapshot('deck', head)
    projection.pptxSemantic = { schemaVersion: 999 }
    expect(() => store.getAuthoritativeSaveSnapshot('deck', head)).toThrow(/semantic schema/)
    expect(before.title).toBe('before')
    delete projection.pptxSemantic
    projection.slides[0].elements.push({ id: 'bad', type: 'text', pptxInstanceId: 'missing' })
    projection.pptxSemantic = { schemaVersion: 1, definitions: {}, instances: {}, styles: {}, fonts: {} }
    expect(() => store.getAuthoritativeSaveSnapshot('deck', head)).toThrow(/semantic element occurrence/)
  })
})
