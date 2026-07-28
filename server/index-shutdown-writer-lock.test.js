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
async function boot() {
  vi.resetModules()
  const serverModule = await import('./index.js')
  const { startServer, stopServer } = serverModule.default || serverModule
  const server = await startServer(0)
  return {
    server,
    async stop() {
      server.closeAllConnections?.()
      await stopServer(server)
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

    try {
      const first = await boot()
      expect(await findWriterLocks(dataDir)).toHaveLength(1)

      await first.stop()
      expect(await findWriterLocks(dataDir)).toEqual([])

      // The lock file being gone is the mechanism; a second boot succeeding is
      // the property operators actually care about.
      const second = await boot()
      expect(second.server.listening).toBe(true)
      await second.stop()
    } finally {
      for (const key of envKeys) {
        if (saved[key] == null) delete process.env[key]
        else process.env[key] = saved[key]
      }
      vi.resetModules()
    }
  })
})
