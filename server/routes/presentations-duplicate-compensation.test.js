// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

const require = createRequire(import.meta.url)
const originalDataDir = process.env.SLIDES_DATA_DIR
const dataDir = path.join(
  os.tmpdir(),
  `navslides-duplicate-compensation-${process.pid}-${Date.now()}`
)
process.env.SLIDES_DATA_DIR = dataDir

const storage = require('../services/storage')
const fsExtra = require('fs-extra')
const packageRuntime = require('../services/pptx-import/package-store-runtime')
const packageLifecycle = require('../services/package-lifecycle-integration')
const { persistOriginalPptx } = require('../services/pptx-import/original-package')

let presentationsRouter
let originalDuplicatePackageOwner
let packageRootFaultInjected
let faultAfterPackageRoot

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/presentations', presentationsRouter)
  return app
}

async function expectOnlySourcePackage({ afterRestart = false } = {}) {
  if (afterRestart) await packageRuntime.shutdownPackageStore()
  expect((await storage.readPresentations()).map((presentation) => presentation.id)).toEqual(['deck-1'])
  await packageRuntime.withPackageStore((store) => {
    const state = store.getState()
    expect(state.heads.map((head) => head.presentationId)).toEqual(['deck-1'])
    expect(state.owners.some((owner) => owner.ownerId !== 'deck-1')).toBe(false)
  })
}

async function addLegacyDeck() {
  const artifact = await persistOriginalPptx(Buffer.from('legacy-original-package'))
  await storage.withPresentations((presentations) => {
    presentations.push({
      id: 'legacy-deck',
      title: 'Legacy source',
      slides: [{ id: 's1', elements: [] }],
      pptxOriginal: {
        id: artifact.id,
        sha256: artifact.sha256,
        byteLength: artifact.byteLength,
        uploadedAt: artifact.uploadedAt,
      },
    })
  })
  return artifact
}

beforeAll(() => {
  originalDuplicatePackageOwner = packageLifecycle.duplicatePackageOwner
  packageLifecycle.duplicatePackageOwner = async (sourceId, destinationId, options) => {
    if (!faultAfterPackageRoot) {
      return originalDuplicatePackageOwner(sourceId, destinationId, options)
    }
    packageRootFaultInjected = true
    return originalDuplicatePackageOwner(sourceId, destinationId, {
      ...options,
      faultAfterRoot: true,
    })
  }
  delete require.cache[require.resolve('./presentations')]
  presentationsRouter = require('./presentations')
})

afterAll(async () => {
  delete require.cache[require.resolve('./presentations')]
  packageLifecycle.duplicatePackageOwner = originalDuplicatePackageOwner
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
  await fs.rm(dataDir, { force: true, recursive: true })
})

describe('presentation duplicate compensation', () => {
  beforeEach(async () => {
    packageRootFaultInjected = false
    faultAfterPackageRoot = false
    await packageRuntime.shutdownPackageStore()
    storage.initDataFiles()
    await storage.writePresentations([
      { id: 'deck-1', title: 'Original', slides: [{ id: 's1', elements: [] }] },
    ])
    await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })
    const packageHead = await packageRuntime.withPackageStore((store) =>
      store.commitOriginal(Buffer.from('original-only-package'), {
        ownerType: 'presentation',
        ownerId: 'deck-1',
      })
    )
    await storage.withPresentations((presentations) => {
      presentations[0].pptxAggregateHead = packageHead
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await packageRuntime.shutdownPackageStore()
    await fs.rm(dataDir, { force: true, recursive: true })
    await fs.mkdir(dataDir, { recursive: true })
  })

  it('rolls back the package destination when JSON publication fails', async () => {
    const writeJson = fsExtra.writeJson.bind(fsExtra)
    vi.spyOn(fsExtra, 'writeJson').mockImplementation(async (file, ...args) => {
      if (String(file).includes('presentations.json')) {
        throw new Error('injected presentation write failure')
      }
      return writeJson(file, ...args)
    })

    const response = await request(makeApp()).post('/api/presentations/deck-1/duplicate')

    expect(response.status).toBe(500)
    vi.restoreAllMocks()
    await expectOnlySourcePackage()
  })

  it('quarantines a destination after a root-level package publication fault', async () => {
    faultAfterPackageRoot = true

    const response = await request(makeApp()).post('/api/presentations/deck-1/duplicate')

    expect(packageRootFaultInjected).toBe(true)
    expect(response.status).toBe(500)
    await expectOnlySourcePackage({ afterRestart: true })
  })

  it('reports a legacy-original cleanup failure after failed JSON publication', async () => {
    await addLegacyDeck()
    const writeJson = fsExtra.writeJson.bind(fsExtra)
    const unlink = fsExtra.unlink.bind(fsExtra)
    vi.spyOn(fsExtra, 'writeJson').mockImplementation(async (file, ...args) => {
      if (String(file).includes('presentations.json')) {
        throw new Error('injected presentation write failure')
      }
      return writeJson(file, ...args)
    })
    vi.spyOn(fsExtra, 'unlink').mockImplementation(async (file, ...args) => {
      if (String(file).includes('pptx-originals')) {
        throw new Error('injected original cleanup failure')
      }
      return unlink(file, ...args)
    })

    const response = await request(makeApp()).post('/api/presentations/legacy-deck/duplicate')

    expect(response).toMatchObject({
      status: 503,
      body: { code: 'PRESENTATION_DUPLICATION_ROLLBACK_FAILED' },
    })
    vi.restoreAllMocks()
    expect((await storage.readPresentations()).map((presentation) => presentation.id)).toEqual([
      'deck-1',
      'legacy-deck',
    ])
  })

  it.each(['readFile', 'writeFile'])(
    'does not publish a duplicate when legacy original %s fails',
    async (method) => {
      const artifact = await addLegacyDeck()
      const original = fsExtra[method].bind(fsExtra)
      vi.spyOn(fsExtra, method).mockImplementation(async (file, ...args) => {
        if (String(file).includes('pptx-originals')) {
          throw Object.assign(new Error(`injected original ${method} failure`), { code: 'EIO' })
        }
        return original(file, ...args)
      })

      const response = await request(makeApp()).post('/api/presentations/legacy-deck/duplicate')

      expect(response.status).toBe(500)
      vi.restoreAllMocks()
      expect((await storage.readPresentations()).map((presentation) => presentation.id)).toEqual([
        'deck-1',
        'legacy-deck',
      ])
      expect(await fsExtra.pathExists(path.join(
        storage.DATA_DIR,
        'pptx-originals',
        `${artifact.id}.pptx`
      ))).toBe(true)
    }
  )
})
