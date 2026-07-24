import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PPTX_JOB_MAX_WAIT_MS,
  pollPptxJobUntilTerminal,
  waitForPptxJob,
  PptxJobOutcomeError,
} from './pptx-job-wait'

describe('PPTX job waiting', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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

    const resultPromise = waitForPptxJob({
      jobId: 'job-1',
      api,
      EventSourceImpl: FakeEventSource,
      onProgress,
      pollIntervalMs: 0,
      maxWaitMs: 60_000,
    })
    await vi.runAllTimersAsync()
    await expect(resultPromise).resolves.toEqual({ presentationId: 'deck-1' })

    expect(onProgress).toHaveBeenCalledWith('Finished')
    expect(api.pollPptxJob).toHaveBeenCalledWith('job-1', expect.any(Object))
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

  it('aborts mid-sleep without further poll calls', async () => {
    const controller = new AbortController()
    const api = {
      pollPptxJob: vi.fn().mockResolvedValue({ jobId: 'job-abort', status: 'running' }),
      cancelPptxJob: vi.fn(),
    }

    const waitPromise = pollPptxJobUntilTerminal({
      jobId: 'job-abort',
      api,
      signal: controller.signal,
      pollIntervalMs: 1000,
      maxWaitMs: 60_000,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(api.pollPptxJob).toHaveBeenCalledTimes(1)
    controller.abort()
    await expect(waitPromise).rejects.toMatchObject({ name: 'AbortError' })
    const pollsAtAbort = api.pollPptxJob.mock.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.pollPptxJob).toHaveBeenCalledTimes(pollsAtAbort)
  })

  it('SSE maxWaitMs cancels once, closes EventSource, and rejects with outcome-unknown', async () => {
    class HangEventSource {
      constructor() {
        this.listeners = new Map()
      }
      addEventListener(type, handler) {
        this.listeners.set(type, handler)
      }
      close = vi.fn()
    }
    const api = {
      pollPptxJob: vi.fn(),
      cancelPptxJob: vi.fn().mockResolvedValue({ status: 'cancelling' }),
    }

    const waitPromise = waitForPptxJob({
      jobId: 'job-budget',
      api,
      EventSourceImpl: HangEventSource,
      maxWaitMs: 5_000,
      pollIntervalMs: 1000,
    })
    // Attach rejection handler before timers fire to avoid unhandled rejection races.
    const assertion = expect(waitPromise).rejects.toMatchObject({
      name: 'PptxJobOutcomeError',
      code: 'PPTX_JOB_OUTCOME_UNKNOWN',
      jobId: 'job-budget',
    })

    await vi.advanceTimersByTimeAsync(5_000)
    await assertion
    expect(api.cancelPptxJob).toHaveBeenCalledTimes(1)
    expect(api.cancelPptxJob).toHaveBeenCalledWith('job-budget')
  })

  it('poll-only path emits onConnection with jobId then clears on settle', async () => {
    const onConnection = vi.fn()
    const api = {
      pollPptxJob: vi.fn().mockResolvedValue({
        jobId: 'job-poll',
        status: 'done',
        result: { presentationId: 'deck-poll' },
      }),
      cancelPptxJob: vi.fn(),
    }

    await expect(
      waitForPptxJob({
        jobId: 'job-poll',
        api,
        EventSourceImpl: undefined,
        onConnection,
        maxPollAttempts: 1,
        pollIntervalMs: 0,
      })
    ).resolves.toEqual({ presentationId: 'deck-poll' })

    expect(onConnection.mock.calls[0][0]).toEqual({ jobId: 'job-poll' })
    expect(onConnection).toHaveBeenLastCalledWith(null)
  })

  it('exports a default wait budget of server import timeout plus 30s slack', () => {
    expect(DEFAULT_PPTX_JOB_MAX_WAIT_MS).toBe(150_000)
  })

  it('SSE abort signal closes EventSource, cancels job, and rejects AbortError', async () => {
    class HangEventSource {
      constructor() {
        this.listeners = new Map()
      }
      addEventListener(type, handler) {
        this.listeners.set(type, handler)
      }
      close = vi.fn()
    }
    const controller = new AbortController()
    const api = {
      pollPptxJob: vi.fn(),
      cancelPptxJob: vi.fn().mockResolvedValue({ status: 'cancelling' }),
    }

    const waitPromise = waitForPptxJob({
      jobId: 'job-sse-abort',
      api,
      EventSourceImpl: HangEventSource,
      signal: controller.signal,
      maxWaitMs: 60_000,
    })

    controller.abort()
    await expect(waitPromise).rejects.toMatchObject({ name: 'AbortError' })
    expect(api.cancelPptxJob).toHaveBeenCalledWith('job-sse-abort')
  })
})

describe('PptxJobOutcomeError', () => {
  it('preserves identity and custom codes', () => {
    const err = new PptxJobOutcomeError('x', { jobId: 'j', code: 'PPTX_JOB_OUTCOME_UNKNOWN', status: 'unknown' })
    expect(err).toMatchObject({
      name: 'PptxJobOutcomeError',
      code: 'PPTX_JOB_OUTCOME_UNKNOWN',
      jobId: 'j',
      status: 'unknown',
    })
  })
})
