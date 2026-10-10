const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const JSZip = require('jszip')
const { openPackageStore } = require('./index')
const { queueCompatibilityUpsert } = require('../compatibility-outbox')
const { hashRecord } = require('./schemas')

const resources = []
async function fixture() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-p07-acceptance-'))
  const store = await openPackageStore({ rootDir })
  resources.push({ rootDir, store })
  await store.acquireWriter()
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('ppt/presentation.xml', '<p:presentation/>')
  const bytes = await zip.generateAsync({ type: 'nodebuffer' })
  const presentation = { id: 'source', title: 'Source', slides: [] }
  const imported = await store.commitImport(bytes, {
    jobId: 'source-job', presentationId: 'source', projection: presentation,
    sourceMap: { entries: {} }, compatibilityPresentation: presentation,
  })
  return { rootDir, store, bytes, imported, presentation }
}
afterEach(async () => {
  for (const { rootDir, store } of resources.splice(0)) {
    await store.releaseWriter()
    await fs.rm(rootDir, { recursive: true, force: true })
  }
})

describe('P07 explicit publication acceptance regressions', () => {
  it.each([
    ['schema', (write) => { write.schemaVersion = -1 }],
    ['generation', (write) => { write.generation = 0 }],
    ['operation', (write) => { write.operation = 'unknown' }],
    ['destination', (write) => { write.presentation.id = 'wrong-destination' }],
  ])('P07-04 rejects malformed outbox %s without publishing success or losing Original', async (_name, corrupt) => {
    const { rootDir, store, bytes, imported } = await fixture()
    const before = store.getState()
    const rootBefore = await fs.readFile(path.join(rootDir, 'state-root.json'))
    await expect(store.mutate((next) => {
      corrupt(next.compatibilityOutbox[0])
    })).rejects.toThrow(/Invalid compatibility/)
    expect(store.getState()).toEqual(before)
    expect(await fs.readFile(path.join(rootDir, 'state-root.json'))).toEqual(rootBefore)
    const reopened = await openPackageStore({ rootDir })
    expect(reopened.getState()).toEqual(before)
    expect(await reopened.readOriginal(imported.head.originalRevisionId)).toEqual(bytes)
  })

  it('P07-06 rejects a template head changed at admission with no partial destination or stale replay', async () => {
    const { rootDir, store, bytes, imported, presentation } = await fixture()
    const template = { ownerType: 'template', ownerId: 'template-source' }
    await store.retainHead(template, 'source')
    let winner
    await expect(store.instantiateRetainedHead(template, 'destination', {
      projection: { ...presentation, id: 'destination' }, requireProjectionMatch: true,
      compatibilityPresentation: { ...presentation, id: 'destination' },
      admissionPreflight: async () => {
        await store.mutate((next) => {
          const source = next.heads.find((head) => head.presentationId === 'source')
          source.generation += 1
          queueCompatibilityUpsert(next, {
            presentationId: 'source', generation: source.generation,
            presentation: { ...presentation, pptxAggregateHead: source },
          })
        })
        await store.retainHead(template, 'source')
        winner = store.getState()
      },
    })).rejects.toMatchObject({ code: 'STALE_GENERATION', status: 409 })
    expect(store.getState()).toEqual(winner)
    const reopened = await openPackageStore({ rootDir })
    expect(reopened.getState()).toEqual(winner)
    for (const state of [store.getState(), reopened.getState()]) {
      expect(state.heads.some((head) => head.presentationId === 'destination')).toBe(false)
      expect(state.owners.some((owner) => owner.ownerId === 'destination')).toBe(false)
      expect(state.mutationResults.some((result) => result.presentationId === 'destination')).toBe(false)
      expect(state.compatibilityOutbox.some((write) => write.presentationId === 'destination')).toBe(false)
      expect(state.compatibilityDeadLetter).toEqual([])
    }
    expect(await reopened.readOriginal(imported.head.originalRevisionId)).toEqual(bytes)
  })
  it('P07-05 refuses pending retained-template instantiation without a partial destination', async () => {
    const { rootDir, store, bytes, imported, presentation } = await fixture()
    await store.mutate((next) => {
      next.heads[0].pendingJournalHash = hashRecord({ state: 'pending-edited-export' })
    })
    const template = { ownerType: 'template', ownerId: 'pending-template' }
    await store.retainHead(template, 'source')
    const before = store.getState()
    const rootBefore = await fs.readFile(path.join(rootDir, 'state-root.json'))
    await expect(store.instantiateRetainedHead(template, 'destination', {
      projection: { ...presentation, id: 'destination' },
      compatibilityPresentation: { ...presentation, id: 'destination' },
    })).rejects.toMatchObject({ code: 'PACKAGE_PENDING_PROJECTION' })
    expect(store.getState()).toEqual(before)
    expect(await fs.readFile(path.join(rootDir, 'state-root.json'))).toEqual(rootBefore)
    const reopened = await openPackageStore({ rootDir })
    expect(reopened.getState()).toEqual(before)
    expect(await reopened.readOriginal(imported.head.originalRevisionId)).toEqual(bytes)
  })
  it.each(['template', 'duplicate'])('rejects a %s destination acquired by another writer during admission', async kind => {
    const { store, presentation } = await fixture()
    const template = { ownerType: 'template', ownerId: 'admitted-template' }
    await store.retainHead(template, 'source')
    let winner
    const options = {
      projection: { ...presentation, id: 'destination' },
      admissionPreflight: async () => {
        await store.commitOriginal(Buffer.from('winner-original'), { ownerType: 'presentation', ownerId: 'destination' })
        winner = store.getState()
      },
    }
    const operation = kind === 'template'
      ? store.instantiateRetainedHead(template, 'destination', options)
      : store.duplicatePresentationOwner('source', 'destination', options)
    await expect(operation).rejects.toMatchObject({ code: 'STALE_GENERATION', status: 409 })
    expect(store.getState()).toEqual(winner)
    const head = winner.heads.find(item => item.presentationId === 'destination')
    expect(await store.readOriginal(head.originalRevisionId)).toEqual(Buffer.from('winner-original'))
  })
})
