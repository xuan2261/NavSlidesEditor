import { afterEach, describe, expect, it } from 'vitest'
import { baseBranch, branch, cleanupLeaseFixtures, leaseFixture } from './electron-lock-refresh-test-support.js'

afterEach(cleanupLeaseFixtures)

// Accepted contract: refresh the one automation ref from a shallow default-branch checkout,
// but never overwrite a winner that changes that ref after observation, even after a background fetch.
describe('Electron lock refresh workflow against a local Git origin', () => {
  it('updates an existing automation branch from a fresh shallow default-branch checkout', () => {
    const fixture = leaseFixture({ existing: true })
    expect(fixture.trackingRefs()).not.toContain(`refs/remotes/origin/${branch}`)
    const result = fixture.run({ openPr: '41' })
    expect(result.status, result.stderr).toBe(0)
    expect(fixture.remoteTip()).toBe(fixture.checkoutTip())
    expect(fixture.remoteTip()).not.toBe(fixture.originalTip)
    expect(fixture.remoteLock()).toBe('refreshed lock')
    expect(fixture.baseTipAfter()).toBe(fixture.baseTip)
    expect(fixture.ghCalls()).toHaveLength(1)
    expect(fixture.ghCalls()[0]).toContain(`pr list --head ${branch} --base ${baseBranch}`)
  }, 30000)

  it('admits an observed absent automation branch and creates its refresh PR', () => {
    const fixture = leaseFixture()
    expect(fixture.originalTip).toBeNull()
    const result = fixture.run()
    expect(result.status, result.stderr).toBe(0)
    expect(fixture.remoteTip()).toBe(fixture.checkoutTip())
    expect(fixture.remoteLock()).toBe('refreshed lock')
    expect(fixture.baseTipAfter()).toBe(fixture.baseTip)
    expect(fixture.ghCalls()).toHaveLength(2)
    expect(fixture.ghCalls()[1]).toContain('pr create ')
    expect(fixture.ghCalls()[1]).toContain(`--base ${baseBranch} --head ${branch}`)
  }, 30000)

  it.each([false, true])('rejects a concurrent winner after observation and tracking fetch (existing=%s)', (existing) => {
    const fixture = leaseFixture({ existing })
    const result = fixture.run({ concurrent: true })
    expect(result.status, result.stderr).not.toBe(0)
    expect(fixture.remoteTip()).toBe(fixture.winnerTip())
    expect(fixture.remoteLock()).toBe('concurrent winner lock')
    expect(fixture.remoteTip()).not.toBe(fixture.checkoutTip())
    expect(fixture.baseTipAfter()).toBe(fixture.baseTip)
    expect(fixture.ghCalls()).toEqual([])
  }, 30000)

  it('does not push or contact the PR API when the lock has no diff', () => {
    const fixture = leaseFixture({ existing: true, changed: false })
    const result = fixture.run()
    expect(result.status, result.stderr).toBe(0)
    expect(fixture.remoteTip()).toBe(fixture.originalTip)
    expect(fixture.checkoutTip()).toBe(fixture.baseTip)
    expect(fixture.baseTipAfter()).toBe(fixture.baseTip)
    expect(fixture.ghCalls()).toEqual([])
  }, 30000)

  it('does not mistake an unreachable origin for an absent automation branch', () => {
    const fixture = leaseFixture({ existing: true })
    fixture.disconnectOrigin()
    const result = fixture.run()
    expect(result.status, result.stderr).not.toBe(0)
    expect(fixture.remoteTip()).toBe(fixture.originalTip)
    expect(fixture.checkoutTip()).toBe(fixture.baseTip)
    expect(fixture.baseTipAfter()).toBe(fixture.baseTip)
    expect(fixture.ghCalls()).toEqual([])
  }, 30000)

  it('fails closed when PR creation is denied after the local-origin refresh push', () => {
    const fixture = leaseFixture()
    const result = fixture.run({ denyPr: true })
    expect(result.status, result.stderr).toBe(1)
    expect(fixture.remoteTip()).toBe(fixture.checkoutTip())
    expect(fixture.baseTipAfter()).toBe(fixture.baseTip)
    expect(fixture.ghCalls()).toHaveLength(2)
    expect(fixture.ghCalls()[1]).toContain('pr create ')
  }, 30000)

  it('uses the resolved non-main default branch without changing repository policy', () => {
    const fixture = leaseFixture()
    const policy = fixture.run({ step: 'Resolve repository default branch without changing permissions' })
    expect(policy.status, policy.stderr).toBe(0)
    expect(fixture.outputs()).toBe(`base=${baseBranch}\n`)
    const refresh = fixture.run()
    expect(refresh.status, refresh.stderr).toBe(0)
    expect(fixture.ghCalls()[0]).toBe("repo view fixture/navslides --json defaultBranchRef --jq .defaultBranchRef.name")
    expect(fixture.ghCalls()[2]).toContain(`--base ${baseBranch} --head ${branch}`)
    expect(fixture.baseTipAfter()).toBe(fixture.baseTip)
  }, 30000)
})
