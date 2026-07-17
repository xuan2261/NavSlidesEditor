const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { openPackageStore } = require('./index')
const { validateMatrixAuthoritySubjects } = require('../canonical-feature-matrix')

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

  it('restores the retained aggregate head as a new forward generation', async () => {
    const store = await createStore()
    await store.mutate((next) => {
      Object.assign(next.heads[0], {
        projectionRevisionId: 'projection-v1',
        sourceMapRevisionId: 'source-map-v1',
        journalRevisionId: 'journal-v1',
        evidence: { editedExport: 'verified' },
      })
    })
    const retained = await store.retainHead(
      { ownerType: 'history', ownerId: 'deck-a:s1' },
      'deck-a'
    )

    await store.mutate((next) => {
      Object.assign(next.heads[0], {
        projectionRevisionId: 'projection-v2',
        sourceMapRevisionId: 'source-map-v2',
        journalRevisionId: 'journal-v2',
        evidence: { editedExport: 'unproven' },
      })
    })
    const current = store.getState().heads[0]
    const restored = await store.restoreForward('deck-a', {
      ownerType: 'history',
      ownerId: 'deck-a:s1',
    })

    expect(restored).toMatchObject({
      originalRevisionId: retained.originalRevisionId,
      projectionRevisionId: retained.projectionRevisionId,
      sourceMapRevisionId: retained.sourceMapRevisionId,
      journalRevisionId: retained.journalRevisionId,
      evidence: retained.evidence,
      generation: current.generation + 1,
      predecessorId: expect.any(String),
    })
    await store.releaseWriter()
  })
})
