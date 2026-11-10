import { createRequire } from 'node:module'
import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)
const resources = { schemaVersion: 1, sourceIdentity: 'a'.repeat(64),
  fontProfile: { schemaVersion: 1, faces: [] }, assets: [] }
const restores = []
function patch(module, key, value) {
  const previous = module[key]
  module[key] = value
  restores.push(() => { module[key] = previous })
}
function fresh(file) {
  delete require.cache[require.resolve(file)]
  restores.push(() => { delete require.cache[require.resolve(file)] })
  return require(file)
}
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
afterEach(() => { for (const restore of restores.splice(0).reverse()) restore(); vi.unstubAllEnvs() })
function harness(route) {
  const snapshot = { id: 'deck', title: 'Exact snapshot', slides: [] }
  const reader = require('../../server/services/package-backed-presentation-read')
  const reads = vi.fn(async () => ({ presentation: snapshot, generation: 7 }))
  patch(reader, 'readAuthoritativePresentation', reads)
  const started = deferred(), release = deferred()
  const prepare = vi.fn(async (presentation) => {
    started.resolve(presentation)
    return release.promise
  })
  patch(require('../../server/services/pptx-import/semantic-output-resources'),
    'prepareSemanticOutputResources', prepare)
  const calls = []
  const shared = require('revealjs-shared'), generator = shared.generateRevealHTML
  patch(shared, 'generateRevealHTML', (presentation, options) => {
    calls.push({ presentation, options })
    return generator(presentation, { ...options, semanticOutputResources: null })
  })
  if (route === 'presentations-extras')
    patch(require('../../server/routes/presentations-helpers'), 'readPresentablePresentation',
      async () => (await reads()).presentation)
  const app = express()
  app.use(express.json())
  app.use(fresh(`../../server/routes/${route}`))
  return { app, snapshot, reads, started, release, prepare, calls }
}

describe('server HTML resource caller contract', () => {
  it.each([['presentations-extras', '/deck/present'], ['presentations-pptx', '/deck/export']])(
    '%s awaits the exact snapshot resources before serialization', async (route, url) => {
      const h = harness(route)
      const response = request(h.app).get(url).then((value) => value)
      expect(await h.started.promise).toBe(h.snapshot)
      expect(h.calls).toHaveLength(0)
      h.release.resolve(resources)
      expect((await response).status).toBe(200)
      expect(h.calls).toHaveLength(1)
      expect(h.calls[0].options.semanticOutputResources).toBe(resources)
      expect(h.calls[0].presentation.title).toBe('Exact snapshot')
      expect(h.reads).toHaveBeenCalledTimes(1)
    })

  it.each(['presentations-extras', 'presentations-pptx'])('%s does not prepare inaccessible decks', async (route) => {
    const h = harness(route)
    // The presentable-reader seam preserves its own missing-deck contract.
    h.reads.mockResolvedValue(null)
    if (route === 'presentations-extras') {
      patch(require('../../server/routes/presentations-helpers'), 'readPresentablePresentation', async () => null)
      const app = express()
      app.use(fresh('../../server/routes/presentations-extras'))
      expect((await request(app).get('/deck/present')).status).toBe(404)
    } else expect((await request(h.app).get('/deck/export')).status).toBe(404)
    expect(h.prepare).not.toHaveBeenCalled()
  })

  it.each([['presentations-extras', '/deck/present'], ['presentations-pptx', '/deck/export']])(
    '%s fails closed on unavailable located font resources', async (route, url) => {
      const h = harness(route)
      const response = request(h.app).get(url).then((value) => value)
      await h.started.promise
      h.release.resolve(Promise.reject(Object.assign(new Error('semantic-output-font-unavailable'), {
        status: 422, code: 'semantic-output-font-unavailable',
        issues: [{ instanceId: 'i', componentId: 'run', path: 'content', code: 'font-unavailable' }],
      })))
      const result = await response
      expect(result.status).toBe(422)
      expect(result.body.issues[0].instanceId).toBe('i')
      expect(h.calls).toHaveLength(0)
    })

  it('GitHub prepares before any external API call and forwards the same snapshot', async () => {
    const config = require('../../server/services/storage')
    patch(config, 'readGithubConfig', async () => ({ token: 'private-token', owner: 'owner', repo: 'repo' }))
    const h = harness('github')
    const external = vi.fn(async () => { throw new Error('external-disabled-in-test') })
    const original = globalThis.fetch
    globalThis.fetch = external
    restores.push(() => { globalThis.fetch = original })
    const response = request(h.app).post('/push/deck').send({}).then((value) => value)
    expect(await h.started.promise).toBe(h.snapshot)
    expect(external).not.toHaveBeenCalled()
    h.release.resolve(resources)
    expect((await response).status).toBe(500)
    expect(h.calls[0].options.semanticOutputResources).toBe(resources)
    expect(h.reads).toHaveBeenCalledTimes(1)
  })

  it.each(['/sync', '/sync-single'])('sync %s prepares before DTO stripping and external sync', async (url) => {
    const snapshot = { id: 'deck', title: 'Sync snapshot', slides: [] }
    const storage = require('../../server/services/storage')
    patch(storage, 'readPresentations', async () => [snapshot])
    patch(require('../../server/services/package-backed-presentation-read'),
      'readAuthoritativePresentations', async () => [{ presentation: snapshot, generation: null }])
    patch(require('../../server/services/pptx-import/package-store-runtime'),
      'withPackageStore', async (action) => action({}))
    const started = deferred(), release = deferred()
    patch(require('../../server/services/pptx-import/semantic-output-resources'),
      'prepareSemanticOutputResources', async (presentation) => {
        started.resolve(presentation)
        return release.promise
      })
    const fs = require('fs-extra'), writes = []
    patch(fs, 'ensureDirSync', () => {})
    patch(fs, 'mkdtempSync', () => 'test-workspace')
    patch(fs, 'existsSync', () => false)
    patch(fs, 'removeSync', () => {})
    patch(fs, 'writeFileSync', (filename, bytes) => writes.push({ filename, bytes }))
    const shared = require('revealjs-shared')
    const calls = []
    patch(shared, 'generateRevealHTML', (presentation, options) => {
      calls.push({ presentation, options })
      return '<html>serialized</html>'
    })
    const router = fresh('../../server/routes/sync')
    const external = vi.fn((_file, _args, _options, callback) => callback(null, '', ''))
    router.setRcloneExecutor(external)
    restores.push(() => router.resetRcloneExecutor())
    const app = express()
    app.use(express.json(), router)
    const response = request(app).post(url).send({ remote: 'test', presentationId: 'deck' }).then((value) => value)
    expect(await started.promise).toBe(snapshot)
    expect(external).not.toHaveBeenCalled()
    expect(writes).toEqual([])
    release.resolve(resources)
    expect((await response).status).toBe(200)
    expect(calls[0].options.semanticOutputResources).toBe(resources)
    expect(calls[0].presentation.title).toBe('Sync snapshot')
    expect(external).toHaveBeenCalledTimes(1)
  })

  it('share admission precedes preparation and preserves CSS sanitization on the same snapshot', async () => {
    const tokens = { allowed: { presentationId: 'deck' }, expired: {
      presentationId: 'deck', expiresAt: '2000-01-01T00:00:00Z',
    }, protected: { presentationId: 'deck', password: 'not-a-real-hash' } }
    const storage = require('../../server/services/storage')
    patch(storage, 'readShareTokens', async () => tokens)
    patch(storage, 'withShareTokens', async (action) => action(tokens))
    patch(require('../../server/routes/analytics'), 'recordView', async () => {})
    const snapshot = { id: 'deck', title: 'Shared snapshot', slides: [],
      customCSS: '.x{background:url(javascript:alert(1))}' }
    patch(require('../../server/services/package-backed-presentation-read'),
      'readAuthoritativePresentation', async () => ({ presentation: snapshot, generation: 1 }))
    const prepare = vi.fn(async () => resources)
    patch(require('../../server/services/pptx-import/semantic-output-resources'),
      'prepareSemanticOutputResources', prepare)
    const calls = []
    patch(require('revealjs-shared'), 'generateRevealHTML', (presentation, options) => {
      calls.push({ presentation, options })
      return '<html>share</html>'
    })
    const { app } = fresh('../../server/index')
    expect((await request(app).get('/share/absent')).status).toBe(404)
    expect((await request(app).get('/share/expired')).status).toBe(403)
    expect((await request(app).get('/share/protected')).text).toContain('Password Required')
    expect(prepare).not.toHaveBeenCalled()
    expect((await request(app).get('/share/allowed')).status).toBe(200)
    expect(prepare).toHaveBeenCalledExactlyOnceWith(snapshot)
    expect(calls[0].options.semanticOutputResources).toBe(resources)
    expect(calls[0].presentation.customCSS).not.toContain('javascript:')
    expect(snapshot.customCSS).toContain('javascript:')
  })
})
