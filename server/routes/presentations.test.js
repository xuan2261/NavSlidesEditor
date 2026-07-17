import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs-extra'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { openPackageStore } from '../services/pptx-import/package-store/index.js'
import * as storage from '../services/storage.js'
import templatesRouter from './templates.js'

const require = createRequire(import.meta.url)
const presentationsRouter = require('./presentations.js')
const packageRuntime = require('../services/pptx-import/package-store-runtime.js')
const JSZip = require('jszip')
const os = require('node:os')
const { buildImportSourceMap } = require('../services/pptx-import/source-map.js')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createApp() {
  const app = express()
  app.use(express.json({ limit: '5mb' }))
  app.use('/api/presentations', presentationsRouter)
  app.use('/api/templates', templatesRouter)
  return app
}

async function createNativeRouteFixture(app, { sourceMap = true } = {}) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'route-g2-'))
  await packageRuntime.shutdownPackageStore()
  const created = await request(app).post('/api/presentations').send({
    title: 'G2', slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>Before</p>' }] }],
  })
  const id = created.body.id
  const store = await packageRuntime.initializePackageStore({ rootDir })
  const shape = '<p:sp><p:nvSpPr><p:cNvPr id="4" name="Title"/></p:nvSpPr><p:spPr/><p:txBody><a:p><a:r><a:t>Before</a:t></a:r></a:p></p:txBody></p:sp>'
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>'); zip.file('ppt/presentation.xml', '<p:presentation/>')
  zip.file('_rels/.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>')
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>')
  zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${shape}</p:spTree></p:cSld></p:sld>`)
  const bytes = await zip.generateAsync({ type: 'nodebuffer' })
  const map = sourceMap && await buildImportSourceMap({ id, slides: [{ id: 's1', elements: [{
    id: 'e1', type: 'text', content: '<p>Before</p>', _pptxSource: { nodeId: '4', matchedBy: 'sourceId' },
  }] }] }, { slides: [{ index: 0, path: 'ppt/slides/slide1.xml', nodes: [{
    id: '4', kind: 'shape', sourceXml: shape,
  }] }] }, zip, { packageGeneration: 1, revisionId: 'pending' })
  if (map) await store.commitImport(bytes, { jobId: `import-${id}`, presentationId: id, projection: { id, slides: created.body.slides }, sourceMap: map })
  else await store.commitOriginal(bytes, { ownerType: 'presentation', ownerId: id })
  return { id, rootDir, store, async cleanup() {
    await packageRuntime.shutdownPackageStore()
    await fs.remove(rootDir)
    await request(app).delete(`/api/presentations/${id}/permanent`)
  } }
}

function nativeSave(app, id, body, key = 'g2-route') {
  return request(app).put(`/api/presentations/${id}`).set('Idempotency-Key', key).send(body)
}
function unkeyedSave(app, id, body) {
  return request(app).put(`/api/presentations/${id}`).send(body)
}

describe('Presentations API', () => {
  const app = createApp()

  beforeAll(() => {
    storage.initDataFiles()
  })

  it('covers CRUD, trash/restore, duplicate, export, present, and save-as-template', async () => {
    const title = `Route Test ${Date.now()}`
    const createRes = await request(app)
      .post('/api/presentations')
      .send({
        title,
        theme: 'dracula',
        transition: 'fade',
        slides: [
          {
            id: 'slide-a',
            notes: 'Legacy note',
            elements: [
              {
                id: 'el-a',
                type: 'text',
                x: 80,
                y: 80,
                width: 300,
                height: 120,
                content: '<p>Hello</p>',
              },
            ],
          },
        ],
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.title).toBe(title)
    expect(createRes.body.slides[0].notes).toBe('Legacy note')
    expect(createRes.body.slides[0].speakerNotes).toBeUndefined()
    const id = createRes.body.id

    const listRes = await request(app).get('/api/presentations')
    expect(listRes.status).toBe(200)
    expect(listRes.body.some((item) => item.id === id && item.slideCount === 1)).toBe(true)

    const getRes = await request(app).get(`/api/presentations/${id}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.title).toBe(title)

    const updateRes = await request(app)
      .put(`/api/presentations/${id}`)
      .send({ title: `${title} Updated`, slides: getRes.body.slides })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.title).toBe(`${title} Updated`)

    const duplicateRes = await request(app).post(`/api/presentations/${id}/duplicate`)
    expect(duplicateRes.status).toBe(201)
    expect(duplicateRes.body.id).not.toBe(id)
    expect(duplicateRes.body.title).toContain('(copy)')

    const exportRes = await request(app).get(`/api/presentations/${id}/export`)
    expect(exportRes.status).toBe(200)
    expect(exportRes.headers['content-type']).toContain('text/html')
    expect(exportRes.text).toContain('Hello')

    const presentRes = await request(app).get(`/api/presentations/${id}/present?preview=true`)
    expect(presentRes.status).toBe(200)
    expect(presentRes.text).toContain('controls: false')

    const templateRes = await request(app)
      .post(`/api/presentations/${id}/save-as-template`)
      .send({ title: 'Reusable' })
    expect(templateRes.status).toBe(201)
    expect(templateRes.body.isTemplate).toBe(true)

    const deleteRes = await request(app).delete(`/api/presentations/${id}`)
    expect(deleteRes.status).toBe(200)

    const trashRes = await request(app).get('/api/presentations/trash/list')
    expect(trashRes.status).toBe(200)
    expect(trashRes.body.some((item) => item.id === id)).toBe(true)

    const restoreRes = await request(app).post(`/api/presentations/${id}/restore`)
    expect(restoreRes.status).toBe(200)

    const permanentDelete = await request(app).delete(`/api/presentations/${id}/permanent`)
    expect(permanentDelete.status).toBe(200)

    await request(app).delete(`/api/presentations/${duplicateRes.body.id}/permanent`)
    await request(app).delete(`/api/templates/${templateRes.body.id}`)
  })

  it('returns 404 for missing presentation mutations and lookup', async () => {
    expect((await request(app).get('/api/presentations/missing')).status).toBe(404)
    expect((await request(app).put('/api/presentations/missing').send({ title: 'Nope' })).status).toBe(404)
    expect((await request(app).delete('/api/presentations/missing')).status).toBe(404)
    expect((await request(app).post('/api/presentations/missing/duplicate')).status).toBe(404)
    expect((await request(app).get('/api/presentations/missing/export')).status).toBe(404)
  })

  it('validates save-as-template title payloads', async () => {
    const createRes = await request(app)
      .post('/api/presentations')
      .send({ title: 'Template validation source', slides: [{ id: 's1', elements: [] }] })
    expect(createRes.status).toBe(201)

    const objectTitleRes = await request(app)
      .post(`/api/presentations/${createRes.body.id}/save-as-template`)
      .send({ title: { bad: true } })
    expect(objectTitleRes.status).toBe(400)

    const longTitleRes = await request(app)
      .post(`/api/presentations/${createRes.body.id}/save-as-template`)
      .send({ title: 'x'.repeat(501) })
    expect(longTitleRes.status).toBe(400)

    await request(app).delete(`/api/presentations/${createRes.body.id}/permanent`)
  })

  it('accepts persisted plugin elements in presentation payloads', async () => {
    const pluginElement = {
      id: 'plugin-counter-1',
      type: 'plugin:counter',
      x: 120,
      y: 140,
      width: 320,
      height: 180,
      pluginId: 'animated-counter',
      pluginSlug: 'animated-counter',
      pluginData: { value: 100 },
      pluginRuntime: { label: 'Animated Counter', sandbox: 'sandbox.html' },
    }
    const createRes = await request(app).post('/api/presentations').send({
      title: 'Plugin persistence route test',
      slides: [{ id: 'slide-plugin', elements: [pluginElement] }],
    })

    expect(createRes.status).toBe(201)
    expect(createRes.body.slides[0].elements[0]).toMatchObject(pluginElement)

    const updateRes = await request(app)
      .put(`/api/presentations/${createRes.body.id}`)
      .send({ slides: createRes.body.slides })

    expect(updateRes.status).toBe(200)
    expect(updateRes.body.slides[0].elements[0].type).toBe('plugin:counter')
    expect(updateRes.body.slides[0].elements[0].pluginRuntime.sandbox).toBe('sandbox.html')

    await request(app).delete(`/api/presentations/${createRes.body.id}/permanent`)
  })

  it('recursively strips forged package authority while preserving editable data', async () => {
    const created = await request(app).post('/api/presentations').send({
      title: 'Authority sanitizer',
      packageRevisionId: 'forged-create-revision',
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', x: 0, y: 0,
        width: 100, height: 100, content: '<p>before</p>',
        nested: { fencingEpoch: 99, blobSha256: 'forged-blob' } }] }],
    })
    expect(created.body).not.toHaveProperty('packageRevisionId')
    const forged = {
      pptxAggregateHead: { packageRevisionId: 'forged' },
      capability: 'stolen',
      validatedRevision: 'forged',
      journal: { operation: 'forged' },
      sourceAuthority: 'forged',
      packagePath: 'C:\\secret',
      fencingEpoch: 7,
      blobSha256: 'forged-blob',
      originalRevisionId: 'forged-original',
    }
    const updated = await request(app).put(`/api/presentations/${created.body.id}`).send({
      title: 'Legitimate edit',
      slides: [{ ...created.body.slides[0], elements: [{
        ...created.body.slides[0].elements[0],
        content: '<p>after</p>',
        nested: forged,
      }] }],
      ...forged,
    })

    expect(updated.status).toBe(200)
    expect(updated.body.title).toBe('Legitimate edit')
    expect(updated.body.slides[0].elements[0].content).toBe('<p>after</p>')
    for (const key of Object.keys(forged)) {
      expect(updated.body).not.toHaveProperty(key)
      expect(updated.body.slides[0].elements[0].nested).not.toHaveProperty(key)
    }
    const persisted = (await storage.readPresentations())
      .find((item) => item.id === created.body.id)
    expect(persisted.slides[0].elements[0].nested).toEqual({})
    expect(persisted.slides[0].elements[0].nested).not.toHaveProperty('fencingEpoch')
    await request(app).delete(`/api/presentations/${created.body.id}/permanent`)
  })

  it('creates from built-in non-UUID template ids selected in the start-from modal', async () => {
    const createRes = await request(app)
      .post('/api/presentations')
      .send({ title: 'Built-in start from test', templateId: 'deck-blank-light' })

    expect(createRes.status).toBe(201)
    expect(createRes.body.id).toBeTruthy()
    expect(createRes.body.title).toBe('Built-in start from test')
    expect(createRes.body.slides.length).toBeGreaterThan(0)

    await request(app).delete(`/api/presentations/${createRes.body.id}/permanent`)
  })

  it('seeds blank presentations with theme tokens instead of a fixed dark slide', async () => {
    const blackRes = await request(app)
      .post('/api/presentations')
      .send({ title: 'Blank black theme', theme: 'black' })
    const whiteRes = await request(app)
      .post('/api/presentations')
      .send({ title: 'Blank white theme', theme: 'white' })

    expect(blackRes.status).toBe(201)
    expect(whiteRes.status).toBe(201)
    expect(blackRes.body.slides[0].background).toEqual({ type: 'none' })
    expect(whiteRes.body.slides[0].background).toEqual({ type: 'none' })
    expect(blackRes.body.designTokens.colors.bg).not.toBe(whiteRes.body.designTokens.colors.bg)
    expect(blackRes.body.slides[0].elements[0].textColor).toBe('auto')

    await request(app).delete(`/api/presentations/${blackRes.body.id}/permanent`)
    await request(app).delete(`/api/presentations/${whiteRes.body.id}/permanent`)
  })

  it('seeds imported slide payloads with theme tokens when none are provided', async () => {
    const createRes = await request(app)
      .post('/api/presentations')
      .send({
        title: 'Imported white deck',
        theme: 'white',
        slides: [{ id: 'imported-slide', elements: [] }],
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.designTokens.colors.bg).toBe('#ffffff')
    expect(createRes.body.designTokens.colors.text).toBe('#1d1d1f')

    await request(app).delete(`/api/presentations/${createRes.body.id}/permanent`)
  })

  it('removes both legacy and object-format share tokens on permanent delete', async () => {
    const created = await request(app).post('/api/presentations').send({ title: 'Cascade test' })
    expect(created.status).toBe(201)
    const id = created.body.id

    await storage.writeShareTokens({
      legacyToken: id,
      objectToken: { presentationId: id, views: 2 },
      otherToken: { presentationId: 'different-id' },
    })

    const deleteRes = await request(app).delete(`/api/presentations/${id}/permanent`)
    expect(deleteRes.status).toBe(200)

    const tokens = await storage.readShareTokens()
    expect(tokens.legacyToken).toBeUndefined()
    expect(tokens.objectToken).toBeUndefined()
    expect(tokens.otherToken).toBeDefined()
  })

  it('leaves presentation, shares, history, and recovery metadata intact when package quarantine is unavailable', async () => {
    const id = `package-quarantine-failure-${Date.now()}`
    const historyFile = path.join(storage.HISTORY_DIR, id, 'snapshot-1.json')
    const original = {
      id,
      title: 'Quarantine failure recovery deck',
      slides: [{ id: 'slide-1', elements: [] }],
      pptxOriginal: {
        id: `legacy-original-${id}`,
        sha256: 'a'.repeat(64),
        byteLength: 42,
        uploadedAt: '2026-07-13T00:00:00.000Z',
      },
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    }
    const legacyToken = `legacy-${id}`
    const objectToken = `object-${id}`

    await storage.withPresentations((presentations) => {
      presentations.push(original)
    })
    await storage.writeShareTokens({
      ...(await storage.readShareTokens()),
      [legacyToken]: id,
      [objectToken]: { presentationId: id },
    })
    await fs.outputJson(historyFile, { id: 'snapshot-1' })
    const heldStore = await openPackageStore({ rootDir: storage.DATA_DIR })
    await heldStore.acquireWriter()
    let deleteRes
    try {
      deleteRes = await request(app).delete(`/api/presentations/${id}/permanent`)
    } finally {
      await heldStore.releaseWriter()
    }

    expect(deleteRes.status).toBe(503)
    expect(deleteRes.body).toEqual({
      error: 'Package lifecycle is temporarily unavailable; retry deletion',
      code: 'PACKAGE_LIFECYCLE_UNAVAILABLE',
      retryable: true,
    })
    expect((await storage.readPresentations()).find((presentation) => presentation.id === id)).toEqual(original)
    const tokens = await storage.readShareTokens()
    expect(tokens[legacyToken]).toBe(id)
    expect(tokens[objectToken]).toEqual({ presentationId: id })
    expect(await fs.pathExists(historyFile)).toBe(true)

    await request(app).delete(`/api/presentations/${id}/permanent`)
  })

  it('normalizes legacy pptx-imported presentation resolution on read without rewriting storage', async () => {
    const id = `legacy-pptx-${Date.now()}`
    const legacy = {
      id,
      title: 'Legacy PPTX 4x3',
      resolution: { width: 720, height: 540 },
      _pptxMeta: { originalSize: { width: 720, height: 540 } },
      slides: [{ id: 'slide-1', elements: [] }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await storage.withPresentations((presentations) => {
      presentations.push(legacy)
    })

    const fetched = await request(app).get(`/api/presentations/${id}`)
    expect(fetched.status).toBe(200)
    expect(fetched.body.resolution).toEqual({ width: 960, height: 540 })
    expect(fetched.body._pptxMeta).toEqual({ originalSize: { width: 720, height: 540 } })

    const persisted = (await storage.readPresentations()).find((presentation) => presentation.id === id)
    expect(persisted.resolution).toEqual({ width: 720, height: 540 })

    await request(app).delete(`/api/presentations/${id}/permanent`)
  })

  it('rejects a package head without current source authority without changing JSON', async () => {
    const fixture = await createNativeRouteFixture(app, { sourceMap: false })
    try {
      const saved = await nativeSave(app, fixture.id, { aggregateGeneration: 1, slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>After</p>' }] }] })
      expect(saved).toMatchObject({ status: 422, body: { code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE' } })
      expect((await storage.readPresentations()).find((item) => item.id === fixture.id).slides[0].elements[0].content).toBe('<p>Before</p>')
      expect(fixture.store.getState().heads.find((head) => head.presentationId === fixture.id).generation).toBe(1)
    } finally { await fixture.cleanup() }
  })

  it('blocks every unkeyed package-backed PUT before JSON or head publication', async () => {
    const fixture = await createNativeRouteFixture(app)
    try {
      const content = await unkeyedSave(app, fixture.id, {
        slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p><strong>Rich</strong></p>' }] }],
      })
      const metadata = await unkeyedSave(app, fixture.id, { title: 'Must not persist' })
      for (const response of [content, metadata]) {
        expect(response).toMatchObject({ status: 428, body: { code: 'PACKAGE_SAVE_ENVELOPE_REQUIRED' } })
      }
      const persisted = (await storage.readPresentations()).find((item) => item.id === fixture.id)
      expect(persisted).toMatchObject({ title: 'G2' })
      expect(persisted.slides[0].elements[0].content).toBe('<p>Before</p>')
      expect(fixture.store.getState().heads.find((head) => head.presentationId === fixture.id))
        .toMatchObject({ generation: 1 })
    } finally { await fixture.cleanup() }
  })

  it('keeps unkeyed PUT compatible for a non-package-backed presentation', async () => {
    const created = await request(app).post('/api/presentations').send({
      title: 'Legacy save', slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>Before</p>' }] }],
    })
    const saved = await unkeyedSave(app, created.body.id, { title: 'Legacy saved' })
    expect(saved).toMatchObject({ status: 200, body: { title: 'Legacy saved' } })
    await request(app).delete(`/api/presentations/${created.body.id}/permanent`)
  })

  it('records a pending journal without publishing R1 when a normal package-backed save lacks qualified validators', async () => {
    const fixture = await createNativeRouteFixture(app)
    try {
      const initialHead = fixture.store.getState().heads.find((head) => head.presentationId === fixture.id)
      const initialRevision = fixture.store.getState().revisions.find(
        (item) => item.id === initialHead.packageRevisionId
      )
      const initialBytes = await fixture.store.readBlob(initialRevision.blobSha256)
      const initialRevisionCount = fixture.store.getState().revisions.length
      const body = {
        aggregateGeneration: 1,
        baseRevisionId: initialHead.packageRevisionId,
        slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>After</p>' }] }],
      }
      const saved = await nativeSave(app, fixture.id, body)
      expect(saved).toMatchObject({ status: 200, body: { aggregateGeneration: 2, saveOutcome: 'committed' } })

      const currentHead = fixture.store.getState().heads.find((head) => head.presentationId === fixture.id)
      expect(currentHead).toMatchObject({
        generation: 2,
        originalRevisionId: initialHead.originalRevisionId,
        packageRevisionId: initialHead.packageRevisionId,
        journalRevisionId: expect.any(String),
      })
      expect(fixture.store.getState().revisions).toHaveLength(initialRevisionCount)
      expect(await fixture.store.readBlob(initialRevision.blobSha256)).toEqual(initialBytes)
      expect(fixture.store.getState().mutationResults.at(-1)).toMatchObject({
        packageRevisionId: initialHead.packageRevisionId,
        state: 'pending-edited-export',
        journal: {
          matrixAuthoritySubject: expect.objectContaining({ hash: expect.any(String) }),
          reasonCodeSubject: expect.objectContaining({ hash: expect.any(String) }),
        },
      })

      const original = await request(app)
        .get(`/api/presentations/${fixture.id}/pptx-original`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () => cb(null, Buffer.concat(chunks)))
        })
      expect(original.status).toBe(200)
      expect(original.headers['x-pptx-export-mode']).toBe('immutable-package-original')
      expect(original.headers['x-pptx-original-sha256']).toBe(initialRevision.blobSha256)
      expect(Buffer.isBuffer(original.body) && original.body.equals(initialBytes)).toBe(true)

      const stale = await nativeSave(app, fixture.id, { ...body, aggregateGeneration: 1 }, 'stale-generation')
      expect(stale).toMatchObject({ status: 409, body: { code: 'STALE_GENERATION', currentGeneration: 2 } })
      const base = await nativeSave(app, fixture.id, {
        ...body,
        aggregateGeneration: 2,
        baseRevisionId: 'r0-stale',
      }, 'stale-base')
      expect(base).toMatchObject({
        status: 409,
        body: {
          code: 'BASE_REVISION_MISMATCH',
          reasonCode: 'BASE_REVISION_MISMATCH',
          reasonCodes: ['BASE_REVISION_MISMATCH'],
          reasonCodeSubject: expect.objectContaining({ schemaVersion: 1, version: '1.0.0' }),
          currentGeneration: 2,
        },
      })
      const persisted = (await storage.readPresentations()).find((item) => item.id === fixture.id)
      expect(persisted.slides[0].elements[0].content).toBe('<p>After</p>')
      expect(persisted.pptxAggregateHead).toMatchObject({
        packageRevisionId: initialHead.packageRevisionId,
        generation: 2,
        pendingJournalHash: expect.any(String),
      })
    } finally { await fixture.cleanup() }
  })

  it('rejects a save whose persisted head matrix authority is stale without advancing it', async () => {
    const fixture = await createNativeRouteFixture(app)
    try {
      const head = fixture.store.getState().heads.find((item) => item.presentationId === fixture.id)
      await fixture.store.mutate((next) => {
        const staleHead = next.heads.find((item) => item.presentationId === fixture.id)
        staleHead.matrixAuthoritySubjects = {
          ...staleHead.matrixAuthoritySubjects,
          journal: { ...staleHead.matrixAuthoritySubjects.journal, hash: '0'.repeat(64) },
        }
      })

      const saved = await nativeSave(app, fixture.id, {
        aggregateGeneration: head.generation,
        baseRevisionId: head.packageRevisionId,
        slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>After</p>' }] }],
      }, 'stale-matrix-authority')

      expect(saved).toMatchObject({ status: 422, body: { code: 'STALE_MATRIX_AUTHORITY' } })
      expect(fixture.store.getState().heads.find((item) => item.presentationId === fixture.id))
        .toMatchObject({ generation: head.generation })
    } finally { await fixture.cleanup() }
  })

  it('replays only the identical idempotency request and never returns stale success', async () => {
    const fixture = await createNativeRouteFixture(app)
    try {
      const body = { aggregateGeneration: 1,
        baseRevisionId: fixture.store.getState().heads.find((head) => head.presentationId === fixture.id).packageRevisionId,
        slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>After</p>' }] }] }
      const first = await nativeSave(app, fixture.id, body, 'replay-key')
      const replay = await nativeSave(app, fixture.id, body, 'replay-key')
      const conflict = await nativeSave(app, fixture.id, { ...body, slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: 'Changed' }] }] }, 'replay-key')
      expect(first.body.aggregateGeneration).toBe(2)
      expect(replay.body).toMatchObject({ aggregateGeneration: 2, saveOutcome: 'idempotent-replay' })
      expect(conflict).toMatchObject({ status: 409, body: { code: 'IDEMPOTENCY_KEY_CONFLICT' } })
      expect((await storage.readPresentations()).find((item) => item.id === fixture.id).slides[0].elements[0].content).toBe('<p>After</p>')
      expect(fixture.store.getState().heads.find((head) => head.presentationId === fixture.id).generation).toBe(2)
    } finally { await fixture.cleanup() }
  })

  it('replays a package-backed save after compatibility persistence fails', async () => {
    const fixture = await createNativeRouteFixture(app)
    try {
      const writeJson = fs.writeJson.bind(fs)
      vi.spyOn(fs, 'writeJson').mockImplementation(async (file, ...args) => {
        if (String(file).includes('presentations.json')) {
          throw new Error('injected compatibility persistence failure')
        }
        return writeJson(file, ...args)
      })
      const body = {
        aggregateGeneration: 1,
        slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>After</p>' }] }],
      }
      const failed = await nativeSave(app, fixture.id, body, 'compatibility-recovery')
      expect(failed.status).toBe(500)
      expect(fixture.store.getState().heads.find((head) => head.presentationId === fixture.id))
        .toMatchObject({ generation: 2 })
      expect(fixture.store.getState().compatibilityOutbox).toEqual([
        expect.objectContaining({ presentationId: fixture.id, generation: 2, operation: 'upsert' }),
      ])

      vi.restoreAllMocks()
      await packageRuntime.shutdownPackageStore()
      await packageRuntime.initializePackageStore({ rootDir: fixture.rootDir })

      const recovered = (await storage.readPresentations()).find((item) => item.id === fixture.id)
      expect(recovered).toMatchObject({
        pptxAggregateHead: { generation: 2 },
        slides: [{ elements: [{ content: '<p>After</p>' }] }],
      })
      expect(packageRuntime.getPackageStore().getState().compatibilityOutbox).toEqual([])
    } finally { await fixture.cleanup() }
  })

  it('preserves durable-root semantics across normal PUT publication faults', async () => {
    for (const [fault, generation] of [['faultAfterPrepare', 1], ['faultAfterRoot', 2]]) {
      const fixture = await createNativeRouteFixture(app)
      try {
        const initialPackageRevisionId = fixture.store.getState().heads.find(
          (head) => head.presentationId === fixture.id
        ).packageRevisionId
        const originalMutate = fixture.store.mutate.bind(fixture.store)
        fixture.store.mutate = (mutator, options) => originalMutate(mutator, { ...options, [fault]: true })
        const body = { aggregateGeneration: 1, slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>After</p>' }] }] }
        const failed = await nativeSave(app, fixture.id, body, `fault-${fault}`)
        fixture.store.mutate = originalMutate
        expect(failed.status).toBe(500)
        expect((await storage.readPresentations()).find((item) => item.id === fixture.id).slides[0].elements[0].content).toBe('<p>Before</p>')
        expect(fixture.store.getState().heads.find((head) => head.presentationId === fixture.id).generation).toBe(generation)
        expect((await fixture.store.auditPhysicalCollection()).candidates).toHaveLength(0)
        await packageRuntime.shutdownPackageStore()
        const recovered = await packageRuntime.initializePackageStore({ rootDir: fixture.rootDir })
        expect(recovered.getState().heads.find((head) => head.presentationId === fixture.id).generation).toBe(generation)
        const retry = await nativeSave(app, fixture.id, body, `fault-${fault}`)
        const state = packageRuntime.getPackageStore().getState()
        const head = state.heads.find((item) => item.presentationId === fixture.id)
        expect(retry.body.aggregateGeneration).toBe(2)
        expect(head).toMatchObject({ generation: 2 })
        expect(head.packageRevisionId).toBe(initialPackageRevisionId)
        expect(head.packageRevisionId).toBe(head.originalRevisionId)
        expect((await storage.readPresentations()).find((item) => item.id === fixture.id).slides[0].elements[0].content).toBe('<p>After</p>')
      } finally { await fixture.cleanup() }
    }
  })

  it('normalizes built-in templates when creating a presentation from a template id', async () => {
    const createRes = await request(app)
      .post('/api/presentations')
      .send({ templateId: 'digi-lecture-overview' })

    expect(createRes.status).toBe(201)
    expect(createRes.body.slides[0].background).toMatchObject({
      type: 'color',
      color: '#0a1628',
    })

    for (const slide of createRes.body.slides) {
      for (const element of slide.elements || []) {
        expect(typeof element.id).toBe('string')
        expect(typeof element.zIndex).toBe('number')
      }
    }

    await request(app).delete(`/api/presentations/${createRes.body.id}/permanent`)
  })
})

describe('Legacy fixture compatibility (I-002)', () => {
  const app = createApp()

  beforeAll(() => {
    storage.initDataFiles()
  })

  it('accepts elements that omit x/y/w/h and persists defaults', async () => {
    const createRes = await request(app)
      .post('/api/presentations')
      .send({
        title: `Legacy fixture test ${Date.now()}`,
        slides: [
          {
            id: 'slide-legacy',
            elements: [
              // Element shape from a pre-geometry-required era.
              { id: 'el-legacy', type: 'text', content: '<p>Legacy</p>' },
            ],
          },
        ],
      })
    expect(createRes.status).toBe(201)

    // GREEN must persist defaults — not just accept the request.
    const id = createRes.body.id
    const fetched = await request(app).get(`/api/presentations/${id}`)
    expect(fetched.status).toBe(200)
    const el = fetched.body.slides[0].elements[0]
    expect(el).toMatchObject({
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    })

    // PUT path: also surfaced the original bug. Mutate one element + add a fresh
    // legacy element and ensure round-trip still applies defaults.
    const updateRes = await request(app)
      .put(`/api/presentations/${id}`)
      .send({
        title: fetched.body.title,
        slides: [
          {
            id: 'slide-legacy',
            elements: [
              el, // already-defaulted
              { id: 'el-legacy-2', type: 'text', content: '<p>Legacy 2</p>' },
            ],
          },
        ],
      })
    expect(updateRes.status).toBe(200)
    const reFetched = await request(app).get(`/api/presentations/${id}`)
    expect(reFetched.body.slides[0].elements[1]).toMatchObject({
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    })

    await request(app).delete(`/api/presentations/${id}/permanent`)
  })

  it('accepts the canonical legacy fixture from disk', async () => {
    const fixturePath = path.join(__dirname, '__fixtures__', 'legacy-deck-no-geometry.json')
    const fixture = await fs.readJson(fixturePath)
    const res = await request(app).post('/api/presentations').send(fixture)
    expect(res.status).toBe(201)

    // Persisted record should have geometry on every element.
    const id = res.body.id
    const fetched = await request(app).get(`/api/presentations/${id}`)
    for (const slide of fetched.body.slides) {
      for (const element of slide.elements) {
        expect(element).toMatchObject({
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        })
      }
    }

    await request(app).delete(`/api/presentations/${id}/permanent`)
  })
})
