import { describe, expect, it } from 'vitest'
import composite from './composite-run.js'

const { aggregateCompositeRun, normalizeLanes, requiredLaneReasons } = composite

describe('composite claim evidence normalization', () => {
  it('normalizes lane metadata without treating synthetic lane flags as a verdict', () => {
    const result = aggregateCompositeRun({
      claimLevel: 'feature-editability',
      lanes: [{ lane: 'semantic', shard: { index: 1, total: 1 }, result: 'pass' }],
    })
    expect(result.passed).toBe(false)
    expect(result.reasons).toContain('missing-schema-version')
    expect(result.reasons).toContain('missing-trusted-config')
  })

  it('cannot make level 5 available through a synthetic protected-provider lane', () => {
    const result = aggregateCompositeRun({
      claimLevel: 'powerpoint-compatibility-visual-fidelity',
      lanes: [{ lane: 'protected-powerpoint-provider', result: 'pass' }],
    })
    expect(result.passed).toBe(false)
    expect(result.reasons).toContain('missing-trusted-config')
  })

  it('fails closed when required lanes are missing, failed, or have incomplete shards', () => {
    expect(requiredLaneReasons(['native-import'], [])).toEqual(['required-lane-missing:native-import'])
    expect(requiredLaneReasons(['native-import'], [
      { lane: 'native-import', result: 'fail' },
    ])).toEqual(['required-lane-failed:native-import'])
    expect(requiredLaneReasons(['native-import'], [
      { lane: 'native-import', result: 'pass', shard: { index: 1, total: 2 } },
    ])).toEqual(['required-lane-shards-incomplete:native-import'])
    expect(requiredLaneReasons(['native-import'], [
      { lane: 'native-import', result: 'pass', shard: { index: 1, total: 2 } },
      { lane: 'native-import', result: 'pass', shard: { index: 2, total: 2 } },
    ])).toEqual([])
  })

  it('drops malformed lane objects without executing accessors', () => {
    const lane = {}
    Object.defineProperty(lane, 'lane', { get: () => { throw new Error('unexpected getter') } })
    expect(normalizeLanes([lane])).toEqual([])
  })
})
