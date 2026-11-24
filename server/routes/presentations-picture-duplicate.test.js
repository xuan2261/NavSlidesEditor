// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { pictureFixture, pixels } from '../../tests/pptx-semantic/semantic-picture-fixture.js'

const require = createRequire(import.meta.url)
const originalDataDir = process.env.SLIDES_DATA_DIR
const dataDir = path.join(os.tmpdir(), `navslides-picture-duplicate-${process.pid}-${Date.now()}`)
process.env.SLIDES_DATA_DIR = dataDir

const storage = require('../services/storage')
const fsExtra = require('fs-extra')
const packageRuntime = require('../services/pptx-import/package-store-runtime')
const operations = require('../../shared/src/pptx-projection-operation')
const { inspectPictureUpload } = require('../services/pptx-import/picture-replacement-validation')
let presentationsRouter

function app() {
  const instance = express()
  instance.use(express.json({ limit: '5mb' }))
  instance.use('/api/presentations', presentationsRouter)
  return instance
}

async function seed() {
  const { presentation } = await pictureFixture({ uploadsDir: storage.UPLOADS_DIR })
  presentation.id = 'source'
  const filename = 'replacement.png'
  await fs.mkdir(storage.UPLOADS_DIR, { recursive: true })
  await fs.writeFile(path.join(storage.UPLOADS_DIR, filename), pixels)
  const replacement = await inspectPictureUpload(
    path.join(storage.UPLOADS_DIR, filename),
    presentation.id,
    filename
  )
  const element = presentation.slides[0].elements[0]
  const replaced = operations.applyPresentationProjectionOperation(presentation, {
    type: 'picture.edit',
    instanceId: element.pptxInstanceId,
    componentId: element.pptxPicture.componentId,
    command: { type: 'replace', replacement, expectedReplacement: null },
  })
  await storage.writePresentations([replaced])
  await storage.withUploadHashes((hashes) => {
    hashes.source = {
      [replacement.sha256]: {
        filename,
        originalName: filename,
        size: pixels.length,
        mimeType: 'image/png',
        uploadedAt: new Date(0).toISOString(),
      },
    }
  })
  return replacement
}

beforeAll(() => {
  delete require.cache[require.resolve('./presentations')]
  presentationsRouter = require('./presentations')
})

afterAll(async () => {
  delete require.cache[require.resolve('./presentations')]
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
  await fs.rm(dataDir, { recursive: true, force: true })
})

describe('duplicate uploaded semantic picture ownership', () => {
  beforeEach(async () => {
    await packageRuntime.shutdownPackageStore()
    await fs.rm(dataDir, { recursive: true, force: true })
    storage.initDataFiles()
  })

  afterEach(() => vi.restoreAllMocks())

  it('rebinds upload authorization and permits the first save of the copy', async () => {
    const sourceReplacement = await seed()
    const duplicate = await request(app()).post('/api/presentations/source/duplicate')

    expect(duplicate.status, JSON.stringify(duplicate.body)).toBe(201)
    const copied = duplicate.body
    const copiedElement = copied.slides[0].elements[0]
    const copiedInstance = copied.pptxSemantic.instances[copiedElement.pptxInstanceId]
    const copiedDefinition = copied.pptxSemantic.definitions[copiedInstance.definitionId]
    const copiedReplacement = copiedInstance.overrides.components[
      copiedDefinition.content.pictureDocument.componentId
    ].picture.replacement
    expect(copiedReplacement).toEqual({ ...sourceReplacement, presentationId: copied.id })

    const saved = await request(app())
      .put(`/api/presentations/${copied.id}`)
      .send(copied)
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    const hashes = await fsExtra.readJson(storage.UPLOAD_HASHES_FILE)
    expect(hashes.source[sourceReplacement.sha256].filename).toBe(sourceReplacement.filename)
    expect(hashes[copied.id][sourceReplacement.sha256].filename).toBe(sourceReplacement.filename)
  })

  it('rolls back destination upload authorization when duplicate publication fails', async () => {
    const replacement = await seed()
    const before = await fsExtra.readJson(storage.UPLOAD_HASHES_FILE)
    const writeJson = fsExtra.writeJson.bind(fsExtra)
    vi.spyOn(fsExtra, 'writeJson').mockImplementation(async (file, ...args) => {
      if (String(file).includes('presentations.json')) throw new Error('injected publication failure')
      return writeJson(file, ...args)
    })

    const duplicate = await request(app()).post('/api/presentations/source/duplicate')

    expect(duplicate.status).toBe(500)
    vi.restoreAllMocks()
    const hashes = await fsExtra.readJson(storage.UPLOAD_HASHES_FILE)
    expect(hashes).toEqual(before)
    expect(hashes.source[replacement.sha256].filename).toBe(replacement.filename)
  })
})
