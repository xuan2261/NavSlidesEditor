import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import authority from './package-authority-snapshot.js'

function fixture() {
  const bytes = { original: Buffer.from('immutable-original'), current: Buffer.from('current') }
  const head = {
    presentationId: 'deck',
    originalRevisionId: 'original',
    packageRevisionId: 'current',
    generation: 2,
  }
  const state = {
    heads: [head],
    revisions: Object.entries(bytes).map(([id, value]) => ({
      id,
      blobSha256: crypto.createHash('sha256').update(value).digest('hex'),
    })),
    owners: ['original', 'current'].map((revisionId) => ({
      ownerType: 'presentation',
      ownerId: 'deck',
      revisionId,
    })),
    mutationResults: [{ presentationId: 'unrelated', projection: { slides: [] } }],
  }
  const root = Object.freeze({})
  const store = {
    getState: vi.fn(() => { throw Error('Byte reads must not clone public history') }),
    getOwnedAuthorityState: vi.fn(() =>
      authority.acquireOwnedAuthorityState(store, state, root)
    ),
    readBlob: vi.fn(async (hash) => {
      const revision = state.revisions.find((item) => item.blobSha256 === hash)
      if (!revision) throw Error('Missing blob')
      return bytes[revision.id]
    }),
  }
  return { bytes, head, state, store }
}

describe('operation-scoped package byte verification', () => {
  it('takes one owned immutable snapshot for both revision lookups and byte checks', async () => {
    const { head, state, store } = fixture()
    const before = structuredClone(state)
    await authority.verifyEditorPackageBytes(store, head)
    expect(store.getOwnedAuthorityState).toHaveBeenCalledTimes(1)
    expect(store.getState).not.toHaveBeenCalled()
    expect(store.readBlob).toHaveBeenCalledTimes(2)
    expect(state).toEqual(before)
  })

  it('shares the captured read snapshot without accepting caller-supplied authority', async () => {
    const { head, state, store } = fixture()
    const read = authority.createEditorPackageRead(store)
    expect(read.state).toEqual(state)
    expect(read.state).not.toBe(state)
    expect(read.state).toBe(store.getOwnedAuthorityState.mock.results[0].value)
    expect(() => { read.state.heads[0].packageRevisionId = 'forged' }).toThrow()
    expect(() => { read.state.owners[0].ownerId = 'forged' }).toThrow()
    expect(() => { read.state.revisions[0].blobSha256 = 'forged' }).toThrow()
    const capturedHead = structuredClone(head)
    // A later publication must not mix new pointers into an already captured read.
    state.heads[0].packageRevisionId = 'later'
    await read.verifyBytes(capturedHead)
    expect(store.getOwnedAuthorityState).toHaveBeenCalledTimes(1)
    expect(store.getState).not.toHaveBeenCalled()
    expect(read.state.heads[0].packageRevisionId).toBe('current')
    const next = authority.createEditorPackageRead(store)
    await expect(next.verifyBytes(read.state.heads[0])).rejects.toMatchObject({
      code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      status: 422,
    })
    expect(store.getOwnedAuthorityState).toHaveBeenCalledTimes(2)
    expect(store.getState).not.toHaveBeenCalled()
  })

  it.each(['original', 'current'])(
    'still rejects corrupt %s bytes from the snapshot',
    async (id) => {
      const { head, state, store } = fixture()
      const readBlob = store.readBlob.getMockImplementation()
      const hash = state.revisions.find((revision) => revision.id === id).blobSha256
      store.readBlob.mockImplementation((requested) =>
        requested === hash ? Buffer.from('corrupt') : readBlob(requested)
      )
      const read = authority.createEditorPackageRead(store)
      await expect(read.verifyBytes(head)).rejects.toMatchObject({
        code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
        status: 422,
      })
    }
  )

  it.each(['owner', 'revision', 'blob'])(
    'fails closed for unavailable original %s',
    async (kind) => {
      const { head, state, store } = fixture()
      if (kind === 'owner')
        state.owners = state.owners.filter((owner) => owner.revisionId !== 'original')
      if (kind === 'revision')
        state.revisions = state.revisions.filter((revision) => revision.id !== 'original')
      if (kind === 'blob') store.readBlob.mockRejectedValue(Error('Blob missing'))
      await expect(
        authority.createEditorPackageRead(store).verifyBytes(head)
      ).rejects.toMatchObject({
        code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
        status: 422,
      })
    }
  )

  it('keeps incomplete-authority recovery limited to the verified immutable original', async () => {
    const { head, state, store } = fixture()
    state.owners = state.owners.filter((owner) => owner.revisionId === 'original')
    await authority.createEditorPackageRead(store).verifyBytes(head)
    expect(store.readBlob).toHaveBeenCalledTimes(1)
    expect(store.getOwnedAuthorityState).toHaveBeenCalledTimes(1)
    expect(store.getState).not.toHaveBeenCalled()
  })
})
