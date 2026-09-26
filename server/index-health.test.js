// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const savedEnv = {}
let root
let runtime
let server

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-health-'))
  for (const key of ['SLIDES_DATA_DIR', 'SLIDES_UPLOADS_DIR', 'NODE_ENV']) {
    savedEnv[key] = process.env[key]
  }
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  process.env.NODE_ENV = 'development'
  vi.resetModules()
  const imported = await import('./index.js')
  runtime = imported.default || imported
})

afterAll(async () => {
  if (server) await runtime.stopServer(server).catch(() => {})
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.resetModules()
  await fs.rm(root, { recursive: true, force: true })
})

describe('server health endpoints', () => {
  it('separates liveness from startup, recovery degradation, and shutdown readiness', async () => {
    const liveStarted = Date.now()
    const live = await request(runtime.app).get('/health/live')
    expect(Date.now() - liveStarted).toBeLessThan(500)
    expect(live.status).toBe(200)
    expect(live.body).toMatchObject({ status: 'live', schemaVersion: 1, reasons: [] })

    const startup = await request(runtime.app).get('/health/ready')
    expect(startup.status).toBe(503)
    expect(startup.body.reasons).toEqual(['STARTING'])

    server = await runtime.startServer(0)
    const ready = await request(runtime.app).get('/health/ready')
    expect(ready.status).toBe(200)
    expect(ready.body).toMatchObject({ status: 'ready', reasons: [] })

    runtime.healthState.markDegraded('DURABLE_RECOVERY_REQUIRED')
    const degraded = await request(runtime.app).get('/health/ready')
    expect(degraded.status).toBe(503)
    expect(degraded.body.reasons).toEqual(['DURABLE_RECOVERY_REQUIRED'])
    expect(JSON.stringify(degraded.body)).not.toContain(root)

    runtime.healthState.markReady()
    const stopping = runtime.stopServer(server)
    const shutdown = await request(runtime.app).get('/health/ready')
    expect(shutdown.status).toBe(503)
    expect(shutdown.body.reasons).toEqual(['SHUTTING_DOWN'])
    await stopping
    server = null
  })
})
