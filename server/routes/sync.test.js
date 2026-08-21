// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

const execFileMock = vi.fn()

const require = createRequire(import.meta.url)
const originalDataDir = process.env.SLIDES_DATA_DIR
const dataDir = path.join(os.tmpdir(), `navslides-sync-${process.pid}-${Date.now()}`)
process.env.SLIDES_DATA_DIR = dataDir

const storage = require('../services/storage')
const packageRuntime = require('../services/pptx-import/package-store-runtime')
const syncRouter = require('./sync')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/rclone', syncRouter)
  return app
}

function deferred() {
  let resolve
  const promise = new Promise((promiseResolve) => { resolve = promiseResolve })
  return { promise, resolve }
}

async function waitFor(predicate, message) {
  const deadline = Date.now() + 2_000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function mockSuccessfulRclone() {
  execFileMock.mockImplementation((_command, args, _options, callback) => {
    callback(null, args[0] === 'version' ? 'rclone v1' : '', '')
  })
}

async function seedLegacyPresentations() {
  await storage.writePresentations([
    {
      id: 'deck-a',
      title: 'Alpha',
      slides: [{ id: 'slide-a', elements: [] }],
    },
    {
      id: 'deck-b',
      title: 'Beta',
      slides: [{ id: 'slide-b', elements: [] }],
    },
  ])
}

async function seedPackagePresentation(bytes = Buffer.from('package-bytes')) {
  await storage.writePresentations([{
    id: 'package-deck',
    title: 'Package Deck',
    slides: [{ id: 'slide-package', elements: [] }],
  }])
  const store = await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })
  const committed = await packageRuntime.withPackageStore((activeStore) =>
    activeStore.commitOriginal(bytes, { ownerType: 'presentation', ownerId: 'package-deck' })
  )
  const head = store.getState().heads.find((item) => item.presentationId === 'package-deck')
  await storage.withPresentations((presentations) => {
    presentations[0].pptxAggregateHead = head
  })
  return { store, revision: committed.revision }
}

beforeAll(async () => {
  await fs.rm(dataDir, { force: true, recursive: true })
  await fs.mkdir(dataDir, { recursive: true })
})

beforeEach(async () => {
  execFileMock.mockReset()
  syncRouter.setRcloneExecutor(execFileMock)
  await packageRuntime.shutdownPackageStore()
  await fs.rm(dataDir, { force: true, recursive: true })
  await fs.mkdir(dataDir, { recursive: true })
  storage.initDataFiles()
})

afterEach(async () => {
  execFileMock.mockReset()
  syncRouter.resetRcloneExecutor()
  await packageRuntime.shutdownPackageStore()
  await fs.rm(dataDir, { force: true, recursive: true })
})

afterAll(async () => {
  syncRouter.resetRcloneExecutor()
  await packageRuntime.shutdownPackageStore()
  await fs.rm(dataDir, { force: true, recursive: true })
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
})

describe('rclone sync authority boundaries', () => {
  it('preserves the working config and sibling files when the candidate probe fails', async () => {
    const configDir = path.dirname(storage.RCLONE_CONFIG_FILE)
    const original = Buffer.from('[working]\ntype = local\n')
    await fs.mkdir(configDir, { recursive: true })
    await fs.writeFile(storage.RCLONE_CONFIG_FILE, original, { mode: 0o640 })
    await fs.writeFile(path.join(configDir, 'keep.txt'), 'keep')
    const beforeMode = (await fs.stat(storage.RCLONE_CONFIG_FILE)).mode
    const beforeEntries = (await fs.readdir(configDir)).sort()

    execFileMock.mockImplementation((_command, args, options, callback) => {
      if (args[0] === 'obscure') return callback(null, 'obscured', '')
      expect(options.env.RCLONE_CONFIG).not.toBe(storage.RCLONE_CONFIG_FILE)
      callback(new Error('probe failed'), '', 'probe failed')
    })

    const response = await request(makeApp())
      .post('/api/rclone/config')
      .send({ username: 'user', password: 'secret', remoteName: 'candidate' })

    expect(response.status).toBe(400)
    expect(await fs.readFile(storage.RCLONE_CONFIG_FILE)).toEqual(original)
    expect((await fs.stat(storage.RCLONE_CONFIG_FILE)).mode).toBe(beforeMode)
    expect((await fs.readdir(configDir)).sort()).toEqual(beforeEntries)
  })

  it('probes a candidate config before replacing the active config', async () => {
    await fs.mkdir(path.dirname(storage.RCLONE_CONFIG_FILE), { recursive: true })
    await fs.writeFile(storage.RCLONE_CONFIG_FILE, '[old]\ntype = local\n')
    let candidatePath
    execFileMock.mockImplementation((_command, args, options, callback) => {
      if (args[0] === 'obscure') return callback(null, 'obscured', '')
      candidatePath = options.env.RCLONE_CONFIG
      expect(candidatePath).not.toBe(storage.RCLONE_CONFIG_FILE)
      callback(null, '', '')
    })

    const response = await request(makeApp())
      .post('/api/rclone/config')
      .send({ username: 'new-user', password: 'secret', remoteName: 'newremote' })

    expect(response.status).toBe(200)
    expect(await fs.readFile(storage.RCLONE_CONFIG_FILE, 'utf8')).toContain('[newremote]')
    expect(await fs.stat(candidatePath).catch(() => null)).toBeNull()
  })
  it('serializes concurrent bulk syncs and cleans each request workspace', async () => {
    await seedLegacyPresentations()
    const calls = []
    const firstCall = deferred()
    execFileMock.mockImplementation((_command, args, _options, callback) => {
      if (args[0] !== 'sync') return callback(null, '', '')
      calls.push({ args, callback })
      if (calls.length === 1) return
      callback(null, '', '')
    })

    const first = request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup' })
      .then((response) => response)
    await waitFor(() => calls.length === 1, 'first bulk sync did not start')
    const second = request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup' })
      .then((response) => response)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toHaveLength(1)

    firstCall.resolve()
    calls[0].callback(null, '', '')
    const [firstResponse, secondResponse] = await Promise.all([first, second])
    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)
    expect(calls).toHaveLength(2)
    expect(await fs.readdir(storage.SYNC_DIR)).toEqual([])
  })

  it('captures a queued destination sync after the prior publication', async () => {
    await seedLegacyPresentations()
    const publications = []
    execFileMock.mockImplementation(async (_command, args, _options, callback) => {
      if (args[0] !== 'sync') return callback(null, '', '')
      const folder = (await fs.readdir(args[1])).find((entry) => entry !== '_uploads')
      const presentation = JSON.parse(await fs.readFile(
        path.join(args[1], folder, 'presentation.json'),
        'utf8'
      ))
      publications.push({ title: presentation.title, callback })
      if (publications.length > 1) callback(null, '', '')
    })

    const first = request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup' })
      .then((response) => response)
    await waitFor(() => publications.length === 1, 'first sync did not reach rclone')

    const second = request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup' })
      .then((response) => response)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(await fs.readdir(storage.SYNC_DIR)).toHaveLength(1)

    await storage.withPresentations((presentations) => {
      presentations[0].title = 'Alpha after first publication'
    })
    publications[0].callback(null, '', '')

    const [firstResponse, secondResponse] = await Promise.all([first, second])
    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)
    expect(publications.map((publication) => publication.title)).toEqual([
      'Alpha',
      'Alpha after first publication',
    ])
  })

  it('shares destination serialization between bulk and single sync', async () => {
    await seedLegacyPresentations()
    const calls = []
    execFileMock.mockImplementation((_command, args, _options, callback) => {
      if (args[0] !== 'sync') return callback(null, '', '')
      calls.push({ args, callback })
      if (calls.length > 1) callback(null, '', '')
    })

    const bulk = request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup' })
      .then((response) => response)
    await waitFor(() => calls.length === 1, 'bulk sync did not start')
    const single = request(makeApp())
      .post('/api/rclone/sync-single')
      .send({ remote: 'remote', remotePath: '/backup', presentationId: 'deck-a' })
      .then((response) => response)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toHaveLength(1)

    calls[0].callback(null, '', '')
    const [bulkResponse, singleResponse] = await Promise.all([bulk, single])
    expect(bulkResponse.status).toBe(200)
    expect(singleResponse.status).toBe(200)
    expect(calls).toHaveLength(2)
  })

  it('copies uploaded slide background images into bulk sync output', async () => {
    const imageBytes = Buffer.from('background-image')
    await fs.writeFile(path.join(storage.UPLOADS_DIR, 'background.png'), imageBytes)
    await storage.writePresentations([{
      id: 'background-deck',
      title: 'Background',
      slides: [{
        id: 'slide-background',
        background: { image: '/uploads/background.png' },
        elements: [],
      }],
    }])
    let copiedBytes
    execFileMock.mockImplementation(async (_command, args, _options, callback) => {
      if (args[0] !== 'sync') return callback(null, '', '')
      copiedBytes = await fs.readFile(path.join(args[1], '_uploads', 'background.png'))
      callback(null, '', '')
    })

    const response = await request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup' })
    expect(response.status).toBe(200)
    expect(copiedBytes).toEqual(imageBytes)
  })

  it('copies nested rendered upload references into bulk sync output', async () => {
    const uploads = {
      'timeline.png': Buffer.from('timeline'),
      'fallback.png': Buffer.from('fallback'),
      'inline.png': Buffer.from('inline'),
    }
    for (const [filename, bytes] of Object.entries(uploads)) {
      await fs.writeFile(path.join(storage.UPLOADS_DIR, filename), bytes)
    }
    await storage.writePresentations([{
      id: 'nested-media-deck',
      title: 'Nested media',
      slides: [{
        id: 'slide-nested-media',
        elements: [
          { id: 'timeline', type: 'timeline', events: [{ imageUrl: '/uploads/timeline.png' }] },
          { id: 'latex', type: 'latex', _fallbackSrc: '/uploads/fallback.png' },
          { id: 'text', type: 'text', content: '<p><img src="/uploads/inline.png" /></p>' },
        ],
      }],
    }])
    let copied
    execFileMock.mockImplementation(async (_command, args, _options, callback) => {
      if (args[0] !== 'sync') return callback(null, '', '')
      copied = {}
      for (const filename of Object.keys(uploads)) {
        copied[filename] = await fs.readFile(path.join(args[1], '_uploads', filename))
      }
      callback(null, '', '')
    })

    const response = await request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup' })
    expect(response.status).toBe(200)
    expect(copied).toEqual(uploads)
  })

  it('keeps colliding titles in separate stable package and legacy folders', async () => {
    const { revision } = await seedPackagePresentation(Buffer.from('same-title-package'))
    await storage.withPresentations((presentations) => {
      presentations[0].title = 'Same / Title'
      presentations.push({
        id: 'legacy-deck',
        title: 'Same: Title',
        slides: [{ id: 'slide-legacy', elements: [] }],
      })
    })
    const folders = []
    execFileMock.mockImplementation(async (_command, args, _options, callback) => {
      if (args[0] !== 'sync') return callback(null, '', '')
      for (const entry of await fs.readdir(args[1])) {
        if (entry === '_uploads') continue
        const data = JSON.parse(await fs.readFile(path.join(args[1], entry, 'presentation.json'), 'utf8'))
        folders.push({ entry, id: data.id, hasPackage: await fs.access(
          path.join(args[1], entry, 'package', 'blobs', `${revision.blobSha256}.pptx`)
        ).then(() => true).catch(() => false) })
      }
      callback(null, '', '')
    })

    const response = await request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup' })
    expect(response.status).toBe(200)
    const sortedFolders = folders.sort((left, right) => left.id.localeCompare(right.id))
    expect(sortedFolders).toEqual([
      { entry: expect.any(String), id: 'legacy-deck', hasPackage: false },
      { entry: expect.any(String), id: 'package-deck', hasPackage: true },
    ])
    expect(new Set(folders.map((folder) => folder.entry)).size).toBe(2)
  })

  it('keeps sanitized identifier collisions in stable bounded folders', async () => {
    const longTitle = 'Same / Title '.repeat(30)
    await storage.writePresentations([
      {
        id: 'deck/a',
        title: longTitle,
        slides: [{ id: 'slide-a', elements: [] }],
      },
      {
        id: 'deck:a',
        title: longTitle,
        slides: [{ id: 'slide-b', elements: [] }],
      },
      {
        id: 'CON',
        title: '',
        slides: [{ id: 'slide-con', elements: [] }],
      },
    ])
    const runs = []
    execFileMock.mockImplementation(async (_command, args, _options, callback) => {
      if (args[0] !== 'sync') return callback(null, '', '')
      const folders = []
      for (const entry of await fs.readdir(args[1])) {
        if (entry === '_uploads') continue
        const presentation = JSON.parse(await fs.readFile(
          path.join(args[1], entry, 'presentation.json'),
          'utf8'
        ))
        folders.push({ entry, id: presentation.id })
      }
      runs.push(folders.sort((left, right) => left.entry.localeCompare(right.entry)))
      callback(null, '', '')
    })

    const firstResponse = await request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup' })
    const secondResponse = await request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup' })

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)
    expect(runs).toHaveLength(2)
    expect(runs[1]).toEqual(runs[0])
    expect(runs[0].map((folder) => folder.id).sort()).toEqual(['CON', 'deck/a', 'deck:a'])
    expect(new Set(runs[0].map((folder) => folder.entry)).size).toBe(3)
    expect(runs[0].every((folder) => folder.entry.length <= 96)).toBe(true)
    expect(runs[0].some((folder) => folder.entry.toUpperCase() === 'CON')).toBe(false)
  })

  it('canonicalizes equivalent remote paths before destination locking', async () => {
    await seedLegacyPresentations()
    const calls = []
    execFileMock.mockImplementation((_command, args, _options, callback) => {
      if (args[0] !== 'sync') return callback(null, '', '')
      calls.push({ args, callback })
      if (calls.length > 1) callback(null, '', '')
    })

    const first = request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup/' })
      .then((response) => response)
    await waitFor(() => calls.length === 1, 'first canonical sync did not start')
    const second = request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup/./' })
      .then((response) => response)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toHaveLength(1)
    calls[0].callback(null, '', '')
    const [firstResponse, secondResponse] = await Promise.all([first, second])
    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)
    expect(calls).toHaveLength(2)
    expect(calls[0].args[2]).toBe('remote:/backup')
    expect(calls[1].args[2]).toBe('remote:/backup')
  })

  it('serializes parent and child destinations on the same remote', async () => {
    await seedLegacyPresentations()
    const calls = []
    execFileMock.mockImplementation((_command, args, _options, callback) => {
      if (args[0] !== 'sync') return callback(null, '', '')
      calls.push({ args, callback })
      if (calls.length > 1) callback(null, '', '')
    })

    const parent = request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/backup' })
      .then((response) => response)
    await waitFor(() => calls.length === 1, 'parent sync did not start')
    const child = request(makeApp())
      .post('/api/rclone/sync-single')
      .send({ remote: 'remote', remotePath: '/backup/sub', presentationId: 'deck-a' })
      .then((response) => response)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toHaveLength(1)

    calls[0].callback(null, '', '')
    const [parentResponse, childResponse] = await Promise.all([parent, child])
    expect(parentResponse.status).toBe(200)
    expect(childResponse.status).toBe(200)
    expect(calls).toHaveLength(2)
    expect(calls[1].args[2]).toMatch(/^remote:\/backup\/sub\//)
  })

  it.each([
    '../',
    '/backup/../',
    '/backup/../archive',
    '..\\backup',
    '\\backup\\..\\archive',
  ])('rejects traversal path %s before invoking rclone', async (remotePath) => {
    mockSuccessfulRclone()

    const response = await request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath })

    expect(response).toMatchObject({
      status: 400,
      body: { error: 'Invalid remote path' },
    })
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('rejects backslash traversal for single sync before invoking rclone', async () => {
    mockSuccessfulRclone()

    const response = await request(makeApp())
      .post('/api/rclone/sync-single')
      .send({
        remote: 'remote',
        remotePath: '\\backup\\..\\archive',
        presentationId: 'deck-a',
      })

    expect(response).toMatchObject({
      status: 400,
      body: { error: 'Invalid remote path' },
    })
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('rejects an explicit remote root before invoking rclone', async () => {
    mockSuccessfulRclone()

    const response = await request(makeApp())
      .post('/api/rclone/sync')
      .send({ remote: 'remote', remotePath: '/' })

    expect(response).toMatchObject({
      status: 400,
      body: { error: 'Invalid remote path' },
    })
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('fails closed when a package head changes after authority resolution', async () => {
    const { store } = await seedPackagePresentation(Buffer.from('fenced-package'))
    const originalExport = store.exportPresentationPackage.bind(store)
    store.exportPresentationPackage = async (presentationId, options) => {
      await store.mutate((next) => {
        next.heads.find((head) => head.presentationId === presentationId).generation += 1
      })
      return originalExport(presentationId, options)
    }
    mockSuccessfulRclone()
    try {
      const response = await request(makeApp())
        .post('/api/rclone/sync-single')
        .send({ remote: 'remote', remotePath: '/backup', presentationId: 'package-deck' })
      expect(response).toMatchObject({
        status: 409,
        body: { code: 'SYNC_SOURCE_CHANGED' },
      })
      expect(execFileMock.mock.calls.some((call) => call[1]?.[0] === 'sync')).toBe(false)
    } finally {
      store.exportPresentationPackage = originalExport
    }
  })

  it('exports a verified portable package manifest and blob for package-backed sync', async () => {
    const bytes = Buffer.from('portable-package')
    const { revision } = await seedPackagePresentation(bytes)
    let manifest
    let blobBytes
    execFileMock.mockImplementation(async (_command, args, _options, callback) => {
      if (args[0] !== 'sync') return callback(null, '', '')
      const packageDir = path.join(args[1], 'package')
      manifest = JSON.parse(await fs.readFile(path.join(packageDir, 'manifest.json'), 'utf8'))
      blobBytes = await fs.readFile(path.join(packageDir, 'blobs', `${revision.blobSha256}.pptx`))
      callback(null, '', '')
    })

    const response = await request(makeApp())
      .post('/api/rclone/sync-single')
      .send({ remote: 'remote', remotePath: '/backup', presentationId: 'package-deck' })
    expect(response.status).toBe(200)
    expect(manifest).toMatchObject({
      presentationId: 'package-deck',
      revisions: [expect.objectContaining({ id: revision.id, blobSha256: revision.blobSha256 })],
    })
    expect(blobBytes).toEqual(bytes)
  })

  it('fails closed before rclone when a package export is unavailable', async () => {
    const { store } = await seedPackagePresentation()
    const originalExport = store.exportPresentationPackage
    store.exportPresentationPackage = async () => null
    mockSuccessfulRclone()
    try {
      const response = await request(makeApp())
        .post('/api/rclone/sync-single')
        .send({ remote: 'remote', remotePath: '/backup', presentationId: 'package-deck' })
      expect(response).toMatchObject({
        status: 422,
        body: { code: 'PACKAGE_EXPORT_UNAVAILABLE' },
      })
      expect(execFileMock.mock.calls.some((call) => call[1]?.[0] === 'sync')).toBe(false)
    } finally {
      store.exportPresentationPackage = originalExport
    }
  })
})
