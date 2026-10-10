// @vitest-environment node
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { openPackageStore } = require('./index')
let root, store
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-async-package-mutation-'))
  store = await openPackageStore({ rootDir: root })
  await store.acquireWriter()
  await store.mutate(() => {})
})
afterEach(async () => {
  await store.releaseWriter()
  await fs.rm(root, { recursive: true, force: true })
})
describe('asynchronous package publication preparation', () => {
  it('does not publish a candidate rejected after an asynchronous durable checkpoint', async () => {
    const before = await fs.readFile(path.join(root, 'state-root.json'))
    const state = store.getState()
    await store.mutate(async (next) => {
      await Promise.resolve()
      next.matrixAuthorityEpoch += 1
      return false
    })
    expect(await fs.readFile(path.join(root, 'state-root.json'))).toEqual(before)
    expect(store.getState()).toEqual(state)
  })
  it('preserves the root when checkpoint preparation aborts before publication', async () => {
    const before = await fs.readFile(path.join(root, 'state-root.json'))
    const state = store.getState()
    const controller = new AbortController()
    const reason = Object.assign(new Error('Checkpoint cancelled'), { name: 'AbortError' })
    await expect(store.mutate(async (next) => {
      await Promise.resolve()
      next.matrixAuthorityEpoch += 1
      controller.abort(reason)
    }, { signal: controller.signal })).rejects.toBe(reason)
    expect(await fs.readFile(path.join(root, 'state-root.json'))).toEqual(before)
    expect(store.getState()).toEqual(state)
  })
})
