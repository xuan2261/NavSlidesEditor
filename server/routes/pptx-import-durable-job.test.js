import { randomUUID } from 'node:crypto'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import * as storage from '../services/storage.js'
import packageStoreModule from '../services/pptx-import/package-store/index.js'
import importRouterModule from './pptx-import.js'

const { openPackageStore } = packageStoreModule
const { createPptxImportRouter, getDurableImportJob, serializeDurableImportJob } = importRouterModule

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
    const durable = {
      id: jobId,
      kind: 'import',
      status: 'completed',
      transactionState: 'committed',
      cancellationPoint: 'committed',
      capabilityHash: 'a'.repeat(64),
      presentationId: 'presentation-late',
    }
    const response = await request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
    })).get(`/api/pptx/jobs/${jobId}`)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      jobId,
      status: 'done',
      durable: true,
      result: { presentationId: 'presentation-late' },
      transactionState: 'committed',
    })
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

  it('does not report a durable completed receipt as an unknown cancellation target', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cc'
    const durable = {
      id: jobId,
      kind: 'import',
      status: 'completed',
      transactionState: 'committed',
      cancellationPoint: 'committed',
      capabilityHash: 'a'.repeat(64),
      presentationId: 'presentation-late',
    }
    const response = await request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
    })).delete(`/api/pptx/jobs/${jobId}`)

    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({
      code: 'JOB_ALREADY_FINISHED',
      job: { jobId, status: 'done', result: { presentationId: 'presentation-late' } },
    })
  })

  it('reconciles a late package-backed completion by durable job identity', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cc'
    const durable = {
      id: jobId,
      kind: 'import',
      status: 'completed',
      transactionState: 'committed',
      cancellationPoint: 'committed',
      capabilityHash: 'b'.repeat(64),
      presentationId: 'presentation-late',
    }
    const deletePresentation = vi.fn(async () => true)
    const packageRollback = vi.fn(async () => {})
    const drainCompatibility = vi.fn(async () => 1)
    const response = await request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
      deletePresentation,
      packageRollback,
      drainCompatibility,
    })).post(`/api/pptx/jobs/${jobId}/reconcile`)

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
    const durable = {
      id: jobId,
      kind: 'import',
      status: 'completed',
      capabilityHash: 'c'.repeat(64),
      presentationId: 'presentation-late',
    }
    const response = await request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => durable),
      packageRollback: vi.fn(async () => {
        throw Object.assign(new Error('writer unavailable'), { code: 'LEGACY_IMPORT_RECEIPT_UNSUPPORTED' })
      }),
      deletePresentation: vi.fn(),
    })).post(`/api/pptx/jobs/${jobId}/reconcile`)

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

  it('refuses to reconcile a non-terminal durable receipt with a presentation identity', async () => {
    const jobId = '8f5fb4c5-8d26-4f83-9f3d-a7cd6f9541cc'
    const packageRollback = vi.fn()
    const deletePresentation = vi.fn()
    const response = await request(createApp({
      jobManager: manager(),
      readDurableJob: vi.fn(async () => ({
        id: jobId,
        kind: 'import',
        status: 'running',
        capabilityHash: 'd'.repeat(64),
        presentationId: 'presentation-mixed-state',
      })),
      packageRollback,
      deletePresentation,
    })).post(`/api/pptx/jobs/${jobId}/reconcile`)

    expect(response).toMatchObject({
      status: 409,
      body: { code: 'JOB_NOT_TERMINAL' },
    })
    expect(packageRollback).not.toHaveBeenCalled()
    expect(deletePresentation).not.toHaveBeenCalled()
  })
})
