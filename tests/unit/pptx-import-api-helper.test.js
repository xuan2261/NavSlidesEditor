import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { expectOriginalPptxHash, getPptxFidelity } from '../e2e/helpers/pptx-import-api-helper.js'

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

function originalResponse(bytes, { headers: headerOverrides = {}, ...overrides } = {}) {
  const hash = createHash('sha256').update(bytes).digest('hex')
  return {
    ok: () => true,
    headers: () => ({
      'content-type': PPTX_MIME,
      'x-pptx-original-sha256': hash,
      ...headerOverrides,
    }),
    body: async () => bytes,
    ...overrides,
  }
}

describe('PPTX import API helper', () => {
  it('hashes immutable original bytes and verifies the server digest', async () => {
    const bytes = Buffer.from('immutable original bytes')
    const expectedHash = createHash('sha256').update(bytes).digest('hex')
    const request = {
      get: async (url) => {
        expect(url).toBe('/api/presentations/deck-1/pptx-original')
        return originalResponse(bytes)
      },
    }

    await expect(expectOriginalPptxHash(request, 'deck-1', expectedHash, PPTX_MIME)).resolves.toBe(
      expectedHash
    )
  })

  it('rejects an immutable original whose advertised digest differs from its bytes', async () => {
    const bytes = Buffer.from('immutable original bytes')
    const expectedHash = createHash('sha256').update(bytes).digest('hex')
    const request = {
      get: async () =>
        originalResponse(bytes, {
          headers: { 'x-pptx-original-sha256': 'a'.repeat(64) },
        }),
    }

    await expect(
      expectOriginalPptxHash(request, 'deck-1', expectedHash, PPTX_MIME)
    ).rejects.toThrow()
  })

  it('reads fidelity only for the requested presentation', async () => {
    const request = {
      get: async (url) => {
        expect(url).toBe('/api/presentations/deck-1/pptx-fidelity')
        return {
          ok: () => true,
          json: async () => ({ presentationId: 'deck-1', exports: {} }),
        }
      },
    }

    await expect(getPptxFidelity(request, 'deck-1')).resolves.toEqual({
      presentationId: 'deck-1',
      exports: {},
    })
  })

  it('rejects failed fidelity reads', async () => {
    const request = {
      get: async () => ({
        ok: () => false,
        json: async () => ({ presentationId: 'deck-1' }),
      }),
    }

    await expect(getPptxFidelity(request, 'deck-1')).rejects.toThrow()
  })
})
