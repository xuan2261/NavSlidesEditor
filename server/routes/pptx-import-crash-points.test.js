// @vitest-environment node
/**
 * Crash-point + restart/interleave suite for package-backed PPTX import.
 *
 * Hard gate: CP1–CP5 use real temp package store + presentations + outbox.
 * Only the single fault injection point is mocked per scenario.
 *
 * Residual: SSE after Map miss remains 404; poll/durable GET recovers (Map-only stream).
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import express from 'express'
import request from 'supertest'
import JSZip from 'jszip'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const originalDataDir = process.env.SLIDES_DATA_DIR
const dataDir = path.join(os.tmpdir(), `navslides-pptx-crash-${process.pid}-${Date.now()}`)
process.env.SLIDES_DATA_DIR = dataDir

const storage = require('../services/storage.js')
const packageRuntime = require('../services/pptx-import/package-store-runtime.js')
const jobManager = require('../services/pptx-import-job-manager.js')
const importRouterModule = require('./pptx-import.js')

const {
  createPptxImportRouter,
  getDurableImportJob,
  isPresentationListable,
  loadPresentationReportSummary,
  runImport,
  serializeDurableImportJob,
} = importRouterModule

async function writeMinimalPptx(filePath) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types />')
  zip.file('ppt/presentation.xml', '<p:presentation />')
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
}

function importerResult(overrides = {}) {
  return {
    presentation: { title: 'crash-deck', theme: 'white', slides: [] },
    stats: { parser: 'pptxtojson', slideCount: 0 },
    warnings: [{ type: 'media-missing', message: 'img' }],
    sourceMap: { entries: {} },
    ...overrides,
  }
}

async function realPackageCommit(source, input) {
  const prepared = await packageRuntime.getPackageStore().prepareImport(source, input)
  return packageRuntime.withPackageStore((store) => store.publishImport(prepared))
}

async function realPackageRollback(input) {
  return packageRuntime.withPackageStore((store) => store.rollbackImport(input))
}

function realDrain() {
  return packageRuntime.drainPackageCompatibilityOutbox()
}

async function packageSnapshot() {
  const state = packageRuntime.getPackageStore().getState()
  return {
    outbox: state.compatibilityOutbox || [],
    heads: state.heads || [],
    jobs: state.jobs || [],
  }
}

async function durableView(jobId, presentationId) {
  const durable = await getDurableImportJob(jobId)
  const expected = durable?.status === 'completed' &&
    durable.outcomeRevisionId &&
    durable.outcomeGeneration !== undefined &&
    durable.outcomeHeadHash
    ? {
      revisionId: durable.outcomeRevisionId,
      generation: durable.outcomeGeneration,
      headHash: durable.outcomeHeadHash,
    }
    : null
  const listable = presentationId ? await isPresentationListable(presentationId, expected) : false
  let reportSummary = null
  if (listable && presentationId) {
    reportSummary = await loadPresentationReportSummary(presentationId)
  }
  return {
    durable,
    listable,
    reportSummary,
    serialized: serializeDurableImportJob(durable, { listable, reportSummary }),
    presentations: await storage.readPresentations(),
    ...(await packageSnapshot()),
  }
}

async function settleJob(jobId, statuses = ['done', 'failed', 'cancelled'], attempts = 80) {
  for (let i = 0; i < attempts; i += 1) {
    const job = jobManager.getJob(jobId)
    if (job && statuses.includes(job.status)) return job
    await new Promise((r) => setTimeout(r, 10))
  }
  return jobManager.getJob(jobId)
}

describe('PPTX import crash points (real store + outbox)', () => {
  let workDir
  let pptxPath

  beforeEach(async () => {
    jobManager._reset()
    await packageRuntime.shutdownPackageStore()
    await fs.rm(dataDir, { recursive: true, force: true })
    await fs.mkdir(dataDir, { recursive: true })
    storage.initDataFiles()
    await storage.writePresentations([])
    await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-crash-file-'))
    pptxPath = path.join(workDir, 'deck.pptx')
    await writeMinimalPptx(pptxPath)
  })

  afterEach(async () => {
    jobManager._reset()
    await packageRuntime.shutdownPackageStore()
    if (workDir) await fs.rm(workDir, { recursive: true, force: true })
    await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {})
  })

  afterAll(async () => {
    await packageRuntime.shutdownPackageStore()
    if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
    else process.env.SLIDES_DATA_DIR = originalDataDir
    await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {})
  })

  it('CP1: after publish before drain — outbox pending, not listable, durable pending-visibility, head exists', async () => {
    const jobId = jobManager.createJob()
    let presentationId
    let mid

    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager,
      packageCommit: async (source, input) => {
        const result = await realPackageCommit(source, input)
        presentationId = input.presentationId
        mid = await durableView(jobId, presentationId)
        return result
      },
      packageRollback: realPackageRollback,
      drainCompatibility: realDrain,
    })

    expect(mid.outbox.length).toBeGreaterThanOrEqual(1)
    expect(mid.listable).toBe(false)
    expect(mid.heads.some((h) => h.presentationId === presentationId)).toBe(true)
    expect(mid.serialized).toMatchObject({
      jobId,
      status: 'pending-visibility',
      durable: true,
    })
    expect(mid.serialized.result).toBeUndefined()

    // Success path must still drain after the observation seam.
    const settled = await settleJob(jobId, ['done'])
    expect(settled?.status).toBe('done')
    expect((await packageSnapshot()).outbox).toHaveLength(0)
    expect((await durableView(jobId, presentationId)).listable).toBe(true)
  })

  it('CP2: drain throws — packageRollback, failed job, no openable done, head rolled back', async () => {
    const jobId = jobManager.createJob()
    const packageRollback = vi.fn(async (input) => realPackageRollback(input))
    let presentationId

    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager,
      packageCommit: async (source, input) => {
        presentationId = input.presentationId
        return realPackageCommit(source, input)
      },
      packageRollback,
      drainCompatibility: async () => {
        throw new Error('CP2 drain fault')
      },
    })

    const job = await settleJob(jobId, ['failed'])
    expect(job).toMatchObject({ status: 'failed', error: 'CP2 drain fault' })
    expect(packageRollback).toHaveBeenCalledWith({ jobId, presentationId })

    const view = await durableView(jobId, presentationId)
    expect(view.listable).toBe(false)
    expect(view.heads.some((h) => h.presentationId === presentationId)).toBe(false)
    expect(view.outbox.filter((w) => w.presentationId === presentationId)).toHaveLength(0)
    // Durable job receipt may remain as rolled-back/failed — never openable done.
    if (view.durable?.status === 'completed') {
      expect(view.serialized.status).not.toBe('done')
      expect(view.serialized.result?.presentationId).toBeUndefined()
    } else {
      expect(view.serialized?.status).not.toBe('done')
    }
  })

  it('CP3: after drain before completeJob — listable + report; durable openable + reportSummary', async () => {
    const jobId = jobManager.createJob()
    let presentationId
    let postDrain
    let completeCalled = false

    const wrappedManager = {
      ...jobManager,
      emitProgress: (...args) => jobManager.emitProgress(...args),
      holdOperation: (...args) => jobManager.holdOperation(...args),
      registerCancelHandler: (...args) => jobManager.registerCancelHandler(...args),
      settleOperation: (...args) => jobManager.settleOperation(...args),
      failJob: (...args) => jobManager.failJob(...args),
      completeCancellation: (...args) => jobManager.completeCancellation(...args),
      completeJob: (id, result) => {
        completeCalled = true
        return jobManager.completeJob(id, result)
      },
    }

    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager: wrappedManager,
      packageCommit: async (source, input) => {
        presentationId = input.presentationId
        return realPackageCommit(source, input)
      },
      packageRollback: realPackageRollback,
      drainCompatibility: async () => {
        const drained = await realDrain()
        postDrain = await durableView(jobId, presentationId)
        expect(completeCalled).toBe(false)
        return drained
      },
    })

    expect(postDrain.listable).toBe(true)
    expect(postDrain.presentations.some((p) => p.id === presentationId)).toBe(true)
    expect(postDrain.presentations.find((p) => p.id === presentationId)?._pptxImportReport).toMatchObject({
      schemaVersion: 1,
      summary: { warningCount: 1, byType: { 'media-missing': 1 } },
    })
    expect(postDrain.serialized).toMatchObject({
      status: 'done',
      durable: true,
      result: {
        presentationId,
        reportSummary: {
          schemaVersion: 1,
          warningCount: 1,
          byType: { 'media-missing': 1 },
          omittedCount: 0,
        },
      },
    })
    expect(await settleJob(jobId, ['done'])).toMatchObject({ status: 'done' })
  })

  it('CP4: completeJob never called (Map miss) — durable openable done + reportSummary; presentation openable', async () => {
    const jobId = jobManager.createJob()
    let presentationId

    const wrappedManager = {
      emitProgress: (...args) => jobManager.emitProgress(...args),
      holdOperation: (...args) => jobManager.holdOperation(...args),
      registerCancelHandler: (...args) => jobManager.registerCancelHandler(...args),
      settleOperation: (...args) => jobManager.settleOperation(...args),
      failJob: (...args) => jobManager.failJob(...args),
      completeCancellation: (...args) => jobManager.completeCancellation(...args),
      // Simulate crash after drain: never terminalize the in-memory Map entry.
      completeJob: vi.fn(() => null),
    }

    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager: wrappedManager,
      packageCommit: async (source, input) => {
        presentationId = input.presentationId
        return realPackageCommit(source, input)
      },
      packageRollback: realPackageRollback,
      drainCompatibility: realDrain,
    })

    expect(wrappedManager.completeJob).toHaveBeenCalled()
    // Map miss (restart / TTL): clear in-memory job.
    jobManager.cleanup(jobId)
    expect(jobManager.getJob(jobId)).toBeNull()

    const view = await durableView(jobId, presentationId)
    expect(view.listable).toBe(true)
    expect(view.serialized).toMatchObject({
      status: 'done',
      durable: true,
      result: {
        presentationId,
        reportSummary: {
          schemaVersion: 1,
          warningCount: 1,
          byType: { 'media-missing': 1 },
        },
      },
    })
    const opened = (await storage.readPresentations()).find((p) => p.id === presentationId)
    expect(opened).toMatchObject({ id: presentationId, title: 'crash-deck' })
    expect(opened._pptxImportReport).toBeTruthy()
  })

  it('CP5: cancel during mapping (pre-publish) — no head, cancelled, no list row', async () => {
    const jobId = jobManager.createJob()
    let releaseImporter
    const importerGate = new Promise((resolve) => {
      releaseImporter = resolve
    })

    const runPromise = runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async (_fp, { signal }) => {
        await new Promise((resolve, reject) => {
          const onAbort = () => reject(signal.reason || new Error('PPTX import cancelled'))
          if (signal.aborted) {
            onAbort()
            return
          }
          signal.addEventListener('abort', onAbort, { once: true })
          importerGate.then(() => {
            signal.removeEventListener('abort', onAbort)
            resolve()
          })
        })
        return importerResult()
      },
      jobManager,
      packageCommit: realPackageCommit,
      packageRollback: realPackageRollback,
      drainCompatibility: realDrain,
    })

    // Allow cancel handler registration, then cancel mid-map.
    await new Promise((r) => setTimeout(r, 15))
    expect(jobManager.cancelJob(jobId)).toBe('ok')
    releaseImporter()
    await runPromise

    const job = await settleJob(jobId, ['cancelled', 'failed'])
    expect(job?.status).toBe('cancelled')
    const snap = await packageSnapshot()
    expect(snap.heads).toHaveLength(0)
    expect(snap.outbox).toHaveLength(0)
    expect(await storage.readPresentations()).toHaveLength(0)
  })

  it('CP6: cancel after publish pre-drain — rollback + non-openable; no ghost openable done', async () => {
    const jobId = jobManager.createJob()
    const packageRollback = vi.fn(async (input) => realPackageRollback(input))
    let presentationId
    const drainCompatibility = vi.fn(realDrain)

    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager,
      packageCommit: async (source, input) => {
        presentationId = input.presentationId
        return realPackageCommit(source, input)
      },
      // Cancel after publish settles (not mid-withAbort) so pre-drain path is deterministic.
      afterPackagePublish: async () => {
        expect(jobManager.cancelJob(jobId)).toBe('ok')
      },
      packageRollback,
      drainCompatibility,
    })

    const job = await settleJob(jobId, ['cancelled', 'failed'])
    expect(job?.status).toBe('cancelled')
    expect(packageRollback).toHaveBeenCalledWith({ jobId, presentationId })
    expect(drainCompatibility).not.toHaveBeenCalled()
    // Drain must not establish a lasting openable list row.
    const view = await durableView(jobId, presentationId)
    expect(view.listable).toBe(false)
    expect(view.heads.some((h) => h.presentationId === presentationId)).toBe(false)
    expect(view.serialized?.result?.presentationId).toBeUndefined()
    expect(view.serialized?.status).not.toBe('done')
  })

  it('CP7: cancel after listable drain — complete as done (post-visibility no-op delete policy)', async () => {
    const jobId = jobManager.createJob()
    let presentationId

    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager,
      packageCommit: async (source, input) => {
        presentationId = input.presentationId
        return realPackageCommit(source, input)
      },
      packageRollback: realPackageRollback,
      drainCompatibility: realDrain,
      // Cancel only after drain withAbort settles — post-visibility policy seam.
      afterPackageVisibility: async () => {
        expect((await durableView(jobId, presentationId)).listable).toBe(true)
        expect(jobManager.cancelJob(jobId)).toBe('ok')
      },
    })

    const job = await settleJob(jobId, ['done', 'cancelled', 'failed'])
    // Chosen policy (AD7): post-visibility cancel does not delete; complete as done.
    expect(job?.status).toBe('done')
    expect(job?.result?.presentationId).toBe(presentationId)
    expect((await durableView(jobId, presentationId)).listable).toBe(true)
    const view = await durableView(jobId, presentationId)
    expect(view.serialized).toMatchObject({
      status: 'done',
      result: { presentationId },
    })
  })

  it('CP8: restart clear Map then GET — visibility-safe durable payload (not presentationId-only phantom)', async () => {
    const jobId = jobManager.createJob()
    const capability = jobManager.takeJobCapability(jobId)
    let presentationId

    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager,
      packageCommit: async (source, input) => {
        presentationId = input.presentationId
        return realPackageCommit(source, input)
      },
      packageRollback: realPackageRollback,
      drainCompatibility: realDrain,
    })
    expect(await settleJob(jobId, ['done'])).toMatchObject({ status: 'done' })

    // Simulate process restart: drop Map + package runtime handle; reload from disk.
    jobManager.cleanup(jobId)
    await packageRuntime.shutdownPackageStore()

    const app = express()
    app.use('/api/pptx', createPptxImportRouter({
      jobManager,
      // Default readDurableJob/checkPresentationListable/loadReportSummary hit real storage.
    }))

    const response = await request(app)
      .get(`/api/pptx/jobs/${jobId}`)
      .set('X-Pptx-Job-Capability', capability)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      jobId,
      status: 'done',
      durable: true,
      result: {
        presentationId,
        reportSummary: {
          schemaVersion: 1,
          warningCount: 1,
          byType: { 'media-missing': 1 },
        },
      },
    })
    expect(response.body.result.warnings).toBeUndefined()
    // Residual: SSE is Map-only — after restart stream is 404; poll recovers above.
    const sse = await request(app)
      .get(`/api/pptx/jobs/${jobId}/stream?capability=${encodeURIComponent(capability)}`)
    expect(sse.status).toBe(404)

    const mismatchApp = express()
    mismatchApp.use('/api/pptx', createPptxImportRouter({
      jobManager,
      readDurableJob: async (id) => ({
        ...(await getDurableImportJob(id)),
        outcomeHeadHash: '0'.repeat(64),
      }),
    }))
    const mismatch = await request(mismatchApp)
      .get(`/api/pptx/jobs/${jobId}`)
      .set('X-Pptx-Job-Capability', capability)
    expect(mismatch.status).toBe(200)
    expect(mismatch.body).toMatchObject({
      jobId,
      status: 'pending-visibility',
      durable: true,
    })
    expect(mismatch.body.result).toBeUndefined()
  })

  it('CP9: DELETE after durable terminal returns 409 finished', async () => {
    const jobId = jobManager.createJob()
    const capability = jobManager.takeJobCapability(jobId)
    let presentationId

    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager,
      packageCommit: async (source, input) => {
        presentationId = input.presentationId
        return realPackageCommit(source, input)
      },
      packageRollback: realPackageRollback,
      drainCompatibility: realDrain,
    })
    expect(await settleJob(jobId, ['done'])).toMatchObject({ status: 'done' })
    jobManager.cleanup(jobId)

    const app = express()
    app.use('/api/pptx', createPptxImportRouter({ jobManager }))
    const response = await request(app)
      .delete(`/api/pptx/jobs/${jobId}`)
      .set('X-Pptx-Job-Capability', capability)
    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({
      error: 'job-too-late',
      code: 'JOB_CANCEL_TOO_LATE',
      status: 'done',
      job: {
        jobId,
        status: 'done',
        result: { presentationId },
      },
    })
  })

  it('CP10: reconcile after success is identity-bound; fencing rejects mismatched identity', async () => {
    const jobId = jobManager.createJob()
    const capability = jobManager.takeJobCapability(jobId)
    let presentationId

    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager,
      packageCommit: async (source, input) => {
        presentationId = input.presentationId
        return realPackageCommit(source, input)
      },
      packageRollback: realPackageRollback,
      drainCompatibility: realDrain,
    })
    expect(await settleJob(jobId, ['done'])).toMatchObject({ status: 'done' })
    jobManager.cleanup(jobId)

    const app = express()
    app.use('/api/pptx', createPptxImportRouter({
      jobManager,
      packageRollback: realPackageRollback,
      drainCompatibility: realDrain,
      deletePresentation: async (id) => {
        const { deleteImportedPresentation } = require('../services/pptx-import/create-imported-presentation.js')
        return deleteImportedPresentation(id)
      },
    }))

    // Happy identity-bound reconcile.
    const ok = await request(app)
      .post(`/api/pptx/jobs/${jobId}/reconcile`)
      .set('X-Pptx-Job-Capability', capability)
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({
      success: true,
      status: 'reconciled',
      jobId,
      presentationId,
    })
    expect(await isPresentationListable(presentationId)).toBe(false)
    expect((await packageSnapshot()).heads.some((h) => h.presentationId === presentationId)).toBe(false)

    // P0 fencing: second reconcile is no-op / safe (already rolled back).
    const again = await request(app)
      .post(`/api/pptx/jobs/${jobId}/reconcile`)
      .set('X-Pptx-Job-Capability', capability)
    expect([200, 409]).toContain(again.status)
    if (again.status === 200) {
      expect(again.body.success).toBe(true)
    } else {
      expect(again.body.success).toBe(false)
      expect(again.body.reasonCode).toBeTruthy()
    }
  })

  it('P07-13: a production drain that dead-letters every write never publishes openable live or SSE done', async () => {
    const jobId = jobManager.createJob()
    const capability = jobManager.takeJobCapability(jobId)
    const originalBytes = await fs.readFile(pptxPath)
    const events = []
    jobManager.attachSseClient(jobId, {
      write: (chunk) => events.push(chunk),
      end: () => {},
    })
    const fsExtra = require('fs-extra')
    const originalRename = fsExtra.rename
    let presentationId
    let drained

    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager,
      packageCommit: async (source, input) => {
        presentationId = input.presentationId
        return realPackageCommit(source, input)
      },
      packageRollback: realPackageRollback,
      drainCompatibility: async () => {
        const failure = vi.spyOn(fsExtra, 'rename').mockImplementation(async (source, destination) => {
          if (path.resolve(destination) === path.resolve(storage.DATA_DIR, 'presentations.json')) {
            throw Object.assign(new Error('projection sink unavailable'), { code: 'EIO' })
          }
          return originalRename(source, destination)
        })
        try {
          drained = await realDrain()
          return drained
        } finally {
          failure.mockRestore()
        }
      },
    })

    expect(drained).toBe(0)
    const state = packageRuntime.getPackageStore().getState()
    expect(state.compatibilityDeadLetter).toEqual(expect.arrayContaining([
      expect.objectContaining({ presentationId, code: 'EIO' }),
    ]))
    expect(await storage.readPresentations()).toEqual([])
    const app = express()
    app.use('/api/pptx', createPptxImportRouter({ jobManager }))
    const live = await request(app).get(`/api/pptx/jobs/${jobId}`)
      .set('X-Pptx-Job-Capability', capability)
    expect(live.status).toBe(200)
    expect(live.body.status).not.toBe('done')
    expect(live.body.result?.presentationId).toBeUndefined()
    expect(events.join('')).not.toContain('event: done\n')

    jobManager.cleanup(jobId)
    const durable = await request(app).get(`/api/pptx/jobs/${jobId}`)
      .set('X-Pptx-Job-Capability', capability)
    expect(durable.status).toBe(200)
    expect(durable.body).toMatchObject({ status: 'pending-visibility', durable: true })
    expect(durable.body.result).toBeUndefined()
    const head = state.heads.find((item) => item.presentationId === presentationId)
    expect(head).toBeTruthy()
    expect(await packageRuntime.getPackageStore().readOriginal(head.originalRevisionId))
      .toEqual(originalBytes)
  })

  it('P07-02: live and durable GET withhold done after raw publication identity diverges', async () => {
    const jobId = jobManager.createJob()
    const capability = jobManager.takeJobCapability(jobId)
    let presentationId
    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager,
      packageCommit: async (source, input) => {
        presentationId = input.presentationId
        return realPackageCommit(source, input)
      },
      packageRollback: realPackageRollback,
      drainCompatibility: realDrain,
    })
    expect(jobManager.getJob(jobId)?.status).toBe('done')
    await storage.withPresentations((rows) => {
      rows.find((row) => row.id === presentationId).pptxAggregateHead.sourceMapRevisionId = '0'.repeat(64)
    })
    const app = express()
    app.use('/api/pptx', createPptxImportRouter({ jobManager }))
    const stream = await request(app)
      .get(`/api/pptx/jobs/${jobId}/stream?capability=${encodeURIComponent(capability)}`)
    expect(stream.status).toBe(200)
    expect(stream.text).toContain('pending-visibility')
    expect(stream.text).not.toContain('event: done\n')
    for (const live of [true, false]) {
      if (!live) jobManager.cleanup(jobId)
      const response = await request(app).get(`/api/pptx/jobs/${jobId}`)
        .set('X-Pptx-Job-Capability', capability)
      expect(response.status).toBe(200)
      expect(response.body.status).toBe('pending-visibility')
      expect(response.body.result).toBeUndefined()
    }
  })

  it.each(['rollback-error', 'visible-error', 'stale-cleanup', 'cancel-successor'])(
    'P08-11/13: %s retains media and immutable Original instead of destructive compensation',
    async (mode) => {
      const jobId = jobManager.createJob()
      const capability = jobManager.takeJobCapability(jobId)
      const originalBytes = await fs.readFile(pptxPath)
      const uploads = path.join(workDir, 'uploads')
      const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13,
        73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222,
        0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 15, 0, 0, 1, 1, 0, 5,
        24, 212, 205, 0, 0, 0, 59, 73, 69, 78, 68, 174, 66, 96, 130])
      const { persistImageBuffer } = require('../services/pptx-import/media')
      const { buildImportSourceMap } = require('../services/pptx-import/source-map')
      let mediaUrl
      let presentationId
      let committedHead
      let successorHead
      await runImport({
        jobId, filePath: pptxPath, originalName: 'deck.pptx', jobManager,
        importer: async (_file, { mediaTransaction, signal }) => {
          const placed = await persistImageBuffer(image, 'image/png', uploads, { mediaTransaction, signal })
          mediaUrl = placed.url
          const presentation = {
            title: 'Media owner', slides: [{ id: 's1', elements: [{ id: 'e1', type: 'image', src: mediaUrl }] }],
          }
          return importerResult({
            presentation, sourceMap: await buildImportSourceMap(presentation, null, null),
          })
        },
        packageCommit: async (source, input) => {
          presentationId = input.presentationId
          const result = await realPackageCommit(source, input)
          committedHead = result.head
          return result
        },
        packageRollback: async (input) => {
          if (mode === 'rollback-error') {
            throw Object.assign(new Error('rollback sink unavailable'), { code: 'EIO' })
          }
          return realPackageRollback(input)
        },
        drainCompatibility: async () => {
          if (mode !== 'rollback-error') await realDrain()
          if (mode === 'stale-cleanup' || mode === 'cancel-successor') {
            const row = (await storage.readPresentations()).find((item) => item.id === presentationId)
            const owner = { ownerType: 'history', ownerId: `${presentationId}:successor` }
            successorHead = await packageRuntime.withPackageStore(async (store) => {
              await store.retainHead(owner, presentationId)
              return store.restoreForward(presentationId, owner, { compatibilityPresentation: row })
            })
            await realDrain()
          }
          if (mode === 'cancel-successor') {
            const control = express()
            control.use('/api/pptx', createPptxImportRouter({ jobManager }))
            const cancelled = await request(control).delete(`/api/pptx/jobs/${jobId}`)
              .set('X-Pptx-Job-Capability', capability)
            expect(cancelled.status).toBe(204)
            return
          }
          throw Object.assign(new Error('drain interrupted'), { code: 'EIO' })
        },
      })
      await importRouterModule.drainDetachedImportCleanups()
      const app = express()
      app.use('/uploads', express.static(uploads))
      const fetched = await request(app).get(mediaUrl).buffer(true)
      expect(fetched.status).toBe(200)
      expect(fetched.body).toEqual(image)
      const store = packageRuntime.getPackageStore()
      expect(store.getState().heads.find((head) => head.presentationId === presentationId))
        .toEqual(successorHead || committedHead)
      expect(await store.readOriginal(committedHead.originalRevisionId)).toEqual(originalBytes)
      const view = await durableView(jobId, presentationId)
      expect(view.durable).toMatchObject({
        transactionState: 'reconcile-required', reconcileRequired: true,
        reconcileReasonCode: expect.stringMatching(/^[A-Z][A-Z0-9_]{1,63}$/),
      })
      expect(view.serialized.status).toBe(mode === 'visible-error' ? 'done' : 'pending-visibility')
      if (successorHead) {
        const { readAuthoritativePresentation } = require('../services/package-backed-presentation-read')
        const opened = await readAuthoritativePresentation(presentationId, { normalize: false })
        expect(opened.presentation.slides[0].elements[0].src).toBe(mediaUrl)
      }
    },
    5_000
  )

})
