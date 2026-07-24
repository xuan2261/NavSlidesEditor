import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { encodePngRgba } from './png-rgba.js'
import actuals from './package-backed-actuals.js'

const { capturePackageBackedActuals, waitForCompletedJob } = actuals
const sha = (value) => createHash('sha256').update(value).digest('hex')

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function png() {
  const rgba = Buffer.alloc(16 * 16 * 4, 255)
  return encodePngRgba(16, 16, rgba)
}

function packageSnapshot(source, { presentationId = 'deck-1', revisionId = 'r0', head = 'head', generation = 1 } = {}) {
  return {
    schemaVersion: 1, presentationId, packageAuthority: { revisionId, headHash: sha(head) }, aggregateGeneration: generation,
    original: { sha256: sha(source), byteLength: source.length },
  }
}

describe('package-backed actual capture', () => {
  const dirs = []
  afterEach(async () => Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))))

  it('uses HTTP import/job/read/original/delete and records package identity', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-actuals-'))
    dirs.push(root)
    const source = Buffer.from('pptx source')
    const sourcePath = path.join(root, 'deck-a.pptx')
    await fs.writeFile(sourcePath, source)
    const calls = []
    let originalHeaders
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      calls.push(request)
      if (request.path === '/api/pptx/import') return response({ jobId: '4e9f231d-9e63-4c59-904f-3a5e1b1ac001' }, 202)
      if (request.path.includes('/api/pptx/jobs/')) return response({ status: 'done', result: { presentationId: 'deck-1' } })
      if (request.path === '/api/presentations/deck-1') return response({
        id: 'deck-1', aggregateGeneration: 4, slides: [{ id: 's1' }],
      })
      if (request.path === '/api/presentations/deck-1/pptx-package-snapshot') return response(packageSnapshot(source, { generation: 4 }))
      if (request.path === '/api/presentations/deck-1/pptx-original') {
        originalHeaders = init.headers
        return new Response(source)
      }
      if (request.path === '/api/presentations/deck-1/permanent') return response({ success: true })
      throw new Error(`unexpected ${request.method} ${request.path}`)
    }
    const capturePresent = async (_presentation, options) => {
      const deckDir = path.join(options.outDir, options.deckStem)
      await fs.mkdir(deckDir, { recursive: true })
      const output = path.join(deckDir, 'slide-0.png')
      await fs.writeFile(output, png())
      return { ok: true, files: [output] }
    }

    const result = await capturePackageBackedActuals({
      baseUrl: 'http://127.0.0.1:4010', sourcePath, outDir: path.join(root, 'actuals'),
      fetchImpl, capturePresent, inspectSource: async () => ({ slides: [{}] }), pollIntervalMs: 0,
    })

    expect(result).toMatchObject({
      ok: true,
      actual: {
        source: { fileName: 'deck-a.pptx', sha256: sha(source) },
        presentation: {
          id: 'deck-1', packageRevisionId: 'r0', packageHeadHash: sha('head'),
          aggregateGeneration: 4, originalSha256: sha(source), originalByteLength: source.length,
        },
      },
    })
    expect(result.actual.slides).toHaveLength(1)
    expect(calls).toEqual([
      { path: '/api/pptx/import', method: 'POST' }, { path: '/api/pptx/jobs/4e9f231d-9e63-4c59-904f-3a5e1b1ac001', method: 'GET' },
      { path: '/api/presentations/deck-1', method: 'GET' }, { path: '/api/presentations/deck-1/pptx-package-snapshot', method: 'GET' },
      { path: '/api/presentations/deck-1/pptx-original', method: 'GET' },
      { path: '/api/presentations/deck-1/pptx-package-snapshot', method: 'GET' },
      { path: '/api/presentations/deck-1/permanent', method: 'DELETE' },
    ])
    expect(originalHeaders).toEqual({
      'If-Pptx-Generation': '4', 'If-Pptx-Package-Revision': 'r0', 'If-Pptx-Package-Head-Hash': sha('head'),
    })
  })

  it('reports a stable code when a capture omits an expected screenshot', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-actuals-'))
    dirs.push(root)
    const source = Buffer.from('pptx source')
    const sourcePath = path.join(root, 'deck-a.pptx')
    await fs.writeFile(sourcePath, source)
    const calls = []
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      calls.push(request)
      if (request.path === '/api/pptx/import') return response({ jobId: 'job-1' }, 202)
      if (request.path === '/api/pptx/jobs/job-1') return response({ status: 'done', result: { presentationId: 'deck-1' } })
      if (request.path === '/api/presentations/deck-1') return response({ id: 'deck-1', aggregateGeneration: 1 })
      if (request.path === '/api/presentations/deck-1/pptx-package-snapshot') return response(packageSnapshot(source))
      if (request.path === '/api/presentations/deck-1/pptx-original') return new Response(source)
      if (request.path === '/api/presentations/deck-1/permanent') return response({ success: true })
      throw new Error(`unexpected ${request.method} ${request.path}`)
    }
    const result = await capturePackageBackedActuals({
      baseUrl: 'http://localhost:4010', sourcePath, outDir: path.join(root, 'actuals'), fetchImpl,
      capturePresent: async (_presentation, options) => ({ ok: true, files: [path.join(options.outDir, options.deckStem, 'slide-0.png')] }),
      inspectSource: async () => ({ slides: [{}] }), pollIntervalMs: 0,
    })

    expect(result).toMatchObject({ ok: false, error: 'actual-capture-read-failed', jobId: 'job-1' })
    expect(calls.at(-1)).toEqual({ path: '/api/presentations/deck-1/permanent', method: 'DELETE' })
  })

  it('rejects an authority identity that changes while screenshots are captured', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-actuals-'))
    dirs.push(root)
    const source = Buffer.from('pptx source')
    const sourcePath = path.join(root, 'deck-a.pptx')
    await fs.writeFile(sourcePath, source)
    let snapshotReads = 0
    const calls = []
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      calls.push(request)
      if (request.path === '/api/pptx/import') return response({ jobId: 'job-1' }, 202)
      if (request.path === '/api/pptx/jobs/job-1') return response({ status: 'done', result: { presentationId: 'deck-1' } })
      if (request.path === '/api/presentations/deck-1') return response({ id: 'deck-1', aggregateGeneration: 1 })
      if (request.path === '/api/presentations/deck-1/pptx-package-snapshot') {
        return response(packageSnapshot(source, snapshotReads++ === 0
          ? { generation: 1, head: 'head-1' }
          : { generation: 2, head: 'head-2' }))
      }
      if (request.path === '/api/presentations/deck-1/pptx-original') return new Response(source)
      if (request.path === '/api/presentations/deck-1/permanent') return response({ success: true })
      throw new Error(`unexpected ${request.method} ${request.path}`)
    }
    const capturePresent = async (_presentation, options) => {
      const file = path.join(options.outDir, options.deckStem, 'slide-0.png')
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, png())
      return { ok: true, files: [file] }
    }

    await expect(capturePackageBackedActuals({
      baseUrl: 'http://localhost:4010', sourcePath, outDir: path.join(root, 'actuals'), fetchImpl, capturePresent,
      inspectSource: async () => ({ slides: [{}] }), pollIntervalMs: 0,
    })).resolves.toMatchObject({ ok: false, error: 'package-authority-changed-during-capture', jobId: 'job-1' })
    expect(calls.at(-1)).toEqual({ path: '/api/presentations/deck-1/permanent', method: 'DELETE' })
  })

  it('rejects invalid capture boundaries before invoking the import endpoint', async () => {
    const fetchImpl = async () => { throw new Error('must not fetch') }
    await expect(capturePackageBackedActuals({
      baseUrl: 'http://localhost:4010', sourcePath: null, outDir: 'actuals', fetchImpl,
    })).resolves.toEqual({ ok: false, error: 'invalid-capture-options' })
  })

  it('atomically rejects a reused deck output before importing anything', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-actuals-'))
    dirs.push(root)
    const sourcePath = path.join(root, 'deck-a.pptx')
    const outDir = path.join(root, 'actuals')
    await fs.writeFile(sourcePath, 'pptx source')
    await fs.mkdir(path.join(outDir, 'deck-a'), { recursive: true })
    const calls = []
    const result = await capturePackageBackedActuals({
      baseUrl: 'http://localhost:4010', sourcePath, outDir,
      fetchImpl: async (url) => { calls.push(url); throw new Error('must not fetch') },
      inspectSource: async () => ({ slides: [{}] }), pollIntervalMs: 0,
    })
    expect(result).toEqual({ ok: false, error: 'actual-output-already-exists' })
    expect(calls).toEqual([])
  })

  it('requires an acknowledged permanent deletion', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-actuals-'))
    dirs.push(root)
    const source = Buffer.from('pptx source')
    const sourcePath = path.join(root, 'deck-a.pptx')
    await fs.writeFile(sourcePath, source)
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      if (request.path === '/api/pptx/import') return response({ jobId: 'job-1' }, 202)
      if (request.path === '/api/pptx/jobs/job-1') return response({ status: 'done', result: { presentationId: 'deck-1' } })
      if (request.path === '/api/presentations/deck-1') return response({ id: 'deck-1', aggregateGeneration: 1 })
      if (request.path === '/api/presentations/deck-1/pptx-package-snapshot') return response(packageSnapshot(source))
      if (request.path === '/api/presentations/deck-1/pptx-original') return new Response(source)
      if (request.path === '/api/presentations/deck-1/permanent') return response({ success: false })
      throw new Error(`unexpected ${request.method} ${request.path}`)
    }
    const capturePresent = async (_presentation, options) => {
      const file = path.join(options.outDir, options.deckStem, 'slide-0.png')
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, png())
      return { ok: true, files: [file] }
    }

    const result = await capturePackageBackedActuals({
      baseUrl: 'http://localhost:4010', sourcePath, outDir: path.join(root, 'actuals'), fetchImpl, capturePresent,
      inspectSource: async () => ({ slides: [{}] }), pollIntervalMs: 0,
    })
    expect(result).toMatchObject({
      ok: false,
      error: 'presentation-cleanup-unacknowledged',
      cleanup: { jobId: 'job-1', presentationId: 'deck-1' },
    })
    await expect(fs.access(path.join(root, 'actuals', 'deck-a'))).rejects.toThrow()
  })

  it('retains recovery identifiers when permanent deletion times out', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-actuals-'))
    dirs.push(root)
    const source = Buffer.from('pptx source')
    const sourcePath = path.join(root, 'deck-a.pptx')
    await fs.writeFile(sourcePath, source)
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      if (request.path === '/api/pptx/import') return response({ jobId: 'job-1' }, 202)
      if (request.path === '/api/pptx/jobs/job-1') return response({ status: 'done', result: { presentationId: 'deck-1' } })
      if (request.path === '/api/presentations/deck-1') return response({ id: 'deck-1', aggregateGeneration: 1 })
      if (request.path === '/api/presentations/deck-1/pptx-package-snapshot') return response(packageSnapshot(source))
      if (request.path === '/api/presentations/deck-1/pptx-original') return new Response(source)
      if (request.path === '/api/presentations/deck-1/permanent') {
        return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
      }
      throw new Error(`unexpected ${request.method} ${request.path}`)
    }
    const capturePresent = async (_presentation, options) => {
      const file = path.join(options.outDir, options.deckStem, 'slide-0.png')
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, png())
      return { ok: true, files: [file] }
    }

    const result = await capturePackageBackedActuals({
      baseUrl: 'http://localhost:4010', sourcePath, outDir: path.join(root, 'actuals'), fetchImpl, capturePresent,
      inspectSource: async () => ({ slides: [{}] }), pollIntervalMs: 0, cleanupTimeoutMs: 20,
    })

    expect(result).toMatchObject({
      ok: false, error: 'presentation-cleanup-failed', cleanup: { jobId: 'job-1', presentationId: 'deck-1' },
    })
    await expect(fs.access(path.join(root, 'actuals', 'deck-a'))).rejects.toThrow()
  })

  it('reconciles a late completed job instead of returning it for capture', async () => {
    const calls = []
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      calls.push(request)
      if (request.method === 'DELETE') return new Response(null, { status: 204 })
      if (request.method === 'POST') return response({ success: true, status: 'reconciled', jobId: 'job-1', presentationId: 'deck-1' })
      return response({ status: 'done', result: { presentationId: 'deck-1' } })
    }

    const controller = new AbortController()
    controller.abort()
    await expect(waitForCompletedJob(fetchImpl, 'http://127.0.0.1:4010', 'job-1', {
      pollIntervalMs: 0, timeoutMs: 10_000, reconciliationAttempts: 1, signal: controller.signal, sleep: async () => {},
    })).rejects.toMatchObject({
      code: 'import-job-timeout-reconciled', cleanup: { jobId: 'job-1', presentationId: 'deck-1' },
    })
    expect(calls).toEqual([
      { path: '/api/pptx/jobs/job-1', method: 'DELETE' },
      { path: '/api/pptx/jobs/job-1', method: 'GET' },
      { path: '/api/pptx/jobs/job-1/reconcile', method: 'POST' },
    ])
  })

  it('retains late completion recovery identity when server reconciliation times out', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      if (request.method === 'DELETE') return new Response(null, { status: 204 })
      if (request.method === 'POST') {
        return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
      }
      return response({ status: 'done', result: { presentationId: 'deck-1' } })
    }

    await expect(waitForCompletedJob(fetchImpl, 'http://127.0.0.1:4010', 'job-1', {
      pollIntervalMs: 0, timeoutMs: 10_000, reconciliationAttempts: 1, reconciliationTimeoutMs: 20,
      signal: controller.signal, sleep: async () => {},
    })).rejects.toMatchObject({
      code: 'import-job-timeout-unreconciled', cleanup: { jobId: 'job-1', presentationId: 'deck-1' },
    })
  })

  it.each([
    'LEGACY_IMPORT_RECEIPT_UNSUPPORTED',
    'PACKAGE_IMPORT_COMMIT_FAILED',
    'PACKAGE_IMPORT_RECONCILIATION_FAILED',
  ])('retains typed reconciliation reasonCode %s without trusting server cleanup data', async (reasonCode) => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      if (request.method === 'DELETE') return new Response(null, { status: 204 })
      if (request.method === 'POST') {
        return response({
          success: false,
          error: 'package-import-reconciliation-failed',
          reasonCode,
          jobId: 'untrusted-job-id',
          presentationId: 'untrusted-presentation-id',
          detail: 'untrusted server detail',
        }, 409)
      }
      return response({ status: 'done', result: { presentationId: 'deck-1' } })
    }

    const error = await waitForCompletedJob(fetchImpl, 'http://127.0.0.1:4010', 'job-1', {
      pollIntervalMs: 0,
      timeoutMs: 10_000,
      reconciliationAttempts: 1,
      signal: controller.signal,
      sleep: async () => {},
    }).catch((requestError) => requestError)

    expect(error).toMatchObject({
      code: 'import-job-timeout-unreconciled',
      reasonCode,
      cleanup: { jobId: 'job-1', presentationId: 'deck-1' },
    })
    expect(error).not.toHaveProperty('detail')
  })

  it('drops untrusted reconciliation reason codes from timeout outcomes', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      if (request.method === 'DELETE') return new Response(null, { status: 204 })
      if (request.method === 'POST') {
        return response({
          success: false,
          reasonCode: 'not-a-server-code',
          detail: 'drop me',
        }, 409)
      }
      return response({ status: 'done', result: { presentationId: 'deck-1' } })
    }

    const error = await waitForCompletedJob(fetchImpl, 'http://127.0.0.1:4010', 'job-1', {
      pollIntervalMs: 0,
      timeoutMs: 10_000,
      reconciliationAttempts: 1,
      signal: controller.signal,
      sleep: async () => {},
    }).catch((requestError) => requestError)

    expect(error).toMatchObject({
      code: 'import-job-timeout-unreconciled',
      cleanup: { jobId: 'job-1', presentationId: 'deck-1' },
    })
    expect(error).not.toHaveProperty('reasonCode')
  })

  it('surfaces reconciliation reasonCode on package-backed capture cleanup reports', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-actuals-reason-'))
    dirs.push(root)
    const sourcePath = path.join(root, 'deck-a.pptx')
    await fs.writeFile(sourcePath, 'pptx source')
    let jobPolls = 0
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      if (request.path === '/api/pptx/import') return response({ jobId: 'job-1' }, 202)
      if (request.method === 'DELETE' && request.path === '/api/pptx/jobs/job-1') {
        return new Response(null, { status: 204 })
      }
      if (request.method === 'POST' && request.path.endsWith('/reconcile')) {
        return response({
          success: false,
          reasonCode: 'PACKAGE_IMPORT_COMMIT_FAILED',
          jobId: 'untrusted-job-id',
          presentationId: 'untrusted-presentation-id',
        }, 409)
      }
      if (request.path === '/api/pptx/jobs/job-1' && request.method === 'GET') {
        jobPolls += 1
        if (jobPolls === 1) {
          return new Promise((_, reject) => {
            init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
          })
        }
        return response({ status: 'done', result: { presentationId: 'deck-1' } })
      }
      throw new Error(`unexpected ${request.method} ${request.path}`)
    }

    const timed = await capturePackageBackedActuals({
      baseUrl: 'http://127.0.0.1:4010',
      sourcePath,
      outDir: path.join(root, 'out-timeout'),
      fetchImpl,
      inspectSource: async () => ({ slides: [{}] }),
      pollIntervalMs: 0,
      timeoutMs: 30,
      reconciliationAttempts: 1,
      reconciliationTimeoutMs: 50,
      cleanupTimeoutMs: 20,
      sleep: async () => {},
    })

    expect(timed).toMatchObject({
      ok: false,
      error: 'import-job-timeout-unreconciled',
      reasonCode: 'PACKAGE_IMPORT_COMMIT_FAILED',
      jobId: 'job-1',
      cleanup: { jobId: 'job-1', presentationId: 'deck-1' },
    })
    expect(timed.cleanup.presentationId).not.toBe('untrusted-presentation-id')
  })

  it('owns a deadline when standalone job polling has no external signal', async () => {
    let jobReads = 0
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      if (request.method === 'DELETE') return new Response(null, { status: 204 })
      if (request.path.endsWith('/job-1') && ++jobReads === 1) {
        return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
      }
      return response({ status: 'cancelled' })
    }

    await expect(waitForCompletedJob(fetchImpl, 'http://127.0.0.1:4010', 'job-1', {
      pollIntervalMs: 0, timeoutMs: 20, reconciliationAttempts: 1, reconciliationTimeoutMs: 500, sleep: async () => {},
    })).rejects.toMatchObject({ code: 'import-job-timeout-cancelled' })
  })

  it('cancels and reconciles after a polling transport failure', async () => {
    const calls = []
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      calls.push(request)
      if (calls.length === 1) throw new Error('transient polling failure')
      if (request.method === 'DELETE') return new Response(null, { status: 204 })
      return response({ status: 'cancelled' })
    }

    await expect(waitForCompletedJob(fetchImpl, 'http://127.0.0.1:4010', 'job-1', {
      pollIntervalMs: 0, timeoutMs: 10_000, reconciliationAttempts: 1, sleep: async () => {},
    })).rejects.toMatchObject({ code: 'import-job-timeout-cancelled' })
    expect(calls.map(({ method }) => method)).toEqual(['GET', 'DELETE', 'GET'])
  })

  it('reconciles a late completion after an aborted job poll without orphaning it', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-actuals-'))
    dirs.push(root)
    const sourcePath = path.join(root, 'deck-a.pptx')
    await fs.writeFile(sourcePath, 'pptx source')
    const calls = []
    let jobReads = 0
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      calls.push(request)
      if (request.path === '/api/pptx/import') return response({ jobId: 'job-1' }, 202)
      if (request.path === '/api/pptx/jobs/job-1' && request.method === 'DELETE') return new Response(null, { status: 204 })
      if (request.path === '/api/pptx/jobs/job-1' && ++jobReads === 1) {
        return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
      }
      if (request.path === '/api/pptx/jobs/job-1') return response({ status: 'done', result: { presentationId: 'deck-1' } })
      if (request.path === '/api/pptx/jobs/job-1/reconcile' && request.method === 'POST') {
        return response({ success: true, status: 'reconciled', jobId: 'job-1', presentationId: 'deck-1' })
      }
      if (request.method === 'DELETE') return new Response(null, { status: 204 })
      throw new Error(`unexpected ${request.method} ${request.path}`)
    }

    const result = await capturePackageBackedActuals({
      baseUrl: 'http://localhost:4010', sourcePath, outDir: path.join(root, 'actuals'), fetchImpl,
      inspectSource: async () => ({ slides: [{}] }), timeoutMs: 25, reconciliationTimeoutMs: 500, pollIntervalMs: 0,
    })
    expect(result).toMatchObject({
      ok: false, error: 'import-job-timeout-reconciled', jobId: 'job-1',
      cleanup: { jobId: 'job-1', presentationId: 'deck-1' },
    })
    expect(calls.map(({ method }) => method)).toEqual(['POST', 'GET', 'DELETE', 'GET', 'POST'])
  })

  it('passes the lifecycle deadline to presentation capture and cleans up after it expires', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-actuals-'))
    dirs.push(root)
    const source = Buffer.from('pptx source')
    const sourcePath = path.join(root, 'deck-a.pptx')
    await fs.writeFile(sourcePath, source)
    const calls = []
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      calls.push(request)
      if (request.path === '/api/pptx/import') return response({ jobId: 'job-1' }, 202)
      if (request.path === '/api/pptx/jobs/job-1') return response({ status: 'done', result: { presentationId: 'deck-1' } })
      if (request.path === '/api/presentations/deck-1') return response({ id: 'deck-1', aggregateGeneration: 1 })
      if (request.path === '/api/presentations/deck-1/pptx-package-snapshot') return response(packageSnapshot(source))
      if (request.path === '/api/presentations/deck-1/pptx-original') return new Response(source)
      if (request.path === '/api/presentations/deck-1/permanent') return response({ success: true })
      throw new Error(`unexpected ${request.method} ${request.path}`)
    }
    const capturePresent = async (_presentation, options) => {
      if (options.signal.aborted) return { ok: false, error: 'capture-timeout', cleanupErrors: ['capture-page-close-timeout', 'untrusted detail'] }
      return new Promise((resolve) => options.signal.addEventListener(
        'abort', () => resolve({ ok: false, error: 'capture-timeout', cleanupErrors: ['capture-page-close-timeout', 'untrusted detail'] }), { once: true }
      ))
    }

    await expect(capturePackageBackedActuals({
      baseUrl: 'http://localhost:4010', sourcePath, outDir: path.join(root, 'actuals'), fetchImpl, capturePresent,
      inspectSource: async () => ({ slides: [{}] }), timeoutMs: 25, pollIntervalMs: 0,
    })).resolves.toMatchObject({
      ok: false,
      error: 'capture-timeout',
      jobId: 'job-1',
      captureCleanupErrors: ['capture-page-close-timeout'],
    })
    expect(calls.at(-1)).toEqual({ path: '/api/presentations/deck-1/permanent', method: 'DELETE' })
  })

  it('rejects a direct-import-shaped read and still permanently cleans up', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-actuals-'))
    dirs.push(root)
    const sourcePath = path.join(root, 'deck-a.pptx')
    await fs.writeFile(sourcePath, 'pptx source')
    const calls = []
    const fetchImpl = async (url, init = {}) => {
      const request = { path: new URL(url).pathname, method: init.method || 'GET' }
      calls.push(request)
      if (request.path === '/api/pptx/import') return response({ jobId: '4e9f231d-9e63-4c59-904f-3a5e1b1ac001' }, 202)
      if (request.path.includes('/api/pptx/jobs/')) return response({ status: 'done', result: { presentationId: 'deck-1' } })
      if (request.path === '/api/presentations/deck-1') return response({ id: 'deck-1', slides: [{ id: 's1' }] })
      if (request.path === '/api/presentations/deck-1/pptx-package-snapshot') return response({ presentationId: 'deck-1' })
      if (request.path === '/api/presentations/deck-1/permanent') return response({ success: true })
      throw new Error(`unexpected ${request.method} ${request.path}`)
    }

    const result = await capturePackageBackedActuals({
      baseUrl: 'http://localhost:4010', sourcePath, outDir: root, fetchImpl,
      inspectSource: async () => ({ slides: [{}] }), pollIntervalMs: 0,
    })

    expect(result).toMatchObject({
      ok: false, error: 'invalid-package-snapshot', jobId: '4e9f231d-9e63-4c59-904f-3a5e1b1ac001',
    })
    expect(calls.at(-1)).toEqual({ path: '/api/presentations/deck-1/permanent', method: 'DELETE' })
  })
})
