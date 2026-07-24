import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import snapshotModule from './package-authority-snapshot.js'
import hashModule from './evidence/canonical-hash.js'

const {
  readPackageAuthoritySnapshot,
  publicPackageAuthoritySnapshot,
  samePackageAuthority,
} = snapshotModule
const { hashCanonical } = hashModule

function fakeStore(bytes, overrides = {}) {
  const head = {
    presentationId: 'deck',
    originalRevisionId: 'r0-original',
    packageRevisionId: 'r1-package',
    generation: 3,
    ...overrides.head,
  }
  const originalSha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  return {
    getState: () => ({
      heads: [head],
      revisions: [{ id: head.originalRevisionId, blobSha256: originalSha256 }],
      owners: [
        { ownerType: 'presentation', ownerId: 'deck', revisionId: head.originalRevisionId },
        { ownerType: 'presentation', ownerId: 'deck', revisionId: head.packageRevisionId },
      ],
      ...overrides.state,
    }),
    readBlob: vi.fn(async () => bytes),
  }
}

describe('package authority snapshots', () => {
  it('returns the current package head and verified immutable R0 identity', async () => {
    const bytes = Buffer.from('immutable-r0')
    const snapshot = await readPackageAuthoritySnapshot('deck', { store: fakeStore(bytes) })

    expect(snapshot).toMatchObject({
      presentationId: 'deck',
      packageRevisionId: 'r1-package',
      aggregateGeneration: 3,
      originalSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      originalByteLength: bytes.length,
    })
    expect(snapshot.packageHeadHash).toBe(hashCanonical({
      presentationId: 'deck',
      originalRevisionId: 'r0-original',
      packageRevisionId: 'r1-package',
      generation: 3,
    }))
    expect(snapshot.originalBytes).toEqual(bytes)
  })

  it('fails closed when the original owner or blob is unavailable', async () => {
    const bytes = Buffer.from('immutable-r0')
    await expect(readPackageAuthoritySnapshot('deck', {
      store: fakeStore(bytes, {
        state: { owners: [] },
      }),
    })).rejects.toMatchObject({ code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE', status: 422 })

    const store = fakeStore(bytes)
    store.readBlob.mockRejectedValueOnce(new Error('missing'))
    await expect(readPackageAuthoritySnapshot('deck', { store }))
      .rejects.toMatchObject({ code: 'IMMUTABLE_ORIGINAL_BLOB_UNAVAILABLE', status: 422 })
  })

  it('publishes only safe identity fields and compares all authority coordinates', () => {
    const snapshot = {
      presentationId: 'deck',
      packageRevisionId: 'r1-package',
      packageHeadHash: 'a'.repeat(64),
      aggregateGeneration: 3,
      originalSha256: 'b'.repeat(64),
      originalByteLength: 12,
      originalBytes: Buffer.from('hidden'),
    }
    expect(publicPackageAuthoritySnapshot(snapshot)).toEqual({
      schemaVersion: 1,
      presentationId: 'deck',
      packageAuthority: { revisionId: 'r1-package', headHash: 'a'.repeat(64) },
      aggregateGeneration: 3,
      original: { sha256: 'b'.repeat(64), byteLength: 12 },
    })
    const publicSnapshot = publicPackageAuthoritySnapshot(snapshot)
    expect(publicSnapshot).not.toHaveProperty('originalBytes')
    expect(samePackageAuthority(snapshot, { ...snapshot })).toBe(true)
    expect(samePackageAuthority(snapshot, { ...snapshot, aggregateGeneration: 4 })).toBe(false)
    expect(samePackageAuthority(snapshot, { ...snapshot, originalSha256: 'c'.repeat(64) })).toBe(false)
    expect(samePackageAuthority(snapshot, { ...snapshot, originalByteLength: 13 })).toBe(false)
    expect(samePackageAuthority(publicSnapshot, { ...publicSnapshot })).toBe(true)
    expect(samePackageAuthority(publicSnapshot, {
      ...publicSnapshot,
      original: { ...publicSnapshot.original, sha256: 'c'.repeat(64) },
    })).toBe(false)
  })
})
