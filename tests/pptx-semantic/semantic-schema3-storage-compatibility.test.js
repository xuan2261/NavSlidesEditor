// @vitest-environment node
// Real schema-3 HTTP/package consumers; not native-render or Electron qualification.
import { createRequire } from 'node:module'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCompatibilityFixture } from './task23-compatibility-fixture.js'
import { binary, editor, admit, publish } from '../../server/routes/portable-package-project-fixture.js'
import { assertNativeExportFailsClosed } from './task23-security-safeguards.js'
import { assertRejectedSemanticArchive } from './task23-archive-admission.js'

const require = createRequire(import.meta.url)
const { semanticInstance, semanticDefinition, replaceSemanticRecords } = require('../../shared/src/pptx-semantic-records')
const fx = createCompatibilityFixture({ schemaVersion: 3 })
beforeEach(async () => { await fx.beforeEach() })
afterEach(async () => { await fx.afterEach() })

function picture(deck, index = 0) {
  const instance = semanticInstance(deck.pptxSemantic, deck.slides[0].elements[index].pptxInstanceId)
  const definition = semanticDefinition(deck.pptxSemantic, instance.definitionId)
  return { instance, definition }
}
async function restart() {
  await fx.current.runtime.shutdownPackageStore()
  fx.current.store = await fx.current.runtime.initializePackageStore({ rootDir: fx.current.storage.DATA_DIR })
}
async function assertRendered(id) {
  const share = await editor(request(fx.current.app).post(`/api/presentations/${id}/share`)).send({ name: 'Schema3' })
  expect(share.status, JSON.stringify(share.body)).toBe(200)
  const deck = await fx.read(id)
  for (const url of [`/api/presentations/${id}/present`, `/api/presentations/${id}/present?preview=true`, `/share/${share.body.token}`]) {
    const response = await request(fx.current.app).get(url)
    expect(response.status, response.text).toBe(200)
    const match = response.text.match(/<script type="application\/json" data-navslides-semantic-payload>([\s\S]*?)<\/script>/)
    expect(match, `canonical payload missing at ${url}`).not.toBeNull()
    const payload = JSON.parse(match[1])
    expect(payload.semantic).toEqual(deck.pptxSemantic)
    expect(picture({ ...deck, pptxSemantic: payload.semantic }).instance.overrides)
      .toEqual(picture(deck).instance.overrides)
    expect(response.text).toContain('data-pptx-picture=')
    expect(response.headers['x-pptx-export-mode']).toBeUndefined()
  }
  return share.body.token
}

describe('schema3 compatibility through real consumer sinks', () => {
  it('duplicates, forks and instantiates templates with isolated edits and recoverable Original after restart', async () => {
    expect(fx.initial.pptxSemantic.schemaVersion).toBe(3)
    const token = await assertRendered(fx.initial.id)
    const duplicate = await editor(request(fx.current.app).post(`/api/presentations/${fx.initial.id}/duplicate`)).send({})
    expect(duplicate.status, JSON.stringify(duplicate.body)).toBe(201)
    const fork = await editor(request(fx.current.app).post(`/api/explore/${token}/fork`)).send({})
    expect(fork.status, JSON.stringify(fork.body)).toBe(200)
    const template = await editor(request(fx.current.app).post(`/api/presentations/${fx.initial.id}/save-as-template`)).send({ title: 'Schema3 template' })
    expect(template.status, JSON.stringify(template.body)).toBe(201)
    const created = await editor(request(fx.current.app).post('/api/presentations')).send({ templateId: template.body.id })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const ids = [duplicate.body.id, fork.body.presentation.id, created.body.id]
    expect(new Set([fx.initial.id, ...ids]).size).toBe(4)
    const expected = new Map()
    for (const id of ids) {
      const before = await fx.read(id)
      expect(before.pptxSemantic).toEqual(fx.initial.pptxSemantic)
      await fx.originalFor(id)
      const edited = fx.cropped(before)
      const saved = await fx.save(edited, `schema3-crop-${id}`)
      expect(saved.status, JSON.stringify(saved.body)).toBe(200)
      const after = await fx.read(id)
      expect(after.pptxSemantic).toEqual(edited.pptxSemantic)
      expect(picture(after).instance.overrides).not.toEqual(picture(before).instance.overrides)
      expect(picture(after, 1)).toEqual(picture(before, 1))
      expect(after.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
      expected.set(id, after.pptxSemantic)
      await assertRendered(id)
    }
    await restart()
    for (const id of ids) {
      expect((await fx.read(id)).pptxSemantic).toEqual(expected.get(id))
      await fx.originalFor(id)
    }
    expect((await fx.read()).pptxSemantic).toEqual(fx.initial.pptxSemantic)
    await fx.originalFor(fx.initial.id)
  })

  it('restores both history states and serializes an edited portable project with independent Original recovery', async () => {
    const snapshot = await editor(request(fx.current.app).post(`/api/presentations/${fx.initial.id}/snapshot`)).send({ name: 'Before' })
    expect(snapshot.status).toBe(200)
    const changed = fx.cropped(await fx.read())
    expect((await fx.save(changed, 'schema3-history-crop')).status).toBe(200)
    const editedSnapshot = await editor(request(fx.current.app).post(`/api/presentations/${fx.initial.id}/snapshot`)).send({ name: 'After' })
    expect(editedSnapshot.status).toBe(200)
    for (const [snapshotId, expected] of [[snapshot.body.id, fx.initial], [editedSnapshot.body.id, changed]]) {
      const restored = await editor(request(fx.current.app).post(`/api/presentations/${fx.initial.id}/restore/${snapshotId}`)).send({})
      expect(restored.status, JSON.stringify(restored.body)).toBe(200)
      expect((await fx.read()).pptxSemantic).toEqual(expected.pptxSemantic)
      await fx.originalFor(fx.initial.id)
    }
    const deck = await fx.read()
    const archive = await binary(editor(request(fx.current.app).get(`/api/presentations/${deck.id}/project-archive`))
      .set('If-Pptx-Generation', String(deck.aggregateGeneration)))
    expect(archive.status, archive.body.toString()).toBe(200)
    const id = await publish(fx.current.app, await admit(fx.current.app, archive.body))
    expect(id).not.toBe(deck.id)
    const imported = await fx.read(id)
    expect(imported.pptxSemantic.schemaVersion).toBe(3)
    expect(picture(imported).instance).toEqual(picture(deck).instance)
    expect(picture(imported).definition.source).toEqual(picture(deck).definition.source)
    expect(picture(imported).definition.content.pictureDocument).toEqual(picture(deck).definition.content.pictureDocument)
    await assertRendered(id)
    await assertNativeExportFailsClosed({ current: fx.current, initialId: id,
      editedGeneration: imported.aggregateGeneration, originalFor: fx.originalFor })
    await restart()
    expect((await fx.read(id)).pptxSemantic).toEqual(imported.pptxSemantic)
    await fx.originalFor(id)
    await fx.originalFor(deck.id)
  }, 30000)

  it.each(['future', 'missing-definition', 'cyclic', 'authority'])(
    'rejects a coherently hashed %s schema3 archive before publishing any owner', async failure => {
      await assertRejectedSemanticArchive({ current: fx.current, initial: fx.initial,
        read: fx.read, originalFor: fx.originalFor, failure })
    }
  )

  it.each(['future', 'missing-definition', 'cyclic-parent', 'authority', 'source-baseline', 'stale-forward', 'stale-backward', 'malformed-catalog'])(
    'rejects %s atomically with committed package and Original intact across restart', async failure => {
      expect((await fx.save(fx.cropped(await fx.read()), `advance-${failure}`)).status).toBe(200)
      const before = await fx.read()
      const state = fx.current.store.getState()
      const invalid = structuredClone(before)
      const instance = structuredClone(picture(invalid).instance)
      if (failure === 'future') invalid.pptxSemantic.schemaVersion = 99
      if (failure === 'missing-definition') instance.definitionId = 'absent'
      if (failure === 'cyclic-parent') instance.parentInstanceId = instance.id
      if (failure === 'authority') instance.overrides.adapterQualified = true
      if (['missing-definition', 'cyclic-parent', 'authority'].includes(failure)) {
        invalid.pptxSemantic = replaceSemanticRecords(invalid.pptxSemantic, { instances: { [instance.id]: instance } })
      }
      if (failure === 'source-baseline') invalid.pptxSemantic.sourceParts[0].preconditionHash = '0'.repeat(64)
      if (failure === 'stale-forward') invalid.aggregateGeneration += 99
      if (failure === 'stale-backward') invalid.aggregateGeneration -= 1
      if (failure === 'malformed-catalog') invalid.pptxSemantic.sourceLocations[0].part = invalid.pptxSemantic.sourceParts.length
      const denied = await fx.save(invalid, `reject-schema3-${failure}`)
      expect(denied.status, JSON.stringify(denied.body)).toBe(failure.startsWith('stale') ? 409 : 400)
      if (failure.startsWith('stale')) expect(denied.body.code).toBe('STALE_GENERATION')
      expect(fx.current.store.getState()).toEqual(state)
      const after = await fx.read()
      expect(after.aggregateGeneration).toBe(before.aggregateGeneration)
      expect(after.slides).toEqual(before.slides)
      expect(after.pptxSemantic).toEqual(before.pptxSemantic)
      await restart()
      expect((await fx.read()).pptxSemantic).toEqual(before.pptxSemantic)
      await fx.originalFor(before.id)
    }
  )
})
