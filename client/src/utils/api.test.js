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
})
