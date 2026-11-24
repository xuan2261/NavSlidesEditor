import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdtemp, copyFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
let root, bytes
const identity = (semantic) => require('../../server/services/pptx-import/semantic-font-request')
  .semanticFontSourceIdentity(semantic)
const text = (name = 'KaTeX_Main') => ({
  schemaVersion: 1, componentId: 'body', body: {},
  paragraphs: [{ componentId: 'paragraph', properties: {}, defaultRunProperties: {
    fontLatin: { typeface: name }, fontSizePt: 18,
  }, runs: [{ componentId: 'run', kind: 'text', text: 'Actual font', properties: {} }] }],
})
function model() {
  const hash = 'a'.repeat(64)
  return {
    schemaVersion: 1,
    definitions: { d: { id: 'd', kind: 'text',
      source: { partUri: 'ppt/slides/slide1.xml', nativeId: '1', preconditionHash: hash },
      components: ['body', 'paragraph', 'run'].map((id, i) => ({
        id, kind: i === 2 ? 'run' : 'paragraph', locator: { path: [0, i], preconditionHash: hash },
      })), content: { textDocument: text() } } },
    instances: { i: { id: 'i', slideId: 's', definitionId: 'd', parentInstanceId: null,
      localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} } },
    styles: {}, fonts: {},
  }
}
async function appFor(semantic, roots = [root]) {
  const { createSemanticFontRouter } = require('../../server/routes/pptx-semantic-fonts')
  const app = express()
  app.use('/api/presentations', createSemanticFontRouter({
    roots, readPresentation: async (id) => id === 'deck'
      ? { presentation: { id, pptxSemantic: structuredClone(semantic) } } : null,
  }))
  return app
}
const url = (semantic, suffix = '') =>
  `/api/presentations/deck/semantic-fonts${suffix}?sourceIdentity=${identity(semantic)}`

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'semantic-font-delivery-'))
  vi.stubEnv('SLIDES_DATA_DIR', path.join(root, 'data'))
  vi.stubEnv('SLIDES_UPLOADS_DIR', path.join(root, 'uploads'))
  vi.stubEnv('NAVSLIDES_PPTX_FONT_ROOTS', JSON.stringify([root]))
  const original = 'server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf'
  bytes = await readFile(original)
  await copyFile(original, path.join(root, 'operator-font.ttf'))
})
afterAll(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

describe('production semantic font delivery router', () => {
  it('collects exact effective source declarations before delivery', () => {
    const { collectSemanticFontRequests } = require('../../server/services/pptx-import/semantic-font-request')
    expect(collectSemanticFontRequests(model()).faces).toEqual([
      expect.objectContaining({ typeface: 'KaTeX_Main', bold: false, italic: false }),
    ])
  })
  it('delivers source-declared real bytes and matching SHA-256 without private paths', async () => {
    const semantic = model(), app = await appFor(semantic)
    const profile = await request(app).get(url(semantic)).expect(200)
    expect(profile.body.sourceIdentity).toBe(identity(semantic))
    expect(profile.body.status).toBe('ready')
    expect(profile.headers['cache-control']).toBe('no-store')
    const face = profile.body.fontProfile.faces[0]
    expect(face).toMatchObject({ typeface: 'KaTeX_Main', bold: false, italic: false,
      assetHash: createHash('sha256').update(bytes).digest('hex') })
    expect(JSON.stringify(profile.body)).not.toContain(root)
    expect(profile.body).not.toHaveProperty('bindings')
    const asset = await request(app).get(url(semantic, `/${face.assetHash}`))
      .buffer(true).parse((res, callback) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => callback(null, Buffer.concat(chunks)))
      }).expect(200)
    expect(asset.body.equals(bytes)).toBe(true)
    expect(asset.headers['x-content-sha256']).toBe(face.assetHash)
  })

  it('rejects stale snapshots on profile and byte requests, including persisted occurrence edits', async () => {
    const semantic = model(), original = structuredClone(semantic), app = await appFor(semantic)
    const profile = await request(app).get(url(original)).expect(200)
    semantic.instances.i.overrides.components = { body: { textDocument: text('Missing Source Face') } }
    await request(app).get(url(original)).expect(409)
    await request(app).get(url(original, `/${profile.body.fontProfile.faces[0].assetHash}`)).expect(409)
    const changed = await request(app).get(url(semantic)).expect(200)
    expect(changed.body.status).toBe('unavailable')
    expect(changed.body.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ typeface: 'Missing Source Face', instanceId: 'i' }),
    ]))
  })

  it('does not accept caller roots, names, undeclared assets or incomplete identities', async () => {
    const semantic = model(), app = await appFor(semantic)
    await request(app).get(`${url(semantic)}&roots=/private`).expect(400)
    await request(app).get('/api/presentations/deck/semantic-fonts').expect(400)
    await request(app).get(url(semantic, `/${'0'.repeat(64)}`)).expect(404)
    await request(app).get(url(semantic).replace('/deck/', '/absent/')).expect(404)
  })

  it('discloses absent operator configuration and unavailable exact source fonts', async () => {
    const semantic = model(), app = await appFor(semantic, [])
    const result = await request(app).get(url(semantic)).expect(200)
    expect(result.body.status).toBe('unavailable')
    expect(result.body.issues[0]).toMatchObject({ code: 'source-font-roots-unconfigured' })
    expect(result.body.fontProfile.faces).toEqual([])
  })

  it('never publishes resolver filesystem errors', async () => {
    const semantic = model(), app = await appFor(semantic, [path.join(root, 'private-missing')])
    const result = await request(app).get(url(semantic)).expect(503)
    expect(JSON.stringify(result.body)).not.toContain(root)
    expect(result.body.code).toBe('source-font-inventory-unavailable')
  })

  it('reads the actual persisted authoritative presentation and revokes trashed access', async () => {
    const storage = require('../../server/services/storage')
    storage.initDataFiles()
    const semantic = model(), presentation = { id: 'deck', slides: [], pptxSemantic: semantic }
    await storage.writePresentations([presentation])
    const { createSemanticFontRouter } = require('../../server/routes/pptx-semantic-fonts')
    const app = express()
    app.use('/api/presentations', createSemanticFontRouter())
    const result = await request(app).get(url(semantic)).expect(200)
    expect(result.body.status).toBe('ready')
    presentation.deletedAt = new Date().toISOString()
    await storage.writePresentations([presentation])
    await request(app).get(url(semantic, `/${result.body.fontProfile.faces[0].assetHash}`)).expect(404)
  })

  it('retains the request identity across unrelated edits but changes for physical style', async () => {
    const semantic = model(), initial = identity(semantic)
    semantic.instances.i.localTransform[4] = 100
    semantic.definitions.d.content.textDocument.paragraphs[0].runs[0].properties = {
      fontSizePt: 42, color: { kind: 'srgb', value: '123456' },
    }
    expect(identity(semantic)).toBe(initial)
    semantic.definitions.d.content.textDocument.paragraphs[0].runs[0].properties.italic = true
    expect(identity(semantic)).not.toBe(initial)
  })
})
