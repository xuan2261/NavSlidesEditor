import { describe, expect, it, beforeEach } from 'vitest'
import {
  getDerivedBlipVariant,
  clearBlipVariantCache,
} from './blip-variant-cache.js'

describe('client blip variant cache', () => {
  beforeEach(() => {
    clearBlipVariantCache()
  })

  it('returns source src unchanged for norm or empty modifier', async () => {
    expect(await getDerivedBlipVariant('/uploads/test.png', 'norm')).toBe('/uploads/test.png')
    expect(await getDerivedBlipVariant('/uploads/test.png')).toBe('/uploads/test.png')
    expect(await getDerivedBlipVariant('')).toBe('')
    expect(await getDerivedBlipVariant(null)).toBe(null)
  })

  it('returns source src for unsupported modifiers without throwing', async () => {
    expect(await getDerivedBlipVariant('/uploads/test.png', 'invalidModifier')).toBe('/uploads/test.png')
  })
})
