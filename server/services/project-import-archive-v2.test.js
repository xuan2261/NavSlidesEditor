// @vitest-environment node
import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import archiveModule from './project-import-archive'
import storeModule from './pptx-import/package-store'
import schemas from './pptx-import/package-store/schemas'
import sourceMapModule from './pptx-import/source-map'
import journalModule from './pptx-import/mutation-journal'
import { createHash } from 'node:crypto'

const roots = []
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.remove(root))) })

async function fixture(extra = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-archive-v2-'))
  roots.push(root)
  const store = await storeModule.openPackageStore({ rootDir: root })
  await store.acquireWriter()
  try {
    const source = new JSZip()
    source.file('[Content_Types].xml', '<Types />')
    source.file('ppt/presentation.xml', '<p:presentation />')
    const projection = { id: 'source', title: 'Portable deck', slides: [], ...extra }
    await store.commitImport(await source.generateAsync({ type: 'nodebuffer' }), {
      jobId: 'portable-archive-source', presentationId: 'source', projection,
      sourceMap: await sourceMapModule.buildImportSourceMap(projection, null, null), compatibilityPresentation: projection,
    })
    const bundle = await store.exportPresentationPackage('source')
    const manifest = { version: '2.0', media: [], externalLinks: [] }
    const entries = {
      'manifest.json': JSON.stringify(manifest),
      'presentation.json': JSON.stringify(projection),
      'package/manifest.json': JSON.stringify(bundle.manifest),
      ...Object.fromEntries(bundle.blobs.map((blob) => [`package/blobs/${blob.sha256}`, blob.bytes])),
    }
    return { root, bundle, manifest, entries, projection }
  } finally { await store.releaseWriter() }
}

async function validate(input, mutate = () => {}, options = {}) {
  const entries = { ...input.entries }
  mutate(entries)
  const zip = new JSZip()
  for (const [name, bytes] of Object.entries(entries)) zip.file(name, bytes, { createFolders: false })
  const filePath = path.join(input.root, 'deck.navslides')
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
  return archiveModule.validateProjectArchive(filePath, {
    stagingDir: path.join(input.root, 'staged'), ...options,
  })
}

describe('project ZIP v2 package authority preflight', () => {
  it('preserves the exact package even without media and durably stages verified bytes', async () => {
    const input = await fixture()
    const result = await validate(input)
    expect(result.manifest.version).toBe('2.0')
    expect(result.media).toEqual([])
    expect(result.packageBundle).toEqual(input.bundle)
    expect(result.packageBundlePath).toBe(path.join(input.root, 'staged', 'package'))
    expect(await fs.readJson(path.join(result.packageBundlePath, 'manifest.json'))).toEqual(input.bundle.manifest)
    for (const blob of input.bundle.blobs) {
      expect(await fs.readFile(path.join(result.packageBundlePath, 'blobs', blob.sha256))).toEqual(blob.bytes)
    }
    expect(schemas.hashRecord(result.presentation)).toBe(schemas.hashRecord(input.projection))
  })

  it.each(['missing', 'extra', 'length', 'digest', 'foreign-authority', 'projection']) (
    'rejects %s package content before creating the staging directory', async (kind) => {
      const input = await fixture()
      await expect(validate(input, (entries) => {
        const blobPath = `package/blobs/${input.bundle.blobs[0].sha256}`
        if (kind === 'missing') delete entries[blobPath]
        if (kind === 'extra') entries[`package/blobs/${'f'.repeat(64)}`] = Buffer.from('extra')
        if (kind === 'length') entries[blobPath] = Buffer.concat([entries[blobPath], Buffer.from('x')])
        if (kind === 'digest') {
          entries[blobPath] = Buffer.from(entries[blobPath])
          entries[blobPath][0] ^= 1
        }
        if (kind === 'foreign-authority') {
          const manifest = structuredClone(input.bundle.manifest)
          manifest.mutationResults[0].presentationId = 'foreign'
          entries['package/manifest.json'] = JSON.stringify(manifest)
        }
        if (kind === 'projection') entries['presentation.json'] = JSON.stringify({ ...input.projection, title: 'spoofed' })
      })).rejects.toMatchObject({ status: 400 })
      expect(await fs.pathExists(path.join(input.root, 'staged'))).toBe(false)
    }
  )

  it('rejects legacy package grafts and projection HTML in the exact v2 entry inventory', async () => {
    for (const kind of ['legacy', 'html']) {
      const input = await fixture()
      await expect(validate(input, (entries) => {
        if (kind === 'legacy') entries['manifest.json'] = JSON.stringify({ version: '1.1', media: [] })
        else entries['presentation.html'] = '<p>not a v2 entry</p>'
      })).rejects.toMatchObject({ code: 'PROJECT_ARCHIVE_ENTRY_REJECTED' })
      expect(await fs.pathExists(path.join(input.root, 'staged'))).toBe(false)
    }
  })

  it('requires acknowledgement for canonical active content before package staging', async () => {
    const input = await fixture({ customJS: 'window.archiveDemo = true' })
    await expect(validate(input)).rejects.toMatchObject({ code: 'ACTIVE_CONTENT_ACK_REQUIRED' })
    expect(await fs.pathExists(path.join(input.root, 'staged'))).toBe(false)
    const admitted = await validate(input, undefined, { trustedAuthorActiveContentAcknowledged: true })
    expect(admitted.activeContent).toEqual(['custom-javascript'])
    expect(admitted.packageBundle.manifest).toEqual(input.bundle.manifest)
  })

  it('requires complete local media and exact external-link inventory', async () => {
    const input = await fixture({ slides: [{ id: 's1', elements: [
      { id: 'e1', type: 'image', src: '/uploads/missing.png' },
      { id: 'e2', type: 'image', src: 'https://example.test/image.png' },
    ] }] })
    await expect(validate(input)).rejects.toMatchObject({ code: 'PROJECT_MEDIA_INVENTORY_MISMATCH' })
    expect(await fs.pathExists(path.join(input.root, 'staged'))).toBe(false)
  })

  it('includes package data in the payload digest, not only compatibility JSON', async () => {
    const first = await fixture()
    const second = await fixture()
    const manifest = JSON.parse(second.entries['package/manifest.json'])
    manifest.revisions[0].createdAt = '2026-10-09T00:00:00.000Z'
    second.entries['package/manifest.json'] = JSON.stringify(manifest)
    const a = await validate(first)
    const b = await validate(second)
    expect(a.payloadDigest).not.toBe(b.payloadDigest)
  })

  it('preserves Original-only bytes without accepting authority grafted onto compatibility JSON', async () => {
    const input = await fixture()
    const originalStore = await storeModule.openPackageStore({ rootDir: path.join(input.root, 'original-only') })
    await originalStore.acquireWriter()
    try {
      await originalStore.commitOriginal(Buffer.from('original-only'), { ownerType: 'presentation', ownerId: 'source' })
      const bundle = await originalStore.exportPresentationPackage('source')
      for (const name of Object.keys(input.entries)) if (name.startsWith('package/')) delete input.entries[name]
      input.entries['package/manifest.json'] = JSON.stringify(bundle.manifest)
      for (const blob of bundle.blobs) input.entries[`package/blobs/${blob.sha256}`] = blob.bytes
      input.entries['presentation.json'] = JSON.stringify({ ...input.projection,
        pptxAggregateHead: { generation: 99, presentationId: 'foreign' }, aggregateGeneration: 99 })
      const result = await validate(input)
      expect(result.packageBundle.blobs[0].bytes).toEqual(Buffer.from('original-only'))
      expect(result.presentation.pptxAggregateHead).toBeUndefined()
      expect(result.presentation.aggregateGeneration).toBeUndefined()
    } finally { await originalStore.releaseWriter() }
  })

  it('inventories retained committed/journal media and HTML even when absent from the current projection', async () => {
    const input = await fixture({ slides: [{ id: 'old-slide', elements: [
      { id: 'old-image', type: 'image', src: '/uploads/old.png' },
      { id: 'old-html', type: 'html', content: '<script>window.retained = true</script>' },
    ] }] })
    const store = await storeModule.openPackageStore({ rootDir: input.root })
    await store.acquireWriter()
    try {
      const state = store.getState(), oldHead = state.heads[0], authority = state.mutationResults[0]
      const after = { ...input.projection, slides: [{ id: 'new-slide', elements: [
        { id: 'new-image', type: 'image', src: '/uploads/pending.png' },
      ] }] }
      const journal = journalModule.deriveMutationJournal(authority.projection, after, {
        sourceMap: authority.sourceMap, baseRevisionId: oldHead.packageRevisionId, matrixAuthorityEpoch: state.matrixAuthorityEpoch,
      })
      const map = sourceMapModule.rebindSourceMap(await sourceMapModule.buildImportSourceMap(after, null, null), {
        presentationId: 'source', revisionId: oldHead.packageRevisionId, packageGeneration: 2,
      })
      await store.mutate((next) => {
        Object.assign(next.heads[0], { generation: 2, predecessorId: schemas.hashRecord(oldHead),
          projectionRevisionId: schemas.hashRecord(after), sourceMapRevisionId: schemas.hashRecord(map),
          journalRevisionId: journal.journalHash, pendingJournalHash: journal.journalHash })
        next.mutationResults.push({ schemaVersion: 1, operation: 'projection-save', presentationId: 'source',
          idempotencyKey: 'pending-media', generation: 2, packageRevisionId: oldHead.packageRevisionId,
          projection: after, sourceMap: map, journal, operationIds: journal.operations.map((op) => op.operationId), state: 'pending-edited-export' })
      })
      input.entries['package/manifest.json'] = JSON.stringify((await store.exportPresentationPackage('source')).manifest)
      input.entries['presentation.json'] = JSON.stringify(after)
      const data = Buffer.from('verified-media'), sha256 = createHash('sha256').update(data).digest('hex')
      const media = ['old', 'pending'].map((name) => ({ archivePath: `media/${name}.png`,
        originalUrl: `/uploads/${name}.png`, byteLength: data.length, sha256 }))
      input.entries['manifest.json'] = JSON.stringify({ version: '2.0', media, externalLinks: [] })
      for (const item of media) input.entries[item.archivePath] = data
      await expect(validate(input)).rejects.toMatchObject({ code: 'ACTIVE_CONTENT_ACK_REQUIRED', activeContent: ['html-element'] })
      expect(await fs.pathExists(path.join(input.root, 'staged'))).toBe(false)
      const result = await validate(input, undefined, { trustedAuthorActiveContentAcknowledged: true })
      expect(result.media.map((item) => item.originalUrl)).toEqual(['/uploads/old.png', '/uploads/pending.png'])
    } finally { await store.releaseWriter() }
  })
})
