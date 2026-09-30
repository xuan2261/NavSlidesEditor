import { describe, expect, it } from 'vitest'

import healthModule from './health-state.js'

const { createHealthState, READY_REASON_CODES } = healthModule

describe('health state', () => {
  it('moves from startup to ready, degraded, and shutdown with bounded DTOs', () => {
    let now = 10_000
    const state = createHealthState({ now: () => now })

    expect(state.live()).toEqual({
      status: 'live',
      schemaVersion: 1,
      reasons: [],
      uptimeSeconds: 0,
    })
    expect(state.ready()).toMatchObject({
      status: 'not-ready',
      reasons: [READY_REASON_CODES.STARTING],
    })

    now += 1_500
    state.markReady()
    expect(state.ready()).toMatchObject({
      status: 'ready',
      reasons: [],
      uptimeSeconds: 1,
    })

    state.markDegraded(READY_REASON_CODES.DURABLE_RECOVERY_REQUIRED)
    expect(state.ready()).toMatchObject({
      status: 'not-ready',
      reasons: [READY_REASON_CODES.DURABLE_RECOVERY_REQUIRED],
    })

    state.markStopping()
    expect(state.ready()).toMatchObject({
      status: 'not-ready',
      reasons: [READY_REASON_CODES.SHUTTING_DOWN],
    })
  })

  it('never reflects arbitrary error details into a health response', () => {
    const state = createHealthState()
    state.markDegraded('C:\\secret\\settings.json token=abc123')
    const response = state.ready()

    expect(response.reasons).toEqual([READY_REASON_CODES.READINESS_DEGRADED])
    expect(JSON.stringify(response)).not.toMatch(/secret|settings|token|abc123/i)
    expect(Object.keys(response).sort()).toEqual(
      ['reasons', 'schemaVersion', 'status', 'uptimeSeconds'].sort()
    )
  })
})
