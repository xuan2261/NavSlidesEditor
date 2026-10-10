// @vitest-environment node
import path from 'node:path'
import fs from 'fs-extra'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { roots, root, target, reset, editor, binary, sourceArchive, admit, publish, verify } from './portable-package-project-fixture'
const priorData = process.env.SLIDES_DATA_DIR, priorUploads = process.env.SLIDES_UPLOADS_DIR
let current
async function open(directory = null) {
  if (current) await current.runtime.shutdownPackageStore()
  current = await target(directory || await root())
  return current
}
afterEach(async () => {
  vi.restoreAllMocks()
  if (current) await current.runtime.shutdownPackageStore()
  current = null
  for (const directory of roots.splice(0)) await fs.remove(directory)
  if (priorData === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = priorData
  if (priorUploads === undefined) delete process.env.SLIDES_UPLOADS_DIR
  else process.env.SLIDES_UPLOADS_DIR = priorUploads
  reset()
})
async function stage(admission) {
  const response = await editor(request(current.app).post(`/api/project-imports/${admission.sessionId}/media`))
    .set('X-NavSlides-Import-Capability', admission.capability)
  expect(response.status, JSON.stringify(response.body)).toBe(200)
}
async function commit(admission) {
  return editor(request(current.app).post(`/api/project-imports/${admission.sessionId}/publish`))
    .set('X-NavSlides-Import-Capability', admission.capability).send({ trustedAuthorActiveContentAcknowledged: false })
}
async function ledger() { return fs.readJson(path.join(current.storage.DATA_DIR, 'project-import-sessions.json')) }

describe('full portable project durable HTTP consumers', () => {
  it.each([false, true])('reopens immutable Original and destination media after import (local media=%s)', async (withMedia) => {
    const fixture = await sourceArchive(withMedia)
    await open()
    const admitted = await admit(current.app, fixture.bytes)
    const id = await publish(current.app, admitted)
    await verify(current.app, id, fixture, withMedia)
    expect((await ledger())[admitted.sessionId].state).toBe('committed')
    expect(await fs.pathExists(path.join(current.storage.DATA_DIR, 'project-import-staging', admitted.sessionId, 'package'))).toBe(false)
    const directory = path.dirname(current.storage.DATA_DIR)
    await open(directory)
    await verify(current.app, id, fixture, withMedia)
  })

  it('exports B then reopens C with A and B offline and preserves Original/media hashes', async () => {
    const fixture = await sourceArchive(true)
    await open()
    const admitted = await admit(current.app, fixture.bytes), id = await publish(current.app, admitted)
    const deck = await verify(current.app, id, fixture, true)
    const archived = await binary(editor(request(current.app).get(`/api/presentations/${id}/project-archive`))
      .set('If-Pptx-Generation', String(deck.aggregateGeneration)))
    expect(archived.status, archived.body.toString()).toBe(200)
    const bRoot = path.dirname(current.storage.DATA_DIR)
    await current.runtime.shutdownPackageStore(); current = null
    await fs.remove(fixture.directory); await fs.remove(bRoot)
    await open()
    const second = await admit(current.app, archived.body), newId = await publish(current.app, second)
    expect(newId).not.toBe(id)
    await verify(current.app, newId, fixture, true)
  })

  it('recovers a durable committing package intent after reopening the data root', async () => {
    const fixture = await sourceArchive(true)
    await open()
    const admitted = await admit(current.app, fixture.bytes)
    await stage(admitted)
    const intent = await current.sessions.beginProjectImportCommit(admitted)
    const directory = path.dirname(current.storage.DATA_DIR)
    await open(directory)
    await current.sessions.recoverProjectImports()
    await verify(current.app, intent.intendedPresentationId, fixture, true)
    expect((await ledger())[admitted.sessionId].state).toBe('committed')
  })

  it('checkpoints exact package authority before root publication and recovers after that publication fails', async () => {
    const fixture = await sourceArchive(false)
    await open()
    const admitted = await admit(current.app, fixture.bytes)
    await stage(admitted)
    const publishRoot = current.store.metadata.publish.bind(current.store.metadata)
    let observed
    const fault = vi.spyOn(current.store.metadata, 'publish').mockImplementation(async (state, ...args) => {
      const candidate = state.heads.find((head) => head.presentationId !== 'source')
      if (candidate) {
        observed = (await ledger())[admitted.sessionId]
        expect(observed.packageOutcome.head).toEqual(candidate)
        expect(current.store.getState().heads.some((head) => head.presentationId === candidate.presentationId)).toBe(false)
        throw Object.assign(new Error('Fixture pre-publication interruption'), { code: 'PREPUBLICATION_INTERRUPTED' })
      }
      return publishRoot(state, ...args)
    })
    const response = await commit(admitted)
    expect(response.status).toBe(500)
    expect(response.body.code).toBe('PREPUBLICATION_INTERRUPTED')
    expect(observed.state).toBe('committing')
    const directory = path.dirname(current.storage.DATA_DIR)
    fault.mockRestore()
    await open(directory)
    await current.sessions.recoverProjectImports()
    await verify(current.app, observed.intendedPresentationId, fixture, false)
  })

  it('rejects changed staged package bytes before publishing any head or projection', async () => {
    const fixture = await sourceArchive(false)
    await open()
    const admitted = await admit(current.app, fixture.bytes)
    await stage(admitted)
    const intent = (await ledger())[admitted.sessionId]
    const manifest = path.join(intent.stagingRoot, 'package', 'manifest.json')
    await fs.ensureDir(path.dirname(manifest))
    await fs.writeJson(manifest, { tampered: true })
    const response = await commit(admitted)
    expect(response).toMatchObject({ status: 503, body: { code: 'PROJECT_IMPORT_RECOVERY_REQUIRED' } })
    expect(current.store.getState().heads).toEqual([])
    expect(await current.storage.readPresentations()).toEqual([])
  })
})
