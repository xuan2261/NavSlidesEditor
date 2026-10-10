// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import canonicalModule from './services/pptx-import/evidence/canonical-hash.js'
import { launchRecoveryChild } from './recovery-test-driver.js'

const resources = []
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const entry = new URL('./recovery-test-child.cjs', import.meta.url)
async function createRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-startup-death-'))
  const resource = { root, children: [] }
  resources.push(resource)
  return resource
}
async function start(resource, mode) {
  const child = launchRecoveryChild(entry, resource.root, mode)
  resource.children.push(child)
  return child
}
async function crash(resource, mode) {
  const child = await start(resource, mode)
  expect((await child.next('checkpoint')).boundary).toBe(mode)
  const exit = await child.kill()
  expect(exit.code === null || exit.code !== 0).toBe(true)
  return JSON.parse(await fs.readFile(path.join(resource.root, 'receipt.json'), 'utf8'))
}
async function reopen(resource) {
  const child = await start(resource, 'restart')
  const { url } = await child.next('ready')
  return { child, url }
}
async function readJson(resource, filename) {
  return JSON.parse(await fs.readFile(path.join(resource.root, 'data', filename), 'utf8'))
}
async function bytes(url, expectedSha) {
  const response = await fetch(url)
  expect(response.status).toBe(200)
  expect(sha256(Buffer.from(await response.arrayBuffer()))).toBe(expectedSha)
}
afterEach(async () => {
  for (const resource of resources.splice(0)) {
    try { for (const child of resource.children) await child.kill() }
    finally { await fs.rm(resource.root, { recursive: true, force: true }) }
  }
})

describe('P09 real production startup after abrupt process death', () => {
  it.each(['project-committing', 'project-row', 'project-committed'])(
    'P09-06/08/15 recovers %s once before readiness and preserves winner media', async (mode) => {
      const resource = await createRoot()
      const receipt = await crash(resource, mode)
      let identity
      for (let restart = 0; restart < 2; restart += 1) {
        const { child, url } = await reopen(resource)
        const health = await fetch(`${url}/health/ready`)
        expect(health.status).toBe(200)
        const ledger = await readJson(resource, 'project-import-sessions.json')
        expect(ledger[receipt.sessionId].state).toBe('committed')
        const rows = await readJson(resource, 'presentations.json')
        expect(rows.filter((row) => row.id === receipt.presentationId)).toHaveLength(1)
        const opened = await fetch(`${url}/api/presentations/${receipt.presentationId}`)
        expect(opened.status).toBe(200)
        expect((await opened.json()).slides[0].elements[0].src).toBe(receipt.mediaUrl)
        const hashes = await readJson(resource, 'upload-hashes.json')
        expect(Object.values(hashes.global).some((record) => record.state === 'committed' &&
          record.presentationId === receipt.presentationId && `/uploads/${record.filename}` === receipt.mediaUrl)).toBe(true)
        await bytes(`${url}${receipt.sharedUrl}`, receipt.sharedSha256)
        await bytes(`${url}${receipt.mediaUrl}`, receipt.mediaSha256)
        const snapshot = JSON.stringify({ ledger, rows, hashes })
        if (identity) expect(snapshot).toBe(identity)
        identity = snapshot
        await child.kill()
      }
    }, 45000,
  )

  it.each(['project-placement', 'project-checkpoint', 'pptx-media'])(
    'P09-05/14/15 retains uncertain %s intent and blocks admission after restart', async (mode) => {
      const resource = await createRoot()
      const receipt = await crash(resource, mode)
      const { url } = await reopen(resource)
      expect((await fetch(`${url}/health/ready`)).status).toBe(503)
      await bytes(`${url}${receipt.sharedUrl}`, receipt.sharedSha256)
      await bytes(`${url}${receipt.mediaUrl}`, receipt.mediaSha256)
      const hashes = await readJson(resource, 'upload-hashes.json')
      expect(Object.values(hashes.global).some((record) => record.state === 'pending' &&
        record.placementOwner === `${mode === 'pptx-media' ? 'pptx-import' : 'project-import'}:${receipt.jobId || receipt.sessionId}`)).toBe(true)
      expect((await fetch(`${url}/api/project-imports/preflight`, { method: 'POST' })).status).toBe(503)
      expect((await readJson(resource, 'presentations.json')).filter((row) => row.id === 'retained-winner')).toHaveLength(1)
    }, 30000,
  )

  it.each(['pptx-root', 'pptx-json', 'pptx-visible'])(
    'P09-02/03/04/14 recovers %s through startup with exact HTTP Original/media', async (mode) => {
      const resource = await createRoot()
      const receipt = await crash(resource, mode)
      let identity
      for (let restart = 0; restart < 2; restart += 1) {
        const { child, url } = await reopen(resource)
        expect((await fetch(`${url}/health/ready`)).status).toBe(200)
        const root = await readJson(resource, 'state-root.json')
        const state = await readJson(resource, root.stateFile)
        const head = state.heads.find((item) => item.presentationId === receipt.presentationId)
        const job = state.jobs.find((item) => item.id === receipt.jobId)
        expect(job).toMatchObject({ status: 'completed', outcomeRevisionId: head.packageRevisionId,
          outcomeGeneration: head.generation, outcomeHeadHash: canonicalModule.hashCanonical(head) })
        expect(state.compatibilityOutbox).toHaveLength(0)
        expect((await readJson(resource, 'presentations.json')).filter((row) => row.id === receipt.presentationId)).toHaveLength(1)
        const opened = await fetch(`${url}/api/presentations/${receipt.presentationId}`)
        expect(opened.status).toBe(200)
        expect((await opened.json()).aggregateGeneration).toBe(head.generation)
        const listed = await fetch(`${url}/api/presentations`)
        expect(listed.status).toBe(200)
        expect((await listed.json()).some((row) => row.id === receipt.presentationId)).toBe(true)
        const original = await fetch(`${url}/api/presentations/${receipt.presentationId}/pptx-original`, { headers: {
          'If-Pptx-Generation': String(head.generation), 'If-Pptx-Package-Revision': head.packageRevisionId,
          'If-Pptx-Package-Head-Hash': canonicalModule.hashCanonical(head),
        } })
        expect(original.status).toBe(200)
        expect(sha256(Buffer.from(await original.arrayBuffer()))).toBe(receipt.originalSha256)
        const hashes = await readJson(resource, 'upload-hashes.json')
        expect(Object.values(hashes.global).some((record) => record.state === 'committed' &&
          record.presentationId === receipt.presentationId && `/uploads/${record.filename}` === receipt.mediaUrl)).toBe(true)
        await bytes(`${url}${receipt.sharedUrl}`, receipt.sharedSha256)
        await bytes(`${url}${receipt.mediaUrl}`, receipt.mediaSha256)
        const snapshot = JSON.stringify({ state, hashes })
        if (identity) expect(snapshot).toBe(identity)
        identity = snapshot
        await child.kill()
      }
    }, 45000,
  )

  it('P09-07/11 preserves failed rollback authority and winner bytes after real death', async () => {
    const resource = await createRoot()
    const receipt = await crash(resource, 'pptx-rollback')
    const beforeRoot = await readJson(resource, 'state-root.json')
    const before = await readJson(resource, beforeRoot.stateFile)
    expect(before.jobs.find((job) => job.id === receipt.jobId)).toMatchObject({
      status: 'completed', reconcileRequired: true, transactionState: 'reconcile-required',
    })
    const { url } = await reopen(resource)
    const afterRoot = await readJson(resource, 'state-root.json')
    const after = await readJson(resource, afterRoot.stateFile)
    const job = after.jobs.find((item) => item.id === receipt.jobId)
    const head = after.heads.find((item) => item.presentationId === receipt.presentationId)
    expect(job.outcomeHeadHash).toBe(canonicalModule.hashCanonical(head))
    expect(job.outcomeRevisionId).toBe(head.originalRevisionId)
    const health = await fetch(`${url}/health/ready`)
    expect(health.status).toBe(job.reconcileRequired ? 503 : 200)
    const original = await fs.readFile(path.join(resource.root, 'data', 'blobs', `${receipt.originalSha256}.blob`))
    expect(sha256(original)).toBe(receipt.originalSha256)
    await bytes(`${url}${receipt.sharedUrl}`, receipt.sharedSha256)
    await bytes(`${url}${receipt.mediaUrl}`, receipt.mediaSha256)
  }, 30000)

  it('P09-13 corrupt ledger survives actual startup and readiness rejects admission', async () => {
    const resource = await createRoot()
    await fs.mkdir(path.join(resource.root, 'data'), { recursive: true })
    const ledger = path.join(resource.root, 'data', 'project-import-sessions.json')
    const corrupt = '{"retained-intent":'
    await fs.writeFile(ledger, corrupt)
    const { url } = await reopen(resource)
    expect((await fetch(`${url}/health/ready`)).status).toBe(503)
    expect((await fetch(`${url}/api/project-imports/preflight`, { method: 'POST' })).status).toBe(503)
    expect(await fs.readFile(ledger, 'utf8')).toBe(corrupt)
  }, 25000)
  it('P09-15 bounded recovery timeout stays degraded and retains the durable intent', async () => {
    const resource = await createRoot()
    const receipt = await crash(resource, 'project-committing')
    const before = await readJson(resource, 'project-import-sessions.json')
    const child = await start(resource, 'restart-timeout')
    const { url } = await child.next('ready')
    expect((await fetch(`${url}/health/ready`)).status).toBe(503)
    expect((await fetch(`${url}/api/project-imports/preflight`, { method: 'POST' })).status).toBe(503)
    const after = await readJson(resource, 'project-import-sessions.json')
    expect(after[receipt.sessionId]).toEqual(before[receipt.sessionId])
    await bytes(`${url}${receipt.sharedUrl}`, receipt.sharedSha256)
    await bytes(`${url}${receipt.mediaUrl}`, receipt.mediaSha256)
  }, 35000)

  it.each(['[]', '{"foreign":{"sessionId":"different","state":"committing"}}']) (
    'P09-13 malformed ledger schema blocks all HTTP mutations and keeps read visibility: %s', async (invalid) => {
      const resource = await createRoot()
      await fs.mkdir(path.join(resource.root, 'data'), { recursive: true })
      const ledger = path.join(resource.root, 'data', 'project-import-sessions.json')
      await fs.writeFile(ledger, invalid)
      const { url } = await reopen(resource)
      const health = await fetch(`${url}/health/ready`)
      expect(health.status).toBe(503)
      expect((await health.json()).reasons).toContain('DURABLE_RECOVERY_REQUIRED')
      expect((await fetch(`${url}/api/presentations`)).status).toBe(200)
      expect((await fetch(`${url}/api/presentations`, { method: 'POST', headers: {
        'Content-Type': 'application/json',
      }, body: JSON.stringify({ title: 'Must not publish', slides: [] }) })).status).toBe(503)
      expect(await fs.readFile(ledger, 'utf8')).toBe(invalid)
      expect(await readJson(resource, 'presentations.json')).toEqual([])
    }, 25000,
  )

  it('P09-13 unreadable ledger starts live but remains degraded without replacing its intent', async () => {
    const resource = await createRoot()
    const ledger = path.join(resource.root, 'data', 'project-import-sessions.json')
    await fs.mkdir(ledger, { recursive: true })
    await fs.writeFile(path.join(ledger, 'retained-intent'), 'preserve-exactly')
    const { url } = await reopen(resource)
    expect((await fetch(`${url}/health/live`)).status).toBe(200)
    expect((await fetch(`${url}/health/ready`)).status).toBe(503)
    expect((await fetch(`${url}/api/pptx/import`, { method: 'POST' })).status).toBe(503)
    expect(await fs.readFile(path.join(ledger, 'retained-intent'), 'utf8')).toBe('preserve-exactly')
  }, 25000)
})
