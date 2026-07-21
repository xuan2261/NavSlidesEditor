import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

describe('PPTX import API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts multipart data to the async PPTX import endpoint', async () => {
    const file = new File(['pptx'], 'deck.pptx')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ jobId: 'job-1' }),
      }))
    )

    await api.importPptxAsync(file)
    expect(fetch).toHaveBeenCalledWith(
      '/api/pptx/import',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
    )
  })

  it('retries async PPTX import when the server reports another import is running', async () => {
    const file = new File(['pptx'], 'deck.pptx')
    const onBusyRetry = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => '60' },
          json: async () => ({ error: 'import-in-progress' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobId: 'job-2' }),
        })
    )

    await expect(
      api.importPptxAsync(file, {
        retryOnBusy: true,
        maxBusyRetries: 1,
        busyRetryDelayMs: 0,
        onBusyRetry,
      })
    ).resolves.toEqual({ jobId: 'job-2' })

    expect(onBusyRetry).toHaveBeenCalledWith(1)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('polls and cancels PPTX import jobs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ jobId: 'job-1', status: 'running' }),
      }))
    )

    await api.pollPptxJob('job-1')
    await api.cancelPptxJob('job-1')

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/pptx/jobs/job-1')
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/pptx/jobs/job-1', { method: 'DELETE' })
  })

  it('downloads original PPTX bytes as a blob and preserves 404 for hybrid fallback', async () => {
    const blob = new Blob(['pptx'])
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, blob: async () => blob })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'No original', mode: 'hybrid-export' }),
        })
    )

    await expect(api.downloadPptxOriginal('deck-1')).resolves.toBe(blob)
    await expect(api.downloadPptxOriginal('deck-1')).rejects.toMatchObject({
      message: 'No original',
      status: 404,
    })
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/presentations/deck-1/pptx-original')
  })

  it('preserves the validated edited successor generation on the returned blob', async () => {
    const blob = new Blob(['edited'])
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: { get: (name) => name === 'X-Pptx-Generation' ? '3' : null },
      blob: async () => blob,
    })))

    const result = await api.downloadValidatedEditedPptx('deck-1', 2, 'export-key')

    expect(result).toBe(blob)
    expect(result.aggregateGeneration).toBe(3)
    expect(fetch).toHaveBeenCalledWith('/api/presentations/deck-1/pptx-edited', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Idempotency-Key': 'export-key',
        'If-Pptx-Generation': '2',
      }),
    }))
  })

  it('fails closed when the validated successor generation header is missing', async () => {
    const blob = new Blob(['edited'])
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: { get: () => null },
      blob: async () => blob,
    })))

    await expect(
      api.downloadValidatedEditedPptx('deck-1', 2, 'export-key')
    ).rejects.toMatchObject({
      code: 'MISSING_PPTX_GENERATION',
    })
    expect(blob.aggregateGeneration).toBeUndefined()
  })
})
