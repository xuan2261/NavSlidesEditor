const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { openPackageStore } = require('./index')
const { validateMatrixAuthoritySubjects } = require('../canonical-feature-matrix')
const { hashRecord, RECORD_SCHEMA_VERSION } = require('./schemas')
const { resolveEditedExportContext } = require('../validated-edited-export-context')

const roots = []

async function createStore() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-lifecycle-'))
  roots.push(rootDir)
  const store = await openPackageStore({ rootDir })
  await store.acquireWriter()
  await store.commitOriginal(Buffer.from('package'), {
    ownerType: 'presentation',
    ownerId: 'deck-a',
  })
  return store
}

async function createAuthorityStore() {
  const store = await createStore()
  const head = store.getState().heads.find((item) => item.presentationId === 'deck-a')
  const projection = {
    id: 'deck-a',
    slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: 'before' }] }],
  }
  const sourceMap = {
    schemaVersion: 1,
    presentationId: 'deck-a',
    revisionId: head.packageRevisionId,
    packageGeneration: 1,
    entries: {
      's1:e1': {
        status: 'missing',
        packageGeneration: 1,
        revisionId: head.packageRevisionId,
        partUri: 'unknown',
        kind: 'text',
        relationshipChain: [],
        groupAncestry: [],
        occurrencePath: [],
        sourceHash: 'a'.repeat(64),
      },
    },
  }
  await store.mutate((next) => {
    const current = next.heads.find((item) => item.presentationId === 'deck-a')
    current.projectionRevisionId = hashRecord(projection)
    current.sourceMapRevisionId = hashRecord(sourceMap)
    next.mutationResults.push({
      schemaVersion: RECORD_SCHEMA_VERSION,
      operation: 'package-import',
      presentationId: 'deck-a',
      idempotencyKey: 'import-authority',
      generation: 1,
      packageRevisionId: head.packageRevisionId,
      projection,
      sourceMap,
      operationIds: [],
      state: 'committed',
    })
  })
  return store
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('package lifecycle ownership', () => {
  it('duplicates refs without copying bytes and quarantines without deleting bytes', async () => {
    const store = await createStore()
    const revisionId = store.getState().heads[0].packageRevisionId
    const before = await store.listBlobFiles()

    await store.duplicatePresentationOwner('deck-a', 'deck-b')
    await store.quarantinePresentation('deck-a', { compatibilityRemove: true })

    const state = store.getState()
    expect(state.heads.map((head) => head.presentationId)).toEqual(['deck-b'])
    expect(state.owners).toContainEqual(expect.objectContaining({
      revisionId,
      ownerType: 'presentation',
      ownerId: 'deck-b',
    }))
    expect(await store.listBlobFiles()).toEqual(before)
    expect(state.compatibilityOutbox).toEqual([
      expect.objectContaining({ operation: 'remove', presentationId: 'deck-a' }),
    ])
    await store.releaseWriter()
  })

  it('rebinds committed source authority when duplicating an imported package', async () => {
    const store = await createAuthorityStore()
    const duplicated = await store.duplicatePresentationOwner('deck-a', 'deck-b')
    const context = resolveEditedExportContext(store.getState(), 'deck-b')

    expect(duplicated).toMatchObject({ presentationId: 'deck-b', generation: 1 })
    expect(context).toMatchObject({
      ok: true,
      sourceMap: {
        presentationId: 'deck-b',
        packageGeneration: 1,
      },
    })
    expect(store.getState().mutationResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ presentationId: 'deck-b', state: 'committed' }),
    ]))
    const owned = store.getState().owners
      .filter((owner) => owner.ownerType === 'presentation' && owner.ownerId === 'deck-b')
      .map((owner) => owner.revisionId).sort()
    expect(owned).toEqual([...new Set([
      duplicated.originalRevisionId, duplicated.packageRevisionId,
      duplicated.projectionRevisionId, duplicated.sourceMapRevisionId,
    ])].sort())
    await store.releaseWriter()
  })

  it('keeps the duplicated package authority aligned with the destination projection', async () => {
    const store = await createAuthorityStore()
    const destination = {
      id: 'deck-b',
      title: 'Copied title',
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: 'before' }] }],
    }

    await store.duplicatePresentationOwner('deck-a', 'deck-b', { projection: destination })

    expect(resolveEditedExportContext(store.getState(), 'deck-b').after).toMatchObject({
      id: 'deck-b',
      title: 'Copied title',
    })
    await store.releaseWriter()
  })

  it('rejects duplicate while a pending package projection is present', async () => {
    const store = await createAuthorityStore()
    await store.mutate((next) => {
      next.heads.find((head) => head.presentationId === 'deck-a').pendingJournalHash = 'a'.repeat(64)
    })
    const before = store.getState()

    await expect(store.duplicatePresentationOwner('deck-a', 'deck-b')).rejects.toMatchObject({
      code: 'PACKAGE_PENDING_PROJECTION',
    })
    expect(store.getState()).toEqual(before)
    await store.releaseWriter()
  })

  it('rejects restore of a retained pending package projection', async () => {
    const store = await createAuthorityStore()
    await store.mutate((next) => {
      next.heads.find((head) => head.presentationId === 'deck-a').pendingJournalHash = 'b'.repeat(64)
    })
    await store.retainHead({ ownerType: 'history', ownerId: 'deck-a:pending' }, 'deck-a')

    await expect(store.restoreForward('deck-a', {
      ownerType: 'history',
      ownerId: 'deck-a:pending',
    })).rejects.toMatchObject({ code: 'PACKAGE_PENDING_PROJECTION' })
    await store.releaseWriter()
  })

  it('fences lifecycle publication when admission changes the source head', async () => {
    const store = await createAuthorityStore()

    await expect(store.duplicatePresentationOwner('deck-a', 'deck-b', {
      admissionPreflight: async () => {
        await store.mutate((next) => {
          next.heads.find((head) => head.presentationId === 'deck-a').generation += 1
        })
      },
    })).rejects.toMatchObject({ code: 'STALE_GENERATION' })
    expect(store.getState().heads.map((head) => head.presentationId)).toEqual(['deck-a'])
    await store.releaseWriter()
  })

  it('fences quarantine to a retained head when admission publishes a successor', async () => {
    const store = await createStore()
    const owner = { ownerType: 'permanent-delete', ownerId: 'deck-a' }
    const retained = await store.retainHead(owner, 'deck-a')

    await expect(store.quarantinePresentation('deck-a', {
      compatibilityRemove: true,
      expectedHead: retained,
      admissionPreflight: async () => {
        await store.mutate((next) => {
          next.heads.find((head) => head.presentationId === 'deck-a').generation += 1
        })
      },
    })).rejects.toMatchObject({ code: 'STALE_GENERATION', retryable: true })

    const state = store.getState()
    expect(state.heads).toEqual([
      expect.objectContaining({ presentationId: 'deck-a', generation: retained.generation + 1 }),
    ])
    expect(state.compatibilityOutbox).toEqual([])
    expect(state.owners).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerType: 'presentation', ownerId: 'deck-a' }),
    ]))
    await store.releaseOwner(owner)
    await store.releaseWriter()
  })

  it('replaces an older retained head when the same owner retains a successor', async () => {
    const store = await createStore()
    const owner = { ownerType: 'permanent-delete', ownerId: 'deck-a' }
    const first = await store.retainHead(owner, 'deck-a')
    await store.mutate((next) => {
      next.heads.find((head) => head.presentationId === 'deck-a').generation += 1
    })
    const current = store.getState().heads.find((head) => head.presentationId === 'deck-a')
    const retained = await store.retainHead(owner, 'deck-a', { expectedHead: current })

    const retainedRecords = store.getState().owners.filter((record) =>
      record.ownerType === owner.ownerType && record.ownerId === owner.ownerId
    )
    expect(retainedRecords).not.toHaveLength(0)
    expect(retainedRecords.every((record) =>
      hashRecord(record.retainedHead) === hashRecord(retained)
    )).toBe(true)
    expect(hashRecord(retained)).not.toBe(hashRecord(first))

    await store.quarantinePresentation('deck-a', { expectedHead: retained })
    const restored = await store.restoreQuarantinedHead(owner, 'deck-a')
    expect(hashRecord(restored)).toBe(hashRecord(retained))
    expect(restored.generation).toBe(current.generation)
    await store.releaseOwner(owner)
    await store.releaseWriter()
  })

  it('rejects restore when the expected current head advanced after snapshot', async () => {
    const store = await createAuthorityStore()
    await store.retainHead({ ownerType: 'history', ownerId: 'deck-a:s1' }, 'deck-a')
    const expectedCurrentHead = structuredClone(store.getState().heads[0])
    await store.mutate((next) => {
      next.heads[0].generation += 1
    })

    await expect(store.restoreForward('deck-a', {
      ownerType: 'history',
      ownerId: 'deck-a:s1',
    }, { expectedCurrentHead })).rejects.toMatchObject({ code: 'STALE_GENERATION' })
    expect(store.getState().heads[0].generation).toBe(expectedCurrentHead.generation + 1)
    await store.releaseWriter()
  })

  it('rebinds retained authority to the restored generation', async () => {
    const store = await createAuthorityStore()
    await store.retainHead({ ownerType: 'history', ownerId: 'deck-a:s1' }, 'deck-a')
    const prior = store.getState().heads.find((item) => item.presentationId === 'deck-a')
    const restored = await store.restoreForward('deck-a', {
      ownerType: 'history',
      ownerId: 'deck-a:s1',
    }, { compatibilityPresentation: { id: 'deck-a', slides: [] } })
    const context = resolveEditedExportContext(store.getState(), 'deck-a')

    expect(restored.generation).toBe(prior.generation + 1)
    expect(context).toMatchObject({
      ok: true,
      sourceMap: {
        presentationId: 'deck-a',
        packageGeneration: restored.generation,
      },
    })
    await store.releaseWriter()
  })

  it('retains history and template revisions and restores forward', async () => {
    const store = await createStore()
    await store.retainHead({ ownerType: 'history', ownerId: 'deck-a:s1' }, 'deck-a')
    await store.retainHead({ ownerType: 'template', ownerId: 'template-a' }, 'deck-a')
    const prior = store.getState().heads[0]

    const restored = await store.restoreForward('deck-a', {
      ownerType: 'history',
      ownerId: 'deck-a:s1',
    }, {
      compatibilityPresentation: { id: 'deck-a', title: 'Restored', slides: [] },
    })

    expect(restored.generation).toBe(prior.generation + 1)
    expect(restored.matrixAuthorityEpoch).toBe(prior.matrixAuthorityEpoch + 1)
    expect(validateMatrixAuthoritySubjects(
      prior.matrixAuthoritySubjects, undefined, restored.matrixAuthorityEpoch
    ).authorized).toBe(false)
    expect(validateMatrixAuthoritySubjects(
      restored.matrixAuthoritySubjects, undefined, restored.matrixAuthorityEpoch
    ).authorized).toBe(true)
    expect(store.getState().compatibilityOutbox).toEqual([
      expect.objectContaining({
        operation: 'upsert',
        presentationId: 'deck-a',
        generation: restored.generation,
        presentation: expect.objectContaining({
          pptxAggregateHead: expect.objectContaining({ generation: restored.generation }),
        }),
      }),
    ])
    expect(restored.predecessorId).toMatch(/^[a-f0-9]{64}$/)
    expect(store.getState().owners).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerType: 'history', ownerId: 'deck-a:s1' }),
      expect.objectContaining({ ownerType: 'template', ownerId: 'template-a' }),
    ]))
    await store.releaseWriter()
  })

  it('refreshes Original-only publication heads without replacing metadata or creating ghost rows', async () => {
    const { applyCompatibilityWrites } = require('../compatibility-view')
    const { resolvePackageBackedReadFromState } = require('../../package-backed-presentation-read')
    const store = await createAuthorityStore()
    const history = { ownerType: 'history', ownerId: 'deck-a:original-only-refresh' }
    await store.retainHead(history, 'deck-a')
    await store.commitOriginal(Buffer.from('unrelated Original'), { ownerType: 'presentation', ownerId: 'deck-b' })
    await store.commitOriginal(Buffer.from('unpublished Original'), { ownerType: 'presentation', ownerId: 'deck-c' })
    const oldHead = store.getState().heads.find((head) => head.presentationId === 'deck-b')
    const metadata = {
      id: 'deck-b', title: 'Keep title', description: 'Keep description',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
      pptxOriginal: { filename: 'original.pptx' }, _pptxImportReport: { warnings: ['retained'] },
      slides: [{ id: 'media-slide', elements: [{ id: 'image', type: 'image', src: '/uploads/owned.png' }] }],
    }
    const rows = [{ ...structuredClone(metadata), pptxAggregateHead: oldHead }]
    const owners = store.getState().owners.filter((owner) => owner.ownerId === 'deck-b')
    await store.restoreForward('deck-a', history)
    const state = store.getState()
    applyCompatibilityWrites(rows, state.compatibilityOutbox)
    const currentHead = state.heads.find((head) => head.presentationId === 'deck-b')
    expect(currentHead.matrixAuthorityEpoch).toBe(oldHead.matrixAuthorityEpoch + 1)
    expect(rows.find((row) => row.id === 'deck-b')).toEqual({ ...metadata, pptxAggregateHead: currentHead })
    expect(rows.some((row) => row.id === 'deck-c')).toBe(false)
    expect(resolvePackageBackedReadFromState(state, 'deck-b', rows.find((row) => row.id === 'deck-b')))
      .toMatchObject({ generation: oldHead.generation, presentation: metadata })
    expect(state.owners.filter((owner) => owner.ownerId === 'deck-b')).toEqual(owners)
    expect(await store.readOriginal(currentHead.originalRevisionId)).toEqual(Buffer.from('unrelated Original'))
    await store.releaseWriter()
  })

  it('reissues authority to every live head during restore-forward', async () => {
    const store = await createStore()
    await store.duplicatePresentationOwner('deck-a', 'deck-b')
    await store.retainHead({ ownerType: 'history', ownerId: 'deck-a:s1' }, 'deck-a')

    const restored = await store.restoreForward('deck-a', {
      ownerType: 'history',
      ownerId: 'deck-a:s1',
    })
    const state = store.getState()

    expect(restored.matrixAuthorityEpoch).toBe(state.matrixAuthorityEpoch)
    expect(state.heads).toHaveLength(2)
    expect(state.heads).toEqual(expect.arrayContaining([
      expect.objectContaining({
        presentationId: 'deck-b',
        matrixAuthorityEpoch: state.matrixAuthorityEpoch,
      }),
    ]))
    expect(state.heads.every((head) => validateMatrixAuthoritySubjects(
      head.matrixAuthoritySubjects, undefined, state.matrixAuthorityEpoch
    ).authorized)).toBe(true)
    await store.releaseWriter()
  })

  it('runs admission before mutation and preserves publication on injected fault', async () => {
    const store = await createStore()
    const initial = store.getState()
    await expect(store.duplicatePresentationOwner('deck-a', 'deck-b', {
      admissionPreflight: () => {
        throw Object.assign(new Error('quota exceeded'), { code: 'QUOTA_EXCEEDED' })
      },
    })).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
    expect(store.getState()).toEqual(initial)

    await expect(store.duplicatePresentationOwner('deck-a', 'deck-b', {
      faultAfterPrepare: true,
    })).rejects.toThrow()
    expect(store.getState()).toEqual(initial)
    await store.releaseWriter()
  })

  it('rejects retaining a head when its expected source changed', async () => {
    const store = await createStore()
    const expectedHead = structuredClone(store.getState().heads[0])
    await store.mutate((next) => {
      next.heads[0].generation += 1
    })

    await expect(store.retainHead(
      { ownerType: 'history', ownerId: 'deck-a:stale' },
      'deck-a',
      { expectedHead }
    )).rejects.toMatchObject({ code: 'STALE_GENERATION' })
    expect(store.getState().owners.some((owner) => owner.ownerId === 'deck-a:stale')).toBe(false)
    await store.releaseWriter()
  })

  it('rejects duplicate publication when its expected source head changed', async () => {
    const store = await createStore()
    const expectedSourceHead = structuredClone(store.getState().heads[0])
    await store.mutate((next) => {
      next.heads[0].generation += 1
    })

    await expect(store.duplicatePresentationOwner('deck-a', 'deck-b', {
      expectedSourceHead,
    })).rejects.toMatchObject({ code: 'STALE_GENERATION' })
    expect(store.getState().heads.map((head) => head.presentationId)).toEqual(['deck-a'])
    await store.releaseWriter()
  })

  it('requires all retained revisions to belong to one aggregate head', async () => {
    const store = await createStore()
    await store.mutate((next) => {
      Object.assign(next.heads[0], {
        projectionRevisionId: 'projection-v1',
        sourceMapRevisionId: 'source-map-v1',
      })
    })
    const retained = await store.retainHead(
      { ownerType: 'history', ownerId: 'deck-a:s1' },
      'deck-a'
    )
    await store.mutate((next) => {
      next.owners = next.owners.filter((owner) => owner.revisionId !== retained.sourceMapRevisionId)
      next.owners.push({
        schemaVersion: 1,
        revisionId: retained.sourceMapRevisionId,
        ownerType: 'history',
        ownerId: 'deck-a:s1',
        retainedHead: { ...retained, journalRevisionId: 'other-journal' },
      })
    })

    await expect(store.restoreForward('deck-a', {
      ownerType: 'history', ownerId: 'deck-a:s1',
    })).resolves.toBeNull()
    await store.releaseWriter()
  })

  it('replaces displaced presentation owners when restoring forward', async () => {
    const store = await createStore()
    const retained = await store.retainHead(
      { ownerType: 'history', ownerId: 'deck-a:s1' },
      'deck-a'
    )
    await store.mutate((next) => {
      next.owners.push({
        schemaVersion: 1,
        revisionId: 'displaced-revision',
        ownerType: 'presentation',
        ownerId: 'deck-a',
      })
    })

    await store.restoreForward('deck-a', { ownerType: 'history', ownerId: 'deck-a:s1' })

    const retainedRevisionIds = new Set([
      retained.originalRevisionId,
      retained.projectionRevisionId,
      retained.packageRevisionId,
      retained.sourceMapRevisionId,
      retained.journalRevisionId,
    ].filter(Boolean))
    expect(store.getState().owners
      .filter((owner) => owner.ownerType === 'presentation' && owner.ownerId === 'deck-a')
      .every((owner) => retainedRevisionIds.has(owner.revisionId))).toBe(true)
    await store.releaseWriter()
  })

  it('rejects restoring retained projected authority without an exact mutation result', async () => {
    const store = await createStore()
    await store.mutate((next) => {
      Object.assign(next.heads[0], {
        projectionRevisionId: 'projection-v1',
        sourceMapRevisionId: 'source-map-v1',
        journalRevisionId: 'journal-v1',
        evidence: { editedExport: 'verified' },
      })
    })
    await store.retainHead(
      { ownerType: 'history', ownerId: 'deck-a:s1' },
      'deck-a'
    )

    await expect(store.restoreForward('deck-a', {
      ownerType: 'history',
      ownerId: 'deck-a:s1',
    })).rejects.toMatchObject({ code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE' })
    expect(store.getState().heads[0].generation).toBe(1)
    await store.releaseWriter()
  })

  it.each(['projected', 'Original-only'])('repairs durable compatibility fences after unpublished restore high-water recovery (%s)', async (kind) => {
    const { applyCompatibilityWrites } = require('../compatibility-view')
    const { drainCompatibilityOutbox } = require('../compatibility-outbox')
    const { resolvePackageBackedReadFromState } = require('../../package-backed-presentation-read')
    const store = await createAuthorityStore()
    const history = { ownerType: 'history', ownerId: 'deck-a:unpublished-restore' }
    await store.retainHead(history, 'deck-a')
    if (kind === 'projected') await store.duplicatePresentationOwner('deck-a', 'deck-b')
    else await store.commitOriginal(Buffer.from('unrelated Original'), {
      ownerType: 'presentation', ownerId: 'deck-b',
    })
    const before = store.getState()
    const oldHead = before.heads.find((head) => head.presentationId === 'deck-b')
    const metadata = {
      ...(kind === 'projected' ? resolveEditedExportContext(before, 'deck-b').after : { slides: [] }),
      id: 'deck-b', title: 'Keep unrelated title',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
      _pptxImportReport: { warnings: ['retained'] },
    }
    const oldRow = { ...metadata, pptxAggregateHead: oldHead }
    const rows = [structuredClone(oldRow)]
    const original = await store.readOriginal(oldHead.originalRevisionId)
    expect(resolvePackageBackedReadFromState(before, 'deck-b', oldRow).generation).toBe(1)
    await expect(store.restoreForward('deck-a', history, { faultAfterPrepare: true })).rejects.toThrow()
    expect(store.getState()).toEqual(before)
    await store.releaseWriter()

    const reopened = await openPackageStore({ rootDir: store.rootDir })
    await reopened.acquireWriter()
    try {
      const recovered = reopened.getState()
      const current = recovered.heads.find((head) => head.presentationId === 'deck-b')
      expect(recovered.matrixAuthorityEpoch).toBeGreaterThan(before.matrixAuthorityEpoch)
      expect(current).toMatchObject({ generation: oldHead.generation, matrixAuthorityEpoch: recovered.matrixAuthorityEpoch })
      expect(current.matrixAuthoritySubjects).not.toEqual(oldHead.matrixAuthoritySubjects)
      expect(validateMatrixAuthoritySubjects(oldHead.matrixAuthoritySubjects, undefined, recovered.matrixAuthorityEpoch).authorized).toBe(false)
      expect(() => resolvePackageBackedReadFromState(recovered, 'deck-b', oldRow))
        .toThrow('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
      const root = JSON.parse(await fs.readFile(path.join(store.rootDir, 'state-root.json'), 'utf8'))
      const published = JSON.parse(await fs.readFile(path.join(store.rootDir, root.stateFile), 'utf8'))
      expect(published.compatibilityOutbox).toEqual(recovered.compatibilityOutbox)
      expect(published.heads).toEqual(recovered.heads)
      expect(recovered.compatibilityOutbox).toEqual(expect.arrayContaining([
        expect.objectContaining({ presentationId: 'deck-b', generation: oldHead.generation }),
      ]))
      await drainCompatibilityOutbox(reopened, async (writes) => applyCompatibilityWrites(rows, writes))
      expect(rows).toEqual([{ ...metadata, pptxAggregateHead: current }])
      expect(resolvePackageBackedReadFromState(reopened.getState(), 'deck-b', rows[0]))
        .toMatchObject({ generation: oldHead.generation, presentation: { id: 'deck-b', slides: metadata.slides } })
      expect(await reopened.readOriginal(current.originalRevisionId)).toEqual(original)
      expect(reopened.getState().owners).toEqual(before.owners)
    } finally { await reopened.releaseWriter() }

    const durable = await openPackageStore({ rootDir: store.rootDir })
    expect(durable.getState().compatibilityOutbox).toEqual([])
    expect(resolvePackageBackedReadFromState(durable.getState(), 'deck-b', rows[0]).generation).toBe(1)
  })

  it('refreshes unpublished canonical template heads without manufacturing rows and preserves explicit pending publication', async () => {
    const { applyCompatibilityWrites } = require('../compatibility-view')
    const { drainCompatibilityOutbox } = require('../compatibility-outbox')
    const { resolvePackageBackedReadFromState } = require('../../package-backed-presentation-read')
    const store = await createAuthorityStore()
    try {
      const template = { ownerType: 'template', ownerId: 'template-source' }
      const history = { ownerType: 'history', ownerId: 'deck-a:template-interleaving' }
      await store.retainHead(template, 'deck-a')
      await store.retainHead(history, 'deck-a')
      const before = store.getState()
      const retained = before.owners.filter((owner) => owner.ownerType !== 'presentation')
      const projection = { ...resolveEditedExportContext(before, 'deck-a').after, id: 'template-destination' }
      // The route's row insertion follows this durable head creation. Hold that
      // boundary explicitly while another restore publishes and drains.
      await store.instantiateRetainedHead(template, projection.id, { projection })
      const pendingProjection = { ...projection, id: 'explicit-pending', title: 'Admitted pending publication' }
      await store.instantiateRetainedHead(template, pendingProjection.id, {
        projection: pendingProjection, compatibilityPresentation: pendingProjection,
      })
      const rows = []
      expect(rows).toHaveLength(0)
      await store.restoreForward('deck-a', history)
      const state = store.getState()
      await drainCompatibilityOutbox(store, async (writes) => applyCompatibilityWrites(rows, writes))
      expect(rows.filter((row) => row.id === projection.id)).toEqual([])
      const pending = rows.filter((row) => row.id === pendingProjection.id)
      expect(pending).toHaveLength(1)
      expect(pending[0]).toMatchObject({ title: pendingProjection.title })
      expect(resolvePackageBackedReadFromState(state, pendingProjection.id, pending[0]).generation).toBe(1)
      expect(state.owners.filter((owner) => owner.ownerType !== 'presentation')).toEqual(retained)
      const destination = state.heads.find((head) => head.presentationId === projection.id)
      expect(resolveEditedExportContext(state, projection.id)).toMatchObject({ ok: true, after: projection })
      expect(destination.journalRevisionId).toBe(before.heads[0].journalRevisionId)
      // Resume the destination publication with its current fenced identity.
      rows.push({ ...projection, pptxAggregateHead: destination })
      expect(rows.filter((row) => row.id === projection.id)).toHaveLength(1)
      expect(resolvePackageBackedReadFromState(state, projection.id, rows.find((row) => row.id === projection.id)))
        .toMatchObject({ generation: 1, presentation: { slides: projection.slides } })
    } finally { await store.releaseWriter() }
  })
})
