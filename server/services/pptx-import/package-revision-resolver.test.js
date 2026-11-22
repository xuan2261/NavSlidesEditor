import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import resolverModule from './package-revision-resolver.js'
import storeModule from './package-store/index.js'
import authority from './package-authority-snapshot.js'
import canonicalHash from './evidence/canonical-hash.js'

const {
  resolveImmutableOriginalRevisionBytes,
  resolvePackageRevisionBytes,
} = resolverModule

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function ownedFixture() {
  const store = new storeModule.PackageStore('unused')
  const bytes = { r0: Buffer.from('immutable-r0'), r1: Buffer.from('validated-r1') }
  store.metadata.state.heads.push({
    presentationId: 'deck', originalRevisionId: 'r0', packageRevisionId: 'r1', generation: 2,
  })
  for (const [id, value] of Object.entries(bytes)) {
    store.metadata.state.revisions.push({ id, blobSha256: sha256(value) })
    store.metadata.state.owners.push({ ownerType: 'presentation', ownerId: 'deck', revisionId: id })
  }
  store.getState = () => { throw new Error('Resolver must not clone full public history') }
  store.readBlob = async (hash) => {
    const id = Object.keys(bytes).find((key) => sha256(bytes[key]) === hash)
    if (!id) throw new Error('Missing blob')
    return Buffer.from(bytes[id])
  }
  return { store, bytes }
}

const resolveCurrent = (store) => resolvePackageRevisionBytes({ presentationId: 'deck', revisionId: 'r1' }, { store })
const resolveOriginal = (store, options = {}) => resolveImmutableOriginalRevisionBytes({ presentationId: 'deck' }, { store, ...options })

describe('package-revision-resolver owned authority', () => {
  it('verifies both byte revisions through the exact captured owned read snapshot', async () => {
    const { store } = ownedFixture()
    const owned = store.getOwnedAuthorityState()
    const read = authority.createEditorPackageRead(store)
    expect(read.state).toBe(owned)
    expect(Object.isFrozen(read.state.revisions[0])).toBe(true)
    const before = structuredClone(owned)
    // A later publication must not retarget this operation's revision metadata.
    store.metadata.state.heads[0].packageRevisionId = 'later'
    await read.verifyBytes(owned.heads[0])
    expect(read.state).toEqual(before)
    store.readBlob = async () => Buffer.from('corrupt')
    await expect(read.verifyBytes(owned.heads[0])).rejects.toMatchObject({
      code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
    })
  })
  it('resolves exact bytes without public history clones and returns editable detached results', async () => {
    const { store, bytes } = ownedFixture()
    const before = structuredClone(store.getOwnedAuthorityState())
    const current = await resolveCurrent(store)
    const original = await resolveOriginal(store)
    expect(current).toEqual({ bytes: bytes.r1, sha256: sha256(bytes.r1), revisionId: 'r1' })
    expect(original).toEqual({ bytes: bytes.r0, sha256: sha256(bytes.r0), revisionId: 'r0' })
    current.bytes.fill(0)
    current.sha256 = 'forged'
    current.revisionId = 'forged'
    original.bytes.fill(0)
    expect(store.getOwnedAuthorityState()).toEqual(before)
    expect(await resolveCurrent(store)).toEqual({ bytes: bytes.r1, sha256: sha256(bytes.r1), revisionId: 'r1' })
    expect((await resolveOriginal(store)).bytes).toEqual(bytes.r0)
    // Byte integrity is re-read even while the exact authority is unchanged.
    store.readBlob = async () => Buffer.from('corrupt')
    await expect(resolveCurrent(store)).rejects.toMatchObject({ code: 'PACKAGE_BLOB_CORRUPT' })
    await expect(resolveOriginal(store)).rejects.toMatchObject({ code: 'IMMUTABLE_ORIGINAL_CORRUPT' })
  })

  it.each(['r0', 'r1'])('rejects changed exact %s ownership and revision metadata after a successful read', async (id) => {
    const { store } = ownedFixture()
    const resolve = id === 'r0' ? resolveOriginal : resolveCurrent
    await resolve(store)
    const owner = store.metadata.state.owners.find((item) => item.revisionId === id)
    owner.ownerId = 'another-deck'
    await expect(resolve(store)).rejects.toMatchObject({
      code: id === 'r0' ? 'IMMUTABLE_ORIGINAL_UNAVAILABLE' : 'PACKAGE_HEAD_UNAVAILABLE',
    })
    owner.ownerId = 'deck'
    const revision = store.metadata.state.revisions.find((item) => item.id === id)
    revision.blobSha256 = '0'.repeat(64)
    await expect(resolve(store)).rejects.toMatchObject({
      code: id === 'r0' ? 'IMMUTABLE_ORIGINAL_BLOB_UNAVAILABLE' : 'PACKAGE_BLOB_UNAVAILABLE',
    })
    revision.id = 'different-revision'
    await expect(resolve(store)).rejects.toMatchObject({
      code: id === 'r0' ? 'IMMUTABLE_ORIGINAL_REVISION_UNAVAILABLE' : 'PACKAGE_REVISION_UNAVAILABLE',
    })
  })

  it('checks the entire head hash, expected revision and generation against changed authority', async () => {
    const { store } = ownedFixture()
    const head = store.getOwnedAuthorityState().heads[0]
    const options = {
      expectedGeneration: head.generation,
      expectedPackageRevisionId: head.packageRevisionId,
      expectedPackageHeadHash: canonicalHash.hashCanonical(head),
    }
    await resolveOriginal(store, options)
    store.metadata.state.heads[0].generation++
    await expect(resolveOriginal(store, options)).rejects.toMatchObject({ code: 'STALE_GENERATION' })
    await expect(resolveOriginal(store, { expectedPackageRevisionId: 'other' })).rejects.toMatchObject({ code: 'STALE_PACKAGE_AUTHORITY' })
    await expect(resolveOriginal(store, { expectedPackageHeadHash: options.expectedPackageHeadHash })).rejects.toMatchObject({ code: 'STALE_PACKAGE_AUTHORITY' })
  })
})

describe('package-revision-resolver', () => {
  it('keeps the current-head resolver separate from immutable-original resolution', async () => {
    const r0 = Buffer.from('immutable-r0')
    const r1 = Buffer.from('validated-r1')
    const r0Hash = sha256(r0)
    const r1Hash = sha256(r1)
    const store = {
      getOwnedAuthorityState: () => ({
        heads: [{
          presentationId: 'deck',
          originalRevisionId: 'r0',
          packageRevisionId: 'r1',
          generation: 2,
        }],
        revisions: [
          { id: 'r0', blobSha256: r0Hash },
          { id: 'r1', blobSha256: r1Hash },
        ],
        owners: [
          { ownerType: 'presentation', ownerId: 'deck', revisionId: 'r0' },
          { ownerType: 'presentation', ownerId: 'deck', revisionId: 'r1' },
        ],
      }),
      readBlob: async (hash) => (hash === r0Hash ? r0 : r1),
    }

    await expect(resolvePackageRevisionBytes({
      presentationId: 'deck',
      revisionId: 'r0',
    }, { store })).rejects.toMatchObject({ code: 'PACKAGE_HEAD_UNAVAILABLE' })

    await expect(resolvePackageRevisionBytes({
      presentationId: 'deck',
      revisionId: 'r1',
    }, { store })).resolves.toMatchObject({ revisionId: 'r1', bytes: r1 })

    await expect(resolveImmutableOriginalRevisionBytes({
      presentationId: 'deck',
    }, { store })).resolves.toMatchObject({ revisionId: 'r0', bytes: r0, sha256: r0Hash })

    await expect(resolveImmutableOriginalRevisionBytes({
      presentationId: 'deck',
    }, {
      store,
      expectedGeneration: 1,
    })).rejects.toMatchObject({ code: 'STALE_GENERATION', status: 409 })
  })
})
