// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dryRunJobRetention, isProtectedJob } from './retention-dry-run.js'

describe('package-store retention dry-run', () => {
  it('never mutates state and marks dryRun only', () => {
    const state = {
      jobs: [
        {
          id: 'old-failed',
          status: 'failed',
          presentationId: 'p-old',
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      heads: [],
      compatibilityOutbox: [],
    }
    const frozen = structuredClone(state)
    const report = dryRunJobRetention(state, Date.parse('2026-07-26T00:00:00.000Z'))
    expect(report.dryRun).toBe(true)
    expect(report.destructiveEnabled).toBe(false)
    expect(report.eligible).toContain('old-failed')
    expect(state).toEqual(frozen)
  })

  it('protects jobs that still have a package head', () => {
    const state = {
      jobs: [
        {
          id: 'live',
          status: 'completed',
          presentationId: 'p-live',
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      heads: [{ presentationId: 'p-live', generation: 1 }],
      compatibilityOutbox: [],
    }
    expect(isProtectedJob(state.jobs[0], state)).toBe(true)
    const report = dryRunJobRetention(state, Date.parse('2026-07-26T00:00:00.000Z'))
    expect(report.eligible).not.toContain('live')
    expect(report.protected).toContain('live')
  })

  it('protects reconcile-required and outbox-referenced jobs', () => {
    const job = {
      id: 'repair',
      status: 'failed',
      presentationId: 'p-repair',
      reconcileRequired: true,
      updatedAt: '2020-01-01T00:00:00.000Z',
    }
    expect(isProtectedJob(job, { heads: [], compatibilityOutbox: [] })).toBe(true)
    const outboxJob = {
      id: 'pending-outbox',
      status: 'completed',
      presentationId: 'p-out',
      updatedAt: '2020-01-01T00:00:00.000Z',
    }
    expect(
      isProtectedJob(outboxJob, {
        heads: [],
        compatibilityOutbox: [{ id: 'w1', presentationId: 'p-out' }],
      })
    ).toBe(true)
  })
})
