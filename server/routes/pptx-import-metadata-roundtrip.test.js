// @vitest-environment node
// Synthetic ZIP/projection fixture; exercises actual package publication, PUT/GET and durable reopen.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import express from 'express'
import request from 'supertest'
import JSZip from 'jszip'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const priorData = process.env.SLIDES_DATA_DIR
const priorUploads = process.env.SLIDES_UPLOADS_DIR
const root = path.join(os.tmpdir(), `pptx-trusted-meta-${process.pid}-${Date.now()}`)
process.env.SLIDES_DATA_DIR = path.join(root, 'data')
process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
const storage = require('../services/storage')
const runtime = require('../services/pptx-import/package-store-runtime')
const { buildImportSourceMap } = require('../services/pptx-import/source-map')
const { canonicalEditableSnapshot } = require('../services/pptx-import/canonical-snapshot')
const { resolveEditedExportContext } = require('../services/pptx-import/validated-edited-export-context')
const { hashRecord } = require('../services/pptx-import/package-store/schemas')
const { replayJournal } = require('../services/pptx-import/mutation-journal')
const app = express()
app.use(express.json())
app.use('/api/presentations', require('./presentations-crud'))
const meta = { version: 1, textFit: 'wrap', sourceFontSizePx: 24, fitFontSizePx: 18,
  textLength: 4, sourceBox: { width: 300, height: 80 }, textInsetsUnit: 'px',
  textInsets: { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6 } }
const element = (id) => ({ id, type: 'text', x: 0, y: 0, content: '<p>Base</p>', width: 300, height: 80,
  fontSize: 24, fontFamily: 'Arial', lineHeight: 1.2, _pptxImportMeta: structuredClone(meta) })
let original, originalRevision
async function opened() {
  const response = await request(app).get('/api/presentations/imported-meta')
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  return response.body
}
async function save(slides, generation, key) {
  const response = await request(app).put('/api/presentations/imported-meta').set('Idempotency-Key', key)
    .send({ aggregateGeneration: generation, slides })
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  return response.body
}
async function assertAuthority() {
  const state = runtime.getPackageStore().getState()
  const head = state.heads.find((item) => item.presentationId === 'imported-meta')
  const context = resolveEditedExportContext(state, 'imported-meta')
  expect(context.ok).toBe(true)
  expect(head.projectionRevisionId).toBe(hashRecord(context.after))
  expect(head.sourceMapRevisionId).toBe(hashRecord(context.sourceMap))
  if (context.pendingJournalHash !== undefined) {
    const pending = state.mutationResults.find((item) => item.journal?.journalHash === context.pendingJournalHash)
    expect(replayJournal(context.before, pending.journal)).toEqual(context.after)
    expect(canonicalEditableSnapshot(await opened())).toMatchObject(context.after)
  }
  expect(await runtime.getPackageStore().readOriginal(originalRevision)).toEqual(original)
}

describe('trusted imported visual metadata across native projection saves', () => {
  beforeEach(async () => {
    await runtime.shutdownPackageStore()
    storage.initDataFiles()
    await storage.writePresentations([])
    const store = await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<Types/>')
    zip.file('ppt/presentation.xml', '<p:presentation/>')
    original = await zip.generateAsync({ type: 'nodebuffer' })
    const projection = { id: 'imported-meta', title: 'Trusted import metadata', slides: [
      { id: 'import-slide', notes: '', elements: [element('import-text')], children: [
        { id: 'import-child', notes: '', elements: [element('child-text')] },
      ] },
    ] }
    const prepared = await store.prepareImport(original, { jobId: 'trusted-import-job',
      presentationId: projection.id, projection, compatibilityPresentation: projection,
      sourceMap: await buildImportSourceMap(projection, null, null) })
    const result = await runtime.withPackageStore((current) => current.publishImport(prepared))
    originalRevision = result.head.originalRevisionId
    await runtime.drainPackageCompatibilityOutbox()
  })
  afterEach(async () => {
    await runtime.shutdownPackageStore()
    await fs.rm(root, { recursive: true, force: true })
  })
  afterAll(() => {
    if (priorData === undefined) delete process.env.SLIDES_DATA_DIR
    else process.env.SLIDES_DATA_DIR = priorData
    if (priorUploads === undefined) delete process.env.SLIDES_UPLOADS_DIR
    else process.env.SLIDES_UPLOADS_DIR = priorUploads
  })

  it('restores trusted parent and child metadata after their identities disappear and the store reopens', async () => {
    const initial = await opened()
    expect(initial.slides[0].elements[0]._pptxImportMeta).toEqual(meta)
    await save([{ id: 'synthetic-boundary', notes: '', elements: [] }], 1, 'replace-imported-identities')
    await runtime.shutdownPackageStore()
    await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
    const restored = structuredClone(initial.slides)
    delete restored[0].elements[0]._pptxImportMeta
    delete restored[0].children[0].elements[0]._pptxImportMeta
    await save(restored, 2, 'restore-imported-identities')
    const reopened = await opened()
    expect(reopened.slides[0].elements[0]._pptxImportMeta).toEqual(meta)
    expect(reopened.slides[0].children[0].elements[0]._pptxImportMeta).toEqual(meta)
    expect(reopened.slides).toEqual(initial.slides)
    await assertAuthority()
  })

  it('rejects client metadata forgery for existing, new, cross-slide and changed-type identities', async () => {
    const initial = await opened(), slides = structuredClone(initial.slides)
    slides[0].elements[0]._pptxImportMeta = { fitFontSizePx: 999, textInsets: { left: 999 } }
    slides[0].elements.push({ ...element('client-created'), _pptxImportMeta: { fitFontSizePx: 999 } })
    slides[0].children[0].elements[0].type = 'shape'
    slides[0].children[0].elements[0]._pptxImportMeta = { fitFontSizePx: 999 }
    slides.push({ id: 'unrelated-slide', notes: '', elements: [element('import-text')] })
    await save(slides, 1, 'reject-visual-metadata-forgery')
    const result = await opened()
    expect(result.slides[0].elements[0]._pptxImportMeta).toEqual(meta)
    expect(result.slides[0].elements[1]._pptxImportMeta).toBeUndefined()
    expect(result.slides[0].children[0].elements[0]._pptxImportMeta).toBeUndefined()
    expect(result.slides[1].elements[0]._pptxImportMeta).toBeUndefined()
    await assertAuthority()
  })

  it.each(['content', 'fontSize', 'width', 'textColor', 'lineHeight'])('invalidates server fit fields after %s edits but restores the exact base after undo', async (key) => {
    const initial = await opened(), slides = structuredClone(initial.slides)
    const edits = { content: '<p>Longer content</p>', fontSize: 32, width: 150, textColor: '#ff0000', lineHeight: 2 }
    slides[0].elements[0][key] = edits[key]
    slides[0].elements[0]._pptxImportMeta = { ...meta, fitFontSizePx: 999 }
    const saved = await save(slides, 1, `invalidate-imported-fit-${key}`)
    const result = await opened(), expected = structuredClone(meta)
    delete expected.fitFontSizePx; delete expected.sourceFontSizePx; delete expected.textLength
    expect(saved.slides[0].elements[0]._pptxImportMeta).toEqual(expected)
    const raw = (await storage.readPresentations()).find((item) => item.id === 'imported-meta')
    expect(raw.slides[0].elements[0]._pptxImportMeta).toEqual(expected)
    expect(result.slides[0].elements[0]._pptxImportMeta).toEqual(expected)
    expect(result.slides[0].children[0].elements[0]._pptxImportMeta).toEqual(meta)
    await save(initial.slides, 2, `undo-imported-fit-${key}`)
    expect((await opened()).slides).toEqual(initial.slides)
    await assertAuthority()
  })
  it('omits forged trustedImportMetadata at root, slide and element ingress and editor output', async () => {
    const initial = await opened(), forged = { schemaVersion: 1, originalRevisionId: 'foreign-original', elements: [] }
    const slides = structuredClone(initial.slides)
    slides[0].trustedImportMetadata = forged
    slides[0].elements[0].trustedImportMetadata = forged
    const saved = await request(app).put('/api/presentations/imported-meta').set('Idempotency-Key', 'deny-client-sidecar')
      .send({ aggregateGeneration: 1, slides, trustedImportMetadata: forged })
    expect(saved.status).toBe(200)
    const result = await opened()
    for (const value of [saved.body, result, result.slides[0], result.slides[0].elements[0]]) {
      expect(value).not.toHaveProperty('trustedImportMetadata')
    }
    expect(result.slides).toEqual(initial.slides)
    await assertAuthority()
  })

  it('validates detached Original-bound sidecars and rejects malformed styling or identity data', async () => {
    const { collectTrustedImportMetadata, validateTrustedImportMetadata } = require('../services/pptx-import/trusted-import-metadata')
    const sidecar = collectTrustedImportMetadata(await opened(), originalRevision)
    const copy = validateTrustedImportMetadata(sidecar, originalRevision)
    expect(copy).toEqual(sidecar)
    copy.elements[0].metadata.fitFontSizePx = 777
    expect(sidecar.elements[0].metadata.fitFontSizePx).toBe(18)
    const wrongOriginal = { ...sidecar, originalRevisionId: 'foreign-original' }
    const duplicate = { ...sidecar, elements: [...sidecar.elements, sidecar.elements[0]] }
    const authority = { ...sidecar, packageRevisionId: originalRevision }
    const forged = structuredClone(sidecar)
    forged.elements[0].metadata.sourceMapRevisionId = 'forged'
    const nonfinite = structuredClone(sidecar)
    nonfinite.elements[0].metadata.fitFontSizePx = NaN
    const accessor = structuredClone(sidecar)
    let getterCalls = 0
    Object.defineProperty(accessor.elements[0].metadata, 'fitFontSizePx', { get() { getterCalls += 1; throw new Error('Getter must not run') }, enumerable: true })
    for (const value of [wrongOriginal, duplicate, authority, forged, nonfinite, accessor]) {
      expect(() => validateTrustedImportMetadata(value, originalRevision)).toThrowError(/Invalid trusted import metadata/)
    }
    expect(getterCalls).toBe(0)
    const { queueCompatibilityUpsert } = require('../services/pptx-import/compatibility-outbox')
    const target = { compatibilityOutbox: [] }
    const projection = await opened()
    projection.pptxAggregateHead = { originalRevisionId: originalRevision }
    const input = { presentationId: projection.id, generation: 1, presentation: projection }
    expect(() => queueCompatibilityUpsert(target, { ...input, trustedImportMetadata: wrongOriginal })).toThrowError(/Invalid trusted import metadata/)
    expect(target.compatibilityOutbox).toEqual([])
    const write = queueCompatibilityUpsert(target, { ...input, trustedImportMetadata: sidecar })
    expect(write.trustedImportMetadata).toEqual(sidecar)
    expect(write.presentation).not.toHaveProperty('trustedImportMetadata')
    expect(write.id).not.toBe(queueCompatibilityUpsert({ compatibilityOutbox: [] }, input).id)
    const invalidImporter = await opened()
    invalidImporter.slides[0].elements[0]._pptxImportMeta.fitFontSizePx = NaN
    expect(() => collectTrustedImportMetadata(invalidImporter, originalRevision)).toThrowError(/Invalid trusted import metadata/)
  })
})
