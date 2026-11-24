import { expect } from '../fixtures/test-fixtures.js'

// Chromium reports CSP-denied requests before transport; retain the whole lifecycle.
export function captureSandboxNetwork(context) {
  const attempts = new Map(),
    frames = new Map()
  let surface = 'unassigned'
  function record(request) {
    if (!request.url().includes('education-sandbox-probe')) return null
    if (!attempts.has(request)) {
      const frame = request.frame()
      if (!frames.has(frame)) frames.set(frame, frames.size + 1)
      attempts.set(request, {
        surface,
        frame: frames.get(frame),
        frameUrl: frame.url(),
        pageUrl: frame.page().url(),
        url: request.url(),
        type: request.resourceType(),
        requestSeen: false,
        failed: null,
        response: null,
        finished: false,
      })
    }
    return attempts.get(request)
  }
  const requested = (request) => {
    const item = record(request)
    if (item) item.requestSeen = true
  }
  const failed = (request) => {
    const item = record(request)
    if (item) item.failed = request.failure()?.errorText || 'unknown'
  }
  const responded = (response) => {
    const item = record(response.request())
    if (item) item.response = response.status()
  }
  const finished = (request) => {
    const item = record(request)
    if (item) item.finished = true
  }
  context.on('request', requested)
  context.on('requestfailed', failed)
  context.on('response', responded)
  context.on('requestfinished', finished)
  return {
    scope(name) {
      surface = name
    },
    async verify(observations) {
      await expect
        .poll(() => [...attempts.values()].every((item) => item.failed !== null))
        .toBe(true)
      const evidence = [...attempts.values()]
      for (const surface of ['canvas', 'generated', 'print']) {
        expect(observations[surface].violations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              directive: 'connect-src',
              blocked: 'https://example.invalid/education-sandbox-probe',
            }),
            expect.objectContaining({
              directive: 'img-src',
              blocked: 'https://example.invalid/education-sandbox-probe',
            }),
          ])
        )
        expect(evidence.some((item) => item.surface === surface && item.type === 'image')).toBe(
          true
        )
      }
      for (const item of evidence) {
        expect(['canvas', 'generated', 'print']).toContain(item.surface)
        expect(item.requestSeen).toBe(true)
        expect(
          observations[item.surface].violations.some((violation) => violation.blocked === item.url)
        ).toBe(true)
        expect(item.response).toBeNull()
        expect(item.finished).toBe(false)
      }
      return evidence
    },
    dispose() {
      context.off('request', requested)
      context.off('requestfailed', failed)
      context.off('response', responded)
      context.off('requestfinished', finished)
    },
  }
}
