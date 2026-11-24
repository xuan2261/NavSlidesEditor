// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { it, expect } from 'vitest'
import { launchRecoveryChild } from './recovery-test-driver.js'
import proof from './recovery-preroot-proof.cjs'

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
it('P09-01 actual startup retains audit-only Original without pre-root HTTP exposure across restarts and backup', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-startup-preroot-'))
  const children = []
  let backup
  const launch = (fixture, mode) => {
    const child = launchRecoveryChild(new URL('./recovery-test-child.cjs', import.meta.url), fixture, mode)
    children.push(child)
    return child
  }
  try {
    const crashing = launch(root, 'pptx-blob')
    expect((await crashing.next('checkpoint')).boundary).toBe('pptx-blob')
    const exit = await crashing.kill()
    expect(exit.code === null || exit.code !== 0).toBe(true)
    const intent = JSON.parse(await fs.readFile(path.join(root, 'receipt.json'), 'utf8'))
    expect(intent.fence).toBe('prepareImport-returned-after-immutable-blob-commit-before-publishImport')
    let identity
    for (let restart = 0; restart < 3; restart += 1) {
      if (restart === 2) {
        backup = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-startup-preroot-backup-'))
        await fs.cp(root, backup, { recursive: true })
      }
      const fixture = backup || root
      const child = launch(fixture, 'restart')
      const { url } = await child.next('ready')
      const request = async (target, options) => {
        const response = await fetch(url + target, { ...options, signal: AbortSignal.timeout(10000) })
        const bytes = Buffer.from(await response.arrayBuffer())
        return { status: response.status, bytes, json: () => JSON.parse(bytes.toString('utf8')) }
      }
      const sample = {}
      await proof.assertRestart({ root: fixture, url, intent, request, sample })
      const winner = await request(intent.sharedUrl)
      expect(winner.status).toBe(200)
      expect(sha(winner.bytes)).toBe(intent.sharedSha256)
      const diskWinner = await fs.readFile(path.join(fixture, 'uploads', path.basename(intent.sharedUrl)))
      expect(sha(diskWinner)).toBe(intent.sharedSha256)
      const media = await request('/api/media')
      expect(media.status).toBe(200)
      expect(media.json().some((entry) => entry.url === intent.sharedUrl)).toBe(true)
      const snapshot = JSON.stringify(sample)
      if (identity) expect(snapshot).toBe(identity)
      identity = snapshot
      await child.kill()
    }
  } finally {
    try { for (const child of children) await child.kill() }
    finally {
      await fs.rm(root, { recursive: true, force: true })
      if (backup) await fs.rm(backup, { recursive: true, force: true })
    }
  }
}, 60000)
