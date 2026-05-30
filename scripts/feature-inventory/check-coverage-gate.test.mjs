import { describe, it, expect } from 'vitest'
import { checkGate } from './check-coverage-gate.mjs'

const PASS_ROW = { id: 'element.chart', status: 'PASS' }
const GAP_ROW = { id: 'canvas.move', status: 'GAP' }
const SKIP_ROW = { id: 'control.format.bold', status: 'SKIP' }
const TAGGED_ROW = { id: 'element.audio', status: 'TAGGED' }
const FAIL_ROW = { id: 'flow.clipboard', status: 'FAIL' }
const ALLOWED_ROW = { id: 'canvas.lock', status: 'ALLOWED' }

const NOW = new Date('2026-05-30T00:00:00Z').getTime()
const validEntry = (id, added = '2026-05-30') => ({
  id,
  reason: 'deferred — tracked',
  added,
  owner: 'qa',
})

describe('coverage gate decision logic', () => {
  it('exits ok when every row is PASS', () => {
    const r = checkGate({ rows: [PASS_ROW], orphans: [], allowlist: [], now: NOW })
    expect(r.ok).toBe(true)
    expect(r.failures).toEqual([])
  })

  it('fails on an un-allowlisted GAP', () => {
    const r = checkGate({ rows: [PASS_ROW, GAP_ROW], orphans: [], allowlist: [], now: NOW })
    expect(r.ok).toBe(false)
    expect(r.failures.some((f) => f.includes('canvas.move'))).toBe(true)
  })

  it('warns (does not fail) on the same GAP when allowlisted', () => {
    const r = checkGate({
      rows: [PASS_ROW, GAP_ROW],
      orphans: [],
      allowlist: [validEntry('canvas.move')],
      now: NOW,
    })
    expect(r.ok).toBe(true)
    expect(r.warnings.some((w) => w.includes('canvas.move'))).toBe(true)
  })

  it('fails on an ORPHAN-TAG', () => {
    const r = checkGate({ rows: [PASS_ROW], orphans: ['element.bogus'], allowlist: [], now: NOW })
    expect(r.ok).toBe(false)
    expect(r.failures.some((f) => f.includes('element.bogus'))).toBe(true)
  })

  it('rejects an allowlist entry missing a reason', () => {
    const r = checkGate({
      rows: [GAP_ROW],
      orphans: [],
      allowlist: [{ id: 'canvas.move', added: '2026-05-30' }],
      now: NOW,
    })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes('reason'))).toBe(true)
  })

  it('warns on an allowlist entry older than the staleness threshold', () => {
    const r = checkGate({
      rows: [GAP_ROW],
      orphans: [],
      allowlist: [validEntry('canvas.move', '2026-01-01')], // ~5 months old
      now: NOW,
    })
    expect(r.ok).toBe(true)
    expect(r.warnings.some((w) => /stale|old/i.test(w))).toBe(true)
  })

  it('fails on un-allowlisted SKIP and TAGGED (never silently green)', () => {
    const r = checkGate({
      rows: [SKIP_ROW, TAGGED_ROW],
      orphans: [],
      allowlist: [],
      now: NOW,
    })
    expect(r.ok).toBe(false)
    expect(r.failures.some((f) => f.includes('control.format.bold'))).toBe(true)
    expect(r.failures.some((f) => f.includes('element.audio'))).toBe(true)
  })

  it('always fails on FAIL even if the id is on the allowlist', () => {
    const r = checkGate({
      rows: [FAIL_ROW],
      orphans: [],
      allowlist: [validEntry('flow.clipboard')],
      now: NOW,
    })
    expect(r.ok).toBe(false)
    expect(r.failures.some((f) => f.includes('flow.clipboard'))).toBe(true)
  })

  it('treats a pre-applied ALLOWED row as a warning', () => {
    const r = checkGate({ rows: [ALLOWED_ROW], orphans: [], allowlist: [validEntry('canvas.lock')], now: NOW })
    expect(r.ok).toBe(true)
    expect(r.warnings.some((w) => w.includes('canvas.lock'))).toBe(true)
  })
})
