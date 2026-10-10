const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { openPackageStore } = require('./index')
const { RECORD_SCHEMA_VERSION, hashRecord } = require('./schemas')
const { MUTATION_OPERATIONS } = require('../mutation-operation-scope')
const { resolveEditedExportContext } = require('../validated-edited-export-context')
const {
  queueCompatibilityRemoval,
  queueCompatibilityUpsert,
} = require('../compatibility-outbox')

const roots = []
async function storeFor(name) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), `navslides-${name}-`))
  roots.push(rootDir)
  const store = await openPackageStore({ rootDir })
  await store.acquireWriter()
  return store
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('portable package boundary', () => {
  it('exports verified bytes and atomically imports owners and head', async () => {
    const source = await storeFor('portable-source')
    await source.commitOriginal(Buffer.from('portable'), {
      ownerType: 'presentation',
      ownerId: 'source',
    })
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('portable-destination')

    await destination.importPresentationPackage(bundle, 'imported')

    expect(destination.getState().heads[0].presentationId).toBe('imported')
    expect(destination.getState().owners).toContainEqual(expect.objectContaining({
      ownerType: 'presentation',
      ownerId: 'imported',
    }))
    expect(await destination.readBlob(bundle.blobs[0].sha256)).toEqual(Buffer.from('portable'))
    await source.releaseWriter()
    await destination.releaseWriter()
  })

  it('clears stale destination compatibility writes during import', async () => {
    const source = await storeFor('portable-outbox-source')
    await source.commitOriginal(Buffer.from('portable-outbox'), {
      ownerType: 'presentation',
      ownerId: 'source',
    })
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('portable-outbox-destination')
    await destination.mutate((next) => {
      queueCompatibilityRemoval(next, { presentationId: 'imported', generation: 7 })
      queueCompatibilityUpsert(next, {
        presentationId: 'imported',
        generation: 8,
        presentation: { id: 'imported', title: 'stale', slides: [] },
      })
    })

    await destination.importPresentationPackage(bundle, 'imported')

    expect(destination.getState().compatibilityOutbox).toEqual([])
    await source.releaseWriter()
    await destination.releaseWriter()
  })

  it('round-trips committed projection authority with destination rebinding', async () => {
    const source = await storeFor('portable-authority-source')
    const revision = await source.commitOriginal(Buffer.from('portable-authority'), {
      ownerType: 'presentation',
      ownerId: 'source',
    })
    const projection = { id: 'source', title: 'Portable authority', slides: [] }
    const sourceMap = {
      schemaVersion: 1,
      presentationId: 'source',
      revisionId: revision.revision.id,
      packageGeneration: 1,
      entries: {},
    }
    await source.mutate((next) => {
      const head = next.heads.find((item) => item.presentationId === 'source')
      head.projectionRevisionId = hashRecord(projection)
      head.sourceMapRevisionId = hashRecord(sourceMap)
      next.mutationResults.push({
        schemaVersion: 1,
        operation: MUTATION_OPERATIONS.PACKAGE_IMPORT,
        presentationId: 'source',
        idempotencyKey: 'portable-authority-import',
        generation: 1,
        packageRevisionId: revision.revision.id,
        projection,
        sourceMap,
        state: 'committed',
      })
    })
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('portable-authority-destination')
    await destination.importPresentationPackage(bundle, 'imported')

    const context = resolveEditedExportContext(destination.getState(), 'imported')
    expect(context.ok).toBe(true)
    expect(context.after).toMatchObject({ id: 'imported', title: 'Portable authority' })
    expect(context.sourceMap).toMatchObject({
      presentationId: 'imported',
      revisionId: revision.revision.id,
      packageGeneration: 1,
    })
    expect(destination.getState().mutationResults).toEqual([
      expect.objectContaining({ presentationId: 'imported' }),
    ])
    await source.releaseWriter()
    await destination.releaseWriter()
  })

  it('fails closed when a head references another presentation revision', async () => {
    const source = await storeFor('portable-cross-owner-source')
    await source.commitOriginal(Buffer.from('source'), {
      ownerType: 'presentation',
      ownerId: 'source',
    })
    const foreign = await source.commitOriginal(Buffer.from('foreign'), {
      ownerType: 'presentation',
      ownerId: 'foreign',
    })
    await source.mutate((next) => {
      next.heads.find((item) => item.presentationId === 'source').packageRevisionId = foreign.revision.id
    })

    await expect(source.exportPresentationPackage('source'))
      .rejects.toMatchObject({ code: 'PACKAGE_INCOMPLETE' })
    await source.releaseWriter()
  })

  it('fails closed when a head-referenced binary revision is missing', async () => {
    const source = await storeFor('portable-incomplete-source')
    await source.commitOriginal(Buffer.from('portable'), {
      ownerType: 'presentation',
      ownerId: 'source',
    })
    await source.mutate((next) => {
      next.heads.find((item) => item.presentationId === 'source').packageRevisionId =
        'missing-package-revision'
    })

    await expect(source.exportPresentationPackage('source'))
      .rejects.toMatchObject({ code: 'PACKAGE_INCOMPLETE' })
    await source.releaseWriter()
  })

  it('rejects incomplete or ambiguous descriptors before publishing metadata', async () => {
    const source = await storeFor('portable-descriptor-source')
    await source.commitOriginal(Buffer.from('portable'), {
      ownerType: 'presentation',
      ownerId: 'source',
    })
    const bundle = await source.exportPresentationPackage('source')
    const copyBundle = () => ({
      manifest: structuredClone(bundle.manifest),
      blobs: bundle.blobs.map((blob) => ({ ...blob, bytes: Buffer.from(blob.bytes) })),
    })
    const invalidBundles = [
      () => {
        const invalid = copyBundle()
        invalid.manifest.revisions = []
        invalid.manifest.blobs = []
        invalid.blobs = []
        return invalid
      },
      () => {
        const invalid = copyBundle()
        const sha256 = '0'.repeat(64)
        invalid.manifest.revisions.push({
          schemaVersion: 1,
          id: 'r99-extra',
          ordinal: 99,
          blobSha256: sha256,
        })
        invalid.manifest.blobs.push({ schemaVersion: 1, sha256, byteLength: 0 })
        invalid.blobs.push({ sha256, byteLength: 0, bytes: Buffer.alloc(0) })
        return invalid
      },
      () => {
        const invalid = copyBundle()
        invalid.manifest.revisions.push(structuredClone(invalid.manifest.revisions[0]))
        return invalid
      },
      () => {
        const invalid = copyBundle()
        invalid.manifest.blobs[0].schemaVersion = RECORD_SCHEMA_VERSION + 1
        return invalid
      },
    ]

    for (const createInvalidBundle of invalidBundles) {
      const destination = await storeFor('portable-descriptor-destination')
      await expect(destination.importPresentationPackage(createInvalidBundle(), 'imported'))
        .rejects.toMatchObject({ code: 'PACKAGE_MANIFEST_INVALID' })
      expect(destination.getState()).toMatchObject({
        heads: [],
        owners: [],
        revisions: [],
        blobs: [],
      })
      await destination.releaseWriter()
    }
    await source.releaseWriter()
  })

  it('blocks corrupt bytes before publishing metadata', async () => {
    const source = await storeFor('portable-corrupt-source')
    await source.commitOriginal(Buffer.from('portable'), {
      ownerType: 'presentation',
      ownerId: 'source',
    })
    const bundle = await source.exportPresentationPackage('source')
    bundle.blobs[0].bytes = Buffer.from('corrupt')
    const destination = await storeFor('portable-corrupt-destination')

    await expect(destination.importPresentationPackage(bundle, 'imported'))
      .rejects.toMatchObject({ code: 'PACKAGE_HASH_MISMATCH' })
    expect(destination.getState().heads).toEqual([])
    expect(destination.getState().owners).toEqual([])
    await source.releaseWriter()
    await destination.releaseWriter()
  })
})

describe('portable destination and source fences (P10-02/03/10)', () => {
  it('rejects create-new over an existing destination without changing its authority', async () => {
    const source = await storeFor('create-new-source')
    await source.commitOriginal(Buffer.from('incoming'), { ownerType: 'presentation', ownerId: 'source' })
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('create-new-destination')
    await destination.commitOriginal(Buffer.from('winner'), { ownerType: 'presentation', ownerId: 'destination' })
    const before = destination.getState()
    await expect(destination.importPresentationPackage(bundle, 'destination'))
      .rejects.toMatchObject({ code: 'SYNC_DESTINATION_CHANGED', status: 409 })
    expect(destination.getState()).toEqual(before)
    expect(await destination.readOriginal(before.heads[0].originalRevisionId)).toEqual(Buffer.from('winner'))
    await source.releaseWriter()
    await destination.releaseWriter()
  })

  it('requires explicit replace and rebases onto the destination predecessor', async () => {
    const source = await storeFor('replace-source')
    for (const value of ['source-first', 'source-second', 'incoming']) {
      await source.commitOriginal(Buffer.from(value), { ownerType: 'presentation', ownerId: 'source' })
    }
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('replace-destination')
    await destination.commitOriginal(Buffer.from('winner'), { ownerType: 'presentation', ownerId: 'destination' })
    const expectedHead = destination.getState().heads[0]
    await expect(destination.importPresentationPackage(bundle, 'destination', { replace: true }))
      .rejects.toMatchObject({ code: 'PACKAGE_DESTINATION_PRECONDITION_REQUIRED', status: 428 })
    const head = await destination.importPresentationPackage(bundle, 'destination', { replace: true, expectedHead })
    expect(head).toMatchObject({ generation: expectedHead.generation + 1, predecessorId: hashRecord(expectedHead) })
    expect(head.generation).not.toBe(bundle.manifest.head.generation)
    expect(await destination.readOriginal(head.originalRevisionId)).toEqual(Buffer.from('incoming'))
    await source.releaseWriter()
    await destination.releaseWriter()
  })

  it.each([false, true])('preserves a winner published during preflight (replace=%s)', async (replace) => {
    const source = await storeFor('race-source')
    await source.commitOriginal(Buffer.from('incoming'), { ownerType: 'presentation', ownerId: 'source' })
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('race-destination')
    if (replace) await destination.commitOriginal(Buffer.from('before'), { ownerType: 'presentation', ownerId: 'destination' })
    const expectedHead = destination.getState().heads[0]
    let winner
    await expect(destination.importPresentationPackage(bundle, 'destination', {
      replace,
      ...(replace ? { expectedHead } : {}),
      admissionPreflight: async () => {
        await destination.commitOriginal(Buffer.from('concurrent-winner'), { ownerType: 'presentation', ownerId: 'destination' })
        winner = destination.getState()
      },
    })).rejects.toMatchObject({ code: 'SYNC_DESTINATION_CHANGED', status: 409 })
    expect(destination.getState()).toEqual(winner)
    expect(await destination.readOriginal(winner.heads[0].originalRevisionId)).toEqual(Buffer.from('concurrent-winner'))
    await source.releaseWriter()
    await destination.releaseWriter()
  })

  it('rechecks replace after asynchronous staging instead of overwriting a new head', async () => {
    const source = await storeFor('staging-race-source')
    await source.commitOriginal(Buffer.from('incoming'), { ownerType: 'presentation', ownerId: 'source' })
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('staging-race-destination')
    await destination.commitOriginal(Buffer.from('before'), { ownerType: 'presentation', ownerId: 'destination' })
    const expectedHead = destination.getState().heads[0]
    const commitBlob = destination.blobs.commit.bind(destination.blobs)
    let winner
    destination.blobs.commit = async (staged) => {
      const blob = await commitBlob(staged)
      destination.blobs.commit = commitBlob
      await destination.mutate((next) => {
        const head = next.heads.find((item) => item.presentationId === 'destination')
        head.predecessorId = hashRecord(head)
        head.generation += 1
        queueCompatibilityUpsert(next, { presentationId: 'destination', generation: head.generation, presentation: { id: 'destination', title: 'concurrent staging winner', slides: [] } })
      })
      winner = destination.getState()
      return blob
    }
    await expect(destination.importPresentationPackage(bundle, 'destination', { replace: true, expectedHead }))
      .rejects.toMatchObject({ code: 'SYNC_DESTINATION_CHANGED', status: 409 })
    expect(destination.getState()).toEqual(winner)
    expect(await destination.readOriginal(winner.heads[0].originalRevisionId)).toEqual(Buffer.from('before'))
    await source.releaseWriter()
    await destination.releaseWriter()
  })

  it('rejects a source head advanced while real blob bytes are being read', async () => {
    const source = await storeFor('export-race')
    await source.commitOriginal(Buffer.from('first'), { ownerType: 'presentation', ownerId: 'source' })
    const expectedHead = source.getState().heads[0]
    const readBlob = source.readBlob.bind(source)
    source.readBlob = async (sha) => {
      const bytes = await readBlob(sha)
      await source.commitOriginal(Buffer.from('winner'), { ownerType: 'presentation', ownerId: 'source' })
      return bytes
    }
    await expect(source.exportPresentationPackage('source', { expectedHead }))
      .rejects.toMatchObject({ code: 'SYNC_SOURCE_CHANGED', status: 409 })
    expect(await source.readOriginal(source.getState().heads[0].originalRevisionId)).toEqual(Buffer.from('winner'))
    await source.releaseWriter()
  })
})

describe('portable canonical media rebinding (P10-14/12)', () => {
  it.each([[false, false], [true, false], [false, true], [true, true]])('rebinds canonical media and immutable Original (pending=%s, replace=%s)', async (pending, replace) => {
    const { deriveMutationJournal, replayJournal } = require('../mutation-journal')
    const { rebindSourceMap } = require('../source-map')
    const source = await storeFor('media-source')
    const bytes = Buffer.from('immutable original /uploads/old.png')
    const { revision } = await source.commitOriginal(bytes, { ownerType: 'presentation', ownerId: 'source' })
    const projection = {
      id: 'source', title: '/uploads/old.png',
      slides: [{ id: 's', background: { type: 'image', image: '/uploads/old.png' }, elements: [
        { id: 'image', type: 'image', src: '/uploads/old.png' },
        { id: 'video', type: 'video', src: '/uploads/old.mp4#t=1,3', poster: '/uploads/old.png', tracks: [{ src: '/uploads/old.vtt' }] },
        { id: 'text', type: 'text', content: '<p>/uploads/old.png</p>' },
      ], children: [{ id: 'child', elements: [{ id: 'nested', type: 'image', src: '/uploads/old.png' }] }] }],
    }
    const sourceMap = { schemaVersion: 1, presentationId: 'source', revisionId: revision.id, packageGeneration: 1, entries: {
      's:image': { schemaVersion: 1, status: 'authoritative', packageGeneration: 1, revisionId: revision.id, partUri: 'ppt/slides/slide1.xml', kind: 'image', sourceHash: 'a'.repeat(64), nativeId: '1', matchMethod: 'native-id', confidence: 1, relationshipChain: ['ppt/_rels/presentation.xml.rels'], groupAncestry: [], occurrencePath: [0], lineage: { tombstone: false, replaces: null } },
    } }
    for (const key of ['s:video', 's:text', 'child:nested']) {
      sourceMap.entries[key] = { ...structuredClone(sourceMap.entries['s:image']), status: 'diagnostic' }
    }
    await source.mutate((next) => {
      const head = next.heads[0]
      head.projectionRevisionId = hashRecord(projection)
      head.sourceMapRevisionId = hashRecord(sourceMap)
      next.mutationResults.push({ schemaVersion: 1, operation: MUTATION_OPERATIONS.PACKAGE_IMPORT, presentationId: 'source', idempotencyKey: 'media-import', generation: 1, packageRevisionId: revision.id, projection, sourceMap, state: 'committed' })
      if (pending) {
        const after = structuredClone(projection)
        after.slides[0].elements[0].src = '/uploads/pending.png'
        const journal = deriveMutationJournal(projection, after, { sourceMap, baseRevisionId: revision.id, matrixAuthorityEpoch: next.matrixAuthorityEpoch })
        const map = rebindSourceMap(sourceMap, { presentationId: 'source', revisionId: revision.id, packageGeneration: 2 })
        Object.assign(head, { generation: 2, projectionRevisionId: hashRecord(after), sourceMapRevisionId: hashRecord(map), journalRevisionId: journal.journalHash, pendingJournalHash: journal.journalHash })
        next.mutationResults.push({ schemaVersion: 1, operation: MUTATION_OPERATIONS.PROJECTION_SAVE, presentationId: 'source', idempotencyKey: 'media-save', generation: 2, packageRevisionId: revision.id, projection: after, sourceMap: map, journal, operationIds: journal.operations.map((op) => op.operationId), requestHash: hashRecord({ operation: MUTATION_OPERATIONS.PROJECTION_SAVE, presentationId: 'source', expectedGeneration: 1, baseRevisionId: revision.id, after }), requestIdentity: { expectedGeneration: 1, baseRevisionId: revision.id, snapshotHash: hashRecord(after) }, state: 'pending-edited-export' })
      }
    })
    const bundle = await source.exportPresentationPackage('source')
    const sourceBefore = source.getState()
    const destination = await storeFor('media-destination')
    await destination.advanceMatrixAuthorityEpoch()
    if (replace) {
      for (const value of ['old-one', 'old-two', 'old-three']) {
        await destination.commitOriginal(Buffer.from(value), { ownerType: 'presentation', ownerId: 'destination' })
      }
    }
    const expectedHead = destination.getState().heads[0]
    const mediaUrlMap = { '/uploads/old.png': '/uploads/destination.png', '/uploads/pending.png': '/uploads/destination-pending.png', '/uploads/old.mp4': '/uploads/destination.mp4', '/uploads/old.vtt': '/uploads/destination.vtt' }
    const head = await destination.importPresentationPackage(bundle, 'destination', { mediaUrlMap, ...(replace ? { replace: true, expectedHead } : {}) })
    expect(head.generation).toBe(replace ? expectedHead.generation + 1 : pending ? 2 : 1)
    expect(head.predecessorId).toBe(replace ? hashRecord(expectedHead) : null)
    const context = resolveEditedExportContext(destination.getState(), 'destination')
    expect(context.ok).toBe(true)
    expect(context.before.slides[0].elements[0].src).toBe('/uploads/destination.png')
    expect(context.after.slides[0].elements[0].src).toBe(pending ? '/uploads/destination-pending.png' : '/uploads/destination.png')
    expect(context.after.slides[0].elements[1]).toMatchObject({ src: '/uploads/destination.mp4#t=1,3', poster: '/uploads/destination.png', tracks: [{ src: '/uploads/destination.vtt' }] })
    expect(context.after.slides[0].background.image).toBe('/uploads/destination.png')
    expect(context.after.slides[0].children[0].elements[0].src).toBe('/uploads/destination.png')
    expect(context.after.title).toBe('/uploads/old.png')
    expect(context.after.slides[0].elements[2].content).toBe('<p>/uploads/old.png</p>')
    expect(head.projectionRevisionId).toBe(hashRecord(context.after))
    expect(head.sourceMapRevisionId).toBe(hashRecord(context.sourceMap))
    if (pending) {
      const result = destination.getState().mutationResults.find((item) => item.state === 'pending-edited-export')
      expect(result.journal.operations[0]).toMatchObject({ before: '/uploads/destination.png', after: '/uploads/destination-pending.png', inverse: { value: '/uploads/destination.png' } })
      expect(result.journal.matrixAuthoritySubject).toEqual(head.matrixAuthoritySubjects.journal)
      expect(result.journal.journalHash).toBe(head.pendingJournalHash)
      expect(result.requestIdentity).toEqual({ expectedGeneration: head.generation - 1, baseRevisionId: head.packageRevisionId, snapshotHash: hashRecord(context.after) })
      expect(result.requestHash).toBe(hashRecord({ operation: MUTATION_OPERATIONS.PROJECTION_SAVE, presentationId: 'destination', expectedGeneration: head.generation - 1, baseRevisionId: head.packageRevisionId, after: context.after }))
      expect(replayJournal(context.before, result.journal)).toEqual(context.after)
    }
    expect(head.originalRevisionId).toBe(bundle.manifest.head.originalRevisionId)
    expect(head.packageRevisionId).toBe(bundle.manifest.head.packageRevisionId)
    expect(await destination.readOriginal(head.originalRevisionId)).toEqual(bytes)
    expect(source.getState()).toEqual(sourceBefore)
    const roundtrip = await destination.exportPresentationPackage('destination', { expectedHead: head })
    expect(roundtrip.blobs.map((blob) => blob.bytes)).toEqual(bundle.blobs.map((blob) => blob.bytes))
    await source.releaseWriter()
    await fs.rm(source.rootDir, { recursive: true, force: true })
    const third = await storeFor('media-third')
    const thirdMap = Object.fromEntries(Object.values(mediaUrlMap).map((url) => [url, url.replace('/uploads/destination', '/uploads/third')]))
    const thirdHead = await third.importPresentationPackage(roundtrip, 'third', { mediaUrlMap: thirdMap })
    const thirdContext = resolveEditedExportContext(third.getState(), 'third')
    expect(thirdContext.ok).toBe(true)
    expect(thirdContext.before.slides[0].elements[0].src).toBe('/uploads/third.png')
    expect(thirdContext.after.slides[0].elements[0].src).toBe(pending ? '/uploads/third-pending.png' : '/uploads/third.png')
    expect(thirdContext.after.slides[0].elements[1].tracks[0].src).toBe('/uploads/third.vtt')
    expect(await third.readOriginal(thirdHead.originalRevisionId)).toEqual(bytes)
    expect(thirdHead.originalRevisionId).toBe(bundle.manifest.head.originalRevisionId)
    await third.releaseWriter()
    await destination.releaseWriter()
  })
})

describe('portable publication identity capture', () => {
  it('creates an independent destination generation instead of copying source history', async () => {
    const source = await storeFor('local-generation-source')
    for (const value of ['one', 'two', 'three']) {
      await source.commitOriginal(Buffer.from(value), { ownerType: 'presentation', ownerId: 'source' })
    }
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('local-generation-destination')
    const head = await destination.importPresentationPackage(bundle, 'destination')
    expect(head).toMatchObject({ generation: 1, predecessorId: null })
    expect(head.originalRevisionId).toBe(bundle.manifest.head.originalRevisionId)
    expect(await destination.readOriginal(head.originalRevisionId)).toEqual(Buffer.from('three'))
    await source.releaseWriter()
    await destination.releaseWriter()
  })

  it('does not allow a caller to retarget expectedHead after admission', async () => {
    const source = await storeFor('capture-source')
    await source.commitOriginal(Buffer.from('incoming'), { ownerType: 'presentation', ownerId: 'source' })
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('capture-destination')
    await destination.commitOriginal(Buffer.from('old'), { ownerType: 'presentation', ownerId: 'destination' })
    const expectedHead = destination.getState().heads[0]
    let winner
    await expect(destination.importPresentationPackage(bundle, 'destination', {
      replace: true, expectedHead,
      admissionPreflight: async () => {
        await destination.commitOriginal(Buffer.from('winner'), { ownerType: 'presentation', ownerId: 'destination' })
        winner = destination.getState()
        Object.assign(expectedHead, winner.heads[0])
      },
    })).rejects.toMatchObject({ code: 'SYNC_DESTINATION_CHANGED', status: 409 })
    expect(destination.getState()).toEqual(winner)
    await source.releaseWriter()
    await destination.releaseWriter()
  })

  it('rejects disappearance of an expected source rather than returning no bundle', async () => {
    const source = await storeFor('missing-export-source')
    await source.commitOriginal(Buffer.from('original'), { ownerType: 'presentation', ownerId: 'source' })
    const expectedHead = source.getState().heads[0]
    await source.mutate((next) => { next.heads = [] })
    await expect(source.exportPresentationPackage('source', { expectedHead }))
      .rejects.toMatchObject({ code: 'SYNC_SOURCE_CHANGED', status: 409 })
    await source.releaseWriter()
  })
})

describe('portable journal preflight authority (P10-06)', () => {
  it('rejects corrupted pending journal content before installing a destination head', async () => {
    const { deriveMutationJournal } = require('../mutation-journal')
    const source = await storeFor('journal-source')
    const { revision } = await source.commitOriginal(Buffer.from('journal-original'), { ownerType: 'presentation', ownerId: 'source' })
    const projection = { id: 'source', slides: [] }
    const sourceMap = { schemaVersion: 1, presentationId: 'source', revisionId: revision.id, packageGeneration: 1, entries: {} }
    await source.mutate((next) => {
      const head = next.heads[0]
      const journal = deriveMutationJournal(projection, projection, { sourceMap, baseRevisionId: revision.id, matrixAuthorityEpoch: next.matrixAuthorityEpoch })
      const pendingMap = { ...sourceMap, packageGeneration: 2 }
      Object.assign(head, { generation: 2, projectionRevisionId: hashRecord(projection), sourceMapRevisionId: hashRecord(pendingMap), journalRevisionId: journal.journalHash, pendingJournalHash: journal.journalHash })
      next.mutationResults.push(
        { schemaVersion: 1, operation: MUTATION_OPERATIONS.PACKAGE_IMPORT, presentationId: 'source', idempotencyKey: 'journal-import', generation: 1, packageRevisionId: revision.id, projection, sourceMap, state: 'committed' },
        { schemaVersion: 1, operation: MUTATION_OPERATIONS.PROJECTION_SAVE, presentationId: 'source', idempotencyKey: 'journal-save', generation: 2, packageRevisionId: revision.id, projection, sourceMap: pendingMap, journal, operationIds: [], state: 'pending-edited-export' },
      )
    })
    const bundle = await source.exportPresentationPackage('source')
    bundle.manifest.mutationResults.find((result) => result.state === 'pending-edited-export').journal.matrixAuthoritySubject.evolutionEpoch += 1
    const destination = await storeFor('journal-destination')
    const before = destination.getState()
    await expect(destination.importPresentationPackage(bundle, 'destination'))
      .rejects.toMatchObject({ code: 'PACKAGE_AUTHORITY_UNAVAILABLE' })
    expect(destination.getState()).toEqual(before)
    expect(await destination.listBlobFiles()).toEqual([])
    await source.releaseWriter()
    await destination.releaseWriter()
  })
})

describe('portable trusted rendering sidecar closure', () => {
  it('retains Original-bound fit/crop metadata when the original import result is outside the current package closure', async () => {
    const source = await storeFor('render-sidecar-source')
    const originalBytes = Buffer.from('immutable render Original')
    const { revision: original } = await source.commitOriginal(originalBytes, { ownerType: 'presentation', ownerId: 'source' })
    const projection = { id: 'source', slides: [{ id: 'slide:one', elements: [{ id: 'text:one', type: 'text', content: '<p>Imported</p>', fontSize: 24, width: 200, height: 80 }] }] }
    const trustedImportMetadata = { schemaVersion: 1, originalRevisionId: original.id, elements: [{ slideId: 'slide:one', elementId: 'text:one', type: 'text', metadata: { version: 1, textFit: 'wrap', fitFontSizePx: 18, textInsetsUnit: 'px', textInsets: { left: 7, right: 7 } }, fitBaseline: { content: '<p>Imported</p>', fontSize: 24, width: 200, height: 80 } }] }
    const staged = await source.stageBlob(Buffer.from('edited render package'))
    const blob = await source.blobs.commit(staged)
    const edited = { ...original, id: `r1-${blob.sha256}`, ordinal: 1, blobSha256: blob.sha256, manifestHash: null }
    await source.mutate((next) => {
      const originalMap = { schemaVersion: 1, presentationId: 'source', revisionId: original.id, packageGeneration: 1, entries: {} }
      const currentMap = { ...originalMap, revisionId: edited.id, packageGeneration: 2 }
      next.blobs.push(blob)
      next.revisions.push(edited)
      next.owners.push({ schemaVersion: 1, ownerType: 'presentation', ownerId: 'source', revisionId: edited.id })
      Object.assign(next.heads[0], { generation: 2, packageRevisionId: edited.id, projectionRevisionId: hashRecord(projection), sourceMapRevisionId: hashRecord(currentMap) })
      next.mutationResults.push(
        { schemaVersion: 1, operation: MUTATION_OPERATIONS.PACKAGE_IMPORT, presentationId: 'source', idempotencyKey: 'sidecar-import', generation: 1, packageRevisionId: original.id, projection, sourceMap: originalMap, trustedImportMetadata, state: 'committed' },
        { schemaVersion: 1, operation: MUTATION_OPERATIONS.VALIDATED_EDITED_EXPORT, presentationId: 'source', idempotencyKey: 'sidecar-edited', generation: 2, packageRevisionId: edited.id, projection, sourceMap: currentMap, state: 'committed' },
      )
    })
    const sourceBefore = source.getState()
    const bundle = await source.exportPresentationPackage('source')
    expect(bundle.manifest.mutationResults.find((result) => result.packageRevisionId === edited.id).trustedImportMetadata).toEqual(trustedImportMetadata)
    const destination = await storeFor('render-sidecar-destination')
    const head = await destination.importPresentationPackage(bundle, 'destination')
    const result = destination.getState().mutationResults.find((item) => item.packageRevisionId === edited.id)
    expect(result.trustedImportMetadata).toEqual(trustedImportMetadata)
    expect(head.originalRevisionId).toBe(original.id)
    expect(head.packageRevisionId).toBe(edited.id)
    expect(await destination.readOriginal(head.originalRevisionId)).toEqual(originalBytes)
    expect(source.getState()).toEqual(sourceBefore)
    const third = await storeFor('render-sidecar-third')
    const secondBundle = await destination.exportPresentationPackage('destination')
    const thirdHead = await third.importPresentationPackage(secondBundle, 'third')
    expect(third.getState().mutationResults.find((item) => item.packageRevisionId === edited.id).trustedImportMetadata).toEqual(trustedImportMetadata)
    expect(await third.readOriginal(thirdHead.originalRevisionId)).toEqual(originalBytes)
    await source.releaseWriter()
    await destination.releaseWriter()
    await third.releaseWriter()
  })

  it.each([false, true])('Audit regression: replacement without a sidecar ignores retained old Original metadata (publication hook=%s)', async (withPublicationHook) => {
    const JSZip = require('jszip')
    const { buildImportSourceMap } = require('../source-map')
    const { resolvePackageBackedReadFromState } = require('../../package-backed-presentation-read')
    const { applyCompatibilityWrites } = require('../compatibility-view')
    const source = await storeFor('sidecar-replace-source')
    const bundle = await bundleWithCanonicalProjection(source)
    const destination = await storeFor('sidecar-replace-destination')
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<Types />')
    zip.file('ppt/presentation.xml', '<p:presentation name="Previous" />')
    const originalBytes = await zip.generateAsync({ type: 'nodebuffer' })
    const projection = { id: 'destination', title: 'Previous', slides: [{ id: 's', elements: [{
      id: 'text', type: 'text', content: '<p>Imported</p>', fontSize: 24, width: 200, height: 80,
      _pptxImportMeta: { version: 1, textFit: 'wrap', fitFontSizePx: 18 },
    }] }] }
    await destination.commitImport(originalBytes, {
      jobId: 'sidecar-replace-old', presentationId: 'destination', projection,
      sourceMap: await buildImportSourceMap(projection, null, null),
      compatibilityPresentation: projection,
    })
    const previous = destination.getState().heads[0]
    const oldRows = []
    applyCompatibilityWrites(oldRows, destination.getState().compatibilityOutbox)
    expect(resolvePackageBackedReadFromState(destination.getState(), 'destination', oldRows[0])
      .presentation.slides[0].elements[0]._pptxImportMeta)
      .toMatchObject({ textFit: 'wrap', fitFontSizePx: 18 })
    const template = { ownerType: 'template', ownerId: 'sidecar-previous-template' }
    await destination.retainHead(template, 'destination')

    const imported = await destination.importPresentationPackage(bundle, 'destination', {
      replace: true, expectedHead: previous,
      ...(withPublicationHook ? { beforePublication: async ({ head, projection: incoming }) => ({
        ...incoming, pptxAggregateHead: head,
      }) } : {}),
    })
    const state = destination.getState()
    const context = resolveEditedExportContext(state, 'destination')
    expect(context).toMatchObject({ ok: true, after: { id: 'destination', title: 'Canonical intent' } })
    const currentRows = []
    applyCompatibilityWrites(currentRows, state.compatibilityOutbox)
    const compatibility = withPublicationHook ? currentRows.find((row) => row.id === 'destination')
      : { ...context.after, pptxAggregateHead: imported }
    expect(resolvePackageBackedReadFromState(state, 'destination', compatibility))
      .toMatchObject({ generation: imported.generation, presentation: { title: 'Canonical intent', slides: [] } })
    const exported = await destination.exportPresentationPackage('destination', { expectedHead: imported })
    expect(exported.manifest.mutationResults.every((result) => result.trustedImportMetadata === undefined)).toBe(true)
    expect(await destination.readOriginal(imported.originalRevisionId)).toEqual(bundle.blobs[0].bytes)

    const retained = await destination.instantiateRetainedHead(template, 'retained-copy')
    const retainedState = destination.getState()
    const retainedContext = resolveEditedExportContext(retainedState, 'retained-copy')
    expect(retainedContext.ok).toBe(true)
    const retainedRead = resolvePackageBackedReadFromState(retainedState, 'retained-copy', {
      ...retainedContext.after, pptxAggregateHead: retained,
    })
    expect(retainedRead.presentation.slides[0].elements[0]._pptxImportMeta)
      .toMatchObject({ textFit: 'wrap', fitFontSizePx: 18 })
    expect(await destination.readOriginal(retained.originalRevisionId)).toEqual(originalBytes)
    await destination.releaseWriter()
    const reopened = await openPackageStore({ rootDir: destination.rootDir })
    expect(resolvePackageBackedReadFromState(reopened.getState(), 'destination', compatibility))
      .toMatchObject({ generation: imported.generation, presentation: { title: 'Canonical intent' } })
    expect(await reopened.readOriginal(imported.originalRevisionId)).toEqual(bundle.blobs[0].bytes)
    await source.releaseWriter()
  })
})

describe('portable trusted sidecar admission boundary', () => {
  it.each(['foreign-original', 'duplicate-identity', 'unknown-metadata'])('rejects a present malformed sidecar before publication: %s', async (failure) => {
    const source = await storeFor('sidecar-preflight-source')
    const { revision } = await source.commitOriginal(Buffer.from('sidecar Original'), { ownerType: 'presentation', ownerId: 'source' })
    const projection = { id: 'source', slides: [{ id: 's', elements: [{ id: 'text', type: 'text', content: '<p>Imported</p>' }] }] }
    const sourceMap = { schemaVersion: 1, presentationId: 'source', revisionId: revision.id, packageGeneration: 1, entries: {} }
    const trustedImportMetadata = { schemaVersion: 1, originalRevisionId: revision.id, elements: [{ slideId: 's', elementId: 'text', type: 'text', metadata: { version: 1, textFit: 'wrap', fitFontSizePx: 18 }, fitBaseline: { content: '<p>Imported</p>' } }] }
    await source.mutate((next) => {
      Object.assign(next.heads[0], { projectionRevisionId: hashRecord(projection), sourceMapRevisionId: hashRecord(sourceMap) })
      next.mutationResults.push({ schemaVersion: 1, operation: MUTATION_OPERATIONS.PACKAGE_IMPORT, presentationId: 'source', idempotencyKey: 'sidecar-preflight', generation: 1, packageRevisionId: revision.id, projection, sourceMap, trustedImportMetadata, state: 'committed' })
    })
    const bundle = await source.exportPresentationPackage('source')
    const sidecar = bundle.manifest.mutationResults[0].trustedImportMetadata
    if (failure === 'foreign-original') sidecar.originalRevisionId = 'r0-foreign'
    if (failure === 'duplicate-identity') sidecar.elements.push(structuredClone(sidecar.elements[0]))
    if (failure === 'unknown-metadata') sidecar.elements[0].metadata.packageAuthority = { generation: 999 }
    const destination = await storeFor('sidecar-preflight-destination')
    const before = destination.getState()
    await expect(destination.importPresentationPackage(bundle, 'destination'))
      .rejects.toMatchObject({ code: 'INVALID_TRUSTED_IMPORT_METADATA' })
    expect(destination.getState()).toEqual(before)
    expect(await destination.listBlobFiles()).toEqual([])
    await source.releaseWriter()
    await destination.releaseWriter()
  })
})

async function bundleWithCanonicalProjection(source) {
  const { revision } = await source.commitOriginal(Buffer.from('publication-hook-original'), { ownerType: 'presentation', ownerId: 'source' })
  const projection = { id: 'source', title: 'Canonical intent', slides: [] }
  const sourceMap = { schemaVersion: 1, presentationId: 'source', revisionId: revision.id, packageGeneration: 1, entries: {} }
  await source.mutate((next) => {
    Object.assign(next.heads[0], { projectionRevisionId: hashRecord(projection), sourceMapRevisionId: hashRecord(sourceMap) })
    next.mutationResults.push({ schemaVersion: 1, operation: MUTATION_OPERATIONS.PACKAGE_IMPORT, presentationId: 'source', idempotencyKey: 'canonical-hook', generation: 1, packageRevisionId: revision.id, projection, sourceMap, state: 'committed' })
  })
  return source.exportPresentationPackage('source')
}

describe('portable durable publication intent', () => {
  it('awaits the exact head/projection intent and commits its compatibility row with the same package candidate', async () => {
    const source = await storeFor('publication-hook-source')
    const bundle = await bundleWithCanonicalProjection(source)
    const destination = await storeFor('publication-hook-destination')
    const intentPath = path.join(destination.rootDir, 'publication-intent.json')
    let compatibility
    const head = await destination.importPresentationPackage(bundle, 'destination', {
      beforePublication: async ({ head: planned, projection }) => {
        expect(destination.getState().heads).toEqual([])
        expect(projection).toMatchObject({ id: 'destination', title: 'Canonical intent' })
        expect(planned.projectionRevisionId).toBe(hashRecord(projection))
        await fs.writeFile(intentPath, JSON.stringify({ headHash: hashRecord(planned), projection }))
        compatibility = { ...projection, pptxAggregateHead: planned, _projectImport: { sessionId: 'durable-session' } }
        return compatibility
      },
    })
    const intent = JSON.parse(await fs.readFile(intentPath, 'utf8'))
    expect(intent.headHash).toBe(hashRecord(head))
    expect(destination.getState().compatibilityOutbox).toEqual([expect.objectContaining({ presentationId: 'destination', generation: head.generation, presentation: compatibility })])
    await destination.releaseWriter()
    const reopened = await openPackageStore({ rootDir: destination.rootDir })
    expect(reopened.getState().heads[0]).toEqual(head)
    expect(reopened.getState().compatibilityOutbox[0].presentation).toEqual(compatibility)
    await source.releaseWriter()
  })

  it.each(['reject', 'abort'])('does not publish a head/outbox when the intent callback fails: %s', async (failure) => {
    const source = await storeFor('publication-failed-source')
    const bundle = await bundleWithCanonicalProjection(source)
    const destination = await storeFor('publication-failed-destination')
    const before = destination.getState()
    const controller = new AbortController()
    const publication = destination.importPresentationPackage(bundle, 'destination', {
      signal: controller.signal,
      beforePublication: async ({ head, projection }) => {
        await fs.writeFile(path.join(destination.rootDir, 'failed-intent.json'), JSON.stringify({ head, projection }))
        if (failure === 'reject') throw Object.assign(new Error('Intent persistence fault'), { code: 'INTENT_PERSISTENCE_FAULT' })
        controller.abort()
        return projection
      },
    })
    await expect(publication).rejects.toMatchObject(failure === 'reject' ? { code: 'INTENT_PERSISTENCE_FAULT' } : { name: 'AbortError' })
    expect(destination.getState()).toEqual(before)
    await destination.releaseWriter()
    const reopened = await openPackageStore({ rootDir: destination.rootDir })
    expect(reopened.getState()).toEqual(before)
    await source.releaseWriter()
  })
})

describe('portable canonical root and child journal snapshots', () => {
  it('rebinds root/child media journal values and inventories retained root active content without replacing text', async () => {
    const { deriveMutationJournal, replayJournal } = require('../mutation-journal')
    const { validatePortableBundle } = require('./portable')
    const source = await storeFor('root-child-source')
    const { revision } = await source.commitOriginal(Buffer.from('root-child Original'), { ownerType: 'presentation', ownerId: 'source' })
    const before = { id: 'source', customJS: 'original-script', title: '/uploads/root-old.png', background: { type: 'image', image: '/uploads/root-old.png' }, slides: [{ id: 'parent', elements: [], children: [{ id: 'child', background: { type: 'image', image: '/uploads/child-old.png' }, elements: [] }] }] }
    const after = structuredClone(before)
    delete after.customJS
    after.background.image = '/uploads/root-pending.png'
    after.slides[0].children[0].background.image = '/uploads/child-pending.png'
    const sourceMap = { schemaVersion: 1, presentationId: 'source', revisionId: revision.id, packageGeneration: 1, entries: {} }
    await source.mutate((next) => {
      const journal = deriveMutationJournal(before, after, { sourceMap, baseRevisionId: revision.id, matrixAuthorityEpoch: next.matrixAuthorityEpoch })
      const pendingMap = { ...sourceMap, packageGeneration: 2 }
      Object.assign(next.heads[0], { generation: 2, projectionRevisionId: hashRecord(after), sourceMapRevisionId: hashRecord(pendingMap), journalRevisionId: journal.journalHash, pendingJournalHash: journal.journalHash })
      next.mutationResults.push(
        { schemaVersion: 1, operation: MUTATION_OPERATIONS.PACKAGE_IMPORT, presentationId: 'source', idempotencyKey: 'root-child-import', generation: 1, packageRevisionId: revision.id, projection: before, sourceMap, state: 'committed' },
        { schemaVersion: 1, operation: MUTATION_OPERATIONS.PROJECTION_SAVE, presentationId: 'source', idempotencyKey: 'root-child-save', generation: 2, packageRevisionId: revision.id, projection: after, sourceMap: pendingMap, journal, operationIds: journal.operations.map((operation) => operation.operationId), state: 'pending-edited-export' },
      )
    })
    const bundle = await source.exportPresentationPackage('source')
    const validated = validatePortableBundle(bundle)
    expect(validated.mediaProjections.some((projection) => projection.slides.length === 0 && projection.customJS === 'original-script')).toBe(true)
    const destination = await storeFor('root-child-destination')
    const mediaUrlMap = { '/uploads/root-old.png': '/uploads/new-root-old.png', '/uploads/root-pending.png': '/uploads/new-root-pending.png', '/uploads/child-old.png': '/uploads/new-child-old.png', '/uploads/child-pending.png': '/uploads/new-child-pending.png' }
    await destination.importPresentationPackage(bundle, 'destination', { mediaUrlMap })
    const context = resolveEditedExportContext(destination.getState(), 'destination')
    const result = destination.getState().mutationResults.find((item) => item.state === 'pending-edited-export')
    expect(result.journal.operations.find((operation) => operation.targetKind === 'presentation' && operation.property === 'background')).toMatchObject({ targetId: 'destination', before: { image: '/uploads/new-root-old.png' }, after: { image: '/uploads/new-root-pending.png' }, inverse: { value: { image: '/uploads/new-root-old.png' } } })
    expect(result.journal.operations.find((operation) => operation.targetKind === 'slide' && operation.slideId === 'child')).toMatchObject({ parentSlideId: 'parent', before: { image: '/uploads/new-child-old.png' }, after: { image: '/uploads/new-child-pending.png' } })
    expect(replayJournal(context.before, result.journal)).toEqual(context.after)
    expect(context.after.title).toBe('/uploads/root-old.png')
    expect(await destination.readOriginal(destination.getState().heads[0].originalRevisionId)).toEqual(Buffer.from('root-child Original'))
    await source.releaseWriter()
    await destination.releaseWriter()
  })
})
