import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import snapshotModule from './package-snapshot.js'

const { extractPackageIdentity, readFencedOriginal, readPackageSnapshot, samePackageIdentity } = snapshotModule
const sha = (value) => createHash('sha256').update(value).digest('hex')

function snapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    presentationId: 'deck-1',
    packageAuthority: { revisionId: 'r0', headHash: sha('head') },
    aggregateGeneration: 1,
    original: { sha256: sha('source'), byteLength: 6 },
    ...overrides,
  }
}

describe('package authority snapshots', () => {
  it('requires a complete public package and R0 identity', () => {
    const identity = extractPackageIdentity(snapshot())
    expect(identity).toMatchObject({
      presentationId: 'deck-1', packageRevisionId: 'r0', packageHeadHash: sha('head'), aggregateGeneration: 1,
      originalSha256: sha('source'), originalByteLength: 6,
    })
    expect(() => extractPackageIdentity(snapshot({ original: { sha256: sha('source'), byteLength: 0 } })))
      .toThrow('invalid-package-snapshot')
  })

  it('treats R0 hash and length drift as package authority drift', () => {
    const identity = extractPackageIdentity(snapshot())
    expect(samePackageIdentity(identity, { ...identity, originalSha256: sha('other') })).toBe(false)
    expect(samePackageIdentity(identity, { ...identity, originalByteLength: 7 })).toBe(false)
  })

  it('downloads originals only with all snapshot fence coordinates', async () => {
    const identity = await readPackageSnapshot(async () => new Response(JSON.stringify(snapshot()), {
      headers: { 'content-type': 'application/json' },
    }), 'http://127.0.0.1:4010', 'deck-1')
    let request
    const bytes = await readFencedOriginal(async (url, init) => {
      request = { url, init }
      return new Response('source')
    }, 'http://127.0.0.1:4010', identity)

    expect(Buffer.from(bytes).toString()).toBe('source')
    expect(request.url).toBe('http://127.0.0.1:4010/api/presentations/deck-1/pptx-original')
    expect(request.init.headers).toEqual({
      'If-Pptx-Generation': '1', 'If-Pptx-Package-Revision': 'r0', 'If-Pptx-Package-Head-Hash': sha('head'),
    })
  })
})
