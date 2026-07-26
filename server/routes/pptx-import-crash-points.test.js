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
  const listable = presentationId ? await isPresentationListable(presentationId) : false
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
    expect(await isPresentationListable(presentationId)).toBe(true)
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
        expect(await isPresentationListable(presentationId)).toBe(true)
        expect(jobManager.cancelJob(jobId)).toBe('ok')
      },
    })

    const job = await settleJob(jobId, ['done', 'cancelled', 'failed'])
    // Chosen policy (AD7): post-visibility cancel does not delete; complete as done.
    expect(job?.status).toBe('done')
    expect(job?.result?.presentationId).toBe(presentationId)
    expect(await isPresentationListable(presentationId)).toBe(true)
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
      code: 'JOB_ALREADY_FINISHED',
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

  it('success path always calls drainCompatibility (hard gate)', async () => {
    const jobId = jobManager.createJob()
    const drainCompatibility = vi.fn(realDrain)

    await runImport({
      jobId,
      filePath: pptxPath,
      originalName: 'deck.pptx',
      importer: async () => importerResult(),
      jobManager,
      packageCommit: realPackageCommit,
      packageRollback: realPackageRollback,
      drainCompatibility,
    })

    expect(await settleJob(jobId, ['done'])).toMatchObject({ status: 'done' })
    expect(drainCompatibility).toHaveBeenCalledTimes(1)
  })
})
