import { describe, expect, it } from 'vitest'
import { buildRunIndex } from './join-run-status.mjs'
import { buildExtendedDomainReport, trustedExtendedRunIndex } from './extended-domain-report.mjs'

const INVENTORY = [
  { id: 'flow.autosave', category: 'flow', risk: 'high', tiers: ['smoke'], scope: 'editor-core' },
  {
    id: 'share.password',
    category: 'share',
    risk: 'high',
    tiers: ['smoke'],
    scope: 'share',
    targetLayer: 'e2e',
    coverageMode: 'executable',
  },
  {
    id: 'ai.failure',
    category: 'ai',
    risk: 'high',
    tiers: ['smoke', 'deep'],
    scope: 'ai',
    targetLayer: 'contract',
    coverageMode: 'contract-only',
  },
]

describe('extended domain report', () => {
  it('reports only non-editor-core capabilities with policy metadata', () => {
    const report = buildExtendedDomainReport({
      inventory: INVENTORY,
      tags: {
        'flow.autosave': [
          { file: 'flow.test.js', title: '[cap:flow.autosave] saves', tier: 'smoke', layer: 'unit', skipped: false },
        ],
        'share.password': [
          { file: 'share.spec.js', title: '[cap:share.password] protects', tier: 'smoke', layer: 'e2e', skipped: false },
        ],
      },
      runIndex: buildRunIndex([
        { file: 'share.spec.js', title: '[cap:share.password] protects', status: 'passed' },
      ]),
    })

    expect(report.rows.map((row) => row.id)).toEqual(['ai.failure', 'share.password'])
    expect(report.rows.find((row) => row.id === 'share.password').status).toBe('PASS')
    expect(report.rows.find((row) => row.id === 'ai.failure').status).toBe('GAP')
    expect(report.policy).toContainEqual({
      id: 'ai.failure',
      scope: 'ai',
      risk: 'high',
      targetLayer: 'contract',
      coverageMode: 'contract-only',
    })
    expect(report.orphans).toEqual([])
  })

  it('downgrades stale run-results to tagged instead of stale PASS', () => {
    const staleRunIndex = buildRunIndex([
      { file: 'share.spec.js', title: '[cap:share.password] protects', status: 'passed' },
    ])
    const report = buildExtendedDomainReport({
      inventory: INVENTORY,
      tags: {
        'share.password': [
          { file: 'share.spec.js', title: '[cap:share.password] protects', tier: 'smoke', layer: 'e2e', skipped: false },
        ],
      },
      runIndex: trustedExtendedRunIndex(staleRunIndex, true),
    })

    expect(report.rows.find((row) => row.id === 'share.password').status).toBe('TAGGED')
    expect(report.summary.PASS || 0).toBe(0)
  })
})
