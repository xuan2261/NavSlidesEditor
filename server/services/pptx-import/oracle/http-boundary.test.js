import { describe, expect, it } from 'vitest'
import boundary from './http-boundary.js'

const { requestJson, waitWithSignal, withSignal } = boundary

describe('bounded HTTP boundary', () => {
  it('converts an aborted fetch into a structured timeout', async () => {
    const controller = new AbortController()
    const fetchImpl = async (_url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    })
    const request = requestJson(fetchImpl, 'http://127.0.0.1:3002/api/pptx/jobs/job-1', { signal: controller.signal })
    controller.abort()
    await expect(request).rejects.toMatchObject({ code: 'http-request-timeout' })
  })

  it('stops a pending polling sleep when its signal aborts', async () => {
    const controller = new AbortController()
    const sleep = () => new Promise(() => {})
    const pending = waitWithSignal(sleep, 10, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'http-request-timeout' })
  })

  it.each([
    'LEGACY_IMPORT_RECEIPT_UNSUPPORTED',
    'PACKAGE_IMPORT_COMMIT_FAILED',
  ])('retains sanitized reason code %s from a JSON failure response', async (reasonCode) => {
    const error = await requestJson(async () => new Response(JSON.stringify({
      reasonCode,
      detail: 'untrusted server detail',
    }), { status: 409, headers: { 'content-type': 'application/json' } }), 'http://127.0.0.1:3002/api/pptx/jobs/job-1')
      .catch((requestError) => requestError)

    expect(error).toMatchObject({
      code: 'http-request-failed',
      reasonCode,
    })
    expect(error).not.toHaveProperty('detail')
  })

  it('keeps malformed error responses generic', async () => {
    const error = await requestJson(
      async () => new Response('not JSON', { status: 409 }),
      'http://127.0.0.1:3002/api/pptx/jobs/job-1'
    ).catch((requestError) => requestError)

    expect(error).toMatchObject({ code: 'http-request-failed' })
    expect(error).not.toHaveProperty('reasonCode')
  })

  it('keeps transport failures generic', async () => {
    const error = await requestJson(
      async () => { throw new Error('transport unavailable') },
      'http://127.0.0.1:3002/api/pptx/jobs/job-1'
    ).catch((requestError) => requestError)

    expect(error).toMatchObject({ code: 'http-request-failed' })
    expect(error).not.toHaveProperty('reasonCode')
  })

  it('normalizes empty request options for injected fetch implementations', () => {
    expect(withSignal(null, null)).toEqual({})
  })
})
