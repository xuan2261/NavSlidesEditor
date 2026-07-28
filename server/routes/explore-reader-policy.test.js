// @vitest-environment node
/**
 * Explore shared-reader policy: quarantined/missing-head public decks are omitted,
 * healthy public decks remain; list must not fail with list-wide 500/422.
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import express from 'express'

const dataDir = path.join(
  os.tmpdir(),
  `navslides-explore-reader-policy-${process.pid}-${Date.now()}`
)
process.env.SLIDES_DATA_DIR = dataDir

const storage = await import('../services/storage.js')
const exploreRouter = (await import('./explore.js')).default

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/explore', exploreRouter)
  return app
}

describe('explore reader policy for package authority quarantine', () => {
  beforeEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true })
    await fs.mkdir(dataDir, { recursive: true })
    storage.initDataFiles()
  })

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true })
  })

  it('returns healthy public decks when another public deck has a missing package head', async () => {
    await storage.writePresentations([
      {
        id: 'public-healthy',
        title: 'Healthy Public',
        slides: [{ id: 's1', elements: [] }],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'public-ghost',
        title: 'Ghost Public',
        slides: [],
        pptxAggregateHead: {
          presentationId: 'public-ghost',
          packageRevisionId: 'r0-missing',
          generation: 1,
        },
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ])
    await storage.writeShareTokens({
      tokHealthy: { presentationId: 'public-healthy' },
      tokGhost: { presentationId: 'public-ghost' },
    })

    const response = await request(createApp()).get('/api/explore')
    expect(response.status).toBe(200)
    expect(response.body.presentations).toEqual([
      expect.objectContaining({ id: 'public-healthy', title: 'Healthy Public' }),
    ])
    expect(response.headers['x-explore-quarantined-count']).toBe('1')
  })
})
