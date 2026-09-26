// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import topologyModule from './services/health-state-topology.js'

const { assertSingleProcessTopology } = topologyModule
const touched = []
const originalDataDir = process.env.SLIDES_DATA_DIR
const originalUploadsDir = process.env.SLIDES_UPLOADS_DIR

afterEach(async () => {
  delete process.env.NAVSLIDES_WORKERS
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
  if (originalUploadsDir === undefined) delete process.env.SLIDES_UPLOADS_DIR
  else process.env.SLIDES_UPLOADS_DIR = originalUploadsDir
  vi.resetModules()
  await Promise.all(touched.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('single-process topology', () => {
  it('accepts an explicit process count of one', () => {
    expect(() => assertSingleProcessTopology({ NAVSLIDES_WORKERS: '1' })).not.toThrow()
  })

  it.each([
    [{ NAVSLIDES_WORKERS: '2' }, {}],
    [{ WEB_CONCURRENCY: '4' }, {}],
    [{ PM2_INSTANCES: 'max' }, {}],
    [{}, { NODE_UNIQUE_ID: 'worker-1' }],
  ])('rejects unsupported worker and cluster settings with a stable code', (env, processLike) => {
    expect(() => assertSingleProcessTopology(env, processLike)).toThrowError(
      expect.objectContaining({
        code: 'UNSUPPORTED_MULTI_PROCESS_TOPOLOGY',
        message: 'UNSUPPORTED_MULTI_PROCESS_TOPOLOGY',
      })
    )
  })

  it('fails before package-store writer ownership is attempted', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-topology-'))
    touched.push(root)
    process.env.SLIDES_DATA_DIR = path.join(root, 'data')
    process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
    process.env.NAVSLIDES_WORKERS = '2'
    vi.resetModules()
    const imported = await import('./index.js')
    const { startServer } = imported.default || imported

    await expect(startServer(0)).rejects.toMatchObject({
      code: 'UNSUPPORTED_MULTI_PROCESS_TOPOLOGY',
    })
    const entries = await fs.readdir(path.join(root, 'data'), { recursive: true }).catch(() => [])
    expect(entries.filter((entry) => entry.endsWith('writer.lock'))).toEqual([])
  })
})
