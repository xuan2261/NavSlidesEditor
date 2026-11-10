// @vitest-environment node
// Diagnostic source-bound fixtures exercise real HTTP/storage consumers, not native fidelity.
import path from 'node:path'
import fs from 'fs-extra'
import request from 'supertest'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { binary, admit, publish, editor, sha } from '../../server/routes/portable-package-project-fixture.js'
import { createCompatibilityFixture } from './task23-compatibility-fixture.js'
import { assertSaveAuthorityRejection, assertArchivePreflightAuthorityRejection, assertPortableSourceMapAuthorityRejection } from './task23-authority-rejection.js'
import { assertPresentAndShareSerializers, assertPendingProjectionFailsClosed, assertSinkGenerationFences } from './task23-sinks-and-remap.js'
import { assertLegacyUnchangedPreservation } from './task23-legacy-preservation.js'
import { assertZipSecuritySafeguards, assertExternalMediaSafeguards, assertConverterSafeguards, assertNativeExportGenerationFence, assertNativeExportFailsClosed } from './task23-security-safeguards.js'

const require = createRequire(import.meta.url)
const fx = createCompatibilityFixture()

beforeEach(async () => { await fx.beforeEach() })
afterEach(async () => { await fx.afterEach() })

describe('semantic compatibility at supported consumer boundaries', () => {
  it('forks duplicate and template owners with independently editable schema-1 occurrences and Original recovery', async () => {
    expect(fx.initial.pptxSemantic.schemaVersion).toBe(1)
    await fx.originalFor(fx.initial.id)
    const duplicate = await request(fx.current.app).post(`/api/presentations/${fx.initial.id}/duplicate`).send({})
    expect(duplicate.status, JSON.stringify(duplicate.body)).toBe(201)
    const template = await request(fx.current.app).post(`/api/presentations/${fx.initial.id}/save-as-template`).send({ title: 'Semantic source' })
    expect(template.status, JSON.stringify(template.body)).toBe(201)
    const share = await editor(request(fx.current.app).post(`/api/presentations/${fx.initial.id}/share`)).send({ name: 'Schema1 fork source' })
    expect(share.status, JSON.stringify(share.body)).toBe(200)
    const fork = await editor(request(fx.current.app).post(`/api/explore/${share.body.token}/fork`)).send({})
    expect(fork.status, JSON.stringify(fork.body)).toBe(200)

    const { readAuthoritativePresentation } = require('../../server/services/package-backed-presentation-read')
    const authoritativeSource = (await readAuthoritativePresentation(fx.initial.id)).presentation
    const persistedTemplate = (await fx.current.storage.readTemplates()).find((item) => item.id === template.body.id)
    expect(authoritativeSource.pptxSlideSize).toBeTruthy()
    expect(persistedTemplate.pptxSlideSize).toEqual(authoritativeSource.pptxSlideSize)
    expect(persistedTemplate.slides.map((s) => s.pptxSlideSource)).toEqual(authoritativeSource.slides.map((s) => s.pptxSlideSource))

    const instantiated = await request(fx.current.app).post('/api/presentations').send({ templateId: template.body.id })
    expect(instantiated.status, JSON.stringify(instantiated.body)).toBe(201)
    const copyIds = [duplicate.body.id, instantiated.body.id, fork.body.presentation.id]
    expect(new Set([fx.initial.id, ...copyIds]).size).toBe(4)

    for (const id of copyIds) {
      const copy = await fx.read(id)
      expect(copy.pptxSemantic).toEqual(fx.initial.pptxSemantic)
      const saved = await fx.save(fx.cropped(copy), `crop-${id}`)
      expect(fx.cropped(copy).pptxSemantic).not.toEqual(copy.pptxSemantic)
      const sibling = copy.slides[0].elements[1]
      expect(fx.cropped(copy).pptxSemantic.instances[sibling.pptxInstanceId]).toEqual(copy.pptxSemantic.instances[sibling.pptxInstanceId])
      expect(saved.status, JSON.stringify(saved.body)).toBe(200)
      expect((await fx.read(id)).pptxSemantic).toEqual(fx.cropped(copy).pptxSemantic)
      await fx.originalFor(id)
    }

    expect((await fx.read()).pptxSemantic).toEqual(fx.initial.pptxSemantic)
    await fx.originalFor(fx.initial.id)
    await fx.current.runtime.shutdownPackageStore()
    fx.current.store = await fx.current.runtime.initializePackageStore({ rootDir: fx.current.storage.DATA_DIR })

    for (const id of copyIds) {
      expect((await fx.read(id)).pptxSemantic).toEqual(fx.cropped(fx.initial).pptxSemantic)
      await fx.originalFor(id)
    }
    await assertPresentAndShareSerializers({ current: fx.current, id: fx.initial.id, instanceId: fx.initial.slides[0].elements[0].pptxInstanceId })
  })

  it('restores retained history and reopens semantic payload plus immutable Original after portable import with the source offline', async () => {
    const snapshot = await request(fx.current.app).post(`/api/presentations/${fx.initial.id}/snapshot`).send({ name: 'Source' })
    expect(snapshot.status).toBe(200)
    const changed = await fx.save(fx.cropped(await fx.read()), 'history-crop-before-restore')
    expect(changed.status, JSON.stringify(changed.body)).toBe(200)

    const editedSnapshot = await request(fx.current.app).post(`/api/presentations/${fx.initial.id}/snapshot`).send({ name: 'Edited picture' })
    expect(editedSnapshot.status).toBe(200)

    const restored = await request(fx.current.app).post(`/api/presentations/${fx.initial.id}/restore/${snapshot.body.id}`).send({})
    expect(restored.status, JSON.stringify(restored.body)).toBe(200)
    expect((await fx.read()).pptxSemantic).toEqual(fx.initial.pptxSemantic)

    const replayed = await request(fx.current.app).post(`/api/presentations/${fx.initial.id}/restore/${editedSnapshot.body.id}`).send({})
    expect(replayed.status, JSON.stringify(replayed.body)).toBe(200)
    expect((await fx.read()).pptxSemantic).toEqual(fx.cropped(fx.initial).pptxSemantic)
    await fx.originalFor(fx.initial.id)

    const restoredAgain = await request(fx.current.app).post(`/api/presentations/${fx.initial.id}/restore/${snapshot.body.id}`).send({})
    expect(restoredAgain.status, JSON.stringify(restoredAgain.body)).toBe(200)
    expect((await fx.read()).pptxSemantic).toEqual(fx.initial.pptxSemantic)

    expect((await fx.save(fx.cropped(await fx.read()), 'portable-edited-overrides')).status).toBe(200)
    const deck = await fx.read()
    await assertSinkGenerationFences({ current: fx.current, id: deck.id, generation: deck.aggregateGeneration })

    const archive = await binary(editor(request(fx.current.app).get(`/api/presentations/${deck.id}/project-archive`))
      .set('If-Pptx-Generation', String(deck.aggregateGeneration)))
    expect(archive.status, archive.body.toString()).toBe(200)

    const sourceRoot = path.dirname(fx.current.storage.DATA_DIR)
    await fx.current.runtime.shutdownPackageStore()
    fx.current = null
    await fs.remove(sourceRoot)
    const { target, root } = await import('../../server/routes/portable-package-project-fixture.js')
    fx.current = await target(await root())

    const id = await publish(fx.current.app, await admit(fx.current.app, archive.body))
    expect(id).not.toBe(fx.initial.id)
    const imported = await fx.read(id)
    for (const [key, definition] of Object.entries(fx.initial.pptxSemantic.definitions)) {
      const rebound = imported.pptxSemantic.definitions[key]
      expect(rebound.source).toEqual(definition.source)
      expect(rebound.content.pictureDocument).toEqual(definition.content.pictureDocument)
      if (definition.content.media) {
        expect(rebound.content.media.sha256).toBe(definition.content.media.sha256)
        const bytes = await binary(request(fx.current.app).get(rebound.content.media.src))
        expect(bytes.status).toBe(200)
        expect(sha(bytes.body)).toBe(definition.content.media.sha256)
      }
    }
    expect(imported.pptxSemantic.instances).toEqual(deck.pptxSemantic.instances)
    expect(imported.pptxSemantic.instances).not.toEqual(fx.initial.pptxSemantic.instances)
    const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')
    const leaf = imported.slides[0].elements[0]
    const definition = imported.pptxSemantic.definitions[imported.pptxSemantic.instances[leaf.pptxInstanceId].definitionId]
    const resetCrop = applyPresentationProjectionOperation(imported, {
      type: 'picture.edit', instanceId: leaf.pptxInstanceId,
      componentId: definition.content.pictureDocument.componentId, command: { type: 'crop', edge: 'l', value: 500 },
    })
    expect((await fx.save(resetCrop, 'portable-independent-edit')).status).toBe(200)
    await fx.originalFor(id)
    await fx.current.runtime.shutdownPackageStore()
    fx.current.store = await fx.current.runtime.initializePackageStore({ rootDir: fx.current.storage.DATA_DIR })
    expect((await fx.read(id)).pptxSemantic).toEqual(resetCrop.pptxSemantic)
    await fx.originalFor(id)
  }, 30000)

  it('serves semantic pictures in present/share without granting either sink edited-export authority', async () => {
    const leaf = fx.initial.slides[0].elements[0]
    const before = await assertPresentAndShareSerializers({ current: fx.current, id: fx.initial.id, instanceId: leaf.pptxInstanceId })
    await assertNativeExportGenerationFence({ current: fx.current, initialId: fx.initial.id, read: fx.read, save: fx.save })
    const edited = await fx.save(fx.cropped(await fx.read()), 'unsupported-native-picture')
    expect(edited.status, JSON.stringify(edited.body)).toBe(200)

    const after = await assertPresentAndShareSerializers({ current: fx.current, id: fx.initial.id, instanceId: leaf.pptxInstanceId, isCropped: true })
    for (let index = 0; index < before.length; index++) {
      const pictures = (html) => html.match(/<svg[^>]*data-pptx-picture="[^"\n]*"[\s\S]*?<\/svg>/g)
      const beforePictures = pictures(before[index]), afterPictures = pictures(after[index])
      expect(beforePictures).toHaveLength(2)
      expect(afterPictures).toHaveLength(2)
      expect(afterPictures[0]).not.toBe(beforePictures[0])
      expect(afterPictures[1]).toBe(beforePictures[1])
    }
    await assertNativeExportFailsClosed({ current: fx.current, initialId: fx.initial.id, editedGeneration: edited.body.aggregateGeneration, originalFor: fx.originalFor })
    await assertPendingProjectionFailsClosed({ current: fx.current, id: fx.initial.id })
  })

  it('rejects malformed, future, cyclic, and authority-injected saves and archives without mutating committed state', async () => {
    await assertSaveAuthorityRejection({ current: fx.current, initialId: fx.initial.id, read: fx.read, save: fx.save, originalFor: fx.originalFor })
    await assertArchivePreflightAuthorityRejection({ current: fx.current, initial: fx.initial, read: fx.read, originalFor: fx.originalFor })
    await assertPortableSourceMapAuthorityRejection({ current: fx.current, initialId: fx.initial.id, read: fx.read, originalFor: fx.originalFor })
  })

  it('fences semantic history restore against stale heads and rejects corrupt retained pending journals', async () => {
    expect((await fx.save(fx.cropped(await fx.read()), 'pending-history-authority')).status).toBe(200)
    const owner = { ownerType: 'history', ownerId: `${fx.initial.id}:authority-check` }
    const retained = await fx.current.runtime.withPackageStore((store) => store.retainHead(owner, fx.initial.id))
    const { hashRecord } = require('../../server/services/pptx-import/package-store/schemas')
    const before = await fx.read()

    await expect(
      fx.current.runtime.withPackageStore((store) => store.restoreForward(fx.initial.id, owner, {
        expectedCurrentHead: { ...retained, generation: retained.generation + 1 },
      }))
    ).rejects.toMatchObject({ code: 'STALE_GENERATION' })

    const state = fx.current.store.getState()
    const pending = state.mutationResults.find((r) => r.generation === retained.generation && r.state === 'pending-edited-export')
    pending.journal.journalHash = '0'.repeat(64)
    const { assertSemanticHistoryAuthority } = require('../../server/services/pptx-import/package-store/portable')
    expect(() => assertSemanticHistoryAuthority(state, retained)).toThrow()
    expect((await fx.read()).aggregateGeneration).toBe(before.aggregateGeneration)
    expect((await fx.read()).pptxSemantic).toEqual(before.pptxSemantic)
    expect(hashRecord(fx.current.store.getState().heads.find((h) => h.presentationId === fx.initial.id))).toBe(hashRecord(retained))
    await fx.originalFor(fx.initial.id)
  })

  it('edits and reopens a legacy deck without semantic migration or fabricated Original authority', async () => {
    await assertLegacyUnchangedPreservation({ current: fx.current, initialId: fx.initial.id, read: fx.read, save: fx.save, originalFor: fx.originalFor })
  })

  it('keeps ZIP, external-media and converter safeguards active alongside semantic editing', async () => {
    await assertZipSecuritySafeguards()
    assertExternalMediaSafeguards()
    await assertConverterSafeguards()
    expect((await fx.read()).pptxSemantic).toEqual(fx.initial.pptxSemantic)
    await fx.originalFor(fx.initial.id)
  })
})
