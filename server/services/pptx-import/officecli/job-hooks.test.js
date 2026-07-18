import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import storeModule from '../package-store/index.js'
import hooksModule from './job-hooks.js'
import securityModule from './security.js'

const { openPackageStore } = storeModule
const { createPackageStoreJobHooks } = hooksModule
const { verifyJobCapability } = securityModule
const roots = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('durable OfficeCLI job hooks', () => {
  it('stores only the capability digest and persists terminal state', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-job-'))
    roots.push(rootDir)
    const store = await openPackageStore({ rootDir })
    await store.acquireWriter()
    const hooks = createPackageStoreJobHooks(store)
    const privateJob = await hooks.create()
    const stored = store.getJob(privateJob.id)

    expect(stored).not.toHaveProperty('capability')
    expect(verifyJobCapability(privateJob.capability, stored.capabilityHash)).toBe(true)
    await hooks.update(privateJob, 'completed')
    expect(store.getJob(privateJob.id).status).toBe('completed')
  })
})
