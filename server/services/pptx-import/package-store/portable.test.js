const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { openPackageStore } = require('./index')

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
