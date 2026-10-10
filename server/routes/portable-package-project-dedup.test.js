// @vitest-environment node
import path from 'node:path'
import fs from 'fs-extra'
import request from 'supertest'
import { afterEach, expect, it } from 'vitest'
import { roots, root, target, reset, editor, sourceArchive, admit, publish, verify } from './portable-package-project-fixture'

const priorData = process.env.SLIDES_DATA_DIR, priorUploads = process.env.SLIDES_UPLOADS_DIR
let current
async function open(directory = null) {
  if (current) await current.runtime.shutdownPackageStore()
  current = await target(directory || await root())
}
afterEach(async () => {
  if (current) await current.runtime.shutdownPackageStore()
  current = null
  for (const directory of roots.splice(0)) await fs.remove(directory)
  if (priorData === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = priorData
  if (priorUploads === undefined) delete process.env.SLIDES_UPLOADS_DIR
  else process.env.SLIDES_UPLOADS_DIR = priorUploads
  reset()
})

it('P10-09: identical archive twice in one store independently owns authority; permanent deletion preserves sibling HTTP consumers after restart', async () => {
  const fixture = await sourceArchive(true)
  await open()
  const first = await admit(current.app, fixture.bytes), firstId = await publish(current.app, first)
  const second = await admit(current.app, fixture.bytes), secondId = await publish(current.app, second)
  expect(firstId).not.toBe(secondId)
  const firstBody = await verify(current.app, firstId, fixture, true)
  const secondBody = await verify(current.app, secondId, fixture, true)
  expect(firstBody.slides).toEqual(secondBody.slides)
  const state = current.store.getState()
  expect(state.heads.map((head) => head.presentationId).sort()).toEqual([firstId, secondId].sort())
  for (const id of [firstId, secondId]) {
    const head = state.heads.find((item) => item.presentationId === id)
    const authority = state.mutationResults.find((item) => item.presentationId === id)
    expect(authority.projection.id).toBe(id)
    expect(authority.sourceMap).toMatchObject({ presentationId: id,
      revisionId: head.packageRevisionId, packageGeneration: head.generation })
    expect(Object.values(authority.sourceMap.entries).every((entry) =>
      entry.revisionId === head.packageRevisionId && entry.packageGeneration === head.generation)).toBe(true)
    expect(state.owners.filter((owner) => owner.ownerType === 'presentation' && owner.ownerId === id)
      .map((owner) => owner.revisionId).sort()).toEqual([...new Set([
      head.originalRevisionId, head.packageRevisionId,
    ])].sort())
  }
  expect(state.heads[0].projectionRevisionId).not.toBe(state.heads[1].projectionRevisionId)
  expect(state.heads[0].sourceMapRevisionId).not.toBe(state.heads[1].sourceMapRevisionId)
  expect(state.blobs).toHaveLength(1)
  const secondHead = state.heads.find((head) => head.presentationId === secondId)
  const secondAuthority = state.mutationResults.filter((item) => item.presentationId === secondId)
  const secondOwners = state.owners.filter((owner) => owner.ownerId === secondId)
  const deletion = await editor(request(current.app).delete(`/api/presentations/${firstId}/permanent`))
  expect(deletion.status, JSON.stringify(deletion.body)).toBe(200)
  expect((await request(current.app).get(`/api/presentations/${firstId}`)).status).toBe(404)
  const after = current.store.getState()
  expect(after.heads.find((head) => head.presentationId === secondId)).toEqual(secondHead)
  expect(after.mutationResults.filter((item) => item.presentationId === secondId)).toEqual(secondAuthority)
  expect(after.owners.filter((owner) => owner.ownerId === secondId)).toEqual(secondOwners)
  expect(after.owners.some((owner) => owner.ownerId === firstId)).toBe(false)
  expect(await verify(current.app, secondId, fixture, true)).toEqual(secondBody)
  const directory = path.dirname(current.storage.DATA_DIR)
  await open(directory)
  expect(await verify(current.app, secondId, fixture, true)).toEqual(secondBody)
  expect((await request(current.app).get(`/api/presentations/${firstId}`)).status).toBe(404)
}, 15000)
