import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import storeModule from './package-store/index.js'
import transactionModule from './mutation-transaction.js'
import adapterModule from './text-ooxml-adapter.js'
import primitiveAdapterModule from './primitive-ooxml-adapters.js'
import postconditionModule from './native-plain-run-postcondition.js'

const { openPackageStore } = storeModule
const { createMutationTransactionService } = transactionModule
const { createNativeTextAdapter } = adapterModule
const { createPrimitiveAdapters } = primitiveAdapterModule
const { verifyNativePlainRunPostcondition } = postconditionModule
const dirs = []
const shape = '<p:sp><p:nvSpPr><p:cNvPr id="4" name="Title"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Before</a:t></a:r></a:p></p:txBody></p:sp>'
const slideXml = `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${shape}</p:spTree></p:cSld></p:sld>`

async function fixture() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml',
    '<Types><Default Extension="xml" ContentType="application/xml"/></Types>')
  zip.file('ppt/presentation.xml', '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>')
  zip.file('_rels/.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>')
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>')
  zip.file('ppt/slides/slide1.xml', slideXml)
  zip.file('docProps/core.xml', '<core>untouched</core>')
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

function snapshots(content = '<p>Before</p>') {
  return {
    id: 'deck',
    slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content }] }],
  }
}

async function setup({ nativeTextAdapter = createNativeTextAdapter(), nativeReimport = async () => true } = {}) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mutation-tx-'))
  dirs.push(rootDir)
  const store = await openPackageStore({ rootDir })
  await store.acquireWriter()
  await store.commitOriginal(await fixture(), { ownerType: 'presentation', ownerId: 'deck' })
  await store.releaseWriter()
  const sourceMap = {
    schemaVersion: 1,
    presentationId: 'deck',
    revisionId: store.getState().heads[0].packageRevisionId,
    packageGeneration: store.getState().heads[0].generation,
    entries: {
      's1:e1': {
        schemaVersion: 1,
        packageGeneration: 1,
        revisionId: store.getState().heads[0].packageRevisionId,
        partUri: 'ppt/slides/slide1.xml',
        kind: 'text-run',
        nativeId: '4',
        relationshipChain: ['_rels/.rels', 'ppt/_rels/presentation.xml.rels'],
        groupAncestry: [],
        occurrencePath: [0],
        sourceHash: crypto.createHash('sha256').update(shape).digest('hex'),
        status: 'authoritative',
        matchMethod: 'native-id',
        confidence: 1,
      },
    },
  }
  return { store, sourceMap, service: createMutationTransactionService({
    store,
    nativeTextAdapter,
    nativePrimitiveAdapter: createPrimitiveAdapters(),
    loadSourceMap: async () => sourceMap,
    loadCanonicalProjection: async () => snapshots(),
    validators: { nativeReimport },
  }) }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('text OOXML mutation transaction vertical slice', () => {
  it('returns exact original bytes for a no-op without publishing', async () => {
    const { store, sourceMap, service } = await setup()
    const original = await store.readOriginal(store.getState().heads[0].packageRevisionId)
    const result = await service.execute({
      presentationId: 'deck', expectedGeneration: 1, idempotencyKey: 'noop',
      before: snapshots(), after: snapshots(), sourceMap,
    })
    expect(result).toMatchObject({ ok: true, noOp: true, generation: 1 })
    expect(result.bytes.equals(original)).toBe(true)
    expect(store.getState().revisions).toHaveLength(1)
  })

  it('publishes R1 from the canonical plain-run journal and reuses it idempotently', async () => {
    const { store, service } = await setup()
    const request = {
      presentationId: 'deck', expectedGeneration: 1, idempotencyKey: 'plain-run-r1', after: snapshots('<p>After</p>'),
      textTransports: { 's1:e1': { format: 'tiptap-json', schemaVersion: 1, document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'After' }] }] } } },
    }
    const result = await service.execute(request)
    expect(result).toMatchObject({ ok: true, generation: 2 })
    expect(store.getState().revisions).toHaveLength(2)
    const rebound = store.getState().mutationResults.at(-1).sourceMap.entries['s1:e1']
    expect(rebound).toMatchObject({ packageGeneration: 2, nativeId: '4' })
    const zip = await JSZip.loadAsync(result.bytes)
    expect(await zip.file('ppt/slides/slide1.xml').async('string')).toContain('<a:t>After</a:t>')
    const retry = await service.execute(request)
    expect(retry).toMatchObject({ ok: true, idempotent: true, revisionId: result.revisionId })
    const conflict = await service.execute({ ...request, after: snapshots('Changed') })
    expect(conflict).toMatchObject({ ok: false, reasonCode: 'IDEMPOTENCY_KEY_CONFLICT' })
  })

  it('blocks a structurally valid wrong-text candidate before R1 publication', async () => {
    const seed = await setup()
    const badAdapter = {
      applyTextPatch: async () => ({
        bytes: await fixture(), sourceHash: seed.sourceMap.entries['s1:e1'].sourceHash,
      }),
    }
    const { store, service } = await setup({ nativeTextAdapter: badAdapter, nativeReimport: verifyNativePlainRunPostcondition })
    await expect(service.execute({
      presentationId: 'deck', expectedGeneration: 1, idempotencyKey: 'wrong-text', after: snapshots('<p>After</p>'),
      textTransports: { 's1:e1': { format: 'tiptap-html', schemaVersion: 1, html: '<p>After</p>' } },
    })).rejects.toMatchObject({ code: 'NATIVE_SEMANTIC_POSTCONDITION_FAILED' })
    expect(store.getState().revisions).toHaveLength(1)
    expect(store.getState().heads[0]).toMatchObject({ generation: 1 })
  })

  it('keeps R0 authoritative when state publication faults after immutable blob commit', async () => {
    const { store, service } = await setup()
    await expect(service.execute({
      presentationId: 'deck', expectedGeneration: 1, idempotencyKey: 'publication-fault', after: snapshots('<p>After</p>'),
      textTransports: { 's1:e1': { format: 'tiptap-json', schemaVersion: 1, document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'After' }] }] } } },
      faults: { faultAfterPrepare: true },
    })).rejects.toThrow(/Injected fault after prepare/)
    expect(store.getState().heads[0]).toMatchObject({ generation: 1 })
    expect(store.getState().revisions).toHaveLength(1)
    expect((await store.auditPhysicalCollection()).candidates).toHaveLength(1)
  })

  it('blocks the current legacy plain-string journal before adapter dispatch', async () => {
    const { store, service } = await setup()
    const result = await service.execute({
      presentationId: 'deck', expectedGeneration: 1, idempotencyKey: 'legacy-edit',
      before: snapshots(), after: snapshots('<p>After</p>'),
    })

    expect(result).toMatchObject({
      ok: false,
      status: 422,
      blockReason: 'CANONICAL_TEXT_JOURNAL_INVALID',
      reasonCode: 'CANONICAL_TEXT_JOURNAL_INVALID',
      reasonCodes: ['CANONICAL_TEXT_JOURNAL_INVALID'],
      reasonCodeSubject: expect.objectContaining({ schemaVersion: 1, version: '1.0.0' }),
    })
    expect(store.getState().revisions).toHaveLength(1)
  })

  it.each([
    ['base revision mismatch', {
      baseRevisionId: 'r0-stale',
    }, 'BASE_REVISION_MISMATCH'],
    ['pre-commit cancellation', {
      cancelled: true,
    }, 'CANCELLED'],
  ])('returns registered current denial authority for %s', async (_label, overrides, reasonCode) => {
    const { store, service } = await setup()
    const result = await service.execute({
      presentationId: 'deck',
      expectedGeneration: 1,
      idempotencyKey: `denial-${reasonCode}`,
      after: snapshots('<p>After</p>'),
      textTransports: {
        's1:e1': {
          format: 'tiptap-html',
          schemaVersion: 1,
          html: '<p>After</p>',
        },
      },
      ...overrides,
    })

    expect(result).toMatchObject({
      ok: false,
      reasonCode,
      reasonCodes: [reasonCode],
      reasonCodeSubject: expect.objectContaining({ schemaVersion: 1, version: '1.0.0' }),
    })
    expect(store.getState().revisions).toHaveLength(1)
  })

  it('blocks all non-seed legacy changes instead of routing geometry by property', async () => {
    const { store, service } = await setup()
    const before = snapshots()
    before.slides[0].elements[0].x = 0
    const after = structuredClone(before)
    after.slides[0].elements[0].x = 1
    const result = await service.execute({
      presentationId: 'deck', expectedGeneration: 1, idempotencyKey: 'legacy-geometry', before, after,
    })

    expect(result).toMatchObject({
      ok: false,
      status: 422,
      blockReason: 'CANONICAL_TEXT_JOURNAL_INVALID',
    })
    expect(store.getState().revisions).toHaveLength(1)
  })

  it('derives changes from the locked canonical projection, not request.before', async () => {
    const { service } = await setup()
    const result = await service.execute({
      presentationId: 'deck', expectedGeneration: 1, idempotencyKey: 'forged-before',
      before: snapshots('<p>After</p>'), after: snapshots('<p>After</p>'),
    })
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      blockReason: 'CANONICAL_TEXT_JOURNAL_INVALID',
    })
  })

  it('does not generate a patch from a fabricated stale before snapshot', async () => {
    const { store, service } = await setup()
    const original = await store.readOriginal(store.getState().heads[0].packageRevisionId)
    const result = await service.execute({
      presentationId: 'deck', expectedGeneration: 1, idempotencyKey: 'fabricated-change',
      before: snapshots('Fabricated'), after: snapshots(),
    })
    expect(result).toMatchObject({ ok: true, noOp: true, generation: 1 })
    expect(result.bytes.equals(original)).toBe(true)
  })

  it('passes only planner-normalized text to the native adapter while preserving source hashes', async () => {
    const { sourceMap } = await setup()
    const adapter = createNativeTextAdapter()
    const result = await adapter.applyTextPatch(await fixture(), {
      rowId: 'primitive.text.run.plain-replacement',
      objectKind: 'text-run',
      sourceRef: sourceMap.entries['s1:e1'],
      before: 'Before',
      after: 'Normalized replacement',
      normalizedText: 'Normalized replacement',
    })
    const zip = await JSZip.loadAsync(result.bytes)

    expect(await zip.file('ppt/slides/slide1.xml').async('string'))
      .toContain('<a:t>Normalized replacement</a:t>')
    expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects direct adapter calls without normalized text or a matching source hash', async () => {
    const { sourceMap } = await setup()
    const adapter = createNativeTextAdapter()
    const baseOperation = {
      rowId: 'primitive.text.run.plain-replacement',
      objectKind: 'text-run',
      before: 'Before',
      sourceRef: sourceMap.entries['s1:e1'],
    }

    await expect(adapter.applyTextPatch(await fixture(), baseOperation)).rejects.toMatchObject({
      code: 'TEXT_NORMALIZATION_REQUIRED',
    })
    await expect(adapter.applyTextPatch(await fixture(), {
      ...baseOperation,
      after: 'After',
      normalizedText: 'After',
      sourceRef: { ...baseOperation.sourceRef, sourceHash: 'b'.repeat(64) },
    })).rejects.toMatchObject({ code: 'SOURCE_HASH_MISMATCH' })
  })

  it('fails closed when transaction dependencies or the current journal handoff are unavailable', async () => {
    const { store, sourceMap } = await setup()
    expect(() => createMutationTransactionService({
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      loadSourceMap: async () => sourceMap,
    })).toThrow(/dependencies/i)
    const service = createMutationTransactionService({
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      loadSourceMap: async () => sourceMap,
      loadCanonicalProjection: async () => snapshots(),
    })
    await expect(service.execute({
      presentationId: 'deck', expectedGeneration: 1, idempotencyKey: 'journal-handoff-missing',
      after: snapshots('<p>After</p>'),
    })).resolves.toMatchObject({
      ok: false,
      status: 422,
      reasonCode: 'CANONICAL_TEXT_JOURNAL_INVALID',
    })
  })
})
