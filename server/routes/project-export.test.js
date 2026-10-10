// @vitest-environment node
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import JSZip from 'jszip'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)
let root, app, store, storage, runtime

function resetCjsModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}NavSlidesEditor${path.sep}server${path.sep}`)) delete require.cache[key]
  }
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-project-export-'))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  resetCjsModules()
  storage = require('../services/storage')
  storage.initDataFiles()
  runtime = require('../services/pptx-import/package-store-runtime')
  store = await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
  const application = require('../index')
  app = application.app
  application.healthState.markReady()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await runtime?.shutdownPackageStore()
  delete process.env.SLIDES_DATA_DIR
  delete process.env.SLIDES_UPLOADS_DIR
  resetCjsModules()
  await fs.remove(root)
})

async function seed(extra = {}) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types />')
  zip.file('ppt/presentation.xml', '<p:presentation />')
  const projection = { id: 'source', title: 'Archive title', slides: [], ...extra }
  const committed = await store.commitImport(await zip.generateAsync({ type: 'nodebuffer' }), {
    jobId: 'export-source', presentationId: 'source', projection,
    sourceMap: await require('../services/pptx-import/source-map').buildImportSourceMap(projection, null, null),
    compatibilityPresentation: projection,
  })
  const { applyCompatibilityWrites } = require('../services/pptx-import/compatibility-view')
  await storage.withPresentations((rows) => applyCompatibilityWrites(rows, store.getState().compatibilityOutbox))
  return { projection, committed }
}

function get(generation = '1') {
  return request(app).get('/api/presentations/source/project-archive')
    .set('Host', 'localhost').set('Origin', 'http://localhost')
    .set('Referer', 'http://localhost/editor/source').set('Sec-Fetch-Site', 'same-origin')
    .set('If-Pptx-Generation', generation)
}

function binary(req) {
  return req.buffer(true).parse((res, done) => {
    const chunks = []
    res.on('data', (chunk) => chunks.push(chunk))
    res.on('end', () => done(null, Buffer.concat(chunks)))
    res.on('error', done)
  })
}

describe('private full project archive endpoint', () => {
  it('exports exact ZIP v2 package closure without local media', async () => {
    const { projection } = await seed()
    const response = await binary(get())
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/^application\/zip/u)
    expect(response.headers['content-disposition']).toContain('.navslides')
    expect(response.headers['x-pptx-generation']).toBe('1')
    const zip = await JSZip.loadAsync(response.body)
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'))
    expect(manifest).toMatchObject({ version: '2.0', media: [], externalLinks: [] })
    expect(JSON.parse(await zip.file('presentation.json').async('string'))).toEqual(projection)
    const bundle = await store.exportPresentationPackage('source')
    expect(Object.keys(zip.files).sort()).toEqual([
      'manifest.json', 'presentation.json', 'package/manifest.json',
      ...bundle.blobs.map((blob) => `package/blobs/${blob.sha256}`),
    ].sort())
    expect(await zip.file(`package/blobs/${bundle.blobs[0].sha256}`).async('nodebuffer')).toEqual(bundle.blobs[0].bytes)
  })

  it('rejects stale generation and missing preconditions without a download', async () => {
    await seed()
    expect(await get('2')).toMatchObject({ status: 409, body: { code: 'SYNC_SOURCE_CHANGED' } })
    expect(await get('invalid')).toMatchObject({ status: 400, body: { code: 'INVALID_EXPECTED_GENERATION' } })
    expect(await get().unset('If-Pptx-Generation')).toMatchObject({ status: 428, body: { code: 'EXPECTED_GENERATION_REQUIRED' } })
  })

  it('rejects cross-origin requests inside the route boundary', async () => {
    await seed()
    expect(await get().set('Origin', 'https://attacker.test'))
      .toMatchObject({ status: 403, body: { code: 'PROJECT_IMPORT_ORIGIN_REJECTED' } })
  })

  it('aborts required local media missing and never fetches external links', async () => {
    await seed({ slides: [{ id: 's1', elements: [
      { id: 'e1', type: 'image', src: '/uploads/missing.png' },
    ] }] })
    expect(await get()).toMatchObject({ status: 422, body: { code: 'PROJECT_EXPORT_MEDIA_MISSING' } })
  })

  it('inventories external media without fetching remote or remote upload-lookalike URLs', async () => {
    const url = 'https://127.0.0.1/uploads/private.png'
    await seed({ slides: [{ id: 's1', elements: [{ id: 'e1', type: 'image', src: url }] }] })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('SSRF') })
    const response = await binary(get())
    expect(response.status).toBe(200)
    const zip = await JSZip.loadAsync(response.body)
    expect(JSON.parse(await zip.file('manifest.json').async('string')).externalLinks).toEqual([{ url, type: 'external-media' }])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects source head replacement while verified blob reads are in flight', async () => {
    await seed()
    const read = store.readBlob.bind(store)
    vi.spyOn(store, 'readBlob').mockImplementationOnce(async (sha) => {
      const bytes = await read(sha)
      await store.mutate((next) => { next.heads[0].generation += 1 })
      return bytes
    })
    expect(await get()).toMatchObject({ status: 409, body: { code: 'SYNC_SOURCE_CHANGED' } })
  })

  it('exports verified owned media including background and child-slide track references', async () => {
    const bytes = Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\nhello\n')
    const ownership = require('../services/media-placement-ownership')
    const placed = await ownership.placeMedia({ ownerId: 'export-media', bytes, originalName: 'track.vtt',
      mimeType: 'text/vtt', sourceKey: 'track' })
    await ownership.commitOwner('export-media', 'source')
    const url = `/uploads/${placed.filename}`
    await seed({ slides: [{ id: 's1', elements: [], children: [{ id: 'child', elements: [
      { id: 'v1', type: 'video', src: 'https://example.test/video.mp4', tracks: [{ src: url }] },
    ] }] }] })
    const response = await binary(get())
    expect(response.status).toBe(200)
    const zip = await JSZip.loadAsync(response.body)
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'))
    expect(manifest.media).toHaveLength(1)
    expect(manifest.media[0]).toMatchObject({ originalUrl: url, byteLength: bytes.length })
    expect(await zip.file(manifest.media[0].archivePath).async('nodebuffer')).toEqual(bytes)
  })

  it('rejects an existing upload that has no server-owned media ledger record', async () => {
    await fs.ensureDir(storage.UPLOADS_DIR)
    await fs.writeFile(path.join(storage.UPLOADS_DIR, 'unowned.png'), 'unowned')
    await seed({ slides: [{ id: 's1', elements: [{ id: 'e1', type: 'image', src: '/uploads/unowned.png' }] }] })
    expect(await get()).toMatchObject({ status: 422, body: { code: 'PROJECT_EXPORT_MEDIA_UNOWNED' } })
  })

  it('accepts browser GET admission without Origin only with private same-origin navigation evidence', async () => {
    await seed()
    expect((await get().unset('Origin')).status).toBe(200)
    expect((await get().unset('Origin').unset('Referer').unset('Sec-Fetch-Site')).status).toBe(403)
    expect((await get().unset('Origin').set('Sec-Fetch-Site', 'cross-site')).status).toBe(403)
    expect((await get().unset('Origin').set('Referer', 'http://localhost/share/token')).status).toBe(403)
  })

  it.each([['emf', 'image/x-emf', [1, 0, 0, 0]], ['wmf', 'image/x-wmf', [215, 205, 198, 154]]])(
    'preserves verified owned %s bytes through ZIP v2 without claiming browser rendering', async (ext, mimeType, header) => {
      const bytes = Buffer.from([...header, ...Array(32).fill(0)])
      const ownership = require('../services/media-placement-ownership')
      const placed = await ownership.placeMedia({ ownerId: `meta-${ext}`, bytes, originalName: `image.${ext}`, mimeType, sourceKey: ext })
      await ownership.commitOwner(`meta-${ext}`, 'source')
      await seed({ slides: [{ id: 's1', elements: [{ id: 'e1', type: 'image', src: `/uploads/${placed.filename}` }] }] })
      const response = await binary(get())
      expect(response.status).toBe(200)
      const zip = await JSZip.loadAsync(response.body)
      const manifest = JSON.parse(await zip.file('manifest.json').async('string'))
      expect(manifest.media[0]).toMatchObject({ mimeType, browserSupport: 'limited' })
      expect(await zip.file(manifest.media[0].archivePath).async('nodebuffer')).toEqual(bytes)
      const filePath = path.join(root, 'metafile.navslides')
      await fs.writeFile(filePath, response.body)
      const validated = await require('../services/project-import-archive').validateProjectArchive(filePath, { stagingDir: path.join(root, 'meta-stage') })
      expect(await fs.readFile(validated.media[0].stagingPath)).toEqual(bytes)
      zip.file('manifest.json', JSON.stringify({ ...manifest, version: '1.1' }))
      for (const name of Object.keys(zip.files)) if (name.startsWith('package/')) zip.remove(name)
      await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
      await expect(require('../services/project-import-archive').validateProjectArchive(filePath, { stagingDir: path.join(root, 'legacy-meta-stage') })).rejects.toMatchObject({ code: 'PROJECT_MEDIA_TYPE_REJECTED' })
    },
  )
})
