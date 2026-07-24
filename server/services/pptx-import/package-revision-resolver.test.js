import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import resolverModule from './package-revision-resolver.js'

const {
  resolveImmutableOriginalRevisionBytes,
  resolvePackageRevisionBytes,
} = resolverModule

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

describe('package-revision-resolver', () => {
  it('keeps the current-head resolver separate from immutable-original resolution', async () => {
    const r0 = Buffer.from('immutable-r0')
    const r1 = Buffer.from('validated-r1')
    const r0Hash = sha256(r0)
    const r1Hash = sha256(r1)
    const store = {
      getState: () => ({
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
