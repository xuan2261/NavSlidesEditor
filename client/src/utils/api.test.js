import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

function busyImportResponse(retryAfter) {
  return {
    ok: false,
    status: 429,
    headers: { get: (name) => name === 'Retry-After' ? retryAfter : null },
    json: async () => ({ error: 'import-in-progress' }),
  }
}

function acceptedImportResponse() {
  return { ok: true, json: async () => ({ jobId: 'job-2' }) }
}

function mockBusyThenAccepted(retryAfter) {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(busyImportResponse(retryAfter))
    .mockResolvedValueOnce(acceptedImportResponse())
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('PPTX import API', () => {
  afterEach(() => {
    vi.useRealTimers()
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
          headers: { get: () => null },
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

  it('keeps numeric retry metadata and exposes the raw Retry-After header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => busyImportResponse('60')))

    await expect(api.importPptxAsync(new File(['pptx'], 'deck.pptx'))).rejects.toMatchObject({
      retryAfter: 60,
      retryAfterRaw: '60',
      status: 429,
    })
  })

  it('preserves typed HTTP failure fields from cancellation responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 409,
      headers: { get: () => null },
      json: async () => ({
        error: 'job-too-late',
        code: 'JOB_CANCEL_TOO_LATE',
        type: 'cancel-too-late',
        failureType: 'job-terminal',
        failureCode: 'JOB_CANCEL_TOO_LATE',
        failureStage: 'cancel',
        reasonCode: 'PACKAGE_VISIBLE',
      }),
    })))

    await expect(api.importPptxAsync(new File(['pptx'], 'deck.pptx'))).rejects.toMatchObject({
      status: 409,
      code: 'JOB_CANCEL_TOO_LATE',
      type: 'cancel-too-late',
      failureType: 'job-terminal',
      failureCode: 'JOB_CANCEL_TOO_LATE',
      failureStage: 'cancel',
      reasonCode: 'PACKAGE_VISIBLE',
    })
  })

  it('waits for the canonical server Retry-After delay before retrying', async () => {
    vi.useFakeTimers()
    const fetchMock = mockBusyThenAccepted('60')
    const promise = api.importPptxAsync(new File(['pptx'], 'deck.pptx'), {
      retryOnBusy: true,
      maxBusyRetries: 1,
      busyRetryDelayMs: 1,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(59_999)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual({ jobId: 'job-2' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['missing', undefined],
    ['zero', '0'],
    ['decimal', '1.5'],
    ['exponent', '1e2'],
    ['hexadecimal', '0x10'],
    ['positive sign', '+60'],
    ['negative sign', '-60'],
    ['leading whitespace', ' 60'],
    ['trailing whitespace', '60 '],
    ['unsafe integer', '9007199254740992'],
  ])('uses the configured fallback for %s Retry-After values', async (_label, retryAfter) => {
    vi.useFakeTimers()
    const fetchMock = mockBusyThenAccepted(retryAfter)
    const promise = api.importPptxAsync(new File(['pptx'], 'deck.pptx'), {
      retryOnBusy: true,
      maxBusyRetries: 1,
      busyRetryDelayMs: 17,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(16)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual({ jobId: 'job-2' })
  })

  it('uses the default fallback when Retry-After is absent', async () => {
    vi.useFakeTimers()
    const fetchMock = mockBusyThenAccepted(undefined)
    const promise = api.importPptxAsync(new File(['pptx'], 'deck.pptx'), {
      retryOnBusy: true,
      maxBusyRetries: 1,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(4_999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual({ jobId: 'job-2' })
  })

  it.each([
    ['caps configured fallback at five minutes', undefined, 400_000, 300_000],
    ['keeps explicit zero fallback immediate', '0', 0, 0],
  ])('%s', async (_label, retryAfter, busyRetryDelayMs, expectedDelayMs) => {
    vi.useFakeTimers()
    const fetchMock = mockBusyThenAccepted(retryAfter)
    const promise = api.importPptxAsync(new File(['pptx'], 'deck.pptx'), {
      retryOnBusy: true,
      maxBusyRetries: 1,
      busyRetryDelayMs,
    })

    await vi.advanceTimersByTimeAsync(0)
    if (expectedDelayMs > 0) {
      await vi.advanceTimersByTimeAsync(expectedDelayMs - 1)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
    }
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await expect(promise).resolves.toEqual({ jobId: 'job-2' })
  })

  it('caps huge canonical Retry-After values at five minutes', async () => {
    vi.useFakeTimers()
    const fetchMock = mockBusyThenAccepted('9007199254740991')
    const promise = api.importPptxAsync(new File(['pptx'], 'deck.pptx'), {
      retryOnBusy: true,
      maxBusyRetries: 1,
      busyRetryDelayMs: 1,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(299_999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await expect(promise).resolves.toEqual({ jobId: 'job-2' })
  })

  it('does not retry unrelated 429 responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: { get: () => '60' },
      json: async () => ({ error: 'too-many-requests' }),
    })))

    await expect(api.importPptxAsync(new File(['pptx'], 'deck.pptx'), {
      retryOnBusy: true,
      maxBusyRetries: 1,
    })).rejects.toMatchObject({ message: 'too-many-requests' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('passes the admission signal to the import fetch', async () => {
    const controller = new AbortController()
    let receivedSignal
    const fetchMock = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      receivedSignal = signal
      signal?.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      }, { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)

    const promise = api.importPptxAsync(new File(['pptx'], 'deck.pptx'), { signal: controller.signal })
    expect(receivedSignal).toBe(controller.signal)

    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('propagates an abort while reading an admitted job response', async () => {
    const controller = new AbortController()
    let beginJson
    const jsonStarted = new Promise((resolve) => {
      beginJson = resolve
    })
    vi.stubGlobal('fetch', vi.fn((_url, { signal }) => Promise.resolve({
      ok: true,
      status: 202,
      json: () => {
        beginJson()
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          }, { once: true })
        })
      },
    })))

    const promise = api.importPptxAsync(new File(['pptx'], 'deck.pptx'), { signal: controller.signal })
    await jsonStarted
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('enforces the admission deadline while response JSON is pending', async () => {
    vi.useFakeTimers()
    let markBodyStarted
    const bodyStarted = new Promise((resolve) => {
      markBodyStarted = resolve
    })
    let bodyAborted = false
    vi.stubGlobal('fetch', vi.fn(async (_url, { signal }) => ({
      ok: true,
      json: () => {
        markBodyStarted()
        signal?.addEventListener?.('abort', () => {
          bodyAborted = true
        }, { once: true })
        return new Promise(() => {})
      },
    })))

    const promise = api.importPptxAsync(new File(['pptx'], 'deck.pptx'), {
      deadlineAt: Date.now() + 250,
    })
    const assertion = expect(promise).rejects.toMatchObject({
      code: 'PPTX_JOB_ADMISSION_TIMEOUT',
      status: 'timeout',
    })
    await bodyStarted
    await vi.advanceTimersByTimeAsync(250)

    await assertion
    expect(bodyAborted).toBe(true)
  })

  it('preserves caller abort while deadline-wrapped response JSON is pending', async () => {
    const controller = new AbortController()
    let markBodyStarted
    const bodyStarted = new Promise((resolve) => {
      markBodyStarted = resolve
    })
    let bodyAborted = false
    vi.stubGlobal('fetch', vi.fn(async (_url, { signal }) => ({
      ok: true,
      json: () => {
        markBodyStarted()
        signal?.addEventListener?.('abort', () => {
          bodyAborted = true
        }, { once: true })
        return new Promise(() => {})
      },
    })))

    const promise = api.importPptxAsync(new File(['pptx'], 'deck.pptx'), {
      deadlineAt: Date.now() + 60_000,
      signal: controller.signal,
    })
    const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    await bodyStarted
    controller.abort()

    await assertion
    expect(bodyAborted).toBe(true)
  })

  it('removes admission abort listeners after a retry sleep resolves', async () => {
    vi.useFakeTimers()
    const signal = {
      aborted: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    const fetchMock = mockBusyThenAccepted('invalid')
    const promise = api.importPptxAsync(new File(['pptx'], 'deck.pptx'), {
      retryOnBusy: true,
      maxBusyRetries: 1,
      busyRetryDelayMs: 10,
      signal,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(10)
    await expect(promise).resolves.toEqual({ jobId: 'job-2' })
    expect(signal.removeEventListener).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('aborts a busy retry sleep without a delayed import POST', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const removeEventListener = vi.spyOn(controller.signal, 'removeEventListener')
    const fetchMock = mockBusyThenAccepted('60')
    const promise = api.importPptxAsync(new File(['pptx'], 'deck.pptx'), {
      retryOnBusy: true,
      maxBusyRetries: 1,
      busyRetryDelayMs: 60_000,
      signal: controller.signal,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const outcome = promise.then(
      () => ({ name: 'resolved' }),
      (error) => error
    )
    controller.abort()
    await vi.advanceTimersByTimeAsync(60_000)
    await expect(outcome).resolves.toMatchObject({ name: 'AbortError' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(removeEventListener).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
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

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/pptx/jobs/job-1', {})
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/pptx/jobs/job-1', { method: 'DELETE' })
  })

  it.each([
    ['too-late', {
      error: 'job-too-late',
      code: 'JOB_CANCEL_TOO_LATE',
      type: 'job-terminal',
      reasonCode: 'PACKAGE_VISIBLE',
    }],
    ['in-progress', {
      error: 'job-cancellation-in-progress',
      code: 'JOB_CANCEL_IN_PROGRESS',
      type: 'job-cancelling',
      reasonCode: 'CANCELLATION_IN_PROGRESS',
    }],
  ])('preserves typed cancel response fields for %s responses', async (_label, body) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 409,
      headers: { get: () => null },
      json: async () => body,
    })))

    await expect(api.cancelPptxJob('job-cancel', { capability: 'cancel-capability' })).rejects.toMatchObject({
      status: 409,
      code: body.code,
      type: body.type,
      reasonCode: body.reasonCode,
    })
    expect(fetch).toHaveBeenCalledWith('/api/pptx/jobs/job-cancel', {
      method: 'DELETE',
      headers: { 'X-Pptx-Job-Capability': 'cancel-capability' },
    })
  })

  it('forwards AbortSignal to PPTX job poll and cancel fetches', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ jobId: 'job-sig', status: 'running' }),
      }))
    )

    await api.pollPptxJob('job-sig', { signal: controller.signal })
    await api.cancelPptxJob('job-sig', { signal: controller.signal })

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/pptx/jobs/job-sig', {
      signal: controller.signal,
    })
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/pptx/jobs/job-sig', {
      method: 'DELETE',
      signal: controller.signal,
    })
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
          json: async () => ({
            error: 'No original',
            mode: 'hybrid-export',
            code: 'PPTX_ORIGINAL_UNAVAILABLE',
            reasonCode: 'ORIGINAL_MISSING',
          }),
        })
    )

    await expect(api.downloadPptxOriginal('deck-1')).resolves.toBe(blob)
    await expect(api.downloadPptxOriginal('deck-1')).rejects.toMatchObject({
      message: 'No original',
      status: 404,
      code: 'PPTX_ORIGINAL_UNAVAILABLE',
      reasonCode: 'ORIGINAL_MISSING',
    })
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/presentations/deck-1/pptx-original')
  })

  it('fences original PPTX downloads to a supplied package generation', async () => {
    const blob = new Blob(['pptx'])
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => blob })))

    await expect(api.downloadPptxOriginal('deck-1', 2)).resolves.toBe(blob)
    expect(fetch).toHaveBeenCalledWith('/api/presentations/deck-1/pptx-original', {
      headers: { 'If-Pptx-Generation': '2' },
    })
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

  it('preserves typed failures from validated edited export responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'Package generation is stale',
        code: 'STALE_PACKAGE_GENERATION',
        reasonCode: 'GENERATION_CONFLICT',
        failureStage: 'export',
      }),
    })))

    await expect(
      api.downloadValidatedEditedPptx('deck-1', 2, 'export-key')
    ).rejects.toMatchObject({
      status: 409,
      code: 'STALE_PACKAGE_GENERATION',
      reasonCode: 'GENERATION_CONFLICT',
      failureStage: 'export',
    })
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
