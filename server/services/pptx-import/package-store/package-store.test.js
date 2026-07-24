import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import storeModule from './index.js'
import resolverModule from '../package-revision-resolver.js'
import canonicalHashModule from '../evidence/canonical-hash.js'

const require = createRequire(import.meta.url)
const runtimeModule = require('../package-store-runtime.js')
const generationSafeSave = require('../../generation-safe-save.js')
const { openPackageStore } = storeModule
const { resolvePackageRevisionBytes } = resolverModule
const { hashCanonical } = canonicalHashModule
const { savePackageProjection } = generationSafeSave
const {
  initializePackageStore,
  shutdownPackageStore,
  withPackageStore,
} = runtimeModule
const dirs = []

async function tempStore() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'package-store-'))
  dirs.push(rootDir)
  return { rootDir, store: await openPackageStore({ rootDir }) }
}

async function minimalPptx() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('ppt/presentation.xml', '<p:presentation/>')
  return zip.generateAsync({ type: 'nodebuffer' })
}

function sourceRef(overrides = {}) {
  return {
    packageGeneration: 42,
    revisionId: 'parser-revision',
    partUri: 'ppt/slides/slide1.xml',
    kind: 'shape',
    nativeId: '7',
    relationshipChain: ['_rels/.rels', 'ppt/_rels/presentation.xml.rels'],
    groupAncestry: [],
    occurrencePath: [0],
    sourceHash: 'a'.repeat(64),
    status: 'authoritative',
    matchMethod: 'native-id',
    confidence: 1,
    ...overrides,
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('package store lifecycle MVP', () => {
  it('serializes direct metadata mutations under one owned writer', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    try {
      await Promise.all([
        store.mutate((next) => { next.matrixAuthorityEpoch += 1 }),
        store.mutate((next) => { next.matrixAuthorityEpoch += 1 }),
      ])
      expect(store.getState()).toMatchObject({ generation: 2, matrixAuthorityEpoch: 3 })
    } finally {
      await store.releaseWriter()
    }
  })

  it('keeps one writer for the process lifetime and serializes metadata mutations', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'package-store-runtime-'))
    dirs.push(rootDir)
    const store = await initializePackageStore({ rootDir })

    const second = await openPackageStore({ rootDir })
    await expect(second.acquireWriter()).rejects.toThrow(/writer lock/i)

    const results = await Promise.all([
      withPackageStore((activeStore) => activeStore.commitOriginal(Buffer.from('one'), {
        ownerType: 'presentation',
        ownerId: 'deck-a',
      })),
      withPackageStore((activeStore) => activeStore.commitOriginal(Buffer.from('two'), {
        ownerType: 'presentation',
        ownerId: 'deck-b',
      })),
    ])

    expect(results).toHaveLength(2)
    expect(store.getState().owners.map(({ ownerId }) => ownerId).sort())
      .toEqual(['deck-a', 'deck-b'])
    await shutdownPackageStore()
  })

  it('rejects new mutations while the process store is shutting down', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'package-store-runtime-'))
    dirs.push(rootDir)
    await initializePackageStore({ rootDir })
    let releaseAction
    let markEntered
    const entered = new Promise((resolve) => {
      markEntered = resolve
    })
    const activeMutation = withPackageStore(async () => {
      markEntered()
      await new Promise((resolve) => {
        releaseAction = resolve
      })
    })
    await entered

    const stopping = shutdownPackageStore()
    await expect(withPackageStore(async () => {})).rejects.toThrow(/shutting down/i)
    releaseAction()
    await activeMutation
    await stopping
  })

  it('deduplicates blobs while retaining two explicit owners', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const first = await store.commitOriginal(Buffer.from('same'), {
      ownerType: 'presentation',
      ownerId: 'deck-a',
    })
    const second = await store.commitOriginal(Buffer.from('same'), {
      ownerType: 'presentation',
      ownerId: 'deck-b',
    })

    expect(second.blob.sha256).toBe(first.blob.sha256)
    expect(await store.listBlobFiles()).toHaveLength(1)
    expect(store.getState().owners).toHaveLength(2)
    expect(store.getState().revisions).toHaveLength(1)
    expect(store.blobs.lastDirectorySync).toMatchObject(
      process.platform === 'win32'
        ? { supported: false, reason: 'directory-fsync-unavailable' }
        : { supported: true }
    )
  })

  it('rejects a staged hash mismatch before publishing metadata', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    await expect(
      store.stageBlob(Buffer.from('bad'), { expectedSha256: '0'.repeat(64) })
    ).rejects.toThrow(/hash mismatch/i)
    expect(store.getState().owners).toHaveLength(0)
  })

  it('preserves a valid staged copy when an existing dedupe target is corrupt', async () => {
    const { store } = await tempStore()
    const staged = await store.stageBlob(Buffer.from('valid staged bytes'))
    await fs.writeFile(store.blobs.blobPath(staged.sha256), Buffer.from('corrupt'))

    await expect(store.blobs.commit(staged)).rejects.toMatchObject({
      code: 'CORRUPT_EXISTING_BLOB',
      stagingPreserved: true,
    })
    expect(await fs.readFile(staged.stagePath)).toEqual(Buffer.from('valid staged bytes'))
    expect(await fs.readFile(store.blobs.blobPath(staged.sha256))).toEqual(Buffer.from('corrupt'))
  })

  it('resolves only the hash-verified authoritative package revision', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const committed = await store.commitOriginal(Buffer.from('authoritative'), {
      ownerType: 'presentation',
      ownerId: 'deck-a',
    })
    await store.releaseWriter()
    const resolved = await resolvePackageRevisionBytes({
      presentationId: 'deck-a',
      revisionId: committed.revision.id,
    }, { store })
    expect(resolved.bytes).toEqual(Buffer.from('authoritative'))

    await fs.writeFile(store.blobs.blobPath(committed.blob.sha256), Buffer.from('corrupt'))
    await expect(resolvePackageRevisionBytes({
      presentationId: 'deck-a',
      revisionId: committed.revision.id,
    }, { store })).rejects.toMatchObject({ code: 'PACKAGE_BLOB_CORRUPT', status: 422 })
    await expect(resolvePackageRevisionBytes({
      presentationId: 'deck-a',
      revisionId: 'forged',
    }, { store })).rejects.toMatchObject({ code: 'PACKAGE_HEAD_UNAVAILABLE', status: 422 })
  })

  it('recovers predecessor state from an unreferenced prepared WAL', async () => {
    const { rootDir, store } = await tempStore()
    await store.acquireWriter()
    await store.commitOriginal(Buffer.from('one'), {
      ownerType: 'presentation',
      ownerId: 'deck-a',
    })
    await expect(
      store.addOwner(store.getState().revisions[0].id, {
        ownerType: 'presentation',
        ownerId: 'deck-b',
      }, { faultAfterPrepare: true })
    ).rejects.toThrow(/fault after prepare/i)
    await store.releaseWriter()

    const reopened = await openPackageStore({ rootDir })
    expect(reopened.getState().owners.map((owner) => owner.ownerId)).toEqual(['deck-a'])
    expect(reopened.recoveryActions).toContain('quarantined-unpublished-prepared-wal')
  })

  it('recovers matrix authority from independently durable high-water state', async () => {
    const { rootDir, store } = await tempStore()
    await store.acquireWriter()
    await store.commitOriginal(Buffer.from('authority'), {
      ownerType: 'presentation',
      ownerId: 'deck-authority',
    })
    await store.advanceMatrixAuthorityEpoch()
    await store.releaseWriter()
    await fs.writeFile(path.join(rootDir, 'matrix-authority-epoch-high-water.json'),
      JSON.stringify({ schemaVersion: 1, matrixAuthorityEpoch: 9 }))

    const reopened = await openPackageStore({ rootDir })

    expect(reopened.getState().matrixAuthorityEpoch).toBe(9)
    expect(reopened.getState().heads[0].matrixAuthorityEpoch).toBe(2)
    expect(reopened.recoveryActions).toContain('advanced-matrix-authority-high-water')
  })

  it.each([
    ['index', { faultAfterIndex: true }, ['deck-a'], null],
    ['prepare', { faultAfterPrepare: true }, ['deck-a'], 'quarantined-unpublished-prepared-wal'],
    ['root', { faultAfterRoot: true }, ['deck-a', 'deck-b'], 'completed-published-wal'],
    ['completion', { faultAfterCompletion: true }, ['deck-a', 'deck-b'], null],
  ])('exposes only a predecessor or complete successor after a %s boundary fault',
    async (_boundary, fault, expectedOwners, recoveryAction) => {
      const { rootDir, store } = await tempStore()
      await store.acquireWriter()
      const first = await store.commitOriginal(Buffer.from('one'), {
        ownerType: 'presentation',
        ownerId: 'deck-a',
      })

      await expect(store.addOwner(first.revision.id, {
        ownerType: 'presentation',
        ownerId: 'deck-b',
      }, fault)).rejects.toThrow(/injected fault/i)
      await store.releaseWriter()

      const reopened = await openPackageStore({ rootDir })
      expect(reopened.getState().owners.map(({ ownerId }) => ownerId).sort())
        .toEqual(expectedOwners)
      expect(reopened.getState().generation).toBe(expectedOwners.length)
      if (recoveryAction) expect(reopened.recoveryActions).toContain(recoveryAction)
    })

  it('rejects an active second writer and stale fencing epochs', async () => {
    const { rootDir, store } = await tempStore()
    await store.acquireWriter()
    const second = await openPackageStore({ rootDir })
    await expect(second.acquireWriter()).rejects.toThrow(/writer lock/i)

    store.fencingEpoch -= 1
    await expect(
      store.commitOriginal(Buffer.from('two'), {
        ownerType: 'presentation',
        ownerId: 'deck-b',
      })
    ).rejects.toThrow(/fencing/i)
  })

  it('reloads durable state after a stale instance acquires the writer lock', async () => {
    const { rootDir, store: first } = await tempStore()
    const second = await openPackageStore({ rootDir })
    expect(second.getState().generation).toBe(0)

    await first.acquireWriter()
    await first.commitOriginal(Buffer.from('first'), {
      ownerType: 'presentation',
      ownerId: 'deck-a',
    })
    await first.releaseWriter()

    await second.acquireWriter()
    await second.commitOriginal(Buffer.from('second'), {
      ownerType: 'presentation',
      ownerId: 'deck-b',
    })

    expect(second.getState().owners.map((owner) => owner.ownerId).sort())
      .toEqual(['deck-a', 'deck-b'])
    expect(second.getState().generation).toBe(2)
  })

  it('rejects a stale expected store generation after refreshing on lock acquisition', async () => {
    const { rootDir, store: first } = await tempStore()
    const second = await openPackageStore({ rootDir })
    await first.acquireWriter()
    await first.mutate(() => {})
    await first.releaseWriter()

    await second.acquireWriter()
    await expect(second.mutate(() => {}, { expectedGeneration: 0 })).rejects.toMatchObject({
      code: 'STALE_GENERATION',
      currentGeneration: 1,
    })
    expect(second.getState().generation).toBe(1)
  })

  it('releases owners without physically collecting shared bytes', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const result = await store.commitOriginal(Buffer.from('keep'), {
      ownerType: 'presentation',
      ownerId: 'deck-a',
    })
    await store.releaseOwner({ ownerType: 'presentation', ownerId: 'deck-a' })
    expect(store.getState().owners).toHaveLength(0)
    expect(await store.readBlob(result.blob.sha256)).toEqual(Buffer.from('keep'))
    expect(await store.auditCollection()).toMatchObject({ physicalDeletionEnabled: false })
  })

  it('persists generalized jobs and provisional leases across restart', async () => {
    const { rootDir, store } = await tempStore()
    await store.acquireWriter()
    await store.putJob({
      id: 'job-1',
      kind: 'provider',
      status: 'running',
      capabilityHash: 'a'.repeat(64),
      provisionalOwner: { ownerType: 'job', ownerId: 'job-1' },
    })
    await store.releaseWriter()

    const reopened = await openPackageStore({ rootDir })
    expect(reopened.getJob('job-1')).toMatchObject({ kind: 'provider', status: 'running' })
    expect(reopened.getState().leases[0]).toMatchObject({ ownerId: 'job-1', provisional: true })
  })

  it('commits an imported package R0, inventory, projection authority, owner, and terminal job together', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const bytes = await minimalPptx()
    const projection = { id: 'deck-imported', title: 'Imported', slides: [] }

    const committed = await store.commitImport(bytes, {
      jobId: 'job-import-1',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })
    const state = store.getState()
    const head = state.heads.find((item) => item.presentationId === projection.id)
    const authority = state.mutationResults.find((item) =>
      item.presentationId === projection.id && item.packageRevisionId === committed.revision.id)

    expect(committed.revision).toMatchObject({
      id: `r0-${crypto.createHash('sha256').update(bytes).digest('hex')}`,
      ordinal: 0,
      manifestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(head).toMatchObject({
      originalRevisionId: committed.revision.id,
      packageRevisionId: committed.revision.id,
      projectionRevisionId: expect.stringMatching(/^[a-f0-9]{64}$/),
      sourceMapRevisionId: expect.stringMatching(/^[a-f0-9]{64}$/),
      generation: 1,
    })
    expect(authority).toMatchObject({
      projection,
      sourceMap: { presentationId: projection.id, revisionId: committed.revision.id, entries: {} },
      opcManifest: {
        packageSha256: committed.blob.sha256,
        parts: expect.arrayContaining([
          expect.objectContaining({ path: '[Content_Types].xml' }),
          expect.objectContaining({ path: 'ppt/presentation.xml' }),
        ]),
      },
    })
    expect(state.owners).toContainEqual(expect.objectContaining({
      revisionId: committed.revision.id, ownerType: 'presentation', ownerId: projection.id,
    }))
    expect(state.jobs).toContainEqual(expect.objectContaining({
      id: 'job-import-1', kind: 'import', status: 'completed',
      presentationId: projection.id,
      outcomeRevisionId: committed.revision.id,
      outcomeGeneration: head.generation,
      outcomeHeadHash: hashCanonical(head),
    }))
  })

  it('queues compatibility recovery alongside package publication', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-import-recovery', title: 'Imported', slides: [] }

    await store.commitImport(await minimalPptx(), {
      jobId: 'job-import-recovery',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
      compatibilityPresentation: {
        ...projection,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      compatibilityUpdatedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(store.getState().compatibilityOutbox).toEqual([
      expect.objectContaining({
        operation: 'upsert',
        presentationId: projection.id,
        generation: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        presentation: expect.objectContaining({
          id: projection.id,
          createdAt: '2026-01-01T00:00:00.000Z',
          pptxAggregateHead: expect.objectContaining({ generation: 1 }),
        }),
      }),
    ])
  })

  it.each([
    ['missing', undefined],
    ['malformed', { entries: [] }],
  ])('rejects a %s package source map without publishing visible import state',
    async (_caseName, sourceMap) => {
      const { store } = await tempStore()
      await store.acquireWriter()
      const projection = { id: 'deck-invalid-map', title: 'Invalid map', slides: [] }

      await expect(store.commitImport(await minimalPptx(), {
        jobId: 'job-invalid-map',
        presentationId: projection.id,
        projection,
        sourceMap,
      })).rejects.toThrow(/source map/i)

      const state = store.getState()
      expect(state.heads).toHaveLength(0)
      expect(state.owners).toHaveLength(0)
      expect(state.mutationResults).toHaveLength(0)
      expect(state.jobs).toHaveLength(0)
    })

  it('rejects source entries that do not correspond to a projection element', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = {
      id: 'deck-unmapped-source',
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'shape' }] }],
    }

    await expect(store.commitImport(await minimalPptx(), {
      jobId: 'job-unmapped-source',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: { 's1:missing': sourceRef() } },
    })).rejects.toThrow(/projection element/i)

    const state = store.getState()
    expect(state.heads).toHaveLength(0)
    expect(state.owners).toHaveLength(0)
    expect(state.mutationResults).toHaveLength(0)
    expect(state.jobs).toHaveLength(0)
  })
  it('rejects an import when a projected element lacks a source-map entry', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = {
      id: 'deck-missing-source',
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'shape' }] }],
    }

    await expect(store.commitImport(await minimalPptx(), {
      jobId: 'job-missing-source',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })).rejects.toThrow(/source map.*projection element/i)

    const state = store.getState()
    expect(state.heads).toHaveLength(0)
    expect(state.owners).toHaveLength(0)
    expect(state.mutationResults).toHaveLength(0)
  })


  it('rebinds a package source map and its entries to committed R0 generation one', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = {
      id: 'deck-source-rebind',
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'shape' }] }],
    }

    const committed = await store.commitImport(await minimalPptx(), {
      jobId: 'job-source-rebind',
      presentationId: projection.id,
      projection,
      sourceMap: {
        presentationId: 'parser-presentation',
        revisionId: 'parser-revision',
        entries: { 's1:e1': sourceRef() },
      },
    })
    const authority = store.getState().mutationResults.find((item) =>
      item.presentationId === projection.id)

    expect(authority.sourceMap).toMatchObject({
      presentationId: projection.id,
      revisionId: committed.revision.id,
      entries: {
        's1:e1': {
          packageGeneration: 1,
          revisionId: committed.revision.id,
        },
      },
    })
  })

  it('quarantines a committed import authority if compatibility publication fails', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-rollback', title: 'Rollback', slides: [] }
    await store.commitImport(await minimalPptx(), {
      jobId: 'job-import-rollback',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })
    await store.mutate((next) => {
      next.mutationResults.push({
        schemaVersion: 1,
        operation: 'projection-save',
        presentationId: projection.id,
        idempotencyKey: 'job-import-rollback',
        requestHash: 'a'.repeat(64),
      })
    })

    await store.rollbackImport({ jobId: 'job-import-rollback', presentationId: projection.id })
    const state = store.getState()

    expect(state.heads).toHaveLength(0)
    expect(state.owners).toHaveLength(0)
    expect(state.mutationResults).toEqual([
      expect.objectContaining({ operation: 'projection-save', idempotencyKey: 'job-import-rollback' }),
    ])
    expect(state.jobs).toContainEqual(expect.objectContaining({
      id: 'job-import-rollback', status: 'failed', transactionState: 'rolled-back',
    }))
  })

  it('keeps repeated rollback of a completed cleanup as a durable no-op', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-rollback-retry', title: 'Rollback retry', slides: [] }
    await store.commitImport(await minimalPptx(), {
      jobId: 'job-rollback-retry',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })

    await store.rollbackImport({ jobId: 'job-rollback-retry', presentationId: projection.id })
    const firstState = store.getState()
    const firstRoot = structuredClone(store.metadata.root)

    await store.rollbackImport({ jobId: 'job-rollback-retry', presentationId: projection.id })

    expect(store.getState()).toEqual(firstState)
    expect(store.metadata.root).toEqual(firstRoot)
    expect(store.getState().generation).toBe(firstState.generation)
  })

  it('rejects a repeated rollback that supplies another presentation identity', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-rollback-bound', title: 'Rollback bound', slides: [] }
    await store.commitImport(await minimalPptx(), {
      jobId: 'job-rollback-bound',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })

    await store.rollbackImport({ jobId: 'job-rollback-bound', presentationId: projection.id })
    const rolledBackState = store.getState()
    const rolledBackRoot = structuredClone(store.metadata.root)

    await expect(store.rollbackImport({
      jobId: 'job-rollback-bound',
      presentationId: 'unrelated-presentation',
    })).rejects.toMatchObject({ code: 'PACKAGE_IMPORT_COMMIT_FAILED' })

    expect(store.getState()).toEqual(rolledBackState)
    expect(store.metadata.root).toEqual(rolledBackRoot)
  })

  it('rejects a missing-head no-op when the supplied job identity does not match', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-rollback-job-bound', title: 'Rollback job bound', slides: [] }
    await store.commitImport(await minimalPptx(), {
      jobId: 'job-rollback-job-bound',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })

    await store.rollbackImport({ jobId: 'job-rollback-job-bound', presentationId: projection.id })
    const rolledBackState = store.getState()
    const rolledBackRoot = structuredClone(store.metadata.root)

    await expect(store.rollbackImport({
      jobId: 'unrelated-job-id',
      presentationId: projection.id,
    })).rejects.toMatchObject({ code: 'PACKAGE_IMPORT_COMMIT_FAILED' })

    expect(store.getState()).toEqual(rolledBackState)
    expect(store.metadata.root).toEqual(rolledBackRoot)
    expect(store.getState().jobs).toContainEqual(expect.objectContaining({
      id: 'job-rollback-job-bound',
      presentationId: projection.id,
      transactionState: 'rolled-back',
    }))
  })

  it('fails closed for a legacy durable receipt on a repeated rollback', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-rollback-legacy', title: 'Rollback legacy', slides: [] }
    await store.commitImport(await minimalPptx(), {
      jobId: 'job-rollback-legacy',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })
    await store.rollbackImport({ jobId: 'job-rollback-legacy', presentationId: projection.id })
    await store.mutate((next) => {
      const job = next.jobs.find((item) => item.id === 'job-rollback-legacy')
      delete job.outcomeRevisionId
      delete job.outcomeGeneration
      delete job.outcomeHeadHash
    })

    await expect(store.rollbackImport({
      jobId: 'job-rollback-legacy',
      presentationId: projection.id,
    })).rejects.toMatchObject({ code: 'LEGACY_IMPORT_RECEIPT_UNSUPPORTED' })
  })

  it('retains a legacy receipt after restart without immutable outcome authority', async () => {
    const { rootDir, store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-legacy-receipt', title: 'Legacy receipt', slides: [] }
    await store.commitImport(await minimalPptx(), {
      jobId: 'job-legacy-receipt',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })
    await store.mutate((next) => {
      const job = next.jobs.find((item) => item.id === 'job-legacy-receipt')
      delete job.outcomeRevisionId
      delete job.outcomeGeneration
      delete job.outcomeHeadHash
    })
    await store.releaseWriter()

    const restarted = await openPackageStore({ rootDir })
    await restarted.acquireWriter()
    try {
      await expect(restarted.rollbackImport({
        jobId: 'job-legacy-receipt', presentationId: projection.id,
      })).rejects.toMatchObject({ code: 'LEGACY_IMPORT_RECEIPT_UNSUPPORTED' })
      expect(restarted.getState().heads).toContainEqual(expect.objectContaining({
        presentationId: projection.id,
      }))
      expect(restarted.getJob('job-legacy-receipt')).toMatchObject({
        status: 'completed', transactionState: 'committed',
      })
    } finally {
      await restarted.releaseWriter()
    }
  })

  it('blocks a legacy receipt after matrix authority advances without a generation change', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-legacy-matrix', title: 'Legacy matrix', slides: [] }
    await store.commitImport(await minimalPptx(), {
      jobId: 'job-legacy-matrix',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })
    await store.mutate((next) => {
      const job = next.jobs.find((item) => item.id === 'job-legacy-matrix')
      delete job.outcomeRevisionId
      delete job.outcomeGeneration
      delete job.outcomeHeadHash
    })
    await store.advanceMatrixAuthorityEpoch()

    await expect(store.rollbackImport({
      jobId: 'job-legacy-matrix', presentationId: projection.id,
    })).rejects.toMatchObject({ code: 'LEGACY_IMPORT_RECEIPT_UNSUPPORTED' })
    expect(store.getState().heads).toContainEqual(expect.objectContaining({
      presentationId: projection.id,
      matrixAuthorityEpoch: 2,
    }))
  })

  it('blocks a legacy receipt after the package head advances', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-legacy-successor', title: 'Legacy successor', slides: [] }
    await store.commitImport(await minimalPptx(), {
      jobId: 'job-legacy-successor',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })
    await store.mutate((next) => {
      const job = next.jobs.find((item) => item.id === 'job-legacy-successor')
      delete job.outcomeRevisionId
      delete job.outcomeGeneration
      delete job.outcomeHeadHash
      next.heads.find((head) => head.presentationId === projection.id).generation = 2
    })

    await expect(store.rollbackImport({
      jobId: 'job-legacy-successor', presentationId: projection.id,
    })).rejects.toMatchObject({ code: 'LEGACY_IMPORT_RECEIPT_UNSUPPORTED' })
    expect(store.getState().heads).toContainEqual(expect.objectContaining({
      presentationId: projection.id, generation: 2,
    }))
  })

  it('refuses a late reconciliation that names a presentation with a newer package head', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-mixed-authority', title: 'Mixed Authority', slides: [] }
    const committed = await store.commitImport(await minimalPptx(), {
      jobId: 'job-mixed-authority',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })

    await store.mutate((next) => {
      const original = next.revisions.find((revision) => revision.id === committed.revision.id)
      const successor = { ...original, id: 'r1-successor', ordinal: 1 }
      next.revisions.push(successor)
      next.owners.push({
        schemaVersion: 1,
        ownerType: 'presentation',
        ownerId: projection.id,
        revisionId: successor.id,
      })
      next.heads.find((head) => head.presentationId === projection.id).packageRevisionId = successor.id
    })

    await expect(store.rollbackImport({
      jobId: 'job-mixed-authority',
      presentationId: projection.id,
    })).rejects.toThrow('Import rollback authority no longer matches the recorded job')

    const state = store.getState()
    expect(state.heads).toContainEqual(expect.objectContaining({
      presentationId: projection.id,
      packageRevisionId: 'r1-successor',
    }))
    expect(state.jobs).toContainEqual(expect.objectContaining({
      id: 'job-mixed-authority', status: 'completed', transactionState: 'committed',
    }))
  })

  it('refuses rollback after a normal same-R0 projection successor', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'package-store-same-r0-'))
    dirs.push(rootDir)
    const activeStore = await initializePackageStore({ rootDir })
    const projection = { id: 'deck-same-r0', title: 'Original', slides: [] }
    try {
      const committed = await activeStore.commitImport(await minimalPptx(), {
        jobId: 'job-same-r0',
        presentationId: projection.id,
        projection,
        sourceMap: { entries: {} },
      })
      const initialHead = committed.head
      expect(activeStore.getState().heads).toMatchObject([
        expect.objectContaining({ presentationId: projection.id }),
      ])
      const saved = await savePackageProjection({
        presentationId: projection.id,
        expectedGeneration: initialHead.generation,
        baseRevisionId: initialHead.packageRevisionId,
        idempotencyKey: 'save-after-import',
        after: { title: 'Edited after import' },
        loadStored: async () => projection,
      })
      expect(saved).toMatchObject({ ok: true, generation: 2 })
      expect(saved.aggregateHead.packageRevisionId).toBe(initialHead.packageRevisionId)
      expect(initialHead.packageRevisionId).toBe(committed.revision.id)
      const durable = activeStore.getJob('job-same-r0')
      expect(durable).toMatchObject({
        outcomeGeneration: initialHead.generation,
        outcomeHeadHash: hashCanonical(initialHead),
      })

      await expect(activeStore.rollbackImport({
        jobId: 'job-same-r0', presentationId: projection.id,
      })).rejects.toThrow('Import rollback authority no longer matches the recorded job')
      const current = activeStore.getState().heads.find(
        (head) => head.presentationId === projection.id
      )
      expect(current).toMatchObject({ generation: 2, packageRevisionId: initialHead.packageRevisionId })
    } finally {
      await shutdownPackageStore()
    }
  })

  it('refuses a rollback when the durable receipt head hash no longer matches', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-receipt-fence', title: 'Receipt Fence', slides: [] }
    await store.commitImport(await minimalPptx(), {
      jobId: 'job-receipt-fence',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })
    await store.mutate((next) => {
      next.jobs.find((job) => job.id === 'job-receipt-fence').outcomeHeadHash = 'f'.repeat(64)
    })

    await expect(store.rollbackImport({
      jobId: 'job-receipt-fence',
      presentationId: projection.id,
    })).rejects.toThrow('Import rollback authority no longer matches the recorded job')
    expect(store.getState().heads).toContainEqual(expect.objectContaining({ presentationId: projection.id }))
  })

  it('blocks a legacy receipt when an import-head field changes without generation advance', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const projection = { id: 'deck-legacy-drift', title: 'Legacy drift', slides: [] }
    await store.commitImport(await minimalPptx(), {
      jobId: 'job-legacy-drift',
      presentationId: projection.id,
      projection,
      sourceMap: { entries: {} },
    })
    await store.mutate((next) => {
      const job = next.jobs.find((item) => item.id === 'job-legacy-drift')
      delete job.outcomeRevisionId
      delete job.outcomeGeneration
      delete job.outcomeHeadHash
      next.heads.find((head) => head.presentationId === projection.id).evidenceByClaim = {
        edited: { status: 'recorded' },
      }
    })

    await expect(store.rollbackImport({
      jobId: 'job-legacy-drift', presentationId: projection.id,
    })).rejects.toMatchObject({ code: 'LEGACY_IMPORT_RECEIPT_UNSUPPORTED' })
    expect(store.getState().heads).toContainEqual(expect.objectContaining({
      presentationId: projection.id,
      evidenceByClaim: { edited: { status: 'recorded' } },
    }))
  })

  it('rejects partial import outcome identity fields while retaining legacy receipts', async () => {
    const { store } = await tempStore()
    await store.acquireWriter()
    const base = {
      id: 'job-partial-outcome',
      kind: 'import',
      status: 'completed',
      capabilityHash: 'a'.repeat(64),
      presentationId: 'deck-partial-outcome',
    }
    await expect(store.putJob({ ...base, outcomeRevisionId: 'r0-partial' }))
      .rejects.toThrow('Import outcome identity must be complete')
    await expect(store.putJob(base)).resolves.toMatchObject({ id: base.id })
  })
})
