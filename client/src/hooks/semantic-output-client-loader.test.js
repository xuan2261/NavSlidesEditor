import { webcrypto, createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { loadPptxSourceFontResources } from './use-pptx-source-font-loader'

const hash = (value) => createHash('sha256').update(value).digest('hex')
const document = { defaultView: { crypto: webcrypto } }
const bytes = new Uint8Array([0, 1, 127, 255])
const requestIdentity = '{"source":"explicit"}'
function responses({ corrupt = false, duplicate = false } = {}) {
  const face = { id: 'source-0', assetHash: hash(bytes) }
  return vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sourceIdentity: hash(requestIdentity), status: 'ready',
        fontProfile: { schemaVersion: 1, faces: duplicate ? [face, face] : [face] },
      }),
    })
    .mockImplementation(async () => new Response(corrupt ? new Uint8Array([1]) : bytes))
}

describe('transferable authoritative source-font resources', () => {
  it('returns bounded hash-verified bytes without registering aliases or mutating the profile', async () => {
    const fetch = responses()
    const result = await loadPptxSourceFontResources({ presentationId: 'deck', requestIdentity, document, fetch })
    expect(result).toEqual({
      schemaVersion: 1, sourceIdentity: hash(requestIdentity),
      fontProfile: { schemaVersion: 1, faces: [{ id: 'source-0', assetHash: hash(bytes) }] },
      assets: [{ faceId: 'source-0', bytesBase64: 'AAF//w==' }],
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][1]).toMatchObject({ credentials: 'same-origin', redirect: 'error', cache: 'no-store' })
  })
  it('rejects corruption and duplicate faces before a bundle can escape', async () => {
    await expect(loadPptxSourceFontResources({
      presentationId: 'deck', requestIdentity, document, fetch: responses({ corrupt: true }),
    })).rejects.toMatchObject({ code: 'source-font-delivery-hash-mismatch' })
    const fetch = responses({ duplicate: true })
    await expect(loadPptxSourceFontResources({
      presentationId: 'deck', requestIdentity, document, fetch,
    })).rejects.toMatchObject({ code: 'source-font-profile-invalid' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('checks cancellation after an awaited asset read/hash', async () => {
    const controller = new AbortController(), fetch = responses()
    const read = fetch.getMockImplementation()
    fetch.mockImplementation(async (...args) => {
      const response = await read(...args)
      controller.abort()
      return response
    })
    await expect(loadPptxSourceFontResources({
      presentationId: 'deck', requestIdentity, document, fetch, signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
