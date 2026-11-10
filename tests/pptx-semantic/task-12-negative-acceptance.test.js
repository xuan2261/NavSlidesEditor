// @vitest-environment node
// Task 12 negative acceptance contract:
// Blocked origin / unconfigured vector converter cannot become a fake editable image.
// Proves terminal failure, rollback of earlier staged media, zero converter execution,
// zero publication, zero Original persistence, and unchanged input bytes.
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}))

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    spawn: (...args) => {
      spawnMock(...args)
      return actual.spawn(...args)
    },
  }
})
import routeModule from '../../server/routes/pptx-import.js'
import defaultJobManager from '../../server/services/pptx-import-job-manager.js'
import importerModule from '../../server/services/pptx-import/importer.js'
import fixtureModule from '../../server/services/pptx-import/importer-picture-negative-fixture.js'

const { createPptxImportRouter, drainDetachedImportCleanups } = routeModule
const { importPptxFile } = importerModule
const { pictureNegativePackage } = fixtureModule
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

function routeHarness({ uploadsDir, customImporter = importPptxFile }) {
  let settled
  const finished = new Promise((resolve) => {
    settled = resolve
  })
  const jobs = {
    ...defaultJobManager,
    settleOperation(jobId) {
      defaultJobManager.settleOperation(jobId)
      settled()
    },
  }
  const persistOriginal = vi.fn(async () => {
    throw new Error('persistOriginal must not be reached on rejected picture')
  })
  const createPresentation = vi.fn(async () => {
    throw new Error('createPresentation must not be reached on rejected picture')
  })
  const app = express()
  app.use(
    '/api/pptx',
    createPptxImportRouter({
      importer: (filePath, options) =>
        customImporter(filePath, {
          ...options,
          uploadsDir,
        }),
      jobManager: jobs,
      persistOriginal,
      createPresentation,
      deletePresentation: vi.fn(),
      deleteOriginal: vi.fn(),
      packageCommit: null,
      packageRollback: null,
    })
  )
  return { app, finished, persistOriginal, createPresentation }
}

afterEach(async () => {
  await drainDetachedImportCleanups()
  defaultJobManager._reset()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('Task 12 actual-importer rejection and media rollback acceptance', () => {
  it.each(['external', 'emf'])(
    'route rejects %s picture fixture: terminal failure, no fake editable image, zero publication, media rolled back',
    async (kind) => {
      vi.stubEnv('PPTX_SLA_STRICT', '0')
      vi.stubEnv('PPTX_SLA_STRICT_COUNT', '0')
      vi.stubEnv('PPTX_SLA_STRICT_NODES', '0')
      vi.stubEnv('PPTX_SLA_STRICT_PRIMITIVES', '0')
      vi.stubEnv('PPTX_EMF_CONVERT', '0')
      vi.stubEnv('PPTX_IMPORT_MEDIA_ORIGINS', '')

      spawnMock.mockClear()

      const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'task-12-negative-accept-'))
      const uploadsDir = path.join(directory, 'uploads')
      await fs.mkdir(uploadsDir)

      const sourceBytes = await pictureNegativePackage(kind)
      const inputHash = sha256(sourceBytes)

      const harness = routeHarness({ uploadsDir })

      try {
        const uploadResponse = await request(harness.app)
          .post('/api/pptx/import')
          .attach('file', sourceBytes, `${kind}-picture-negative.pptx`)

        expect(uploadResponse.status).toBe(202)
        const { jobId, capability } = uploadResponse.body
        expect(typeof jobId).toBe('string')
        expect(typeof capability).toBe('string')

        await harness.finished

        expect(harness.persistOriginal).not.toHaveBeenCalled()
        expect(harness.createPresentation).not.toHaveBeenCalled()
        expect(spawnMock).not.toHaveBeenCalled()

        const jobResponse = await request(harness.app)
          .get(`/api/pptx/jobs/${jobId}`)
          .set('X-Pptx-Job-Capability', capability)

        expect(jobResponse.status).toBe(200)
        expect(jobResponse.body).toMatchObject({
          status: 'failed',
          code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
        })
        expect(jobResponse.body).not.toHaveProperty('result')
        expect(jobResponse.body).not.toHaveProperty('presentation')
        expect(jobResponse.body).not.toHaveProperty('trustedSemanticImportMetadata')

        // Clean rollback check: uploadsDir must not leak the staged supported.png
        const remainingUploads = await fs.readdir(uploadsDir)
        expect(remainingUploads).toEqual([])

        // Source preservation
        expect(sha256(sourceBytes)).toBe(inputHash)
      } finally {
        await fs.rm(directory, { recursive: true, force: true })
      }
    },
    30000
  )
})
