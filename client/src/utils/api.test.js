import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

describe('api.importPptx', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts multipart data to the PPTX import endpoint', async () => {
    const file = new File(['pptx'], 'deck.pptx')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ presentation: { slides: [] }, stats: {}, warnings: [] }),
      }))
    )

    await api.importPptx(file)
    expect(fetch).toHaveBeenCalledWith(
      '/api/pptx/import',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
    )
  })
})
