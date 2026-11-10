// @vitest-environment node
// Storage lifecycle uses the real app and isolated package store, never route mocks.
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCompatibilityFixture } from './task23-compatibility-fixture.js'
import { editor } from '../../server/routes/portable-package-project-fixture.js'

const fx = createCompatibilityFixture()
beforeEach(async () => { await fx.beforeEach() })
afterEach(async () => { await fx.afterEach() })

function assertLegacy(deck, content) {
  expect(deck.slides[0].elements[0].content).toBe(content)
  for (const key of ['pptxSemantic', 'pptxSourceAvailable', 'pptxAggregateHead', 'packageRevisionId', 'aggregateGeneration']) {
    expect(deck[key], key).toBeUndefined()
  }
}
async function share(id) {
  const response = await editor(request(fx.current.app).post(`/api/presentations/${id}/share`)).send({ name: 'Legacy share' })
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  return response.body.token
}

describe('legacy storage consumer compatibility', () => {
  it('retains legacy history, fork, duplicate, template and public render behavior without promoting source authority', async () => {
    const original = '<p>Legacy source content</p>'
    const edited = '<p>Legacy independently edited</p>'
    const created = await editor(request(fx.current.app).post('/api/presentations')).send({
      title: 'Legacy consumers', slides: [{ id: 'legacy-slide', elements: [{
        id: 'legacy-text', type: 'text', x: 12, y: 18, width: 320, height: 80, content: original,
      }] }],
    })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const sourceId = created.body.id
    assertLegacy(await fx.read(sourceId), original)
    const token = await share(sourceId)
    const snapshot = await editor(request(fx.current.app).post(`/api/presentations/${sourceId}/snapshot`)).send({ name: 'Legacy baseline' })
    expect(snapshot.status).toBe(200)
    const changed = await fx.read(sourceId)
    changed.slides[0].elements[0].content = edited
    expect((await fx.save(changed, 'legacy-history-edit')).status).toBe(200)
    const restore = await editor(request(fx.current.app).post(`/api/presentations/${sourceId}/restore/${snapshot.body.id}`)).send({})
    expect(restore.status, JSON.stringify(restore.body)).toBe(200)
    assertLegacy(await fx.read(sourceId), original)
    const duplicate = await editor(request(fx.current.app).post(`/api/presentations/${sourceId}/duplicate`)).send({})
    expect(duplicate.status).toBe(201)
    const fork = await editor(request(fx.current.app).post(`/api/explore/${token}/fork`)).send({})
    expect(fork.status, JSON.stringify(fork.body)).toBe(200)
    const template = await editor(request(fx.current.app).post(`/api/presentations/${sourceId}/save-as-template`)).send({ title: 'Legacy template' })
    expect(template.status).toBe(201)
    const instance = await editor(request(fx.current.app).post('/api/presentations')).send({ templateId: template.body.id })
    expect(instance.status).toBe(201)
    const ids = [duplicate.body.id, fork.body.presentation.id, instance.body.id]
    expect(new Set([sourceId, ...ids]).size).toBe(4)
    for (const id of ids) {
      const deck = await fx.read(id)
      assertLegacy(deck, original)
      deck.slides[0].elements[0].content = edited
      expect((await fx.save(deck, `legacy-isolated-${id}`)).status).toBe(200)
    }
    await fx.current.runtime.shutdownPackageStore()
    fx.current.store = await fx.current.runtime.initializePackageStore({ rootDir: fx.current.storage.DATA_DIR })
    assertLegacy(await fx.read(sourceId), original)
    for (const id of ids) {
      assertLegacy(await fx.read(id), edited)
      const copyToken = await share(id)
      for (const url of [`/api/presentations/${id}/present`, `/api/presentations/${id}/present?preview=true`, `/share/${copyToken}`]) {
        const response = await request(fx.current.app).get(url)
        expect(response.status, response.text).toBe(200)
        expect(response.text).toContain('Legacy independently edited')
        expect(response.text).not.toContain('data-navslides-semantic-payload')
        expect(response.text).not.toContain('data-pptx-picture=')
      }
      const originalResponse = await request(fx.current.app).get(`/api/presentations/${id}/pptx-original`)
      expect(originalResponse.status).not.toBe(200)
    }
    expect((await fx.read()).pptxSemantic).toEqual(fx.initial.pptxSemantic)
    await fx.originalFor(fx.initial.id)
  })
})
