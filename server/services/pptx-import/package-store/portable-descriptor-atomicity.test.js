// @vitest-environment node
import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import storeModule from './index'

const resources = []
async function storeFor() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-portable-descriptor-'))
  const store = await storeModule.openPackageStore({ rootDir })
  resources.push({ store, rootDir })
  await store.acquireWriter()
  return store
}
afterEach(async () => {
  for (const { store, rootDir } of resources.splice(0)) {
    await store.releaseWriter()
    await fs.remove(rootDir)
  }
})
async function bundles() {
  const source = await storeFor()
  for (const id of ['source', 'extra']) {
    await source.commitOriginal(Buffer.from(`genuine native ${id}`), { ownerType: 'presentation', ownerId: id })
  }
  return { source, bundle: await source.exportPresentationPackage('source'),
    extra: await source.exportPresentationPackage('extra') }
}

describe('P10-04 portable exact native descriptor and payload closure', () => {
  it.each(['missing', 'extra', 'duplicate'])('rejects %s revision independently before staging/publication', async (kind) => {
    const { bundle, extra } = await bundles()
    if (kind === 'missing') bundle.manifest.revisions = []
    if (kind === 'extra') bundle.manifest.revisions.push(extra.manifest.revisions[0])
    if (kind === 'duplicate') bundle.manifest.revisions.push(structuredClone(bundle.manifest.revisions[0]))
    const destination = await storeFor(), before = destination.getState()
    await expect(destination.importPresentationPackage(bundle, 'destination')).rejects.toMatchObject({ code: 'PACKAGE_MANIFEST_INVALID' })
    expect(destination.getState()).toEqual(before)
    expect(await destination.listBlobFiles()).toEqual([])
    expect(await fs.readdir(destination.blobs.stagingDir)).toEqual([])
  })
  it.each(['missing', 'extra', 'duplicate'])('rejects %s blob descriptor independently before staging/publication', async (kind) => {
    const { bundle, extra } = await bundles()
    if (kind === 'missing') bundle.manifest.blobs = []
    if (kind === 'extra') bundle.manifest.blobs.push(extra.manifest.blobs[0])
    if (kind === 'duplicate') bundle.manifest.blobs.push(structuredClone(bundle.manifest.blobs[0]))
    const destination = await storeFor(), before = destination.getState()
    await expect(destination.importPresentationPackage(bundle, 'destination')).rejects.toMatchObject({ code: 'PACKAGE_MANIFEST_INVALID' })
    expect(destination.getState()).toEqual(before)
    expect(await destination.listBlobFiles()).toEqual([])
    expect(await fs.readdir(destination.blobs.stagingDir)).toEqual([])
  })
  it.each(['missing', 'extra', 'duplicate'])('rejects %s supplied payload independently before staging/publication', async (kind) => {
    const { bundle, extra } = await bundles()
    if (kind === 'missing') bundle.blobs = []
    if (kind === 'extra') bundle.blobs.push(extra.blobs[0])
    if (kind === 'duplicate') bundle.blobs.push({ ...bundle.blobs[0], bytes: Buffer.from(bundle.blobs[0].bytes) })
    const destination = await storeFor(), before = destination.getState()
    await expect(destination.importPresentationPackage(bundle, 'destination')).rejects.toMatchObject({ code: 'PACKAGE_MANIFEST_INVALID' })
    expect(destination.getState()).toEqual(before)
    expect(await destination.listBlobFiles()).toEqual([])
    expect(await fs.readdir(destination.blobs.stagingDir)).toEqual([])
  })
})

it('P10-05: corrupt existing destination blob refuses portable admission without a new head or losing valid staged/source bytes', async () => {
  const { source, bundle } = await bundles()
  const destination = await storeFor(), before = destination.getState()
  const blob = bundle.blobs[0], corrupt = Buffer.from('corrupt existing destination')
  const target = destination.blobs.blobPath(blob.sha256)
  await fs.writeFile(target, corrupt)
  await expect(destination.importPresentationPackage(bundle, 'destination'))
    .rejects.toMatchObject({ code: 'CORRUPT_EXISTING_BLOB', stagingPreserved: true })
  expect(destination.getState()).toEqual(before)
  expect(await fs.readFile(target)).toEqual(corrupt)
  const staged = await fs.readdir(destination.blobs.stagingDir)
  expect(staged).toHaveLength(1)
  expect(await fs.readFile(path.join(destination.blobs.stagingDir, staged[0]))).toEqual(blob.bytes)
  expect(await source.readOriginal(bundle.manifest.head.originalRevisionId)).toEqual(blob.bytes)
  expect(bundle.blobs[0].bytes).toEqual(blob.bytes)
})
