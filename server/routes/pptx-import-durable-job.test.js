import { randomUUID } from 'node:crypto'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import * as storage from '../services/storage.js'
import packageStoreModule from '../services/pptx-import/package-store/index.js'
import jobManagerModule from '../services/pptx-import-job-manager.js'
import importRouterModule from './pptx-import.js'

const { openPackageStore } = packageStoreModule
const { hashCapability } = jobManagerModule
const { createPptxImportRouter, getDurableImportJob, serializeDurableImportJob } = importRouterModule
const DURABLE_CONTROL_CAPABILITY = 'durable-control-capability'
const DURABLE_CONTROL_HASH = hashCapability(DURABLE_CONTROL_CAPABILITY)
const OUTCOME_IDENTITY = {
  outcomeRevisionId: 'revision-1',
  outcomeGeneration: 1,
  outcomeHeadHash: 'f'.repeat(64),
}
const OUTCOME_EXPECTATION = {
  revisionId: OUTCOME_IDENTITY.outcomeRevisionId,
  generation: OUTCOME_IDENTITY.outcomeGeneration,
  headHash: OUTCOME_IDENTITY.outcomeHeadHash,
}

function authorize(requestBuilder) {
  return requestBuilder.set('X-Pptx-Job-Capability', DURABLE_CONTROL_CAPABILITY)
}

function packageReceipt(fields) {
  return {
    ...fields,
    controlCapabilityHash: DURABLE_CONTROL_HASH,
    ...OUTCOME_IDENTITY,
  }
}

function createApp(options) {
  const app = express()
  app.use('/api/pptx', createPptxImportRouter(options))
  return app
}

function manager() {
  return {
    getJob: vi.fn(() => null),
    serializeJob: vi.fn(),
    createJob: vi.fn(() => 'unused'),
    cleanup: vi.fn(),
    cancelJob: vi.fn(() => 'unknown'),
  }
}

describe('durable PPTX import job authority', () => {
  it('serves a durable completed receipt after the in-memory TTL', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cc'
    const durable = packageReceipt({
      id: jobId,
      kind: 'import',
      status: 'completed',
      transactionState: 'committed',
      cancellationPoint: 'committed',
      capabilityHash: 'a'.repeat(64),
      presentationId: 'presentation-late',
    })
    const response = await authorize(request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
      checkPresentationListable: vi.fn(async () => true),
    })).get(`/api/pptx/jobs/${jobId}`))

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      jobId,
      status: 'done',
      durable: true,
      result: { presentationId: 'presentation-late' },
      transactionState: 'committed',
    })
  })

  it('withholds openable done while listable presentation is missing (contract B)', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cc'
    const durable = packageReceipt({
      id: jobId,
      kind: 'import',
      status: 'completed',
      transactionState: 'committed',
      cancellationPoint: 'committed',
      capabilityHash: 'a'.repeat(64),
      presentationId: 'presentation-pending',
    })
    const response = await authorize(request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
      checkPresentationListable: vi.fn(async () => false),
    })).get(`/api/pptx/jobs/${jobId}`))

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      jobId,
      status: 'pending-visibility',
      durable: true,
      transactionState: 'committed',
    })
    expect(response.body.result).toBeUndefined()
  })

  it('reads a persisted receipt after the in-memory job is unavailable', async () => {
    const jobId = randomUUID()
    storage.initDataFiles()
    const store = await openPackageStore({ rootDir: path.resolve(storage.DATA_DIR) })
    await store.acquireWriter()
    try {
      await store.putJob({
        id: jobId, kind: 'import', status: 'completed', capabilityHash: 'e'.repeat(64),
        transactionState: 'committed', cancellationPoint: 'committed', presentationId: 'presentation-restarted',
      })
      await expect(getDurableImportJob(jobId)).resolves.toMatchObject({
        id: jobId, status: 'completed', presentationId: 'presentation-restarted',
      })
    } finally {
      await store.mutate((next) => {
        next.jobs = next.jobs.filter((job) => job.id !== jobId)
      })
      await store.releaseWriter()
    }
  })

  it('denies legacy durable receipts without a control capability hash', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541ce'
    const response = await request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => ({
        id: jobId,
        kind: 'import',
        status: 'completed',
        capabilityHash: 'a'.repeat(64),
        presentationId: 'presentation-legacy',
      })),
    })).get(`/api/pptx/jobs/${jobId}`)

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({
      error: 'job-capability-required',
      code: 'JOB_CAPABILITY_REQUIRED',
    })
  })

  it('does not report a durable completed receipt as an unknown cancellation target', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cc'
    const durable = packageReceipt({
      id: jobId,
      kind: 'import',
      status: 'completed',
      transactionState: 'committed',
      cancellationPoint: 'committed',
      capabilityHash: 'a'.repeat(64),
      presentationId: 'presentation-late',
    })
    const response = await authorize(request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
      checkPresentationListable: vi.fn(async () => true),
    })).delete(`/api/pptx/jobs/${jobId}`))

    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({
      error: 'job-too-late',
      code: 'JOB_CANCEL_TOO_LATE',
      status: 'done',
      job: { jobId, status: 'done', result: { presentationId: 'presentation-late' } },
    })
  })

  it('durable DELETE withholds presentationId when projection is not listable (Contract B)', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cd'
    const checkPresentationListable = vi.fn(async () => false)
    const durable = packageReceipt({
      id: jobId,
      kind: 'import',
      status: 'completed',
      transactionState: 'committed',
      cancellationPoint: 'committed',
      capabilityHash: 'c'.repeat(64),
      presentationId: 'presentation-not-listable',
    })
    const response = await authorize(request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
      checkPresentationListable,
    })).delete(`/api/pptx/jobs/${jobId}`))

    expect(response.status).toBe(409)
    expect(checkPresentationListable).toHaveBeenCalledWith(
      'presentation-not-listable',
      OUTCOME_EXPECTATION,
    )
    expect(response.body).toMatchObject({
      error: 'job-too-late',
      code: 'JOB_CANCEL_TOO_LATE',
      status: 'pending-visibility',
      job: {
        jobId,
        status: 'pending-visibility',
        durable: true,
      },
    })
    expect(response.body.job.result).toBeUndefined()
  })

  it('reconciles a late package-backed completion by durable job identity', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cc'
    const durable = packageReceipt({
      id: jobId,
      kind: 'import',
      status: 'completed',
      transactionState: 'committed',
      cancellationPoint: 'committed',
      capabilityHash: 'b'.repeat(64),
      presentationId: 'presentation-late',
    })
    const deletePresentation = vi.fn(async () => true)
    const packageRollback = vi.fn(async () => {})
    const drainCompatibility = vi.fn(async () => 1)
    const response = await authorize(request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
      deletePresentation,
      packageRollback,
      drainCompatibility,
    })).post(`/api/pptx/jobs/${jobId}/reconcile`))

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      status: 'reconciled',
      jobId,
      presentationId: 'presentation-late',
    })
    expect(packageRollback).toHaveBeenCalledWith({ jobId, presentationId: 'presentation-late' })
    expect(drainCompatibility).toHaveBeenCalledTimes(1)
    expect(deletePresentation).toHaveBeenCalledWith('presentation-late')
  })

  it('returns cleanup identity when package rollback fails', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cc'
    const durable = packageReceipt({
      id: jobId,
      kind: 'import',
      status: 'completed',
      capabilityHash: 'c'.repeat(64),
      presentationId: 'presentation-late',
    })
    const response = await authorize(request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
      packageRollback: vi.fn(async () => {
        throw Object.assign(new Error('writer unavailable'), { code: 'LEGACY_IMPORT_RECEIPT_UNSUPPORTED' })
      }),
      deletePresentation: vi.fn(),
    })).post(`/api/pptx/jobs/${jobId}/reconcile`))

    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({
      success: false,
      error: 'package-import-reconciliation-failed',
      reasonCode: 'LEGACY_IMPORT_RECEIPT_UNSUPPORTED',
      jobId,
      presentationId: 'presentation-late',
    })
  })

  it('maps durable non-terminal receipts without exposing package internals', () => {
    expect(serializeDurableImportJob({
      id: 'job', kind: 'import', status: 'running', capabilityHash: 'd'.repeat(64),
    })).toMatchObject({
      jobId: 'job', status: 'running', durable: true, percent: 0,
    })
  })

  it('tells a failed durable receipt apart by whether its partial import was cleaned up', () => {
    expect(serializeDurableImportJob({
      id: 'job-rolled-back',
      kind: 'import',
      status: 'failed',
      transactionState: 'rolled-back',
      cancellationPoint: 'rolled-back',
      capabilityHash: 'f'.repeat(64),
    })).toMatchObject({
      status: 'failed',
      message: 'Import failed; partial import rolled back',
    })
    expect(serializeDurableImportJob({
      id: 'job-cancelled-clean',
      kind: 'import',
      status: 'cancelled',
      transactionState: 'rolled-back',
      cancellationPoint: 'rolled-back',
      capabilityHash: 'f'.repeat(64),
    })).toMatchObject({
      status: 'cancelled',
      message: 'Import cancelled; partial import rolled back',
    })
    expect(serializeDurableImportJob({
      id: 'job-failed-before-commit',
      kind: 'import',
      status: 'failed',
      transactionState: 'requested',
      cancellationPoint: 'cancellable',
      capabilityHash: 'f'.repeat(64),
    })).toMatchObject({ status: 'failed', message: 'Import failed' })
  })

  it('includes reportSummary on durable done result without unbounded warnings (R4)', () => {
    const reportSummary = {
      schemaVersion: 1,
      warningCount: 12,
      byType: { 'media-missing': 5, other: 7 },
      unsupportedFeatureCount: 0,
      omittedCount: 2,
    }
    expect(serializeDurableImportJob({
      id: 'job-report',
      kind: 'import',
      status: 'completed',
      presentationId: 'pres-1',
      reportSummary,
      capabilityHash: 'e'.repeat(64),
    }, { listable: true })).toMatchObject({
      jobId: 'job-report',
      status: 'done',
      durable: true,
      result: {
        presentationId: 'pres-1',
        reportSummary,
      },
    })
    expect(serializeDurableImportJob({
      id: 'job-report',
      kind: 'import',
      status: 'completed',
      presentationId: 'pres-1',
      capabilityHash: 'e'.repeat(64),
      warnings: Array.from({ length: 500 }, () => ({ type: 'x', message: 'y' })),
    }, { listable: true, reportSummary })).toEqual(expect.objectContaining({
      result: {
        presentationId: 'pres-1',
        reportSummary,
      },
    }))
    const serialized = serializeDurableImportJob({
      id: 'job-report',
      kind: 'import',
      status: 'completed',
      presentationId: 'pres-1',
      capabilityHash: 'e'.repeat(64),
    }, { listable: true, reportSummary })
    expect(serialized.result).not.toHaveProperty('warnings')
  })

  it('returns reportSummary on durable GET after Map miss when presentation exists (R4/Clear Map)', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cc'
    const reportSummary = {
      schemaVersion: 1,
      warningCount: 3,
      byType: { 'grouped-complex': 3 },
      unsupportedFeatureCount: 0,
      omittedCount: 0,
    }
    const durable = packageReceipt({
      id: jobId,
      kind: 'import',
      status: 'completed',
      transactionState: 'committed',
      cancellationPoint: 'committed',
      capabilityHash: 'a'.repeat(64),
      presentationId: 'presentation-with-report',
      reportSummary,
    })
    const response = await authorize(request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
      checkPresentationListable: vi.fn(async () => true),
      loadReportSummary: vi.fn(async () => reportSummary),
    })).get(`/api/pptx/jobs/${jobId}`))

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      jobId,
      status: 'done',
      durable: true,
      result: {
        presentationId: 'presentation-with-report',
        reportSummary,
      },
    })
    expect(response.body.result.warnings).toBeUndefined()
  })

  it('refuses to reconcile a non-terminal durable receipt with a presentation identity', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cc'
    const packageRollback = vi.fn()
    const deletePresentation = vi.fn()
    const response = await authorize(request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => ({
        id: jobId,
        kind: 'import',
        status: 'running',
        capabilityHash: 'd'.repeat(64),
        controlCapabilityHash: DURABLE_CONTROL_HASH,
        presentationId: 'presentation-mixed-state',
      })),
      packageRollback,
      deletePresentation,
    })).post(`/api/pptx/jobs/${jobId}/reconcile`))

    expect(response).toMatchObject({
      status: 409,
      body: { code: 'JOB_NOT_TERMINAL' },
    })
    expect(packageRollback).not.toHaveBeenCalled()
    expect(deletePresentation).not.toHaveBeenCalled()
  })

  it('restart interleave: concurrent GETs stay visibility-safe until listable flips', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cc'
    const reportSummary = {
      schemaVersion: 1,
      warningCount: 1,
      byType: { 'media-missing': 1 },
      unsupportedFeatureCount: 0,
      omittedCount: 0,
    }
    const durable = packageReceipt({
      id: jobId,
      kind: 'import',
      status: 'completed',
      transactionState: 'committed',
      cancellationPoint: 'committed',
      capabilityHash: 'a'.repeat(64),
      presentationId: 'presentation-interleave',
      reportSummary,
    })
    let listable = false
    const app = createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
      checkPresentationListable: vi.fn(async () => listable),
      loadReportSummary: vi.fn(async () => reportSummary),
    })

    const [pendingA, pendingB] = await Promise.all([
      authorize(request(app).get(`/api/pptx/jobs/${jobId}`)),
      authorize(request(app).get(`/api/pptx/jobs/${jobId}`)),
    ])
    for (const response of [pendingA, pendingB]) {
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({ status: 'pending-visibility', durable: true })
      expect(response.body.result).toBeUndefined()
    }

    listable = true
    const [openA, openB] = await Promise.all([
      authorize(request(app).get(`/api/pptx/jobs/${jobId}`)),
      authorize(request(app).get(`/api/pptx/jobs/${jobId}`)),
    ])
    for (const response of [openA, openB]) {
      expect(response.body).toMatchObject({
        status: 'done',
        durable: true,
        result: { presentationId: 'presentation-interleave', reportSummary },
      })
      expect(response.body.result.warnings).toBeUndefined()
    }
  })
})
