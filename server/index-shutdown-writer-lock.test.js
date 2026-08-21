// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The writer lock outlives the process that took it: a shutdown that skips the
// release leaves it on disk and the next boot refuses to start. Exercise
// stopServer directly rather than signalling a child — stopServer is the shared
// path for POSIX SIGTERM, a Windows console Ctrl+C, and an Electron quit, and
// child.kill() on Windows calls TerminateProcess without running JS handlers at
// all, so a signal-based test would assert nothing on this platform.

const envKeys = ['SLIDES_DATA_DIR', 'SLIDES_UPLOADS_DIR', 'NODE_ENV']
const dirs = []

async function findWriterLocks(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  const found = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await findWriterLocks(full)))
    else if (entry.name === 'writer.lock') found.push(full)
  }
  return found
}

// A fresh module registry per boot: the runtime holds the active store in module
// scope, so this is what makes a second import behave like a genuine restart.
async function boot(configureApp) {
  vi.resetModules()
  const serverModule = await import('./index.js')
  const { app, startServer, stopServer } = serverModule.default || serverModule
  configureApp?.(app)
  const server = await startServer(0)
  return {
    app,
    server,
    stopServer,
    async stop(options) {
      await stopServer(server, options)
    },
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('server shutdown', () => {
  it('releases the package store writer lock so the next boot still starts', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shutdown-lock-'))
    dirs.push(root)
    const saved = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
    const dataDir = path.join(root, 'data')
    process.env.SLIDES_DATA_DIR = dataDir
    process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
    process.env.NODE_ENV = 'development'

    let releaseRequest
    let markRequestStarted
    const requestStarted = new Promise((resolve) => {
      markRequestStarted = resolve
    })
    const requestRelease = new Promise((resolve) => {
      releaseRequest = resolve
    })

    try {
      const first = await boot((app) => {
        app.get('/__shutdown-drain-test', async (_req, res) => {
          markRequestStarted()
          await requestRelease
          res.json({ ok: true })
        })
      })
      expect(await findWriterLocks(dataDir)).toHaveLength(1)

      const address = first.server.address()
      const responsePromise = fetch(`http://127.0.0.1:${address.port}/__shutdown-drain-test`)
      await requestStarted
      const firstStop = first.stopServer(first.server, { drainTimeoutMs: 1000 })
      const secondStop = first.stopServer(first.server, { drainTimeoutMs: 1000 })
      expect(secondStop).toBe(firstStop)
      await new Promise((resolve) => setTimeout(resolve, 25))
      expect(await findWriterLocks(dataDir)).toHaveLength(1)

      releaseRequest()
      expect((await responsePromise).status).toBe(200)
      await firstStop
      expect(await findWriterLocks(dataDir)).toEqual([])

      // The lock file being gone is the mechanism; a second boot succeeding is
      // the property operators actually care about.
      const second = await boot()
      expect(second.server.listening).toBe(true)
      await second.stop()
    } finally {
      releaseRequest?.()
      for (const key of envKeys) {
        if (saved[key] == null) delete process.env[key]
        else process.env[key] = saved[key]
      }
      vi.resetModules()
    }
  })

})
