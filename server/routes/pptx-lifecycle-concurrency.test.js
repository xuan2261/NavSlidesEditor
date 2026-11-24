// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import express from 'express'
import request from 'supertest'
import JSZip from 'jszip'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const previousDataDir = process.env.SLIDES_DATA_DIR
const previousUploadsDir = process.env.SLIDES_UPLOADS_DIR
const dataDir = path.join(os.tmpdir(), `pptx-lifecycle-race-${process.pid}-${Date.now()}`)
process.env.SLIDES_DATA_DIR = dataDir
process.env.SLIDES_UPLOADS_DIR = path.join(dataDir, 'uploads')
const storage = require('../services/storage')
const runtime = require('../services/pptx-import/package-store-runtime')
const crud = require('./presentations-crud')
const ownership = require('../services/media-placement-ownership')
const { buildImportSourceMap } = require('../services/pptx-import/source-map')

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

async function prepare(jobId, title, presentationId = 'contended', mediaUrl) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types />')
  zip.file('ppt/presentation.xml', `<p:presentation name="${title}" />`)
  const bytes = await zip.generateAsync({ type: 'nodebuffer' })
  const projection = { id: presentationId, title, slides: mediaUrl
    ? [{ id: 's1', elements: [{ id: 'img', type: 'image', src: mediaUrl }] }] : [] }
  const prepared = await runtime.getPackageStore().prepareImport(bytes, {
    jobId, presentationId: projection.id, projection,
    sourceMap: mediaUrl ? await buildImportSourceMap(projection, null, null) : { entries: {} },
    compatibilityPresentation: projection,
  })
  return { prepared, bytes, projection }
}

async function publish(input) {
  return runtime.withPackageStore((store) => store.publishImport(input.prepared))
}

function app(withMedia = false) {
  const server = express()
  server.use(express.json())
  server.use('/api/presentations', crud)
  if (withMedia) {
    server.use('/uploads', express.static(storage.UPLOADS_DIR))
    server.use('/api/presentations', require('./presentations-pptx'))
  }
  return server
}

function binary(response, callback) {
  const chunks = []
  response.on('data', (chunk) => chunks.push(chunk))
  response.on('end', () => callback(null, Buffer.concat(chunks)))
  response.on('error', callback)
}

describe('PPTX lifecycle concurrency with real package authority', () => {
  beforeEach(async () => {
    await runtime.shutdownPackageStore()
    storage.initDataFiles()
    await storage.writePresentations([])
    await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
  })
  afterEach(async () => {
    await runtime.shutdownPackageStore()
    await fs.rm(dataDir, { recursive: true, force: true })
  })
  afterAll(() => {
    if (previousDataDir === undefined) delete process.env.SLIDES_DATA_DIR
    else process.env.SLIDES_DATA_DIR = previousDataDir
    if (previousUploadsDir === undefined) delete process.env.SLIDES_UPLOADS_DIR
    else process.env.SLIDES_UPLOADS_DIR = previousUploadsDir
  })

  it('P08-01/02: overlapping same-destination publications preserve the winner after loser compensation', async () => {
    const [winner, loser] = await Promise.all([prepare('job-a', 'Winner'), prepare('job-b', 'Loser')])
    const entered = deferred()
    const release = deferred()
    const first = runtime.withPackageStore(async (store) => {
      entered.resolve()
      await release.promise
      return store.publishImport(winner.prepared)
    })
    await entered.promise
    const second = publish(loser)
    const settling = Promise.allSettled([first, second])
    release.resolve()
    const outcomes = await settling
    expect(outcomes[0].status).toBe('fulfilled')
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'PACKAGE_IMPORT_COMMIT_FAILED' } })
    const store = runtime.getPackageStore()
    const committed = store.getState()
    await expect(runtime.withPackageStore((current) => current.rollbackImport({
      jobId: 'job-b', presentationId: 'contended',
    }))).rejects.toMatchObject({ code: 'PACKAGE_IMPORT_COMMIT_FAILED' })
    expect(store.getState()).toEqual(committed)
    expect(committed.heads).toHaveLength(1)
    expect(committed.jobs.map((job) => job.id)).toEqual(['job-a'])
    expect(committed.owners).toEqual([expect.objectContaining({ ownerId: 'contended' })])
    expect(committed.compatibilityOutbox).toHaveLength(1)
    await runtime.drainPackageCompatibilityOutbox()
    const opened = await request(app()).get('/api/presentations/contended')
    expect(opened.status).toBe(200)
    expect(opened.body).toMatchObject({ title: 'Winner', aggregateGeneration: 1 })
    expect(await store.readOriginal(committed.heads[0].originalRevisionId)).toEqual(winner.bytes)
    expect(await fs.readFile(store.blobs.blobPath(loser.prepared.blob.sha256))).toEqual(loser.bytes)
  }, 5_000)

  it('P08-02/14: a late old-job rollback cannot erase a new publication at the same generation', async () => {
    const old = await prepare('old-job', 'Old')
    const oldResult = await publish(old)
    await runtime.drainPackageCompatibilityOutbox()
    await runtime.withPackageStore((store) => store.rollbackImport({
      jobId: 'old-job', presentationId: 'contended',
    }))
    const winner = await prepare('new-job', 'New')
    const result = await publish(winner)
    expect(result.head.generation).toBe(oldResult.head.generation)
    expect(result.head.packageRevisionId).not.toBe(oldResult.head.packageRevisionId)
    await runtime.drainPackageCompatibilityOutbox()
    const store = runtime.getPackageStore()
    const state = store.getState()
    const rows = await storage.readPresentations()
    await expect(runtime.withPackageStore((current) => current.rollbackImport({
      jobId: 'old-job', presentationId: 'contended',
    }))).rejects.toMatchObject({ code: 'PACKAGE_IMPORT_COMMIT_FAILED' })
    expect(store.getState()).toEqual(state)
    expect(await storage.readPresentations()).toEqual(rows)
    const opened = await request(app()).get('/api/presentations/contended')
    expect(opened.status).toBe(200)
    expect(opened.body.title).toBe('New')
    expect(await store.readOriginal(result.head.originalRevisionId)).toEqual(winner.bytes)
    expect(await store.readOriginal(oldResult.head.originalRevisionId)).toEqual(old.bytes)
  }, 5_000)

  it('P08-06: a duplicate waiting at admission rejects an actual source restore without a partial destination', async () => {
    const input = await prepare('source-job', 'Source')
    await publish(input)
    await runtime.drainPackageCompatibilityOutbox()
    const store = runtime.getPackageStore()
    const owner = { ownerType: 'history', ownerId: 'contended:snapshot' }
    await store.retainHead(owner, 'contended')
    const entered = deferred()
    const release = deferred()
    const duplication = store.duplicatePresentationOwner('contended', 'duplicate', {
      admissionPreflight: async () => { entered.resolve(); await release.promise },
    }).catch((error) => error)
    let successor
    try {
      await entered.promise
      successor = await store.restoreForward('contended', owner, {
        compatibilityPresentation: input.projection,
      })
    } finally {
      release.resolve()
    }
    expect(await duplication).toMatchObject({ code: 'STALE_GENERATION' })
    expect(store.getState().heads.some((head) => head.presentationId === 'duplicate')).toBe(false)
    expect(store.getState().owners.some((item) => item.ownerId === 'duplicate')).toBe(false)
    await runtime.drainPackageCompatibilityOutbox()
    const opened = await request(app()).get('/api/presentations/contended')
    expect(opened.status).toBe(200)
    expect(opened.body).toMatchObject({ title: 'Source', aggregateGeneration: successor.generation })
    expect((await request(app()).get('/api/presentations/duplicate')).status).toBe(404)
    expect(await store.readOriginal(successor.originalRevisionId)).toEqual(input.bytes)
  }, 5_000)
  it.each([false, true])('Audit regression: restoring A preserves unrelated B reads and Original (pending outbox=%s)', async (pendingOutbox) => {
    const server = app(true)
    const a = await prepare('restore-a', 'Deck A', 'deck-a')
    await publish(a)
    await runtime.drainPackageCompatibilityOutbox()
    const store = runtime.getPackageStore()
    const history = { ownerType: 'history', ownerId: 'deck-a:snapshot' }
    await store.retainHead(history, 'deck-a')
    const b = await prepare('restore-b', 'Deck B', 'deck-b')
    const publishedB = await publish(b)
    if (!pendingOutbox) await runtime.drainPackageCompatibilityOutbox()

    await runtime.withPackageStore((current) => current.restoreForward('deck-a', history, {
      compatibilityPresentation: a.projection,
    }))
    await runtime.drainPackageCompatibilityOutbox()

    const opened = await request(server).get('/api/presentations/deck-b')
    expect(opened).toMatchObject({ status: 200, body: {
      id: 'deck-b', title: 'Deck B', aggregateGeneration: publishedB.head.generation,
    } })
    const listed = await request(server).get('/api/presentations')
    expect(listed.status).toBe(200)
    expect(listed.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'deck-b', title: 'Deck B' }),
    ]))
    const original = await request(server).get('/api/presentations/deck-b/pptx-original')
      .buffer(true).parse(binary)
    expect(original.status).toBe(200)
    expect(original.body).toEqual(b.bytes)
    expect(await store.readOriginal(publishedB.head.originalRevisionId)).toEqual(b.bytes)
  }, 5_000)

  it('P08-12: an unrelated deck publishes and stays readable while another lifecycle admission is paused', async () => {
    const server = app(true)
    const store = runtime.getPackageStore()
    const inputs = []
    const media = []
    for (const id of ['deck-a', 'deck-b']) {
      const bytes = Buffer.from(`synthetic ${id} media`)
      const placed = await ownership.placeMedia({ ownerId: id, bytes,
        originalName: `${id}.bin`, mimeType: 'application/octet-stream', sourceKey: id })
      await ownership.commitOwner(id, id)
      media.push({ bytes, url: `/uploads/${placed.filename}` })
      const input = await prepare(`import-${id}`, id, id, `/uploads/${placed.filename}`)
      inputs.push(input)
      await publish(input)
    }
    await runtime.drainPackageCompatibilityOutbox()
    const before = store.getState()
    const hashes = await fs.readFile(storage.UPLOAD_HASHES_FILE)
    const entered = deferred()
    const release = deferred()
    const a = store.duplicatePresentationOwner('deck-a', 'copy-a', {
      admissionPreflight: async () => { entered.resolve(); await release.promise },
    }).catch((error) => error)
    let copyB
    try {
      await entered.promise
      const b = await request(server).post('/api/presentations/deck-b/duplicate')
        .timeout({ response: 2000, deadline: 3000 })
      expect(b.status).toBe(201)
      copyB = b.body.id
      expect(copyB).not.toBe('deck-a')
      expect(store.getState().heads.some((head) => head.presentationId === 'copy-a')).toBe(false)
      expect(store.getState().heads.filter((head) => ['deck-a', 'deck-b'].includes(head.presentationId))).toEqual(before.heads)
      for (const [index, id] of ['deck-a', 'deck-b'].entries()) {
        const [opened, image, original] = await Promise.all([
          request(server).get(`/api/presentations/${id}`).timeout({ deadline: 2000 }),
          request(server).get(media[index].url).buffer(true).parse(binary).timeout({ deadline: 2000 }),
          request(server).get(`/api/presentations/${id}/pptx-original`).buffer(true).parse(binary).timeout({ deadline: 2000 }),
        ])
        expect(opened).toMatchObject({ status: 200, body: { title: id, aggregateGeneration: 1 } })
        expect(opened.body.slides[0].elements[0].src).toBe(media[index].url)
        expect(image.status).toBe(200)
        expect(image.body).toEqual(media[index].bytes)
        expect(original.status).toBe(200)
        expect(original.body).toEqual(inputs[index].bytes)
      }
    } finally { release.resolve(); await a }
    const copyA = await a
    expect(copyA).toMatchObject({ presentationId: 'copy-a', generation: 1 })
    const after = store.getState()
    expect(after.heads.filter((head) => ['deck-a', 'deck-b'].includes(head.presentationId))).toEqual(before.heads)
    expect(after.jobs).toEqual(before.jobs)
    expect(after.owners.filter((owner) => ['deck-a', 'deck-b'].includes(owner.ownerId))).toEqual(before.owners)
    expect(after.mutationResults.filter((result) => ['deck-a', 'deck-b'].includes(result.presentationId))).toEqual(before.mutationResults)
    for (const [sourceId, destinationId] of [['deck-a', 'copy-a'], ['deck-b', copyB]]) {
      const source = before.heads.find((head) => head.presentationId === sourceId)
      const copy = after.heads.find((head) => head.presentationId === destinationId)
      expect(after.heads.find((head) => head.presentationId === destinationId)).toMatchObject({
        generation: 1, originalRevisionId: source.originalRevisionId, packageRevisionId: source.packageRevisionId,
      })
      expect(after.owners.filter((owner) => owner.ownerType === 'presentation' && owner.ownerId === destinationId)
        .map((owner) => owner.revisionId).sort())
        .toEqual([...new Set([copy.originalRevisionId, copy.packageRevisionId,
          copy.projectionRevisionId, copy.sourceMapRevisionId, copy.journalRevisionId].filter(Boolean))].sort())
    }
    expect(await fs.readFile(storage.UPLOAD_HASHES_FILE)).toEqual(hashes)
    const copied = await request(server).get(`/api/presentations/${copyB}`)
    expect(copied.status).toBe(200)
    expect(copied.body.slides[0].elements[0].src).toBe(media[1].url)
  }, 10000)
})
