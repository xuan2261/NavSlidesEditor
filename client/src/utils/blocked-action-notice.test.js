import { describe, expect, it } from 'vitest'
import { getBlockedActionNotice } from './blocked-action-notice'

describe('getBlockedActionNotice', () => {
  it('returns stable message for group-locked reason', () => {
    expect(getBlockedActionNotice('group-locked')).toMatch(/group.*locked/i)
  })

  it('returns stable message for element-locked reason', () => {
    expect(getBlockedActionNotice('element-locked')).toMatch(/locked/i)
  })

  it('returns fallback for unknown reason', () => {
    expect(getBlockedActionNotice('other')).toBe('Action blocked')
  })
})
