// Real package/media fixtures for portable project HTTP consumers.
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import JSZip from 'jszip'
import request from 'supertest'
import { expect } from 'vitest'
const require = createRequire(import.meta.url)
export const roots = []
export const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
export async function root() {
  const result = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-portable-project-http-'))
  roots.push(result)
  return result
}
export function reset() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}NavSlidesEditor${path.sep}server${path.sep}`)) delete require.cache[key]
  }
}
export async function target(directory) {
  process.env.SLIDES_DATA_DIR = path.join(directory, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(directory, 'uploads')
  reset()
  const storage = require('../services/storage')
  storage.initDataFiles()
  const runtime = require('../services/pptx-import/package-store-runtime')
  const store = await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
  const application = require('../index')
  application.healthState.markReady()
  return { app: application.app, store, storage, runtime, sessions: require('../services/project-import-media-session') }
}
export function editor(builder) {
  return builder.set('Host', 'localhost').set('Origin', 'http://localhost')
    .set('Referer', 'http://localhost/').set('Sec-Fetch-Site', 'same-origin')
}
export function binary(builder) {
  return builder.buffer(true).parse((response, done) => {
    const chunks = []
    response.on('data', (chunk) => chunks.push(chunk))
    response.on('end', () => done(null, Buffer.concat(chunks)))
    response.on('error', done)
  })
}
export async function sourceArchive(withMedia = true) {
  const directory = await root()
  const { openPackageStore } = require('../services/pptx-import/package-store')
  const store = await openPackageStore({ rootDir: directory })
  await store.acquireWriter()
  try {
    const originalZip = new JSZip()
    originalZip.file('[Content_Types].xml', '<Types/>')
    originalZip.file('ppt/presentation.xml', '<p:presentation/>')
    const original = await originalZip.generateAsync({ type: 'nodebuffer' })
    const mediaBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64')
    const projection = { id: 'source', title: 'Full portable project', slides: [{ id: 's1', elements:
      withMedia ? [{ id: 'e1', type: 'image', src: '/uploads/source.png', width: 100, height: 100 }] : [] }] }
    await store.commitImport(original, { jobId: 'source-import', presentationId: 'source', projection,
      compatibilityPresentation: projection,
      sourceMap: await require('../services/pptx-import/source-map').buildImportSourceMap(projection, null, null) })
    const bundle = await store.exportPresentationPackage('source')
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({ version: '2.0', externalLinks: [], media: withMedia ? [{
      archivePath: 'media/source.png', originalUrl: '/uploads/source.png', filename: 'source.png',
      mimeType: 'image/png', sha256: sha(mediaBytes), byteLength: mediaBytes.length,
    }] : [] }), { createFolders: false })
    zip.file('presentation.json', JSON.stringify(projection), { createFolders: false })
    zip.file('package/manifest.json', JSON.stringify(bundle.manifest), { createFolders: false })
    for (const blob of bundle.blobs) zip.file(`package/blobs/${blob.sha256}`, blob.bytes, { createFolders: false })
    if (withMedia) zip.file('media/source.png', mediaBytes, { createFolders: false })
    return { directory, bytes: await zip.generateAsync({ type: 'nodebuffer' }), original, mediaBytes }
  } finally { await store.releaseWriter() }
}
export async function admit(app, bytes) {
  const result = await editor(request(app).post('/api/project-imports/preflight')).attach('file', bytes, 'full.navslides')
  expect(result.status).toBe(201)
  return result.body
}
export async function publish(app, admission) {
  const media = await editor(request(app).post(`/api/project-imports/${admission.sessionId}/media`))
    .set('X-NavSlides-Import-Capability', admission.capability)
  expect(media.status).toBe(200)
  const result = await editor(request(app).post(`/api/project-imports/${admission.sessionId}/publish`))
    .set('X-NavSlides-Import-Capability', admission.capability).send({ trustedAuthorActiveContentAcknowledged: false })
  expect(result.status).toBe(201)
  expect(result.body.status).toBe('committed')
  return result.body.presentationId
}
export async function verify(app, id, fixture, withMedia) {
  const response = await request(app).get(`/api/presentations/${id}`)
  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({ id, pptxSourceAvailable: true })
  const original = await binary(request(app).get(`/api/presentations/${id}/pptx-original`)
    .set('If-Pptx-Generation', String(response.body.aggregateGeneration)))
  expect(original.status).toBe(200)
  expect(original.body).toEqual(fixture.original)
  if (withMedia) {
    const src = response.body.slides[0].elements[0].src
    expect(src).not.toBe('/uploads/source.png')
    expect((await binary(request(app).get(src))).body).toEqual(fixture.mediaBytes)
  }
  return response.body
}
