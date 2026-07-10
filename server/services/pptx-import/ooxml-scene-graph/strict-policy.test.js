import { describe, expect, it } from 'vitest'
import { resolveSceneGraphStrictPolicy } from './strict-policy.js'

describe('scene graph strict policy', () => {
  it('canonical strict mode implies both count and authoritative node gates', () => {
    expect(resolveSceneGraphStrictPolicy({ strict: true })).toEqual({
      strict: true,
      strictCountGate: true,
      strictNodeGate: true,
    })
  })

  it('allows explicit gates without enabling canonical strict mode', () => {
    expect(resolveSceneGraphStrictPolicy({ strictCountGate: true })).toEqual({
      strict: false,
      strictCountGate: true,
      strictNodeGate: false,
    })
  })
})
