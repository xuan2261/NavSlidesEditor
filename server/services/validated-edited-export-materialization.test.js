import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { initializePackageStore, shutdownPackageStore } = require('./pptx-import/package-store-runtime.js')
const { createEditedExportHandler } = require('../routes/pptx-edited-export.js')
const { savePackageProjection } = require('./generation-safe-save.js')
const { queueCompatibilityRemoval } = require('./pptx-import/compatibility-outbox.js')
const {
  editedExportAvailability,
  executeValidatedEditedExport,
} = require('./validated-edited-export.js')
const { replayRequest } = require('./pptx-import/validated-edited-export-context.js')
const { createNativeTextAdapter } = require('./pptx-import/text-ooxml-adapter.js')
const { createPrimitiveAdapters } = require('./pptx-import/primitive-ooxml-adapters.js')
const { resolveExportStrategy } = require('./pptx-import/roundtrip-policy.js')

const dirs = []
const shape = '<p:sp><p:nvSpPr><p:cNvPr id="4" name="Title"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Before</a:t></a:r></a:p></p:txBody></p:sp>'

function snapshot(content = '<p>Before</p>') {
  return {
    id: 'deck',
    slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content }] }],
  }
}

async function fixtureBytes() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types><Default Extension="xml" ContentType="application/xml"/></Types>')
  zip.file('ppt/presentation.xml', '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>')
  zip.file('_rels/.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>')
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>')
  zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${shape}</p:spTree></p:cSld></p:sld>`)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

function sourceMap() {
  return {
    schemaVersion: 1,
    presentationId: 'deck',
    revisionId: 'import-pending',
    packageGeneration: 1,
    entries: {
      's1:e1': {
        schemaVersion: 1,
        packageGeneration: 1,
        revisionId: 'import-pending',
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
}

async function setupPendingSave(after = snapshot('<p>After</p>')) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validated-export-materialization-'))
  dirs.push(rootDir)
  await shutdownPackageStore()
  const store = await initializePackageStore({ rootDir })
  const committed = await store.commitImport(await fixtureBytes(), {
    jobId: 'import-deck', presentationId: 'deck', projection: snapshot(), sourceMap: sourceMap(),
  })
  expect(store.getState().heads).toHaveLength(1)
  const saved = await savePackageProjection({
    presentationId: 'deck',
    expectedGeneration: 1,
    baseRevisionId: committed.revision.id,
    idempotencyKey: 'save-pending-edit',
    after,
    loadStored: async () => {
      throw new Error('Package authority should supply the saved projection')
    },
  })
  expect(saved).toMatchObject({ ok: true, generation: 2 })
  return { store, committed, after }
}

function validators(nativeReimport) {
  return {
    nativeReimport,
    officeCliGatewayFactory: () => ({
      probeCapability: async () => ({ available: true, validation: true }),
      validatePackage: async () => ({ ok: true }),
    }),
  }
}

function routeResponse() {
  return {
    headers: {},
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    setHeader(key, value) { this.headers[key] = value },
    send(body) { this.body = body; return this },
  }
}

function routeRequest(generation, idempotencyKey) {
  const headers = {
    'Idempotency-Key': idempotencyKey,
    'If-Pptx-Generation': String(generation),
  }
  return {
    params: { id: 'deck' },
    get: (name) => headers[name],
  }
}

afterEach(async () => {
  await shutdownPackageStore()
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('validated edited export pending materialization', () => {
  it('materializes a pending server save as one R1 instead of returning R0', async () => {
    const { store, committed, after } = await setupPendingSave()
    const nativeReimport = vi.fn(async () => true)
    const request = {
      presentationId: 'deck',
      expectedGeneration: 2,
      idempotencyKey: 'export-pending-edit',
      after,
      textTransports: {
        's1:e1': { format: 'tiptap-html', schemaVersion: 1, html: '<p>Client-forged transport</p>' },
      },
    }

    const result = await executeValidatedEditedExport(request, {
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      ...validators(nativeReimport),
    })

    expect(result).toMatchObject({ ok: true, generation: 3 })
    expect(result.noOp).not.toBe(true)
    expect(result.revisionId).not.toBe(committed.revision.id)
    const originalZip = await JSZip.loadAsync(await store.readBlob(committed.revision.blobSha256))
    const originalXml = await originalZip.file('ppt/slides/slide1.xml').async('string')
    const editedZip = await JSZip.loadAsync(result.bytes)
    const editedXml = await editedZip.file('ppt/slides/slide1.xml').async('string')
    expect(originalXml).toContain('<a:t>Before</a:t>')
    expect(originalXml).not.toContain('<a:t>After</a:t>')
    expect(editedXml).toContain('<a:t>After</a:t>')
    expect(editedXml).not.toContain('<a:t>Before</a:t>')
    const state = store.getState()
    expect(state.revisions).toHaveLength(2)
    expect(state.compatibilityOutbox.at(-1)).toMatchObject({
      generation: 3,
      presentation: {
        id: 'deck',
        slides: after.slides,
        pptxAggregateHead: { generation: 3, packageRevisionId: result.revisionId },
      },
    })
    expect(nativeReimport).toHaveBeenCalledWith(expect.objectContaining({
      expectedProjection: after,
    }))
    expect(store.getState().mutationResults.at(-1).journal.operations).toEqual([
      expect.objectContaining({
        before: 'Before',
        after: 'After',
        textTransport: { format: 'tiptap-html', schemaVersion: 1, html: '<p>After</p>' },
      }),
    ])

    await store.mutate((next) => { delete next.mutationResults.at(-1).operation })
    const retry = await executeValidatedEditedExport(request, {
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      ...validators(nativeReimport),
    })
    expect(retry).toMatchObject({ ok: true, idempotent: true, revisionId: result.revisionId })
    expect(store.getState().revisions).toHaveLength(2)
  })

  it('publishes against the target head after unrelated store state changes during validation', async () => {
    const { store, after } = await setupPendingSave()
    const nativeReimport = vi.fn(async () => {
      await store.mutate((next) => {
        queueCompatibilityRemoval(next, {
          presentationId: 'unrelated-deck',
          generation: 1,
        })
      })
      return true
    })

    const result = await executeValidatedEditedExport({
      presentationId: 'deck',
      expectedGeneration: 2,
      idempotencyKey: 'unrelated-store-mutation',
      after,
    }, {
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      ...validators(nativeReimport),
    })

    expect(result).toMatchObject({ ok: true, generation: 3 })
    expect(store.getState().compatibilityOutbox).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operation: 'remove',
        presentationId: 'unrelated-deck',
        generation: 1,
      }),
    ]))
  })

  it('coalesces concurrent same-key exports into the published successor', async () => {
    const { store, after } = await setupPendingSave()
    const nativeReimport = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25))
      return true
    })
    const request = {
      presentationId: 'deck',
      expectedGeneration: 2,
      idempotencyKey: 'concurrent-export',
      after,
    }
    const options = {
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      ...validators(nativeReimport),
    }

    const [first, second] = await Promise.all([
      executeValidatedEditedExport(request, options),
      executeValidatedEditedExport(request, options),
    ])

    expect(first).toMatchObject({ ok: true, generation: 3 })
    expect(second).toMatchObject({ ok: true, generation: 3, idempotent: true })
    expect(second.revisionId).toBe(first.revisionId)
    expect(nativeReimport).toHaveBeenCalledTimes(1)
    expect(store.getState().revisions).toHaveLength(2)
  })

  it('binds durable replay to the current package head and request generation', async () => {
    const { store, after } = await setupPendingSave()
    await executeValidatedEditedExport({
      presentationId: 'deck',
      expectedGeneration: 2,
      idempotencyKey: 'bound-replay',
      after,
    }, {
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      ...validators(vi.fn(async () => true)),
    })

    const state = store.getState()
    expect(replayRequest(state, {
      presentationId: 'deck', expectedGeneration: 2, idempotencyKey: 'bound-replay',
    })).toBeTruthy()
    expect(replayRequest(state, {
      presentationId: 'deck', expectedGeneration: 999, idempotencyKey: 'bound-replay',
    })).toBeNull()
    await store.mutate((next) => {
      next.heads.find((head) => head.presentationId === 'deck').generation += 1
    })
    expect(replayRequest(store.getState(), {
      presentationId: 'deck', expectedGeneration: 2, idempotencyKey: 'bound-replay',
    })).toBeNull()
  })

  it('does not replay an edited export after a newer package head exists', async () => {
    const { store, after } = await setupPendingSave()
    const options = {
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      ...validators(vi.fn(async () => true)),
    }
    const request = {
      presentationId: 'deck', expectedGeneration: 2,
      idempotencyKey: 'stale-export-replay', after,
    }
    const first = await executeValidatedEditedExport(request, options)
    expect(first).toMatchObject({ ok: true, generation: 3 })

    const newerSave = await savePackageProjection({
      presentationId: 'deck', expectedGeneration: 3,
      baseRevisionId: first.revisionId,
      idempotencyKey: 'newer-projection-save', after,
      loadStored: async () => { throw new Error('Package authority should supply the projection') },
    })
    expect(newerSave).toMatchObject({ ok: true, generation: 4 })

    const retry = await executeValidatedEditedExport(request, options)
    expect(retry).toMatchObject({ ok: false, status: 409, reasonCode: 'STALE_GENERATION' })
    expect(store.getState().heads[0]).toMatchObject({ generation: 4 })
  })

  it('does not coalesce distinct idempotency keys', async () => {
    const { store, after } = await setupPendingSave()
    const nativeReimport = vi.fn(async () => true)
    const options = {
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      ...validators(nativeReimport),
    }
    const [first, second] = await Promise.all([
      executeValidatedEditedExport({
        presentationId: 'deck', expectedGeneration: 2,
        idempotencyKey: 'distinct-export-a', after,
      }, options),
      executeValidatedEditedExport({
        presentationId: 'deck', expectedGeneration: 2,
        idempotencyKey: 'distinct-export-b', after,
      }, options),
    ])

    expect([first.ok, second.ok].sort()).toEqual([false, true])
    expect([first, second]).toEqual(expect.arrayContaining([
      expect.objectContaining({ ok: true, generation: 3 }),
      expect.objectContaining({ ok: false, reasonCode: 'STALE_GENERATION' }),
    ]))
    const loserKey = first.ok ? 'distinct-export-b' : 'distinct-export-a'
    const retry = await executeValidatedEditedExport({
      presentationId: 'deck', expectedGeneration: 2,
      idempotencyKey: loserKey, after,
    }, options)
    expect(retry).toMatchObject({ ok: false, reasonCode: 'STALE_GENERATION' })
    expect(nativeReimport).toHaveBeenCalledTimes(1)
    expect(store.getState().revisions).toHaveLength(2)
  })

  it.each([
    ['a non-text property', (after) => { after.slides[0].elements[0].x = 1 }],
    ['unsupported deck metadata', (after) => { after.title = 'Unsupported package edit' }],
  ])('fails closed for %s without publishing', async (_label, mutate) => {
    const after = snapshot()
    mutate(after)
    const { store, committed } = await setupPendingSave(after)
    const nativeReimport = vi.fn(async () => true)

    const result = await executeValidatedEditedExport({
      presentationId: 'deck',
      expectedGeneration: 2,
      idempotencyKey: `blocked-${_label.replace(/[^a-z0-9]/gi, '-')}`,
      after: snapshot('<p>Client state is ignored</p>'),
    }, {
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      ...validators(nativeReimport),
    })

    expect(result).toMatchObject({
      ok: false,
      status: 422,
      reasonCode: 'CANONICAL_TEXT_JOURNAL_INVALID',
    })
    expect(nativeReimport).not.toHaveBeenCalled()
    expect(store.getState().revisions).toHaveLength(1)
    expect(store.getState().heads[0]).toMatchObject({
      generation: 2,
      packageRevisionId: committed.revision.id,
    })
  })

  it('fails closed when a pending text edit also changes deck metadata', async () => {
    const after = snapshot('<p>After</p>')
    after.title = 'Unsupported package edit'
    const { store, committed } = await setupPendingSave(after)
    const nativeReimport = vi.fn(async () => true)

    const result = await executeValidatedEditedExport({
      presentationId: 'deck',
      expectedGeneration: 2,
      idempotencyKey: 'blocked-mixed-edit',
      after: snapshot('<p>Client state is ignored</p>'),
    }, {
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      ...validators(nativeReimport),
    })

    expect(result).toMatchObject({
      ok: false,
      status: 422,
      reasonCode: 'CANONICAL_TEXT_JOURNAL_INVALID',
    })
    expect(nativeReimport).not.toHaveBeenCalled()
    expect(store.getState().revisions).toHaveLength(1)
    expect(store.getState().heads[0]).toMatchObject({
      generation: 2,
      packageRevisionId: committed.revision.id,
    })
  })

  it('clears a pending marker for a true no-op pending save', async () => {
    const { store } = await setupPendingSave(snapshot())
    expect(store.getState().heads[0].pendingJournalHash).toBeTruthy()

    const result = await executeValidatedEditedExport({
      presentationId: 'deck',
      expectedGeneration: 2,
      idempotencyKey: 'no-op-pending',
      after: snapshot('<p>Client state is ignored</p>'),
    }, {
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      ...validators(vi.fn(async () => true)),
    })

    expect(result).toMatchObject({ ok: true, noOp: true, generation: 2 })
    const head = store.getState().heads[0]
    expect(head.pendingJournalHash).toBeUndefined()
    expect(head.journalRevisionId).toBeNull()
    expect(resolveExportStrategy({ pptxAggregateHead: head })).toMatchObject({
      mode: 'package-head',
      reason: 'authoritative-unchanged-head',
    })
    expect(store.getState().revisions).toHaveLength(1)
  })

  it('resolves legacy operation-less import authority', async () => {
    const { store, committed, after } = await setupPendingSave()
    await store.mutate((next) => {
      const authority = next.mutationResults.find((result) => result.packageRevisionId === committed.revision.id && result.state === 'committed')
      const pending = next.mutationResults.find((result) => result.packageRevisionId === committed.revision.id && result.state === 'pending-edited-export')
      delete authority.operation
      delete pending.operation
    })
    const nativeReimport = vi.fn(async () => true)

    const result = await executeValidatedEditedExport({
      presentationId: 'deck',
      expectedGeneration: 2,
      idempotencyKey: 'legacy-import-authority',
      after,
    }, {
      store,
      nativeTextAdapter: createNativeTextAdapter(),
      nativePrimitiveAdapter: createPrimitiveAdapters(),
      ...validators(nativeReimport),
    })

    expect(result).toMatchObject({ ok: true, generation: 3 })
    expect(result.noOp).not.toBe(true)
    expect(result.revisionId).not.toBe(committed.revision.id)
  })

  it('allows POST no-op reconciliation without qualified external validators', async () => {
    const { store } = await setupPendingSave(snapshot())
    const nativeReimport = vi.fn(async () => true)
    const handler = createEditedExportHandler({
      findPresentation: async () => ({ id: 'deck', title: 'Deck' }),
      getAvailability: (presentation) => editedExportAvailability(presentation, { store }),
      execute: (request) => executeValidatedEditedExport(request, {
        store,
        nativeTextAdapter: createNativeTextAdapter(),
        nativePrimitiveAdapter: createPrimitiveAdapters(),
        nativeReimport,
      }),
      drainCompatibility: vi.fn(async () => 1),
    })
    const res = routeResponse()

    await handler(routeRequest(2, 'route-no-op'), res)

    expect(res.statusCode).toBe(200)
    expect(res.headers['X-Pptx-Generation']).toBe('2')
    expect(nativeReimport).not.toHaveBeenCalled()
  })

  it('materializes through the POST handler and drains compatibility state', async () => {
    const { store, after } = await setupPendingSave()
    const nativeReimport = vi.fn(async () => true)
    const drainCompatibility = vi.fn(async () => 1)
    const handler = createEditedExportHandler({
      findPresentation: async () => ({ id: 'deck', title: 'Deck' }),
      getAvailability: async () => ({ available: true }),
      execute: (request) => executeValidatedEditedExport(request, {
        store,
        nativeTextAdapter: createNativeTextAdapter(),
        nativePrimitiveAdapter: createPrimitiveAdapters(),
        ...validators(nativeReimport),
      }),
      drainCompatibility,
    })
    const res = routeResponse()

    await handler(routeRequest(2, 'route-export'), res)

    expect(res.statusCode).toBe(200)
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect(res.headers['X-Pptx-Generation']).toBe('3')
    expect(res.headers['X-Pptx-Export-Mode']).toBe('validated-edited')
    expect(drainCompatibility).toHaveBeenCalledTimes(1)
    expect(store.getState().revisions).toHaveLength(2)
    expect(store.getState().mutationResults.at(-1).projection).toEqual(after)
  })
})
