import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import manager from './pptx-import-job-manager.js'

function responseSink() {
  return {
    chunks: [],
    ended: false,
    write(chunk) {
      this.chunks.push(chunk)
    },
    end() {
      this.ended = true
    },
  }
}

describe('pptx import job manager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    manager._reset()
  })

  afterEach(() => {
    manager._reset()
    vi.useRealTimers()
  })

  it('creates one running job and enforces the concurrency limit', () => {
    const jobId = manager.createJob()
    expect(manager.getJob(jobId)).toMatchObject({ status: 'running', percent: 0 })
    expect(() => manager.createJob()).toThrow('import-in-progress')
  })

  it('emits progress and completion to every attached SSE client', () => {
    const jobId = manager.createJob()
    const a = responseSink()
    const b = responseSink()

    manager.attachSseClient(jobId, a)
    manager.attachSseClient(jobId, b)
    manager.emitProgress(jobId, { stage: 'mapping', percent: 42, message: 'Processing slide 1 of 2' })
    manager.completeJob(jobId, { presentation: { slides: [] } })

    expect(a.chunks.join('')).toContain('event: progress')
    expect(a.chunks.join('')).toContain('Processing slide 1 of 2')
    expect(b.chunks.join('')).toContain('event: done')
  })

  it('closes terminal SSE clients so they cannot pin jobs indefinitely', () => {
    const jobId = manager.createJob()
    const res = responseSink()

    manager.attachSseClient(jobId, res)
    manager.completeJob(jobId, { ok: true })
    expect(res.ended).toBe(true)
    expect(manager.getJob(jobId).sseClients.size).toBe(0)
    vi.advanceTimersByTime(manager.JOB_TTL_MS + 1)
    expect(manager.getJob(jobId)).toBeNull()
  })

  it('returns cancellation status codes', () => {
    const jobId = manager.createJob()
    const cancel = vi.fn()
    manager.registerCancelHandler(jobId, cancel)

    expect(manager.cancelJob('missing')).toBe('unknown')
    expect(manager.cancelJob(jobId)).toBe('ok')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(manager.getJob(jobId)).toMatchObject({ status: 'cancelling', terminalState: false })
    expect(manager.cancelJob(jobId)).toBe('conflict')
    manager.completeCancellation(jobId)
    expect(manager.getJob(jobId)).toMatchObject({ status: 'cancelled', terminalState: true })
  })

  it('keeps cancelling jobs counted against the concurrency limit until settled', () => {
    const jobId = manager.createJob()
    manager.registerCancelHandler(jobId, vi.fn())

    expect(manager.cancelJob(jobId)).toBe('ok')
    expect(() => manager.createJob()).toThrow('import-in-progress')

    manager.completeCancellation(jobId)
    expect(manager.createJob()).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('keeps terminal jobs counted while their background operation is pending', () => {
    const jobId = manager.createJob()
    manager.holdOperation(jobId)
    manager.failJob(jobId, 'deadline exceeded')

    expect(manager.getJob(jobId)).toMatchObject({ status: 'failed', operationPending: true })
    expect(() => manager.createJob()).toThrow('import-in-progress')

    manager.settleOperation(jobId)
    expect(manager.createJob()).toMatch(/^[0-9a-f-]{36}$/i)
  })
})
