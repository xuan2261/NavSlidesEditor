// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import storeModule from './index.js'
import schemaModule from './schemas.js'
import canonicalModule from '../evidence/canonical-hash.js'
import { launchRecoveryChild } from '../../../recovery-test-driver.js'

const resources = []
afterEach(async () => {
  for (const { root, child, store } of resources.splice(0)) {
    try { await child?.kill() } finally {
      try { await store?.releaseWriter() } finally { await fs.rm(root, { recursive: true, force: true }) }
    }
  }
})

// SIGKILL / Windows TerminateProcess, not host power-loss or injected exceptions.
describe('P09 package store actual process death', () => {
  it.each(['blob', 'prepared', 'root', 'completed'])(
    'retains immutable bytes and validates root/WAL after death at %s', async (boundary) => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-package-death-'))
      const child = launchRecoveryChild(new URL('./restart-test-child.cjs', import.meta.url), root, boundary)
      const resource = { root, child }
      resources.push(resource)
      const marker = await child.next('checkpoint')
      expect(marker.boundary).toBe(boundary)
      const exit = await child.kill()
      expect(exit.code === null || exit.code !== 0).toBe(true)
      const data = path.join(root, 'data')
      const receipt = JSON.parse(await fs.readFile(path.join(root, 'receipt.json'), 'utf8'))
      const original = await fs.readFile(path.join(root, 'original.pptx'))
      const rootBefore = JSON.parse(await fs.readFile(path.join(data, 'state-root.json'), 'utf8'))
      const store = await storeModule.openPackageStore({ rootDir: data })
      resource.store = store
      await store.acquireWriter()
      const published = ['root', 'completed'].includes(boundary)
      const state = store.getState()
      expect(state.generation).toBe(receipt.priorGeneration + Number(published))
      expect(state.heads).toHaveLength(Number(published))
      expect(state.compatibilityOutbox).toHaveLength(Number(published))
      const blob = await store.readBlob(receipt.sha256)
      expect(blob.equals(original)).toBe(true)
      if (published) {
        const head = state.heads[0]
        expect(head).toMatchObject({ presentationId: receipt.presentationId, generation: 1,
          packageRevisionId: receipt.revisionId, originalRevisionId: receipt.revisionId })
        expect(store.getJob(receipt.jobId)).toMatchObject({ status: 'completed',
          outcomeRevisionId: receipt.revisionId, outcomeGeneration: 1,
          outcomeHeadHash: canonicalModule.hashCanonical(head) })
        expect((await store.readOriginal(receipt.revisionId)).equals(original)).toBe(true)
        expect(await fs.readFile(path.join(data, 'wal', `${rootBefore.transactionId}.completed`), 'utf8')).toBe('completed')
      } else {
        expect(store.getJob(receipt.jobId)).toBeNull()
        expect(await store.auditPhysicalCollection()).toMatchObject({ mode: 'audit-only',
          physicalDeletionEnabled: false, candidates: [receipt.sha256] })
        if (boundary === 'prepared') {
          expect(await fs.readdir(path.join(data, 'quarantine'))).toHaveLength(1)
          expect(store.recoveryActions).toContain('quarantined-unpublished-prepared-wal')
        }
      }
      const rootAfter = JSON.parse(await fs.readFile(path.join(data, 'state-root.json'), 'utf8'))
      expect(rootAfter.stateHash).toBe(schemaModule.hashRecord(state))
      const identity = schemaModule.hashRecord(state)
      await store.releaseWriter()
      resource.store = await storeModule.openPackageStore({ rootDir: data })
      await resource.store.acquireWriter()
      expect(schemaModule.hashRecord(resource.store.getState())).toBe(identity)
      expect((await resource.store.readBlob(receipt.sha256)).equals(original)).toBe(true)
      const currentEpoch = resource.store.fencingEpoch
      resource.store.fencingEpoch = rootBefore.fencingEpoch
      await expect(resource.store.mutate(() => {})).rejects.toThrow(/fencing/i)
      resource.store.fencingEpoch = currentEpoch
      expect(schemaModule.hashRecord(resource.store.getState())).toBe(identity)
    }, 25000,
  )
  it.each(['ENOSPC', 'EACCES'])('P09-12 keeps the previous authority on %s before root rename', async (code) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-package-io-'))
    const store = await storeModule.openPackageStore({ rootDir: root })
    resources.push({ root, store })
    await store.acquireWriter()
    const retained = await store.commitOriginal(Buffer.from('retained Original'), {
      ownerType: 'presentation', ownerId: 'retained-winner',
    })
    const originalRoot = await fs.readFile(path.join(root, 'state-root.json'), 'utf8')
    const identity = schemaModule.hashRecord(store.getState())
    const rename = fs.rename.bind(fs)
    const denied = vi.spyOn(fs, 'rename').mockImplementation((from, to) => {
      if (to === path.join(root, 'state-root.json')) return Promise.reject(Object.assign(new Error('Injected storage failure'), { code }))
      return rename(from, to)
    })
    try {
      await expect(store.commitOriginal(Buffer.from('unpublished Original'), {
        ownerType: 'presentation', ownerId: 'loser',
      })).rejects.toMatchObject({ code })
    } finally { denied.mockRestore() }
    expect(await fs.readFile(path.join(root, 'state-root.json'), 'utf8')).toBe(originalRoot)
    expect(schemaModule.hashRecord(store.getState())).toBe(identity)
    expect((await store.readOriginal(retained.revision.id)).toString()).toBe('retained Original')
    expect(await store.ownsWriter()).toBe(true)
  })
  it.each([false, true])('P09-09 validates every retained root; all corrupt = %s', async (allCorrupt) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-package-corrupt-'))
    const store = await storeModule.openPackageStore({ rootDir: root })
    const resource = { root, store }
    resources.push(resource)
    await store.acquireWriter()
    const retained = await store.commitOriginal(Buffer.from('verified predecessor Original'), {
      ownerType: 'presentation', ownerId: 'retained-winner',
    })
    const expected = store.getState()
    await store.mutate(() => {})
    await store.mutate(() => {})
    const rootBytes = await fs.readFile(path.join(root, 'state-root.json'), 'utf8')
    const newest = JSON.parse(rootBytes)
    await store.releaseWriter()
    for (let candidate = newest; candidate; candidate = candidate.predecessor) {
      if (!allCorrupt && candidate.storeGeneration === expected.generation) break
      await fs.writeFile(path.join(root, candidate.stateFile), 'corrupt-index')
    }
    if (allCorrupt) {
      await expect(storeModule.openPackageStore({ rootDir: root })).rejects.toThrow()
      expect(await fs.readFile(path.join(root, 'state-root.json'), 'utf8')).toBe(rootBytes)
      expect((await store.readOriginal(retained.revision.id)).toString()).toBe('verified predecessor Original')
    } else {
      resource.store = await storeModule.openPackageStore({ rootDir: root })
      expect(resource.store.getState()).toEqual(expected)
      await resource.store.acquireWriter()
      expect(resource.store.getState().heads).toEqual(expected.heads)
      expect((await resource.store.readOriginal(retained.revision.id)).toString()).toBe('verified predecessor Original')
    }
  })
})
