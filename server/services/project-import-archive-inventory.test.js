// @vitest-environment node
import path from 'node:path'
import fs from 'fs-extra'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import archiveModule from './project-import-archive'
import storeModule from './pptx-import/package-store'
import rawZip from './pptx-import/package-store/raw-zip'
import { roots, sourceArchive } from '../routes/portable-package-project-fixture'

afterEach(async () => {
  for (const directory of roots.splice(0)) await fs.remove(directory)
})
async function fixture() {
  const source = await sourceArchive(false)
  const zip = await JSZip.loadAsync(source.bytes)
  const manifest = JSON.parse(await zip.file('package/manifest.json').async('string'))
  const store = await storeModule.openPackageStore({ rootDir: source.directory })
  await store.acquireWriter()
  let extra
  try {
    await store.commitOriginal(Buffer.from('genuine unused native revision'), { ownerType: 'presentation', ownerId: 'extra' })
    extra = await store.exportPresentationPackage('extra')
  } finally { await store.releaseWriter() }
  return { source, zip, manifest, extra }
}
async function rejectBeforeStaging(input, bytes, code) {
  const file = path.join(input.source.directory, 'invalid.navslides')
  const stagingDir = path.join(input.source.directory, 'rejected-staging')
  await fs.writeFile(file, bytes)
  await expect(archiveModule.validateProjectArchive(file, { stagingDir })).rejects.toMatchObject({ status: 400, code })
  expect(await fs.pathExists(stagingDir)).toBe(false)
}

describe('P10-04/P10-07 exact ZIP payload inventory preflight', () => {
  it.each(['missing', 'extra'])('rejects %s physical package payload before staging', async (kind) => {
    const input = await fixture()
    if (kind === 'missing') input.zip.remove(`package/blobs/${input.manifest.blobs[0].sha256}`)
    else input.zip.file(`package/blobs/${input.extra.blobs[0].sha256}`, input.extra.blobs[0].bytes, { createFolders: false })
    await rejectBeforeStaging(input, await input.zip.generateAsync({ type: 'nodebuffer' }), 'PROJECT_PACKAGE_INVENTORY_MISMATCH')
  })

  it('rejects exact duplicate ZIP payload entries before JSZip can collapse them or stage bytes', async () => {
    const input = await fixture()
    const originalName = `package/blobs/${input.manifest.blobs[0].sha256}`
    const duplicateName = `package/blobs/${input.extra.blobs[0].sha256}`
    input.zip.file(duplicateName, input.extra.blobs[0].bytes, { createFolders: false })
    const bytes = await input.zip.generateAsync({ type: 'nodebuffer' })
    const entry = rawZip.parseRawEntries(bytes).find((item) => item.name === duplicateName)
    expect(Buffer.byteLength(originalName)).toBe(Buffer.byteLength(duplicateName))
    Buffer.from(originalName).copy(bytes, entry.localHeaderOffset + 30)
    Buffer.from(originalName).copy(bytes, entry.centralHeaderOffset + 46)
    // Both local and central names agree; this is an exact duplicate, not a case collision/header mismatch.
    expect(() => rawZip.parseRawEntries(bytes)).toThrow(`Duplicate ZIP entry path: ${originalName}`)
    await rejectBeforeStaging(input, bytes, 'PROJECT_ARCHIVE_STRUCTURE_INVALID')
  })
})
