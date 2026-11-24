// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import express from 'express'
import request from 'supertest'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const originalDataDir = process.env.SLIDES_DATA_DIR
const originalUploadsDir = process.env.SLIDES_UPLOADS_DIR
const root = path.join(os.tmpdir(), `navslides-pptx-preparation-${process.pid}-${Date.now()}`)
process.env.SLIDES_DATA_DIR = path.join(root, 'data')
process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')

const storage = require('../services/storage')
const runtime = require('../services/pptx-import/package-store-runtime')
const jobs = require('../services/pptx-import-job-manager')
const { runImport, drainDetachedImportCleanups } = require('./pptx-import')
const { persistImageBuffer } = require('../services/pptx-import/media')
const { buildImportSourceMap } = require('../services/pptx-import/source-map')
const { buildGoodPackage } = require('../services/pptx-import/pptx-import-adversarial-fixtures')
const { recoverStartupState } = require('../services/health-state-readiness')

const privateImage = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ8sAAAAASUVORK5CYII=', 'base64'
)
const sharedImage = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

async function mediaRecords() {
  const hashes = JSON.parse(await fs.readFile(storage.UPLOAD_HASHES_FILE, 'utf8'))
  return Object.values(hashes).flatMap((bucket) => Object.values(bucket))
}

async function importImages(jobId, images, urls) {
  const filePath = path.join(root, `${jobId}.pptx`)
  await fs.writeFile(filePath, await buildGoodPackage())
  await runImport({
    jobId, filePath, originalName: 'fixture.pptx', jobManager: jobs,
    importer: async (_file, { mediaTransaction, signal }) => {
      const elements = []
      for (const [index, image] of images.entries()) {
        const placed = await persistImageBuffer(image, null, storage.UPLOADS_DIR, { mediaTransaction, signal })
        expect(placed.url).toBeTruthy()
        urls.push(placed.url)
        elements.push({ id: `image-${index}`, type: 'image', src: placed.url })
      }
      const presentation = { title: 'Preparation media', slides: [{ id: 'slide-1', elements }] }
      return {
        presentation, sourceMap: await buildImportSourceMap(presentation, null, null),
        warnings: [], stats: { slideCount: 1 },
      }
    },
    packageCommit: async (source, input) => {
      const prepared = await runtime.getPackageStore().prepareImport(source, input)
      return runtime.withPackageStore((store) => store.publishImport(prepared))
    },
    packageRollback: (input) => runtime.withPackageStore((store) => store.rollbackImport(input)),
    drainCompatibility: () => runtime.drainPackageCompatibilityOutbox(),
  })
  await drainDetachedImportCleanups()
}

describe('PPTX preparation-failure media compensation (real stores)', () => {
  beforeEach(async () => {
    jobs._reset()
    await runtime.shutdownPackageStore()
    await fs.rm(root, { recursive: true, force: true })
    await fs.mkdir(root, { recursive: true })
    storage.initDataFiles()
    await storage.withUploadHashes(() => {})
    await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
  })

  afterEach(async () => {
    await drainDetachedImportCleanups()
    vi.restoreAllMocks()
    jobs._reset()
    await runtime.shutdownPackageStore()
    await fs.rm(root, { recursive: true, force: true })
  })

  afterAll(() => {
    if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
    else process.env.SLIDES_DATA_DIR = originalDataDir
    if (originalUploadsDir === undefined) delete process.env.SLIDES_UPLOADS_DIR
    else process.env.SLIDES_UPLOADS_DIR = originalUploadsDir
  })

  it.each([
    ['without a shared winner', false],
    ['with a shared winner', true],
  ])('stageBlob EIO %s releases unpublished media and permits ready startup', async (_label, shared) => {
    const store = runtime.getPackageStore()
    let winnerHead
    let winnerOriginal
    const winnerUrls = []
    if (shared) {
      const winnerId = jobs.createJob()
      await importImages(winnerId, [sharedImage], winnerUrls)
      expect(jobs.getJob(winnerId).status).toBe('done')
      winnerHead = store.getState().heads[0]
      winnerOriginal = await store.readOriginal(winnerHead.originalRevisionId)
    }
    const before = store.getState()
    const retainedMedia = await mediaRecords()
    const jobId = jobs.createJob()
    const urls = []
    let pendingAtFault
    let bytesAtFault
    const fault = vi.spyOn(store, 'stageBlob').mockImplementationOnce(async () => {
      pendingAtFault = (await mediaRecords()).filter((record) => record.placementOwner === `pptx-import:${jobId}`)
      bytesAtFault = await fs.readFile(path.join(storage.UPLOADS_DIR, path.basename(urls[0])))
      throw Object.assign(new Error('Package preparation I/O failure'), { code: 'EIO' })
    })
    try {
      await importImages(jobId, shared ? [privateImage, sharedImage] : [privateImage], urls)
      expect(fault).toHaveBeenCalledTimes(1)
    } finally {
      fault.mockRestore()
    }
    expect(pendingAtFault).toHaveLength(1)
    expect(pendingAtFault[0]).toMatchObject({ state: 'pending', placementOwner: `pptx-import:${jobId}` })
    expect(bytesAtFault).toEqual(privateImage)
    expect(jobs.getJob(jobId)).toMatchObject({ status: 'failed', failureCode: 'EIO', operationPending: false })
    expect(jobs.getJob(jobId).result).toBeNull()
    expect(store.getJob(jobId)).toBeFalsy()
    expect(store.getState().heads).toEqual(before.heads)
    expect(store.getState().jobs).toEqual(before.jobs)
    expect(store.getState().compatibilityOutbox).toHaveLength(0)
    expect(await storage.readPresentations()).toHaveLength(shared ? 1 : 0)

    // Soft assertions also exercise real reopen/recovery on the leaking implementation.
    expect.soft(await mediaRecords()).toEqual(retainedMedia)
    await expect.soft(fs.stat(path.join(storage.UPLOADS_DIR, path.basename(urls[0]))))
      .rejects.toMatchObject({ code: 'ENOENT' })
    const app = express()
    app.use('/uploads', express.static(storage.UPLOADS_DIR))
    expect.soft((await request(app).get(urls[0])).status).toBe(404)
    if (shared) {
      expect(urls[1]).toBe(winnerUrls[0])
      const fetched = await request(app).get(winnerUrls[0]).buffer(true)
      expect(fetched.status).toBe(200)
      expect(fetched.body).toEqual(sharedImage)
      expect(await store.readOriginal(winnerHead.originalRevisionId)).toEqual(winnerOriginal)
    }

    await runtime.shutdownPackageStore()
    const reopened = await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
    expect.soft(await recoverStartupState(reopened)).toBeNull()
    expect.soft(await mediaRecords()).toEqual(retainedMedia)
    expect(reopened.getState().heads).toEqual(before.heads)
    if (shared) {
      expect(await reopened.readOriginal(winnerHead.originalRevisionId)).toEqual(winnerOriginal)
      expect(await fs.readFile(path.join(storage.UPLOADS_DIR, path.basename(winnerUrls[0])))).toEqual(sharedImage)
    }
  })
})
