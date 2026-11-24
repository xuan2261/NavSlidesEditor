// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import express from 'express'
import request from 'supertest'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const storage = require('../services/storage')
const runtime = require('../services/pptx-import/package-store-runtime')
const { savePackageProjection } = require('../services/generation-safe-save')
const { readAuthoritativePresentation } = require('../services/package-backed-presentation-read')
const { createPptxImportRouter, isPresentationListable } = require('./pptx-import')
const { hashCapability } = require('../services/pptx-import-job-manager')
const { resolveEditedExportContext } = require('../services/pptx-import/validated-edited-export-context')
const capability = 'successor-visibility-capability'
let workDir
let presentationId
let jobId
let outcome
let app

async function getJob() {
  return request(app).get(`/api/pptx/jobs/${jobId}`).set('X-Pptx-Job-Capability', capability)
}

async function save() {
  const current = await readAuthoritativePresentation(presentationId)
  const saved = await savePackageProjection({
    presentationId,
    expectedGeneration: current.generation,
    baseRevisionId: current.presentation.pptxAggregateHead.packageRevisionId,
    idempotencyKey: randomUUID(),
    after: { ...current.presentation, title: `Saved ${current.generation}` },
    loadStored: async () => current.presentation,
  })
  expect(saved.ok).toBe(true)
  await runtime.drainPackageCompatibilityOutbox()
}

describe('durable import visibility after server-owned saves', () => {
  beforeEach(async () => {
    await runtime.shutdownPackageStore()
    storage.initDataFiles()
    await storage.writePresentations([])
    await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-successor-'))
    presentationId = randomUUID()
    jobId = randomUUID()
    const projection = { id: presentationId, title: 'Imported', theme: 'white', slides: [] }
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<Types />')
    zip.file('ppt/presentation.xml', '<p:presentation />')
    const file = path.join(workDir, 'deck.pptx')
    await fs.writeFile(file, await zip.generateAsync({ type: 'nodebuffer' }))
    await runtime.withPackageStore((store) =>
      store.commitImport(file, {
        jobId,
        presentationId,
        projection,
        sourceMap: { entries: {} },
        compatibilityPresentation: projection,
        controlCapabilityHash: hashCapability(capability),
      })
    )
    await runtime.drainPackageCompatibilityOutbox()
    const job = runtime.getPackageStore().getJob(jobId)
    outcome = {
      revisionId: job.outcomeRevisionId,
      generation: job.outcomeGeneration,
      headHash: job.outcomeHeadHash,
    }
    app = express()
    app.use(
      '/api/pptx',
      createPptxImportRouter({
        jobManager: { getJob: () => null, cancelJob: () => 'unknown' },
      })
    )
  })

  afterEach(async () => {
    await runtime.shutdownPackageStore()
    await fs.rm(workDir, { recursive: true, force: true })
  })

  it('keeps durable GET done after import, two saves, and package-store restart', async () => {
    expect((await getJob()).body.status).toBe('done')
    await save()
    await save()
    await runtime.shutdownPackageStore()
    await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
    const response = await getJob()
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      status: 'done',
      durable: true,
      result: { presentationId },
    })
    // Commit, reconciliation, rollback, and cancellation retain the exact fence.
    expect(await isPresentationListable(presentationId, outcome)).toBe(false)
    const cancelled = await request(app)
      .delete(`/api/pptx/jobs/${jobId}`)
      .set('X-Pptx-Job-Capability', capability)
    expect(cancelled.status).toBe(409)
    expect(cancelled.body.job.status).toBe('done')
    await expect(
      runtime.withPackageStore((store) =>
        store.rollbackImport({
          jobId,
          presentationId,
        })
      )
    ).rejects.toThrow('authority no longer matches')
  })

  it('revalidates committed export authority after a warm read and in-place corruption', async () => {
    const state = runtime.getPackageStore().getState()
    expect(resolveEditedExportContext(state, presentationId).ok).toBe(true)
    expect((await readAuthoritativePresentation(presentationId)).presentation.title).toBe('Imported')
    await runtime.withPackageStore((store) => store.mutate((next) => {
      next.mutationResults.find((item) => item.idempotencyKey === jobId).projection.title = 'Not imported'
    }))
    expect(resolveEditedExportContext(runtime.getPackageStore().getState(), presentationId)).toEqual({
      ok: false,
      reasonCode: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
    })
    await expect(readAuthoritativePresentation(presentationId)).rejects.toMatchObject({
      code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
    })
    const response = await getJob()
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('pending-visibility')
    expect(response.body.result).toBeUndefined()
  })

  it.each([
    [
      'legacy import authority without retained head hash',
      (state) => {
        delete state.mutationResults.find((item) => item.idempotencyKey === jobId).importHeadHash
      },
    ],
    [
      'legacy receipt',
      (state) => {
        const job = state.jobs.find((item) => item.id === jobId)
        delete job.outcomeRevisionId
        delete job.outcomeGeneration
        delete job.outcomeHeadHash
      },
    ],
    [
      'conflicting receipt hash',
      (state) => {
        state.jobs.find((item) => item.id === jobId).outcomeHeadHash = 'f'.repeat(64)
      },
    ],
    [
      'conflicting receipt revision',
      (state) => {
        state.jobs.find((item) => item.id === jobId).outcomeRevisionId = 'other-revision'
      },
    ],
    [
      'conflicting receipt presentation',
      (state) => {
        state.jobs.find((item) => item.id === jobId).presentationId = randomUUID()
      },
    ],
    [
      'missing import authority',
      (state) => {
        state.mutationResults = state.mutationResults.filter(
          (item) => item.idempotencyKey !== jobId
        )
      },
    ],
    [
      'conflicting import receipt',
      (state) => {
        state.mutationResults.find((item) => item.idempotencyKey === jobId).idempotencyKey =
          randomUUID()
      },
    ],
    [
      'conflicting original',
      (state) => {
        state.heads.find((item) => item.presentationId === presentationId).originalRevisionId =
          'other-original'
      },
    ],
    [
      'missing saved authority',
      (state) => {
        state.mutationResults = state.mutationResults.filter((item) => item.generation !== 2)
      },
    ],
    [
      'conflicting saved projection',
      (state) => {
        state.mutationResults.find((item) => item.generation === 2).projection.title = 'Not saved'
      },
      'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
    ],
  ])('withholds visibility for %s', async (_label, corrupt, consumerError) => {
    await save()
    expect((await readAuthoritativePresentation(presentationId)).presentation.title).toBe('Saved 1')
    await runtime.withPackageStore((store) => store.mutate(corrupt))
    if (consumerError) {
      await expect(readAuthoritativePresentation(presentationId)).rejects.toMatchObject({
        code: consumerError,
      })
    }
    const response = await getJob()
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('pending-visibility')
    expect(response.body.result).toBeUndefined()
  })
})
