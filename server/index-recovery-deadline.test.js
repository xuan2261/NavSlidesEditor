// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { launchRecoveryChild } from './recovery-test-driver.js'
const entry = new URL('./recovery-test-child.cjs', import.meta.url)
const resources = []
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
async function launch(resource, mode) {
  const child = launchRecoveryChild(entry, resource.root, mode)
  resource.children.push(child)
  return child
}
async function authority(root) {
  const data = path.join(root, 'data')
  const stateRoot = await fs.readFile(path.join(data, 'state-root.json'))
  const state = JSON.parse(await fs.readFile(path.join(data, JSON.parse(stateRoot).stateFile), 'utf8'))
  return { stateRoot, state, rows: await fs.readFile(path.join(data, 'presentations.json')),
    media: await fs.readFile(path.join(data, 'upload-hashes.json')) }
}
afterEach(async () => {
  for (const resource of resources.splice(0)) {
    try { for (const child of resource.children) await child.kill() }
    finally { await fs.rm(resource.root, { recursive: true, force: true }) }
  }
})
describe('P09-R2/R3 bounded real startup compatibility recovery', () => {
  it.each(['apply', 'ack'])('retains authority after deadline during %s candidate persistence', async (boundary) => {
    const resource = { root: await fs.mkdtemp(path.join(os.tmpdir(), 'nav-startup-pptx-timeout-')), children: [] }
    resources.push(resource)
    const original = await launch(resource, 'pptx-root')
    await original.next('checkpoint')
    await original.kill()
    const receipt = JSON.parse(await fs.readFile(path.join(resource.root, 'receipt.json'), 'utf8'))
    const before = await authority(resource.root)
    expect(before.state.compatibilityOutbox).toHaveLength(1)
    const restart = await launch(resource, `restart-pptx-${boundary}-timeout`)
    await restart.next('checkpoint')
    const paused = await authority(resource.root)
    const ready = await restart.next('ready').catch(() => null)
    expect(ready, 'A stalled recovery must still expose degraded HTTP readiness before the harness deadline').not.toBeNull()
    const { url } = ready
    expect((await fetch(`${url}/health/live`)).status).toBe(200)
    expect((await fetch(`${url}/health/ready`)).status).toBe(503)
    expect((await fetch(`${url}/api/project-imports/preflight`, { method: 'POST' })).status).toBe(503)
    await new Promise((resolve, reject) => restart.child.send({ type: 'release-recovery' }, (error) => error ? reject(error) : resolve()))
    await restart.next('recovery-settled')
    const after = await authority(resource.root)
    expect(after.stateRoot).toEqual(paused.stateRoot)
    expect(after.rows).toEqual(paused.rows)
    expect(after.media).toEqual(paused.media)
    expect(after.state.compatibilityOutbox).toEqual(before.state.compatibilityOutbox)
    expect(after.state.jobs).toEqual(before.state.jobs)
    const originalBytes = await fs.readFile(path.join(resource.root, 'data', 'blobs', `${receipt.originalSha256}.blob`))
    expect(hash(originalBytes)).toBe(receipt.originalSha256)
    expect((await fetch(`${url}/health/ready`)).status).toBe(503)
    for (const [mediaUrl, expected] of [[receipt.sharedUrl, receipt.sharedSha256], [receipt.mediaUrl, receipt.mediaSha256]]) {
      const response = await fetch(`${url}${mediaUrl}`)
      expect(response.status).toBe(200)
      expect(hash(Buffer.from(await response.arrayBuffer()))).toBe(expected)
    }
  }, 45000)
})
