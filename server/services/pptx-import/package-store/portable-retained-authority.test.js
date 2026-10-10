const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { openPackageStore } = require('./index')
const { hashRecord } = require('./schemas')
const { resolveEditedExportContext } = require('../validated-edited-export-context')

const resources = []
async function storeFor(id, title) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-portable-retained-'))
  const store = await openPackageStore({ rootDir })
  resources.push({ store, rootDir })
  await store.acquireWriter()
  if (title === undefined) return store
  const { revision } = await store.commitOriginal(Buffer.from(title), {
    ownerType: 'presentation', ownerId: id,
  })
  const projection = { id, title, slides: [] }
  const sourceMap = {
    schemaVersion: 1, presentationId: id, revisionId: revision.id,
    packageGeneration: 1, entries: {},
  }
  await store.mutate((next) => {
    const head = next.heads.find((item) => item.presentationId === id)
    head.projectionRevisionId = hashRecord(projection)
    head.sourceMapRevisionId = hashRecord(sourceMap)
    next.mutationResults.push({
      schemaVersion: 1, operation: 'package-import', presentationId: id,
      idempotencyKey: `import-${id}`, generation: 1, packageRevisionId: revision.id,
      projection, sourceMap, state: 'committed',
    })
  })
  return store
}

afterEach(async () => {
  for (const { store, rootDir } of resources.splice(0)) {
    await store.releaseWriter()
    await fs.rm(rootDir, { recursive: true, force: true })
  }
})

describe('portable retained and supplied authority', () => {
  it('keeps snapshot restore and template instantiation readable after replacement', async () => {
    const source = await storeFor('source', 'Incoming')
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('destination', 'Previous')
    const previous = destination.getState().heads[0]
    const history = { ownerType: 'history', ownerId: 'destination:snapshot' }
    const template = { ownerType: 'template', ownerId: 'previous-template' }
    await destination.retainHead(history, 'destination')
    await destination.retainHead(template, 'destination')

    const imported = await destination.importPresentationPackage(bundle, 'destination', {
      replace: true, expectedHead: previous,
    })
    expect(resolveEditedExportContext(destination.getState(), 'destination').after.title)
      .toBe('Incoming')
    const instantiated = await destination.instantiateRetainedHead(template, 'from-template')
    expect(resolveEditedExportContext(destination.getState(), 'from-template'))
      .toMatchObject({ ok: true, after: { id: 'from-template', title: 'Previous' } })
    expect(destination.getState().owners
      .filter((owner) => owner.ownerType === 'presentation' && owner.ownerId === 'from-template')
      .map((owner) => owner.revisionId).sort())
      .toEqual([...new Set([instantiated.originalRevisionId, instantiated.packageRevisionId,
        instantiated.projectionRevisionId, instantiated.sourceMapRevisionId,
        instantiated.journalRevisionId].filter(Boolean))].sort())
    const current = destination.getState().heads.find((head) => head.presentationId === 'destination')
    const restored = await destination.restoreForward('destination', history, {
      expectedCurrentHead: current,
    })
    expect(restored.generation).toBe(imported.generation + 1)
    expect(resolveEditedExportContext(destination.getState(), 'destination'))
      .toMatchObject({ ok: true, after: { id: 'destination', title: 'Previous' } })
    expect(await destination.readOriginal(previous.originalRevisionId))
      .toEqual(Buffer.from('Previous'))
  })

  it.each(['foreign-revision', 'foreign-generation', 'unsupported-schema'])(
    'rejects supplied %s instead of normalizing it into destination authority',
    async (mismatch) => {
      const source = await storeFor('source', 'Incoming')
      const bundle = await source.exportPresentationPackage('source')
      const result = bundle.manifest.mutationResults[0]
      const map = result.sourceMap
      map.entries['s1:e1'] = {
        status: 'missing', revisionId: result.packageRevisionId,
        packageGeneration: result.generation, partUri: 'unknown', kind: 'text',
        relationshipChain: [], groupAncestry: [], occurrencePath: [],
        sourceHash: 'a'.repeat(64),
      }
      if (mismatch === 'foreign-revision') map.entries['s1:e1'].revisionId = 'foreign'
      else if (mismatch === 'foreign-generation') map.entries['s1:e1'].packageGeneration += 1
      else map.schemaVersion = 2
      bundle.manifest.head.sourceMapRevisionId = hashRecord(map)
      const destination = await storeFor('destination')
      const before = destination.getState()

      await expect(destination.importPresentationPackage(bundle, 'destination'))
        .rejects.toMatchObject({ code: 'PACKAGE_AUTHORITY_UNAVAILABLE' })
      expect(destination.getState()).toEqual(before)
      expect(await destination.listBlobFiles()).toEqual([])
    }
  )
})
