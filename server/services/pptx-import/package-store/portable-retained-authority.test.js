const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { openPackageStore } = require('./index')
const { hashRecord } = require('./schemas')
const { resolveEditedExportContext } = require('../validated-edited-export-context')
const { resolveEditorProjectionContext } = require('../package-authority-snapshot')

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
  it('retains older-package journal references when only the current committed authority is exported', async () => {
    const { deriveMutationJournal } = require('../mutation-journal')
    const { buildImportSourceMap, rebindSourceMap } = require('../source-map')
    const source = await storeFor('source', 'Original')
    const original = source.getState().heads[0].originalRevisionId
    const before = { id: 'source', title: 'Original', slides: [{ id: 's1', elements: [
      { id: 'e1', type: 'shape', x: 1, y: 2, width: 30, height: 40 },
    ] }] }
    const after = structuredClone(before)
    after.slides[0].elements[0].x = 4
    const baselineMap = await buildImportSourceMap(before, null, null, {
      revisionId: original, packageGeneration: 1,
    })
    for (const bytes of ['intermediate package', 'current package']) {
      await source.commitOriginal(Buffer.from(bytes), { ownerType: 'presentation', ownerId: 'source' })
    }
    await source.mutate((next) => {
      const head = next.heads.find((item) => item.presentationId === 'source')
      const sourceMap = rebindSourceMap(baselineMap, {
        presentationId: 'source', revisionId: head.packageRevisionId, packageGeneration: head.generation,
      })
      const journal = deriveMutationJournal(before, after, {
        sourceMap: baselineMap, baseRevisionId: original, matrixAuthorityEpoch: next.matrixAuthorityEpoch,
      })
      Object.assign(head, { originalRevisionId: original, projectionRevisionId: hashRecord(after),
        sourceMapRevisionId: hashRecord(sourceMap), journalRevisionId: journal.journalHash })
      next.mutationResults.push({ schemaVersion: 1, operation: 'validated-edited-export',
        presentationId: 'source', idempotencyKey: 'current-committed', generation: head.generation,
        packageRevisionId: head.packageRevisionId, projection: after, sourceMap, journal,
        operationIds: journal.operations.map((operation) => operation.operationId), state: 'committed' })
    })
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('destination')
    await destination.importPresentationPackage(bundle, 'destination')

    const roundtrip = await destination.exportPresentationPackage('destination')
    expect(roundtrip.manifest.mutationResults[0].journal.operations[0].sourceRef)
      .toMatchObject({ revisionId: original, packageGeneration: 1 })
    expect(resolveEditorProjectionContext(destination.getState(), 'destination'))
      .toMatchObject({ ok: true, after: { id: 'destination', slides: [{ elements: [{ x: 4 }] }] } })
    expect(await destination.readOriginal(roundtrip.manifest.head.originalRevisionId))
      .toEqual(Buffer.from('Original'))
  })

  it.each([false, true])('keeps multi-save undo/redo authority readable after portable import (replace=%s)', async (replace) => {
    const { deriveMutationJournal } = require('../mutation-journal')
    const { rebindSourceMap } = require('../source-map')
    const source = await storeFor('source', 'Initial')
    const originalBundle = await source.exportPresentationPackage('source')
    for (const title of ['Edited', 'Initial', 'Edited']) {
      await source.mutate((next) => {
        const head = next.heads.find((item) => item.presentationId === 'source')
        const before = next.mutationResults.find((item) => item.generation === head.generation)
        const after = { ...before.projection, title }
        const journal = deriveMutationJournal(before.projection, after, {
          sourceMap: before.sourceMap, baseRevisionId: head.packageRevisionId,
          matrixAuthorityEpoch: next.matrixAuthorityEpoch,
        })
        const generation = head.generation + 1
        const sourceMap = rebindSourceMap(before.sourceMap, {
          presentationId: 'source', revisionId: head.packageRevisionId, packageGeneration: generation,
        })
        Object.assign(head, { generation, projectionRevisionId: hashRecord(after),
          sourceMapRevisionId: hashRecord(sourceMap), journalRevisionId: journal.journalHash,
          pendingJournalHash: journal.journalHash })
        next.mutationResults.push({ schemaVersion: 1, operation: 'projection-save', presentationId: 'source',
          idempotencyKey: `save-${generation}`, generation, packageRevisionId: head.packageRevisionId,
          projection: after, sourceMap, journal, state: 'pending-edited-export',
          operationIds: journal.operations.map((operation) => operation.operationId) })
      })
    }
    expect(resolveEditorProjectionContext(source.getState(), 'source')).toMatchObject({ ok: true })
    const bundle = await source.exportPresentationPackage('source')
    const frozen = JSON.stringify(bundle)
    const destination = await storeFor('destination')
    if (replace) await destination.importPresentationPackage(originalBundle, 'destination')
    const previous = destination.getState().heads[0]
    await destination.importPresentationPackage(bundle, 'destination', replace ? {
      replace: true, expectedHead: previous,
    } : {})

    expect(resolveEditorProjectionContext(destination.getState(), 'destination'))
      .toMatchObject({ ok: true, after: { id: 'destination', title: 'Edited' } })
    expect(await destination.readOriginal(destination.getState().heads[0].originalRevisionId))
      .toEqual(Buffer.from('Initial'))
    expect(JSON.stringify(bundle)).toBe(frozen)
    expect(resolveEditorProjectionContext(source.getState(), 'source'))
      .toMatchObject({ ok: true, after: { id: 'source', title: 'Edited' } })
  })

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

  it.each([false, true])('keeps a restored deck readable after portable import (replace=%s)', async (replace) => {
    const source = await storeFor('source', 'Restored content')
    const history = { ownerType: 'history', ownerId: 'source:snapshot' }
    await source.retainHead(history, 'source')
    await source.restoreForward('source', history, {
      expectedCurrentHead: source.getState().heads[0],
    })
    const bundle = await source.exportPresentationPackage('source')
    const destination = await storeFor('destination', replace ? 'Previous content' : undefined)
    await destination.importPresentationPackage(bundle, 'destination', replace ? {
      replace: true, expectedHead: destination.getState().heads[0],
    } : {})

    expect(resolveEditorProjectionContext(destination.getState(), 'destination'))
      .toMatchObject({ ok: true, after: { id: 'destination', title: 'Restored content' } })
    expect(await destination.readOriginal(destination.getState().heads[0].originalRevisionId))
      .toEqual(Buffer.from('Restored content'))
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
