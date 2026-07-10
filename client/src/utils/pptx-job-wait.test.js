import { describe, expect, it, vi } from 'vitest'
import { pollPptxJobUntilTerminal, waitForPptxJob } from './pptx-job-wait'

describe('PPTX job waiting', () => {
  it('falls back from SSE to polling while preserving progress and job identity', async () => {
    class FakeEventSource {
      constructor(url) {
        this.url = url
        queueMicrotask(() => this.onerror())
      }
      addEventListener() {}
      close = vi.fn()
    }
    const onProgress = vi.fn()
    const api = {
      pollPptxJob: vi.fn().mockResolvedValue({
        jobId: 'job-1',
        status: 'done',
        message: 'Finished',
        result: { presentationId: 'deck-1' },
      }),
      cancelPptxJob: vi.fn(),
    }

    await expect(
      waitForPptxJob({
        jobId: 'job-1',
        api,
        EventSourceImpl: FakeEventSource,
        onProgress,
        pollIntervalMs: 0,
      })
    ).resolves.toEqual({ presentationId: 'deck-1' })

    expect(onProgress).toHaveBeenCalledWith('Finished')
    expect(api.pollPptxJob).toHaveBeenCalledWith('job-1')
  })

  it('cancels at the polling deadline then reconciles a final-poll success race', async () => {
    const api = {
      pollPptxJob: vi
        .fn()
        .mockResolvedValueOnce({ jobId: 'job-7', status: 'running' })
        .mockResolvedValueOnce({
          jobId: 'job-7',
          status: 'done',
          result: { presentationId: 'deck-7' },
        }),
      cancelPptxJob: vi.fn().mockResolvedValue({ jobId: 'job-7', status: 'cancelling' }),
    }

    await expect(
      pollPptxJobUntilTerminal({
        jobId: 'job-7',
        api,
        maxPollAttempts: 1,
        pollIntervalMs: 0,
      })
    ).resolves.toEqual({ presentationId: 'deck-7' })
    expect(api.cancelPptxJob).toHaveBeenCalledWith('job-7')
    expect(api.pollPptxJob).toHaveBeenCalledTimes(2)
  })

  it('returns an identity-bearing outcome-unknown error after deadline cancellation', async () => {
    const api = {
      pollPptxJob: vi
        .fn()
        .mockResolvedValueOnce({ jobId: 'job-9', status: 'running' })
        .mockResolvedValueOnce({ jobId: 'job-9', status: 'cancelled' }),
      cancelPptxJob: vi.fn().mockResolvedValue({ jobId: 'job-9', status: 'cancelling' }),
    }

    await expect(
      pollPptxJobUntilTerminal({
        jobId: 'job-9',
        api,
        maxPollAttempts: 1,
        pollIntervalMs: 0,
      })
    ).rejects.toMatchObject({
      name: 'PptxJobOutcomeError',
      code: 'PPTX_JOB_OUTCOME_UNKNOWN',
      jobId: 'job-9',
    })
  })
})
