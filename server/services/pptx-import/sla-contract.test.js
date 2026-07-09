import { describe, expect, it } from 'vitest'
import sla from './sla-contract.js'

const { METRIC_IDS, MILESTONES, getMilestone, phase01RequiresP1Only } = sla

describe('sla-contract (T1.8)', () => {
  it('exports milestone table with phase01 requiring P1 only', () => {
    expect(MILESTONES.phase01).toBeDefined()
    expect(MILESTONES.phase08_full.productOneToOneClaimAllowed).toBe(true)
    expect(phase01RequiresP1Only()).toBe(true)
    expect(getMilestone('phase01').requires).toEqual([METRIC_IDS.P1])
    expect(getMilestone('phase01').originalPptxRequired).toBe(true)
    expect(getMilestone('missing')).toBeNull()
  })

  it('keeps progressive SSIM floors for later phases', () => {
    expect(MILESTONES.phase04.meanSsim).toBe(0.95)
    expect(MILESTONES.phase05.meanSsim).toBe(0.97)
    expect(MILESTONES.phase08_full.meanSsim).toBe(0.99)
    expect(MILESTONES.phase08_full.minSsim).toBe(0.97)
  })
})
