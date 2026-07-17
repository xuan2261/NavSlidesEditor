import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import receipts from './local-role-receipts.js'

const { createRoleReceipt, verifyRoleReceiptBundle } = receipts
const hash = (value) => createHash('sha256').update(value).digest('hex')
const subjectHash = hash('exact-local-subject')

function receipt(role, decision = 'approve', id = `receipt-${role}`) {
  return createRoleReceipt({
    receiptId: id,
    role,
    decision,
    subjectHash,
    observedExecutionHash: hash('execution'),
    terminalMachineResultHash: hash('machine-result'),
    owner: { source: 'local-browser-binding', digest: hash('one-owner') },
    authorizationPolicyHash: hash('policy'),
    invocationId: `decision-${role}`,
    decidedAt: '2026-07-17T10:00:00.000Z',
  })
}

describe('honest local role receipts', () => {
  it('allows one disclosed owner only through three distinct immutable role records', () => {
    const bundle = ['app-storage', 'security', 'release'].map((role) => receipt(role))

    expect(verifyRoleReceiptBundle(bundle, {
      subjectHash,
      start: '2026-07-17T09:59:00.000Z',
      publishedAt: '2026-07-17T10:01:00.000Z',
    })).toEqual({ valid: true, verdict: 'approved', reasons: [] })
    expect(new Set(bundle.map((item) => item.receiptId)).size).toBe(3)
    expect(new Set(bundle.map((item) => item.role)).size).toBe(3)
    expect(bundle.every(Object.isFrozen)).toBe(true)
    expect(bundle.every((item) => item.owner.digest === bundle[0].owner.digest)).toBe(true)
  })

  it.each([
    ['aliased receipt', () => [receipt('app-storage'), receipt('security'), receipt('security')], 'duplicate-role-receipt'],
    ['mixed decision', () => [receipt('app-storage'), receipt('security', 'reject'), receipt('release')], 'mixed-role-decisions'],
    ['mismatched subject', () => [
      receipt('app-storage'), receipt('security'), createRoleReceipt({
        receiptId: 'receipt-release', role: 'release', decision: 'approve',
        subjectHash: hash('other-subject'), observedExecutionHash: hash('execution'),
        terminalMachineResultHash: hash('machine-result'),
        owner: { source: 'local-browser-binding', digest: hash('one-owner') },
        authorizationPolicyHash: hash('policy'), invocationId: 'decision-release',
        decidedAt: '2026-07-17T10:00:00.000Z',
      }),
    ], 'role-receipt-subject-mismatch'],
    ['modified receipt', () => {
      const record = receipt('app-storage')
      return [{ ...record, decision: 'reject' }, receipt('security'), receipt('release')]
    }, 'role-receipt-hash-mismatch'],
  ])('rejects %s', (_name, records, reason) => {
    expect(verifyRoleReceiptBundle(records(), {
      subjectHash, start: '2026-07-17T09:59:00.000Z', publishedAt: '2026-07-17T10:01:00.000Z',
    }).reasons).toContain(reason)
  })

  it('keeps a uniformly rejected bundle immutable without changing lower claims', () => {
    const bundle = ['app-storage', 'security', 'release'].map((role) => receipt(role, 'reject'))
    expect(verifyRoleReceiptBundle(bundle, {
      subjectHash, start: '2026-07-17T09:59:00.000Z', publishedAt: '2026-07-17T10:01:00.000Z',
    })).toEqual({ valid: true, verdict: 'rejected', reasons: [] })
  })

  it('requires a bounded decision window and unique receipt invocation IDs', () => {
    const bundle = ['app-storage', 'security', 'release'].map((role) => receipt(role))
    expect(verifyRoleReceiptBundle(bundle, { subjectHash }).reasons)
      .toContain('invalid-role-receipt-window')

    const duplicateInvocation = [
      bundle[0],
      { ...bundle[1], invocationId: bundle[0].invocationId },
      bundle[2],
    ]
    expect(verifyRoleReceiptBundle(duplicateInvocation, {
      subjectHash, start: '2026-07-17T09:59:00.000Z', publishedAt: '2026-07-17T10:01:00.000Z',
    }).reasons).toContain('duplicate-receipt-invocation')
  })
})
