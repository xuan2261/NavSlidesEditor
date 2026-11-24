// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { openPackageStore } = require('./index')
let root, store
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'destination-proof-'))
  store = await openPackageStore({ rootDir: root })
  await store.acquireWriter()
  await store.commitOriginal(Buffer.from('source'), { ownerType: 'presentation', ownerId: 'source' })
  await store.retainHead({ ownerType: 'template', ownerId: 'template' }, 'source')
  // Exercise predecessor truncation, not just an almost-empty root chain.
  for (let i = 0; i < 5; i++) await store.mutate(() => {})
})
afterEach(async () => {
  await store?.releaseWriter()
  if (root) await fs.rm(root, { recursive: true, force: true })
})

async function create(kind, options) {
  return kind === 'duplicate'
    ? store.duplicatePresentationOwner('source', 'destination', options)
    : store.instantiateRetainedHead({ ownerType: 'template', ownerId: 'template' }, 'destination', options)
}

describe('destination creation durable compensation proof', () => {
  for (const kind of ['duplicate', 'template']) {
    it.each(['faultAfterRoot', 'faultAfterCompletion'])(`${kind} proves its exact published outcome after %s`, async fault => {
      const before = store.getState()
      const error = await create(kind, { [fault]: true }).catch(error => error)
      expect(error.createdPackageHead).toEqual(store.getPresentationHead('destination'))
      await store.quarantinePresentation('destination', { expectedHead: error.createdPackageHead })
      expect(store.getState().heads).toEqual(before.heads)
      expect(store.getState().owners).toEqual(before.owners)
      await store.reload()
      expect(store.getPresentationHead('destination')).toBeNull()
    })

    it.each(['faultAfterIndex', 'faultAfterPrepare'])(`${kind} gives no cleanup authority before root: %s`, async fault => {
      const before = store.getState()
      const error = await create(kind, { [fault]: true }).catch(error => error)
      expect(error.createdPackageHead).toBeUndefined()
      expect(store.getState()).toEqual(before)
    })

    it(`${kind} does not claim an identical-head concurrent successor transaction`, async () => {
      const mutate = store.mutate.bind(store)
      store.mutate = async (...args) => {
        try { return await mutate(...args) }
        catch (error) {
          await mutate(() => {})
          throw error
        }
      }
      const error = await create(kind, { faultAfterRoot: true }).catch(error => error)
      expect(error.createdPackageHead).toBeUndefined()
      expect(store.getPresentationHead('destination')).not.toBeNull()
    })

    it(`${kind} keeps compensation conditional on the exact destination head`, async () => {
      const error = await create(kind, { faultAfterRoot: true }).catch(error => error)
      expect(error.createdPackageHead).toBeDefined()
      await store.mutate(next => { next.heads.find(head => head.presentationId === 'destination').generation++ })
      const successor = store.getState()
      await expect(store.quarantinePresentation('destination', { expectedHead: error.createdPackageHead }))
        .rejects.toMatchObject({ code: 'STALE_GENERATION' })
      expect(store.getState()).toEqual(successor)
    })
  }
})
