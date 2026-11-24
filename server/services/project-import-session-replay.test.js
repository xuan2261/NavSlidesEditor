// @vitest-environment node
import path from 'node:path'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { roots, root, target, reset, editor, sourceArchive, admit, verify } from '../routes/portable-package-project-fixture'

const require = createRequire(import.meta.url)
const priorData = process.env.SLIDES_DATA_DIR, priorUploads = process.env.SLIDES_UPLOADS_DIR
let current

afterEach(async () => {
  vi.restoreAllMocks()
  try {
    if (current) await current.runtime.shutdownPackageStore()
  } finally {
    current = undefined
    for (const directory of roots.splice(0)) await fs.remove(directory)
    if (priorData === undefined) delete process.env.SLIDES_DATA_DIR
    else process.env.SLIDES_DATA_DIR = priorData
    if (priorUploads === undefined) delete process.env.SLIDES_UPLOADS_DIR
    else process.env.SLIDES_UPLOADS_DIR = priorUploads
    reset()
  }
})
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
async function committingPackage() {
  const fixture = await sourceArchive(true)
  current = await target(await root())
  const admission = await admit(current.app, fixture.bytes)
  const staged = await editor(request(current.app).post(`/api/project-imports/${admission.sessionId}/media`))
    .set('X-NavSlides-Import-Capability', admission.capability)
  expect(staged.status).toBe(200)
  const snapshot = await current.sessions.beginProjectImportCommit(admission)
  expect(snapshot.packageBundleDigest).toMatch(/^[a-f0-9]{64}$/u)
  return { fixture, admission, snapshot, recovery: require('./project-import-media-session-recovery') }
}
async function durableBytes() {
  return Promise.all(['project-import-sessions.json', 'upload-hashes.json', 'presentations.json']
    .map(filename => fs.readFile(path.join(current.storage.DATA_DIR, filename))))
}
async function assertOnePackage(receipt, fixture, admission) {
  expect(receipt).toMatchObject({ status: 'committed', sessionId: admission.sessionId,
    presentationId: expect.any(String) })
  const rows = await current.storage.readPresentations()
  expect(rows).toHaveLength(1)
  expect(rows[0].id).toBe(receipt.presentationId)
  const heads = current.store.getState().heads
  expect(heads).toHaveLength(1)
  expect(heads[0].presentationId).toBe(receipt.presentationId)
  const terminal = await current.sessions.readProjectImportSession(admission.sessionId)
  expect(terminal.state).toBe('committed')
  expect(terminal.packageBundleDigest).toBeUndefined()
  expect(terminal.packageBundlePath).toBeUndefined()
  await verify(current.app, receipt.presentationId, fixture, true)
}

describe('package-backed project session terminal replay identity', () => {
  it('replays a stale committing snapshot after legitimate package staging retirement without another publication', async () => {
    const { fixture, admission, snapshot, recovery } = await committingPackage()
    const receipt = await recovery.recoverProjectImport(snapshot)
    await assertOnePackage(receipt, fixture, admission)
    const before = await durableBytes(), packageState = current.store.getState()
    await expect(recovery.recoverProjectImport(snapshot)).resolves.toEqual(receipt)
    await expect(current.sessions.publishProjectImport(admission)).resolves.toEqual(receipt)
    expect(await durableBytes()).toEqual(before)
    expect(current.store.getState()).toEqual(packageState)
    await assertOnePackage(receipt, fixture, admission)
  })

  it('returns the same committed receipt to two overlapping exact package recovery waiters', async () => {
    const { fixture, admission, snapshot, recovery } = await committingPackage()
    const secondSnapshot = await current.sessions.beginProjectImportCommit(admission)
    const { withProjectImportSessionLock } = require('./project-import-media-session-lock')
    const entered = deferred(), resume = deferred()
    const held = withProjectImportSessionLock(admission.sessionId, async () => {
      entered.resolve()
      await resume.promise
    })
    await entered.promise
    let pending
    try {
      // Both real recovery calls queue behind the same mutex before either can commit.
      pending = Promise.allSettled([recovery.recoverProjectImport(snapshot), recovery.recoverProjectImport(secondSnapshot)])
    } finally { resume.resolve() }
    await held
    const outcomes = await pending
    expect(outcomes.map(result => result.status)).toEqual(['fulfilled', 'fulfilled'])
    expect(outcomes[1].value).toEqual(outcomes[0].value)
    await assertOnePackage(outcomes[0].value, fixture, admission)
  })

  it.each(['committing', 'committed'])('rejects foreign immutable snapshot identity while %s without touching package or media bytes', async state => {
    const { fixture, admission, snapshot, recovery } = await committingPackage()
    let receipt
    if (state === 'committed') receipt = await recovery.recoverProjectImport(snapshot)
    const before = await durableBytes(), packageState = current.store.getState()
    const variants = {
      sessionId: '00000000-0000-4000-8000-000000000001',
      archiveDigest: 'c'.repeat(64), payloadDigest: 'd'.repeat(64),
      leaseId: '00000000-0000-4000-8000-000000000002',
      intendedPresentationId: '00000000-0000-4000-8000-000000000003',
    }
    if (state === 'committing') variants.packageBundleDigest = 'e'.repeat(64)
    for (const [key, value] of Object.entries(variants)) {
      await expect(recovery.recoverProjectImport({ ...snapshot, [key]: value }))
        .rejects.toMatchObject({ code: 'PROJECT_IMPORT_RECOVERY_REQUIRED', status: 503 })
      expect(await durableBytes()).toEqual(before)
      expect(current.store.getState()).toEqual(packageState)
    }
    if (receipt) await assertOnePackage(receipt, fixture, admission)
    else {
      expect(await current.storage.readPresentations()).toEqual([])
      expect(current.store.getState().heads).toEqual([])
      for (const media of snapshot.media) expect(await fs.pathExists(media.stagingPath)).toBe(true)
      for (const placed of snapshot.placements) expect(await fs.readFile(placed.absolutePath)).toEqual(fixture.mediaBytes)
    }
  })

  it('refuses another admitted session capability on terminal public replay and retains the exact committed result', async () => {
    const { fixture, admission, snapshot, recovery } = await committingPackage()
    const receipt = await recovery.recoverProjectImport(snapshot)
    const foreign = await admit(current.app, fixture.bytes)
    const before = await durableBytes(), packageState = current.store.getState()
    const rejected = await editor(request(current.app).post(`/api/project-imports/${admission.sessionId}/publish`))
      .set('X-NavSlides-Import-Capability', foreign.capability)
      .send({ trustedAuthorActiveContentAcknowledged: false })
    expect(rejected).toMatchObject({ status: 403, body: { code: 'PROJECT_IMPORT_CAPABILITY_INVALID' } })
    expect(await durableBytes()).toEqual(before)
    expect(current.store.getState()).toEqual(packageState)
    await assertOnePackage(receipt, fixture, admission)
  })
})
