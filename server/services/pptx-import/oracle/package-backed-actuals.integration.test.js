// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodePngRgba } from './png-rgba.js'
import actuals from './package-backed-actuals.js'

const { capturePackageBackedActuals } = actuals
const dirs = []
const envKeys = ['SLIDES_DATA_DIR', 'SLIDES_UPLOADS_DIR', 'NODE_ENV']

function screenshot() {
  return encodePngRgba(16, 16, Buffer.alloc(16 * 16 * 4, 255))
}

async function closeServer(server) {
  server.closeAllConnections?.()
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

function restoreEnvironment(saved) {
  for (const key of envKeys) {
    if (saved[key] == null) delete process.env[key]
    else process.env[key] = saved[key]
  }
  vi.resetModules()
}

async function startIsolatedServer(root) {
  const saved = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  let server = null
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  process.env.NODE_ENV = 'development'
  try {
    vi.resetModules()
    const serverModule = await import('../../../index.js')
    const { startServer } = serverModule.default || serverModule
    server = await startServer(0)
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('ephemeral-server-address-unavailable')
    return {
      baseUrl: `http://127.0.0.1:${address.port}`,
      async stop() {
        try { await closeServer(server) } finally { restoreEnvironment(saved) }
      },
    }
  } catch (error) {
    if (server) await closeServer(server).catch(() => {})
    restoreEnvironment(saved)
    throw error
  }
}

afterEach(async () => Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))))

describe('package-backed actual capture over loopback HTTP', () => {
  it('imports, fences R0, captures identity, and permanently cleans up a real package', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oracle-http-'))
    dirs.push(root)
    const server = await startIsolatedServer(root)
    try {
      const sourcePath = path.resolve('server/data/test-corpus/background-image-notes-footer.pptx')
      let capturedPresentationId = null
      const calls = []
      const fetchImpl = (url, init = {}) => {
        calls.push({ path: new URL(url).pathname, method: init.method || 'GET', headers: init.headers || null })
        return fetch(url, init)
      }
      const result = await capturePackageBackedActuals({
        baseUrl: server.baseUrl,
        sourcePath,
        outDir: path.join(root, 'actuals'),
        fetchImpl,
        pollIntervalMs: 20,
        timeoutMs: 30_000,
        capturePresent: async (presentation, options) => {
          capturedPresentationId = presentation.id
          const count = presentation.slides.reduce((total, slide) => total + 1 + (slide.children?.length || 0), 0)
          const directory = path.join(options.outDir, options.deckStem)
          await fs.mkdir(directory, { recursive: true })
          const files = await Promise.all(Array.from({ length: count }, async (_value, index) => {
            const file = path.join(directory, `slide-${index}.png`)
            await fs.writeFile(file, screenshot())
            return file
          }))
          return { ok: true, files }
        },
      })

      expect(result.ok).toBe(true)
      expect(result).toMatchObject({
        ok: true,
        actual: {
          authority: 'package-backed-http',
          source: { fileName: 'background-image-notes-footer.pptx' },
          presentation: {
            id: expect.any(String), packageRevisionId: expect.any(String), packageHeadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            aggregateGeneration: expect.any(Number), originalSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            originalByteLength: expect.any(Number),
          },
        },
      })
      expect(capturedPresentationId).toBe(result.actual.presentation.id)
      expect(calls.map(({ path: requestPath, method }) => `${method} ${requestPath}`)).toEqual(expect.arrayContaining([
        'POST /api/pptx/import', `GET /api/pptx/jobs/${result.actual.jobId}`,
        `GET /api/presentations/${result.actual.presentation.id}`,
        `GET /api/presentations/${result.actual.presentation.id}/pptx-package-snapshot`,
        `GET /api/presentations/${result.actual.presentation.id}/pptx-original`,
        `DELETE /api/presentations/${result.actual.presentation.id}/permanent`,
      ]))
      const original = calls.find(({ path: requestPath }) => requestPath.endsWith('/pptx-original'))
      expect(original.headers).toEqual({
        'If-Pptx-Generation': String(result.actual.presentation.aggregateGeneration),
        'If-Pptx-Package-Revision': result.actual.presentation.packageRevisionId,
        'If-Pptx-Package-Head-Hash': result.actual.presentation.packageHeadHash,
      })
      const removed = await fetch(`${server.baseUrl}/api/presentations/${encodeURIComponent(result.actual.presentation.id)}`)
      expect(removed.status).toBe(404)
    } finally {
      await server.stop()
    }
  }, 180_000)
})
