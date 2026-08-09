import { describe, expect, it, vi } from 'vitest'
import { resolveClientPptxMedia } from './export-pptx-media'

function response(mime, bytes) {
  const payload =
    bytes ||
    (mime === 'video/mp4'
      ? [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]
      : [0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])
  return {
    ok: true,
    headers: { get: () => mime },
    arrayBuffer: async () => Uint8Array.from(payload).buffer,
  }
}

describe('client PPTX media resolver', () => {
  it('loads only the validated local media and PNG poster', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response('video/mp4'))
      .mockResolvedValueOnce(response('image/png'))

    const result = await resolveClientPptxMedia(
      {
        type: 'video',
        src: '/uploads/movie.mp4',
        poster: '/uploads/poster.png',
      },
      fetchMock
    )

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/uploads/movie.mp4', {
      credentials: 'same-origin',
      redirect: 'error',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/uploads/poster.png', {
      credentials: 'same-origin',
      redirect: 'error',
    })
    expect(result).toMatchObject({
      embedded: true,
      mediaType: 'video',
      extension: 'mp4',
    })
    expect(result.data).toMatch(/^data:video\/mp4;base64,/)
    expect(result.cover).toMatch(/^data:image\/png;base64,/)
  })

  it.each([
    'https://example.test/movie.mp4',
    'file:///private/movie.mp4',
    '/uploads/%2e%2e/private/movie.mp4',
    '/uploads/movie.webm',
  ])('does not fetch external, traversal, or unsupported sources: %s', async (src) => {
    const fetchMock = vi.fn()
    const result = await resolveClientPptxMedia({ type: 'video', src }, fetchMock)
    expect(result.embedded).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a MIME-changing response from a nominally supported upload URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('audio/wav'))
    const result = await resolveClientPptxMedia(
      { type: 'video', src: '/uploads/movie.mp4' },
      fetchMock
    )
    expect(result).toMatchObject({
      embedded: false,
      reason: 'validated-upload-unavailable',
    })
  })
})
