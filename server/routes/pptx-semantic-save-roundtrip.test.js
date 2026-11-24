// @vitest-environment node
// Synthetic package/projection: real publication and HTTP save/read, not native fidelity evidence.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import express from 'express'
import request from 'supertest'
import JSZip from 'jszip'
import { beforeEach, afterEach, afterAll, describe, it, expect } from 'vitest'

const require = createRequire(import.meta.url)
const priorData = process.env.SLIDES_DATA_DIR
const priorUploads = process.env.SLIDES_UPLOADS_DIR
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'semantic-save-'))
process.env.SLIDES_DATA_DIR = path.join(root, 'data')
process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
const storage = require('../services/storage')
const runtime = require('../services/pptx-import/package-store-runtime')
const { buildImportSourceMap } = require('../services/pptx-import/source-map')
const app = express()
app.use(express.json())
app.use('/api/presentations', require('./presentations-crud'))
app.use('/api/presentations', require('./history'))
app.use('/api/project-imports', require('./project-import'))
let original, revision

function projection() {
  return {
    id: 'semantic-deck',
    title: 'Semantic',
    slides: [
      {
        id: 's1',
        elements: [
          {
            id: 'leaf',
            type: 'shape',
            shapeType: 'rect',
            x: -1.25,
            y: 2.5,
            width: 96,
            height: 48,
            pptxInstanceId: 'i1',
          },
        ],
      },
    ],
    pptxSemantic: {
      schemaVersion: 1,
      styles: {},
      fonts: {},
      definitions: {
        d1: {
          id: 'd1',
          kind: 'shape',
          components: [],
          source: {
            partUri: 'ppt/slides/slide1.xml',
            nativeId: '2',
            preconditionHash: 'a'.repeat(64),
          },
          content: { extent: { cx: 914400, cy: 457200 } },
        },
      },
      instances: {
        i1: {
          id: 'i1',
          definitionId: 'd1',
          slideId: 's1',
          parentInstanceId: null,
          localTransform: [1, 0, 0, 1, -11906.25, 23812.5],
          paintIndex: 0,
          overrides: {},
        },
      },
    },
  }
}
const read = () => request(app).get('/api/presentations/semantic-deck')
const save = (body, generation = 1, key = 'semantic-save') =>
  request(app)
    .put('/api/presentations/semantic-deck')
    .set('Idempotency-Key', key)
    .send({ ...body, aggregateGeneration: generation })

describe('actual semantic package HTTP persistence', () => {
  it('publishes an image archive with matching canonical and leaf asset bindings', async () => {
    const source = projection()
    source.slides[0].elements[0].type = 'image'
    source.slides[0].elements[0].src = '/uploads/source.png'
    source.pptxSemantic.definitions.d1.kind = 'image'
    source.pptxSemantic.definitions.d1.content.media = {
      src: '/uploads/source.png',
      partUri: 'ppt/media/image1.png',
      relationshipId: 'rId2',
    }
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64'
    )
    const zip = new JSZip()
    zip.file(
      'manifest.json',
      JSON.stringify({
        version: '1.1',
        media: [
          {
            archivePath: 'media/source.png',
            originalUrl: '/uploads/source.png',
            byteLength: png.length,
            mimeType: 'image/png',
          },
        ],
      })
    )
    zip.file('presentation.json', JSON.stringify(source))
    zip.file('media/source.png', png)
    const editorRequest = (req) =>
      req
        .set('Host', 'localhost')
        .set('Origin', 'http://localhost')
        .set('Referer', 'http://localhost/')
        .set('Sec-Fetch-Site', 'same-origin')
    const admitted = await editorRequest(
      request(app).post('/api/project-imports/preflight')
    ).attach('file', await zip.generateAsync({ type: 'nodebuffer' }), 'semantic.navslides')
    expect(admitted.status, JSON.stringify(admitted.body)).toBe(201)
    const route = `/api/project-imports/${admitted.body.sessionId}`
    const staged = await editorRequest(request(app).post(`${route}/media`)).set(
      'X-NavSlides-Import-Capability',
      admitted.body.capability
    )
    expect(staged.status, JSON.stringify(staged.body)).toBe(200)
    const published = await editorRequest(request(app).post(`${route}/publish`))
      .set('X-NavSlides-Import-Capability', admitted.body.capability)
      .send({})
    expect(published.status, JSON.stringify(published.body)).toBe(201)
    const opened = await request(app).get(`/api/presentations/${published.body.presentationId}`)
    expect(opened.status).toBe(200)
    const asset = opened.body.slides[0].elements[0].src
    expect(opened.body.pptxSemantic.definitions.d1.content.media.src).toBe(asset)
    expect(opened.body.pptxSemantic.definitions.d1.source).toEqual(
      source.pptxSemantic.definitions.d1.source
    )
    expect(opened.body.pptxSemantic.definitions.d1.content.media.partUri).toBe(
      'ppt/media/image1.png'
    )
    expect(await fs.readFile(path.join(storage.UPLOADS_DIR, path.basename(asset)))).toEqual(png)
    expect(opened.body).not.toHaveProperty('pptxAggregateHead')
  })
  it('restores semantic overrides in bare project history without rewriting source definitions', async () => {
    const bare = { ...projection(), id: 'history-semantic' }
    await storage.writePresentations([...(await storage.readPresentations()), bare])
    const snapshot = await request(app)
      .post('/api/presentations/history-semantic/snapshot')
      .send({ name: 'Source baseline' })
    expect(snapshot.status).toBe(200)
    const edited = structuredClone(bare)
    edited.pptxSemantic.instances.i1.overrides.hidden = true
    expect(
      (await request(app).put('/api/presentations/history-semantic').send(edited)).status
    ).toBe(200)
    const restored = await request(app)
      .post(`/api/presentations/history-semantic/restore/${snapshot.body.id}`)
      .send({})
    expect(restored.status, JSON.stringify(restored.body)).toBe(200)
    const opened = await request(app).get('/api/presentations/history-semantic')
    expect(opened.body.pptxSemantic).toEqual(bare.pptxSemantic)
    expect(opened.body.slides[0].elements[0].pptxInstanceId).toBe('i1')
  })
  it('exports project JSON and republishes semantic editing state under a new project identity', async () => {
    const { projectExportValue } = require('revealjs-shared/src/project-export-value.js')
    const initial = await read()
    const portable = projectExportValue(initial.body)
    const preflight = await request(app)
      .post('/api/project-imports/preflight')
      .set('Host', 'localhost')
      .set('Origin', 'http://localhost')
      .set('Referer', 'http://localhost/')
      .set('Sec-Fetch-Site', 'same-origin')
      .attach(
        'file',
        Buffer.from(JSON.stringify({ version: '1.1', presentation: portable })),
        'semantic.json'
      )
    expect(preflight.status, JSON.stringify(preflight.body)).toBe(201)
    const published = await request(app)
      .post(`/api/project-imports/${preflight.body.sessionId}/publish`)
      .set('Host', 'localhost')
      .set('Origin', 'http://localhost')
      .set('Referer', 'http://localhost/')
      .set('Sec-Fetch-Site', 'same-origin')
      .set('X-NavSlides-Import-Capability', preflight.body.capability)
      .send({ trustedAuthorActiveContentAcknowledged: false })
    expect(published.status, JSON.stringify(published.body)).toBe(201)
    expect(published.body.presentationId).not.toBe('semantic-deck')
    const opened = await request(app).get(`/api/presentations/${published.body.presentationId}`)
    expect(opened.status).toBe(200)
    expect(opened.body.pptxSemantic).toEqual(initial.body.pptxSemantic)
    expect(opened.body.slides[0].elements[0].pptxInstanceId).toBe('i1')
    expect(opened.body).not.toHaveProperty('pptxOriginal')
    expect(opened.body).not.toHaveProperty('pptxAggregateHead')
  })
  it('retains canonical semantic edits in history without materializing native package bytes', async () => {
    const initial = await read()
    const snapshot = await request(app)
      .post('/api/presentations/semantic-deck/snapshot')
      .send({ name: 'Semantic baseline' })
    expect(snapshot.status, JSON.stringify(snapshot.body)).toBe(200)
    const snapshotBytes = await fs.readFile(
      path.join(storage.HISTORY_DIR, 'semantic-deck', `${snapshot.body.id}.json`),
      'utf8'
    )
    expect(JSON.parse(snapshotBytes).data.pptxSemantic).toEqual(initial.body.pptxSemantic)
    const edited = structuredClone(initial.body)
    edited.pptxSemantic.instances.i1.overrides.hidden = true
    expect((await save(edited)).status).toBe(200)
    const pending = await request(app).post('/api/presentations/semantic-deck/snapshot').send({})
    expect(pending.status, JSON.stringify(pending.body)).toBe(200)
    const retained = JSON.parse(await fs.readFile(path.join(storage.HISTORY_DIR, 'semantic-deck', `${pending.body.id}.json`), 'utf8'))
    expect(retained.data.pptxSemantic).toEqual(edited.pptxSemantic)
    const liveHead = runtime.getPackageStore().getState().heads.find(head => head.presentationId === 'semantic-deck')
    expect(retained.data.pptxAggregateHead).toEqual(liveHead)
    const owner = { ownerType: 'history', ownerId: `semantic-deck:${pending.body.id}` }
    expect(runtime.getPackageStore().getRestorableHead('semantic-deck', owner)).toEqual(liveHead)
    expect(await runtime.getPackageStore().readOriginal(revision)).toEqual(original)
  })
  it('protects source baselines and merged linkage in non-package project saves too', async () => {
    const bare = { ...projection(), id: 'bare-semantic' }
    await storage.writePresentations([...(await storage.readPresentations()), bare])
    const changed = structuredClone(bare)
    changed.pptxSemantic.definitions.d1.content.extent.cy += 1
    const rejected = await request(app).put('/api/presentations/bare-semantic').send(changed)
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(400)
    const partial = await request(app)
      .put('/api/presentations/bare-semantic')
      .send({ slides: [{ id: 's1', elements: [] }] })
    expect(partial.status, JSON.stringify(partial.body)).toBe(400)
    const readBare = await request(app).get('/api/presentations/bare-semantic')
    expect(readBare.body.pptxSemantic).toEqual(bare.pptxSemantic)
    expect(readBare.body.slides[0].elements).toEqual(bare.slides[0].elements)
  })
  it('duplicates into an independent package owner without rewriting native definition identity', async () => {
    const initial = await read()
    const copy = await request(app).post('/api/presentations/semantic-deck/duplicate')
    expect(copy.status, JSON.stringify(copy.body)).toBe(201)
    expect(copy.body.id).not.toBe('semantic-deck')
    expect(copy.body.pptxSemantic).toEqual(initial.body.pptxSemantic)
    const openedCopy = await request(app).get(`/api/presentations/${copy.body.id}`)
    const changed = structuredClone(openedCopy.body)
    changed.pptxSemantic.instances.i1.overrides.hidden = true
    const saved = await request(app)
      .put(`/api/presentations/${copy.body.id}`)
      .set('Idempotency-Key', 'edit-semantic-copy')
      .send({ ...changed, aggregateGeneration: openedCopy.body.aggregateGeneration })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect(saved.body.pptxSemantic.instances.i1.overrides.hidden).toBe(true)
    expect((await read()).body.pptxSemantic).toEqual(initial.body.pptxSemantic)
    const heads = runtime.getPackageStore().getState().heads
    expect(heads.find((h) => h.presentationId === copy.body.id).presentationId).not.toBe(
      'semantic-deck'
    )
    expect(await runtime.getPackageStore().readOriginal(revision)).toEqual(original)
  })
  beforeEach(async () => {
    await runtime.shutdownPackageStore()
    storage.initDataFiles()
    // Multer's destination was initialized once when the router was mounted;
    // afterEach removes this isolated root between cases.
    await fs.mkdir(path.join(storage.DATA_DIR, 'project-import-incoming'), { recursive: true })
    await storage.writePresentations([])
    const store = await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<Types/>')
    zip.file('ppt/presentation.xml', '<p:presentation/>')
    original = await zip.generateAsync({ type: 'nodebuffer' })
    const deck = projection()
    const prepared = await store.prepareImport(original, {
      jobId: 'semantic-save-fixture',
      presentationId: deck.id,
      projection: deck,
      compatibilityPresentation: deck,
      sourceMap: await buildImportSourceMap(deck, null, null),
    })
    const result = await runtime.withPackageStore((current) => current.publishImport(prepared))
    revision = result.head.originalRevisionId
    await runtime.drainPackageCompatibilityOutbox()
  })
  afterEach(async () => {
    await runtime.shutdownPackageStore()
    await fs.rm(root, { recursive: true, force: true })
  })
  afterAll(() => {
    if (priorData === undefined) delete process.env.SLIDES_DATA_DIR
    else process.env.SLIDES_DATA_DIR = priorData
    if (priorUploads === undefined) delete process.env.SLIDES_UPLOADS_DIR
    else process.env.SLIDES_UPLOADS_DIR = priorUploads
  })

  it('saves canonical transform/override, reopens durable store and rejects a stale save without touching Original', async () => {
    const initial = await read()
    expect(initial.status).toBe(200)
    expect(initial.body.pptxSemantic).toEqual(projection().pptxSemantic)
    const edited = structuredClone(initial.body)
    edited.pptxSemantic.instances.i1.localTransform[4] += 2381.25
    edited.pptxSemantic.instances.i1.overrides.hidden = true
    const saved = await save(edited)
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect(saved.body.pptxSemantic).toEqual(edited.pptxSemantic)
    await runtime.shutdownPackageStore()
    await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
    const reopened = await read()
    expect(reopened.body.pptxSemantic).toEqual(edited.pptxSemantic)
    expect(reopened.body.slides[0].elements[0].pptxInstanceId).toBe('i1')
    expect(reopened.body.aggregateGeneration).toBe(2)
    const stale = await save(initial.body, 1, 'stale-semantic-save')
    expect(stale.status).toBe(409)
    expect((await read()).body.pptxSemantic).toEqual(edited.pptxSemantic)
    expect(await runtime.getPackageStore().readOriginal(revision)).toEqual(original)
  })

  it.each(['future', 'baseline', 'new-source', 'missing-instance'])(
    'rejects %s before publish with unchanged head/projection/Original',
    async (failure) => {
      const initial = await read()
      const edited = structuredClone(initial.body)
      if (failure === 'future') edited.pptxSemantic.schemaVersion = 99
      if (failure === 'baseline') edited.pptxSemantic.definitions.d1.content.extent.cx += 1
      if (failure === 'new-source')
        edited.pptxSemantic.definitions.d2 = {
          ...edited.pptxSemantic.definitions.d1,
          id: 'd2',
          source: { ...edited.pptxSemantic.definitions.d1.source, nativeId: '99' },
        }
      if (failure === 'missing-instance') {
        edited.slides[0].elements = []
        delete edited.pptxSemantic.instances.i1
      }
      const before = structuredClone(runtime.getPackageStore().getState().heads)
      const denied = await save(edited, 1, `deny-${failure}`)
      expect(denied.status, JSON.stringify(denied.body)).toBe(400)
      expect((await read()).body.pptxSemantic).toEqual(initial.body.pptxSemantic)
      expect(runtime.getPackageStore().getState().heads).toEqual(before)
      expect(await runtime.getPackageStore().readOriginal(revision)).toEqual(original)
    }
  )
})
