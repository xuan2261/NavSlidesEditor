// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs-extra'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { createCanvas } from '@napi-rs/canvas'
import { pictureFixture, pixels } from '../../tests/pptx-semantic/semantic-picture-fixture'
const require = createRequire(import.meta.url)
const storage = require('../services/storage')
const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { initializePackageStore, shutdownPackageStore } = require('../services/pptx-import/package-store-runtime')
const { savePackageProjection } = require('../services/generation-safe-save')
const raster = createCanvas(2, 1)
raster.getContext('2d').fillRect(0, 0, 2, 1)
const replacementPixels = raster.toBuffer('image/png')
let id, root, app, files
beforeEach(async () => {
  id = `picture-${randomUUID()}`
  await fs.ensureDir(storage.DATA_DIR)
  storage.initDataFiles()
  root = await fs.mkdtemp(path.join(storage.DATA_DIR, 'picture-save-'))
  files = new Set()
  await fs.ensureDir(storage.UPLOADS_DIR)
  app = express()
  app.use(express.json({ limit: '5mb' }))
  app.use('/api/upload', require('./upload'))
  app.use('/api/presentations', require('./presentations-crud'))
})
afterEach(async () => {
  await shutdownPackageStore()
  await storage.withUploadHashes((hashes) => { delete hashes[id]; delete hashes[`${id}-other`] })
  await storage.withPresentations((items) => {
    const at = items.findIndex((p) => p.id === id)
    if (at !== -1) items.splice(at, 1)
  })
  await Promise.all([...files].map((name) => fs.remove(path.join(storage.UPLOADS_DIR, name))))
  await fs.remove(root)
})
async function upload({ bytes = replacementPixels, filename = 'new.png', scope = id } = {}) {
  const result = await request(app).post('/api/upload')
    .field('presentationId', scope).field('purpose', 'picture-replacement')
    .attach('file', bytes, filename)
  if (result.body.url) files.add(path.basename(result.body.url))
  return result
}
async function fixture(options = {}) {
  const data = await pictureFixture({ ...options, uploadsDir: root })
  data.presentation.id = id
  return data
}
function replace(p, replacement) {
  const element = p.slides[0].elements[0]
  return applyPresentationProjectionOperation(p, { type: 'picture.edit',
    instanceId: element.pptxInstanceId, componentId: element.pptxPicture.componentId,
    command: { type: 'replace', replacement, expectedReplacement: null } })
}
function crop(p, value) {
  const element = p.slides[0].elements[0]
  return applyPresentationProjectionOperation(p, { type: 'picture.edit',
    instanceId: element.pptxInstanceId, componentId: element.pptxPicture.componentId,
    command: { type: 'crop', edge: 'l', value } })
}
function expectSourcePreserved(before, after) {
  expect(after.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(after.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  const targetId = before.slides[0].elements[0].pptxInstanceId
  for (const [instanceId, source] of Object.entries(before.pptxSemantic.instances)) {
    const next = after.pptxSemantic.instances[instanceId]
    if (instanceId !== targetId) expect(next).toEqual(source)
    else {
      expect(next.sourceBinding).toEqual(source.sourceBinding)
      expect(next.textSourceBinding).toEqual(source.textSourceBinding)
      expect(next.relationshipChain).toEqual(source.relationshipChain)
    }
  }
}
describe('uploaded picture receipts and actual publication boundaries', () => {
  it('returns identical scoped receipts on concurrent dedup and keeps other scopes separate', async () => {
    const [a, b] = await Promise.all([upload(), upload()])
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(a.body.pictureReplacement).toEqual({
      kind: 'uploaded-picture', presentationId: id, filename: path.basename(a.body.url),
      sha256: createHash('sha256').update(replacementPixels).digest('hex'), width: 2, height: 1,
    })
    expect(a.body.pictureReplacement).toEqual(b.body.pictureReplacement)
    expect([a.body.deduped, b.body.deduped].sort()).toEqual([false, true])
    const foreign = await upload({ scope: `${id}-other` })
    expect(foreign.body.url).not.toBe(a.body.url)
  })
  it.each([
    { bytes: Buffer.from('not a raster'), filename: 'bad.png' },
    { bytes: pixels, filename: 'mismatch.jpg' },
    { bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), filename: 'vector.svg' },
    { scope: 'global' },
    { scope: '' },
  ])('refuses inadmissible raster upload %j without a receipt', async (options) => {
    const result = await upload(options)
    expect(result.status).toBe(400)
    expect(result.body).not.toHaveProperty('pictureReplacement')
  })
  it('rejects a stale dedup ledger file rather than issuing authority for changed bytes', async () => {
    const first = await upload()
    await fs.writeFile(path.join(storage.UPLOADS_DIR, path.basename(first.body.url)), Buffer.from('changed'))
    const second = await upload()
    expect(second.status).toBe(400)
    expect(second.body).not.toHaveProperty('pictureReplacement')
  })
  it('validates real legacy PUT, JSON reopen, and rejects forged upload references atomically', async () => {
    storage.initDataFiles()
    const { presentation } = await fixture({ crop: '' })
    await storage.withPresentations((items) => items.push(presentation))
    const cropped = crop(presentation, 500)
    const cropSave = await request(app).put(`/api/presentations/${id}`).send(cropped)
    expect(cropSave.status).toBe(200)
    const uploaded = await upload()
    expect(uploaded.status).toBe(200)
    const next = replace(cropped, uploaded.body.pictureReplacement)
    const source = presentation.slides[0].elements[0].pptxPictureAsset
    expect(uploaded.body.pictureReplacement.sha256).not.toBe(source.sha256)
    expect(await fs.readFile(path.join(root, path.basename(source.src)))).toEqual(pixels)
    const partial = { ...next }
    delete partial.id
    const response = await request(app).put(`/api/presentations/${id}`).send(partial)
    expect(response.status).toBe(200)
    const reopened = await request(app).get(`/api/presentations/${id}`)
    expect(reopened.body.pptxSemantic).toEqual(next.pptxSemantic)
    expect(reopened.body.slides[0].elements[0].src).toBe(uploaded.body.url)
    const element = reopened.body.slides[0].elements[0]
    const componentId = cropped.slides[0].elements[0].pptxPicture.componentId
    const targetInstance = reopened.body.pptxSemantic.instances[element.pptxInstanceId]
    expect(targetInstance.overrides.components[componentId].picture.srcRect).toEqual({ l: 500 })
    expect(targetInstance.overrides.components[componentId].picture.replacement).toEqual(uploaded.body.pictureReplacement)
    const hydrated = normalizeSemanticPresentation(reopened.body)
    expect(hydrated.slides[0].elements[0].pptxPictureAsset).toMatchObject({
      src: uploaded.body.url, sha256: uploaded.body.pictureReplacement.sha256, width: 2, height: 1,
    })
    expect(hydrated.slides[0].elements[0].pptxPicture.srcRect).toEqual({ l: 500 })
    expectSourcePreserved(presentation, reopened.body)
    const before = await storage.readPresentations()
    const foreign = await upload({ scope: `${id}-other` })
    for (const replacement of [
      { ...uploaded.body.pictureReplacement, filename: 'unknown.png' },
      { ...foreign.body.pictureReplacement, presentationId: id },
      { ...uploaded.body.pictureReplacement, sha256: 'f'.repeat(64) },
      { ...uploaded.body.pictureReplacement, width: 8 },
    ]) {
      const forged = replace(presentation, replacement)
      const rejected = await request(app).put(`/api/presentations/${id}`).send(forged)
      expect(rejected.status).toBe(400)
      expect(await storage.readPresentations()).toEqual(before)
    }
  })
  it.each(['slide', 'element', 'instance'])('rejects replacement of a stored %s lock even when the client removes it', async (lock) => {
    const { presentation: original } = await fixture()
    const locked = structuredClone(original)
    const element = locked.slides[0].elements[0]
    if (lock === 'slide') locked.slides[0].locked = true
    if (lock === 'element') element.locked = true
    if (lock === 'instance') locked.pptxSemantic.instances[element.pptxInstanceId].overrides.locked = true
    await storage.withPresentations((items) => items.push(locked))
    const uploaded = await upload()
    const next = replace(original, uploaded.body.pictureReplacement)
    const before = await storage.readPresentations()
    const rejected = await request(app).put(`/api/presentations/${id}`).send(next)
    expect(rejected.status).toBe(400)
    expect(await storage.readPresentations()).toEqual(before)
  })
  it('rejects a batch with one valid and one unknown replacement without publishing either', async () => {
    const { presentation } = await fixture()
    await storage.withPresentations((items) => items.push(presentation))
    const uploaded = await upload()
    const next = replace(presentation, uploaded.body.pictureReplacement)
    const sibling = next.slides[0].elements[1]
    const batch = applyPresentationProjectionOperation(next, { type: 'picture.edit',
      instanceId: sibling.pptxInstanceId, componentId: sibling.pptxPicture.componentId,
      command: { type: 'replace', replacement: {
        ...uploaded.body.pictureReplacement, filename: 'unknown.png',
      }, expectedReplacement: null } })
    const before = await storage.readPresentations()
    const rejected = await request(app).put(`/api/presentations/${id}`).send(batch)
    expect(rejected.status).toBe(400)
    expect(await storage.readPresentations()).toEqual(before)
  })
  it('awaits package validation, preserves Original, and rejects stale generations and changed bytes', async () => {
    const { presentation, zip } = await fixture()
    const original = await zip.generateAsync({ type: 'nodebuffer' })
    const store = await initializePackageStore({ rootDir: path.join(root, 'package') })
    const { buildImportSourceMap } = require('../services/pptx-import/source-map')
    const sourceMap = await buildImportSourceMap(presentation, null, zip)
    const imported = await store.commitImport(original, {
      jobId: id, presentationId: id, projection: presentation, sourceMap,
    })
    const uploaded = await upload()
    const cropped = crop(presentation, 750)
    const next = replace(cropped, uploaded.body.pictureReplacement)
    const save = (after, generation, key) => savePackageProjection({
      presentationId: id, expectedGeneration: generation,
      baseRevisionId: imported.head.packageRevisionId, idempotencyKey: key,
      after, loadStored: async () => presentation,
    })
    const [saved, conflict] = await Promise.all([
      save(next, 1, 'replace-picture'), save(next, 1, 'concurrent-picture'),
    ])
    expect(saved).toMatchObject({ ok: true, generation: 2 })
    expect(conflict).toMatchObject({ ok: false, reason: 'STALE_GENERATION' })
    expect(saved.aggregateHead.packageRevisionId).toBe(imported.head.packageRevisionId)
    const reopened = JSON.parse(JSON.stringify(saved.projection))
    expect(reopened.pptxSemantic).toEqual(next.pptxSemantic)
    expect(reopened.slides[0].elements[0].src).toBe(uploaded.body.url)
    expect(reopened.slides[0].elements[0].pptxPictureAsset).toMatchObject({
      src: uploaded.body.url, sha256: uploaded.body.pictureReplacement.sha256, width: 2, height: 1,
    })
    const element = reopened.slides[0].elements[0]
    const targetInstance = reopened.pptxSemantic.instances[element.pptxInstanceId]
    const componentId = reopened.pptxSemantic.definitions[targetInstance.definitionId].content.pictureDocument.componentId
    expect(targetInstance.overrides.components[componentId].picture.srcRect).toEqual({ l: 750 })
    expectSourcePreserved(presentation, reopened)
    expect(await save(next, 1, 'stale-picture')).toMatchObject({ ok: false, reason: 'STALE_GENERATION' })
    const before = structuredClone(store.getState())
    await fs.writeFile(path.join(storage.UPLOADS_DIR, uploaded.body.pictureReplacement.filename), Buffer.from('changed'))
    await expect(save(next, 2, 'changed-picture')).rejects.toMatchObject({ code: 'INVALID_PPTX_SEMANTIC_DOCUMENT' })
    expect(store.getState()).toEqual(before)
    const { resolveImmutableOriginalRevisionBytes } = require('../services/pptx-import/package-revision-resolver')
    expect((await resolveImmutableOriginalRevisionBytes({ presentationId: id }, { store })).bytes).toEqual(original)
  })
})
