import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PPTX_JOB_MAX_WAIT_MS,
  PPTX_FINAL_STATUS_BUDGET_MS,
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

  it('uses a final status GET at the polling deadline for a success race', async () => {
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
    expect(api.cancelPptxJob).not.toHaveBeenCalled()
    expect(api.pollPptxJob).toHaveBeenCalledTimes(2)
  })

  it('surfaces durable cancelled after deadline as cancelled, not outcome-unknown', async () => {
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
      code: 'PPTX_JOB_CANCELLED',
      status: 'cancelled',
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

  it('SSE budget path performs a bounded final GET without cancellation or repair', async () => {
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
      pollPptxJob: vi.fn().mockResolvedValue({
        jobId: 'job-budget',
        status: 'running',
      }),
      cancelPptxJob: vi.fn().mockResolvedValue({ status: 'cancelling' }),
      // Guard: timeout recovery must never call destructive repair.
      reconcilePptxJob: vi.fn(),
    }

    const waitPromise = waitForPptxJob({
      jobId: 'job-budget',
      api,
      EventSourceImpl: HangEventSource,
      maxWaitMs: 5_000,
      pollIntervalMs: 1000,
    })
    const assertion = expect(waitPromise).rejects.toMatchObject({
      name: 'PptxJobOutcomeError',
      code: 'PPTX_JOB_OUTCOME_UNKNOWN',
      jobId: 'job-budget',
      message:
        'PPTX import job job-budget reached the waiting deadline; its final outcome is not confirmed. Check existing presentations before retrying.',
    })

    await vi.advanceTimersByTimeAsync(5_000)
    await assertion
    expect(api.cancelPptxJob).not.toHaveBeenCalled()
    expect(api.pollPptxJob).toHaveBeenCalledTimes(1)
    expect(api.reconcilePptxJob).not.toHaveBeenCalled()
  })

  it('retained terminal SSE cancels a pending final status GET without aborting ownership', async () => {
    let eventSource
    let resolveFinal
    let finalOptions
    class FinalRecoveryEventSource {
      constructor() {
        eventSource = this
        this.listeners = new Map()
      }
      addEventListener(type, handler) {
        this.listeners.set(type, handler)
      }
      emit(type, payload) {
        this.listeners.get(type)?.({ data: JSON.stringify(payload) })
      }
      close = vi.fn()
    }
    const callerController = new AbortController()
    const onProgress = vi.fn()
    const api = {
      pollPptxJob: vi.fn((_jobId, options) => {
        finalOptions = options
        return new Promise((resolve) => {
          resolveFinal = resolve
        })
      }),
    }
    const waitPromise = waitForPptxJob({
      jobId: 'job-retained-final-terminal',
      api,
      EventSourceImpl: FinalRecoveryEventSource,
      onProgress,
      signal: callerController.signal,
      maxWaitMs: 5_000,
    })
    let outcome
    waitPromise.then(
      (value) => {
        outcome = { type: 'resolved', value }
      },
      (error) => {
        outcome = { type: 'rejected', error }
      },
    )

    await vi.advanceTimersByTimeAsync(2_500)
    await vi.advanceTimersByTimeAsync(0)
    expect(api.pollPptxJob).toHaveBeenCalledTimes(1)
    expect(finalOptions.signal).toBeDefined()
    expect(callerController.signal.aborted).toBe(false)

    eventSource.emit('done', { result: { presentationId: 'retained-final-deck' } })
    await vi.advanceTimersByTimeAsync(0)
    expect(outcome).toEqual({
      type: 'resolved',
      value: { presentationId: 'retained-final-deck' },
    })
    expect(finalOptions.signal.aborted).toBe(true)
    expect(callerController.signal.aborted).toBe(false)

    resolveFinal({
      jobId: 'job-retained-final-terminal',
      status: 'running',
      message: 'late final progress',
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('SSE onerror poll fallback uses remaining absolute budget (not a fresh full maxWaitMs)', async () => {
    class FailThenHang {
      constructor() {
        this.listeners = new Map()
        queueMicrotask(() => this.onerror?.())
      }
      addEventListener() {}
      close = vi.fn()
    }
    const api = {
      pollPptxJob: vi.fn().mockResolvedValue({ jobId: 'job-reuse', status: 'running' }),
      cancelPptxJob: vi.fn().mockResolvedValue({ status: 'cancelling' }),
    }
    const waitPromise = waitForPptxJob({
      jobId: 'job-reuse',
      api,
      EventSourceImpl: FailThenHang,
      maxWaitMs: 5_000,
      pollIntervalMs: 1_000,
    })
    const assertion = expect(waitPromise).rejects.toMatchObject({
      name: 'PptxJobOutcomeError',
      code: 'PPTX_JOB_OUTCOME_UNKNOWN',
      jobId: 'job-reuse',
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(api.pollPptxJob).toHaveBeenCalled()
    // Absolute budget ends within maxWaitMs; do not require a second full 5s after fallback.
    await vi.advanceTimersByTimeAsync(5_000)
    await assertion
  })

  it('bounds a hanging poll transport and bounds its final status GET', async () => {
    const api = {
      pollPptxJob: vi.fn(() => new Promise(() => {})),
    }
    const waitPromise = pollPptxJobUntilTerminal({
      jobId: 'job-poll-hang',
      api,
      maxWaitMs: 6_000,
      pollIntervalMs: 0,
    })
    const assertion = expect(waitPromise).rejects.toMatchObject({
      name: 'PptxJobOutcomeError',
      code: 'PPTX_JOB_OUTCOME_UNKNOWN',
      jobId: 'job-poll-hang',
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(api.pollPptxJob).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(0)
    expect(api.pollPptxJob).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5_000)
    await assertion
    expect(api.pollPptxJob).toHaveBeenCalledTimes(2)
  })

  it('routes a non-timeout poll failure through the final status read', async () => {
    const api = {
      pollPptxJob: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('network unavailable'))
        .mockResolvedValueOnce({
          jobId: 'job-poll-network-race',
          status: 'done',
          result: { presentationId: 'deck-after-network-race' },
        }),
    }

    await expect(
      pollPptxJobUntilTerminal({
        jobId: 'job-poll-network-race',
        api,
        maxPollAttempts: 1,
        pollIntervalMs: 0,
      })
    ).resolves.toEqual({ presentationId: 'deck-after-network-race' })
    expect(api.pollPptxJob).toHaveBeenCalledTimes(2)
  })

  it('maps a persistent non-timeout poll failure to outcome-unknown', async () => {
    const api = {
      pollPptxJob: vi.fn().mockRejectedValue(new Error('status unavailable')),
    }

    await expect(
      pollPptxJobUntilTerminal({
        jobId: 'job-poll-status-error',
        api,
        maxPollAttempts: 1,
        pollIntervalMs: 0,
      })
    ).rejects.toMatchObject({
      name: 'PptxJobOutcomeError',
      code: 'PPTX_JOB_OUTCOME_UNKNOWN',
      jobId: 'job-poll-status-error',
    })
    expect(api.pollPptxJob).toHaveBeenCalledTimes(2)
  })

  it('does not emit late progress when final status resolves after timeout', async () => {
    let resolveFinal
    const finalStatus = new Promise((resolve) => {
      resolveFinal = resolve
    })
    const api = {
      pollPptxJob: vi.fn()
        .mockImplementationOnce(() => new Promise(() => {}))
        .mockImplementationOnce(() => finalStatus),
    }
    const onProgress = vi.fn()
    const waitPromise = pollPptxJobUntilTerminal({
      jobId: 'job-late-progress',
      api,
      onProgress,
      maxWaitMs: 6_000,
      pollIntervalMs: 0,
    })
    const assertion = expect(waitPromise).rejects.toMatchObject({
      name: 'PptxJobOutcomeError',
      code: 'PPTX_JOB_OUTCOME_UNKNOWN',
      jobId: 'job-late-progress',
    })

    await vi.advanceTimersByTimeAsync(1_000)
    expect(api.pollPptxJob).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5_000)
    await assertion

    resolveFinal({
      jobId: 'job-late-progress',
      status: 'running',
      message: 'late progress',
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('delivers progress while the active SSE connection owns the wait', async () => {
    let eventSource
    class ActiveEventSource {
      constructor() {
        eventSource = this
        this.listeners = new Map()
      }
      addEventListener(type, handler) {
        this.listeners.set(type, handler)
      }
      emit(type, payload) {
        this.listeners.get(type)?.({ data: JSON.stringify(payload) })
      }
      close = vi.fn()
    }
    const controller = new AbortController()
    const onProgress = vi.fn()
    const api = {
      cancelPptxJob: vi.fn().mockResolvedValue({ status: 'cancelling' }),
    }
    const waitPromise = waitForPptxJob({
      jobId: 'job-active-sse-progress',
      api,
      EventSourceImpl: ActiveEventSource,
      onProgress,
      signal: controller.signal,
      maxWaitMs: 60_000,
    })

    eventSource.emit('progress', { message: 'active progress' })
    expect(onProgress).toHaveBeenCalledWith('active progress')

    const assertion = expect(waitPromise).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await assertion
  })

  it('settles on direct SSE done and ignores retained progress', async () => {
    let eventSource
    class DirectEventSource {
      constructor() {
        eventSource = this
        this.listeners = new Map()
      }
      addEventListener(type, handler) {
        this.listeners.set(type, handler)
      }
      emit(type, payload) {
        this.listeners.get(type)?.({ data: JSON.stringify(payload) })
      }
      close = vi.fn()
    }
    const onProgress = vi.fn()
    const waitPromise = waitForPptxJob({
      jobId: 'job-direct-sse-done',
      api: {},
      EventSourceImpl: DirectEventSource,
      onProgress,
      maxWaitMs: 60_000,
    })

    eventSource.emit('done', { result: { presentationId: 'direct-sse-deck' } })
    await expect(waitPromise).resolves.toEqual({ presentationId: 'direct-sse-deck' })
    eventSource.emit('progress', { message: 'retained after done' })
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('ignores queued SSE progress after final recovery begins and settles', async () => {
    let eventSource
    class QueuedEventSource {
      constructor() {
        eventSource = this
        this.listeners = new Map()
      }
      addEventListener(type, handler) {
        this.listeners.set(type, handler)
      }
      emit(type, payload) {
        this.listeners.get(type)?.({ data: JSON.stringify(payload) })
      }
      close = vi.fn()
    }
    const api = {
      pollPptxJob: vi.fn(() => new Promise(() => {})),
    }
    const onProgress = vi.fn()
    const waitPromise = waitForPptxJob({
      jobId: 'job-queued-sse-progress',
      api,
      EventSourceImpl: QueuedEventSource,
      onProgress,
      maxWaitMs: 5_000,
      pollIntervalMs: 0,
    })
    const assertion = expect(waitPromise).rejects.toMatchObject({
      name: 'PptxJobOutcomeError',
      code: 'PPTX_JOB_OUTCOME_UNKNOWN',
      jobId: 'job-queued-sse-progress',
    })

    await vi.advanceTimersByTimeAsync(2_500)
    expect(api.pollPptxJob).toHaveBeenCalledTimes(1)
    eventSource.emit('progress', { message: 'queued after close' })
    expect(onProgress).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2_500)
    await assertion
    eventSource.emit('progress', { message: 'queued after settle' })
    expect(onProgress).not.toHaveBeenCalled()
  })

  it.each([
    [
      'done',
      { result: { presentationId: 'queued-sse-deck' } },
      { presentationId: 'queued-sse-deck' },
    ],
    [
      'failed',
      { error: 'queued failure', type: 'ImportError', code: 'QUEUED_FAILURE' },
      {
        name: 'PptxJobOutcomeError',
        code: 'PPTX_JOB_FAILED',
        status: 'failed',
        failureType: 'ImportError',
        failureCode: 'QUEUED_FAILURE',
      },
    ],
    [
      'cancelled',
      { error: 'queued cancellation', type: 'CancelError', code: 'QUEUED_CANCEL' },
      {
        name: 'PptxJobOutcomeError',
        code: 'PPTX_JOB_CANCELLED',
        status: 'cancelled',
        failureType: 'CancelError',
        failureCode: 'QUEUED_CANCEL',
      },
    ],
  ])('preserves a retained %s terminal SSE event after polling fallback', async (status, payload, expectation) => {
    let eventSource
    let resolvePoll
    let pollOptions
    const callerController = new AbortController()
    class FallbackEventSource {
      constructor() {
        eventSource = this
        this.listeners = new Map()
        queueMicrotask(() => this.onerror?.())
      }
      addEventListener(type, handler) {
        this.listeners.set(type, handler)
      }
      emit(type, eventPayload) {
        this.listeners.get(type)?.({ data: JSON.stringify(eventPayload) })
      }
      close = vi.fn()
    }
    const onProgress = vi.fn()
    const api = {
      pollPptxJob: vi.fn(
        (_jobId, options) => {
          pollOptions = options
          return new Promise((resolve) => {
            resolvePoll = resolve
          })
        },
      ),
    }
    const waitPromise = waitForPptxJob({
      jobId: 'job-queued-sse-terminal',
      api,
      EventSourceImpl: FallbackEventSource,
      onProgress,
      signal: callerController.signal,
      maxWaitMs: 5_000,
      pollIntervalMs: 0,
    })
    let outcome
    waitPromise.then(
      (value) => {
        outcome = { type: 'resolved', value }
      },
      (error) => {
        outcome = { type: 'rejected', error }
      },
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(api.pollPptxJob).toHaveBeenCalledTimes(1)
    expect(pollOptions.signal).toBeDefined()
    expect(callerController.signal.aborted).toBe(false)
    eventSource.emit(status, payload)
    await vi.advanceTimersByTimeAsync(0)

    expect(outcome?.type).toBe(status === 'done' ? 'resolved' : 'rejected')
    expect(pollOptions.signal.aborted).toBe(true)
    expect(callerController.signal.aborted).toBe(false)
    if (status === 'done') {
      expect(outcome.value).toEqual(expectation)
    } else {
      expect(outcome.error).toMatchObject(expectation)
    }

    resolvePoll({
      jobId: 'job-queued-sse-terminal',
      status: 'running',
      message: 'late fallback progress',
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(onProgress).not.toHaveBeenCalled()
    expect(api.pollPptxJob).toHaveBeenCalledTimes(1)
  })

  it('does not start a duplicate final GET after SSE fallback begins', async () => {
    class FailThenHang {
      constructor() {
        queueMicrotask(() => this.onerror?.())
      }
      addEventListener() {}
      close = vi.fn()
    }
    const api = {
      pollPptxJob: vi.fn(() => new Promise(() => {})),
    }
    const waitPromise = waitForPptxJob({
      jobId: 'job-fallback-hang',
      api,
      EventSourceImpl: FailThenHang,
      maxWaitMs: 6_000,
      pollIntervalMs: 0,
    })
    const assertion = expect(waitPromise).rejects.toMatchObject({
      name: 'PptxJobOutcomeError',
      code: 'PPTX_JOB_OUTCOME_UNKNOWN',
      jobId: 'job-fallback-hang',
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(api.pollPptxJob).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(0)
    expect(api.pollPptxJob).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5_000)
    await assertion
    expect(api.pollPptxJob).toHaveBeenCalledTimes(2)
  })

  it('preserves caller abort while a poll transport is pending', async () => {
    const controller = new AbortController()
    const api = {
      pollPptxJob: vi.fn(() => new Promise(() => {})),
    }
    const waitPromise = pollPptxJobUntilTerminal({
      jobId: 'job-poll-abort',
      api,
      signal: controller.signal,
      maxWaitMs: 60_000,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(api.pollPptxJob).toHaveBeenCalledTimes(1)
    controller.abort()
    await expect(waitPromise).rejects.toMatchObject({ name: 'AbortError' })
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
    expect(PPTX_FINAL_STATUS_BUDGET_MS).toBe(5_000)
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
    expect(api.cancelPptxJob).toHaveBeenCalledWith('job-sse-abort', expect.objectContaining({}))
  })

  it('preserves typed async failure fields from durable polling', async () => {
    const api = {
      pollPptxJob: vi.fn().mockResolvedValue({
        jobId: 'job-failure',
        status: 'failed',
        error: 'Import output was empty',
        type: 'output-empty',
        code: 'OUTPUT_EMPTY',
        failureStage: 'parse',
        reasonCode: 'EMPTY_OUTPUT',
      }),
    }
    await expect(
      pollPptxJobUntilTerminal({ jobId: 'job-failure', api, maxPollAttempts: 1 })
    ).rejects.toMatchObject({
      code: 'PPTX_JOB_FAILED',
      failureType: 'output-empty',
      failureCode: 'OUTPUT_EMPTY',
      failureStage: 'parse',
      reasonCode: 'EMPTY_OUTPUT',
    })
  })

  it('reports the durable failure message when no typed error field is present', async () => {
    const api = {
      pollPptxJob: vi.fn().mockResolvedValue({
        jobId: 'job-durable-failure',
        status: 'failed',
        message: 'Import failed; partial import rolled back',
        durable: true,
      }),
    }
    await expect(
      pollPptxJobUntilTerminal({ jobId: 'job-durable-failure', api, maxPollAttempts: 1 })
    ).rejects.toThrow('Import failed; partial import rolled back')
  })

  it('surfaces pending-visibility without opening a presentation id', async () => {
    const api = {
      pollPptxJob: vi.fn().mockResolvedValue({
        jobId: 'job-pv',
        status: 'pending-visibility',
        message: 'awaiting list visibility',
      }),
      cancelPptxJob: vi.fn(),
    }
    await expect(
      pollPptxJobUntilTerminal({
        jobId: 'job-pv',
        api,
        maxPollAttempts: 1,
        pollIntervalMs: 0,
      })
    ).rejects.toMatchObject({
      code: 'PPTX_JOB_PENDING_VISIBILITY',
      status: 'pending-visibility',
      jobId: 'job-pv',
    })
  })
})

describe('PptxJobOutcomeError', () => {
  it('preserves identity and custom codes', () => {
    const err = new PptxJobOutcomeError('x', {
      jobId: 'j',
      code: 'PPTX_JOB_FAILED',
      status: 'failed',
      failureType: 'output-empty',
      failureCode: 'OUTPUT_EMPTY',
      failureStage: 'parse',
      reasonCode: 'EMPTY_OUTPUT',
    })
    expect(err).toMatchObject({
      name: 'PptxJobOutcomeError',
      code: 'PPTX_JOB_FAILED',
      jobId: 'j',
      status: 'failed',
      failureType: 'output-empty',
      failureCode: 'OUTPUT_EMPTY',
      failureStage: 'parse',
      reasonCode: 'EMPTY_OUTPUT',
    })
  })
})
