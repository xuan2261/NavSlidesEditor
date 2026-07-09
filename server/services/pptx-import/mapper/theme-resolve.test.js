import { describe, expect, it } from 'vitest'
import { resolveSchemeColor, resolveColorValue } from './theme-resolve.js'

describe('theme-resolve (T4.1)', () => {
  it('T4.1 schemeClr accent1 → concrete hex', () => {
    expect(resolveSchemeColor('accent1')).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(resolveColorValue('scheme:accent1')).toBe(resolveSchemeColor('accent1'))
    expect(resolveColorValue({ scheme: 'accent1' })).toBe(resolveSchemeColor('accent1'))
  })

  it('passes through already concrete colors', () => {
    expect(resolveColorValue('#ff00aa')).toBe('#ff00aa')
  })
})
