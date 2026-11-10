import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash, webcrypto } from 'node:crypto'
const require = createRequire(import.meta.url)
const { validateSemanticOutputResources, decodeSemanticOutputResources } =
  require('../../shared/src/pptx-semantic-output-resources')
const semantic = { schemaVersion: 1, definitions: {}, instances: {}, styles: {}, fonts: {} }
const { collectSemanticFontRequests } = require('../../shared/src/pptx-source-font-request')
const empty = () => ({ schemaVersion: 1,
  sourceIdentity: createHash('sha256').update(collectSemanticFontRequests(semantic).identity).digest('hex'),
  fontProfile: { schemaVersion: 1, faces: [] }, assets: [] })
describe('bounded semantic output transport', () => {
  it('accepts genuinely empty requests and rechecks the destination identity', async () => {
    const realm = { crypto: webcrypto, TextEncoder, Uint8Array, atob }
    expect(validateSemanticOutputResources(empty()).assets).toEqual([])
    expect((await decodeSemanticOutputResources(semantic, empty(), realm)).assets).toEqual([])
    await expect(decodeSemanticOutputResources(semantic, { ...empty(), sourceIdentity: '0'.repeat(64) }, realm))
      .rejects.toThrow(/identity/)
  })
  it('rejects executable, extra and unbounded transport before decoding', () => {
    expect(() => validateSemanticOutputResources({ ...empty(), authoritative: true })).toThrow()
    const getter = empty()
    Object.defineProperty(getter, 'assets', { get() { throw new Error('getter executed') } })
    expect(() => validateSemanticOutputResources(getter)).toThrow(/plain|data|transport/i)
    expect(() => validateSemanticOutputResources({ ...empty(), assets: Array(257).fill({}) })).toThrow()
    expect(() => validateSemanticOutputResources({ ...empty(), assets: [{ faceId: 'x', bytesBase64: '!!!!' }] })).toThrow()
  })
})
