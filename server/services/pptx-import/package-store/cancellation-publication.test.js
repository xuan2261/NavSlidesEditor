import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const nativeFs = require('node:fs/promises')
const { openPackageStore } = require('./index.js')
const { acknowledgeCompatibilityOutbox, queueCompatibilityUpsert } = require('../compatibility-outbox.js')
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
let root, store, before, rootBytes, originalBytes

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-ack-cancel-'))
  store = await openPackageStore({ rootDir: root })
  await store.acquireWriter()
  originalBytes = Buffer.from('retained original package bytes')
  await store.commitOriginal(originalBytes, { ownerType: 'presentation', ownerId: 'winner' })
  await store.mutate(next => {
    queueCompatibilityUpsert(next, { presentationId: 'winner', generation: 1,
      presentation: { id: 'winner', title: 'Current authority', slides: [] } })
  })
  before = store.getState()
  rootBytes = await fs.readFile(path.join(root, 'state-root.json'), 'utf8')
})
afterEach(async () => {
  vi.restoreAllMocks()
  await store?.releaseWriter()
  await fs.rm(root, { recursive: true, force: true })
})

async function assertAuthorityUnchanged(result) {
  expect(await fs.readFile(path.join(root, 'state-root.json'), 'utf8')).toBe(rootBytes)
  expect(store.getState()).toEqual(before)
  expect(result.error).toMatchObject({ name: 'AbortError' })
  expect(await store.readOriginal(before.heads[0].originalRevisionId)).toEqual(originalBytes)
  await store.reload()
  expect(store.getState()).toEqual(before)
}

function startAck(controller) {
  return acknowledgeCompatibilityOutbox(store, before.compatibilityOutbox, { signal: controller.signal })
    .then(value => ({ value }), error => ({ error }))
}

describe('P09-R2 actual package ACK publication barrier', () => {
  it.each(['index', 'prepare', 'root'])('retains durable outbox, head and owners after an aborted stalled %s write', async stage => {
    const entered = deferred(), release = deferred()
    const original = nativeFs.writeFile
    vi.spyOn(nativeFs, 'writeFile').mockImplementation(async (file, ...args) => {
      const result = await original(file, ...args)
      const name = String(file)
      const matches = stage === 'index' ? path.dirname(name) === path.join(root, 'indexes')
        : stage === 'prepare' ? name.endsWith('.prepared.json')
          : name.startsWith(path.join(root, 'state-root.json.')) && name.endsWith('.tmp')
      if (matches) {
        entered.resolve()
        await release.promise
      }
      return result
    })
    const controller = new AbortController()
    const pending = startAck(controller)
    await entered.promise
    controller.abort()
    release.resolve()
    await assertAuthorityUnchanged(await pending)
  })

  it('fences ACK after the awaited root candidate sync, before any native canonical rename', async () => {
    const entered = deferred(), release = deferred()
    const original = nativeFs.open
    vi.spyOn(nativeFs, 'open').mockImplementation(async (file, ...args) => {
      const handle = await original(file, ...args)
      if (String(file).startsWith(path.join(root, 'state-root.json.'))) {
        const sync = handle.sync.bind(handle)
        handle.sync = async () => {
          await sync()
          entered.resolve()
          await release.promise
        }
      }
      return handle
    })
    const controller = new AbortController()
    const pending = startAck(controller)
    await entered.promise
    controller.abort()
    release.resolve()
    await assertAuthorityUnchanged(await pending)
  })

  it('truthfully commits ACK when native canonical rename already succeeded before cancellation', async () => {
    const entered = deferred(), release = deferred()
    const original = nativeFs.rename
    vi.spyOn(nativeFs, 'rename').mockImplementation(async (source, target) => {
      const result = await original(source, target)
      if (target === path.join(root, 'state-root.json')) {
        entered.resolve()
        await release.promise
      }
      return result
    })
    const controller = new AbortController()
    const pending = startAck(controller)
    await entered.promise
    controller.abort()
    release.resolve()
    expect(await pending).toEqual({ value: 1 })
    expect(store.getState().compatibilityOutbox).toEqual([])
    expect(store.getState().heads).toEqual(before.heads)
    expect(store.getState().owners).toEqual(before.owners)
    const committed = store.getState()
    await store.reload()
    expect(store.getState()).toEqual(committed)
    expect(await store.readOriginal(before.heads[0].originalRevisionId)).toEqual(originalBytes)
  })
})
