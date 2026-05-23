import { describe, it, expect } from 'vitest'
import { ELEMENT_DEFAULTS } from './element-defaults'

describe('element-defaults guards README count claim', () => {
  it('exposes exactly 19 element types (matches README "19 element types")', () => {
    expect(Object.keys(ELEMENT_DEFAULTS)).toHaveLength(19)
  })
})
