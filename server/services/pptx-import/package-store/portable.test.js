const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { openPackageStore } = require('./index')
const { SCHEMA_VERSION, hashRecord } = require('./schemas')
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
        invalid.manifest.blobs[0].schemaVersion = SCHEMA_VERSION + 1
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
