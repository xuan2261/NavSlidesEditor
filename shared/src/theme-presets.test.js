import { describe, expect, it } from 'vitest'
import themePresets from './theme-presets.js'

const {
  BASE_REVEAL_THEME_PRESET_IDS,
  SUPPORTED_REVEAL_THEMES,
  getDesignTokensForRevealTheme,
} = themePresets

describe('supported Reveal theme catalog', () => {
  it('owns the complete ordered selector contract', () => {
    expect(SUPPORTED_REVEAL_THEMES).toEqual([
      'black',
      'white',
      'league',
      'beige',
      'sky',
      'night',
      'serif',
      'simple',
      'solarized',
      'blood',
      'moon',
      'dracula',
    ])
    expect(Object.isFrozen(SUPPORTED_REVEAL_THEMES)).toBe(true)
    expect(SUPPORTED_REVEAL_THEMES).toEqual(Object.keys(BASE_REVEAL_THEME_PRESET_IDS))
  })

  it('maps every supported theme to design tokens', () => {
    for (const theme of SUPPORTED_REVEAL_THEMES) {
      expect(getDesignTokensForRevealTheme(theme), theme).toMatchObject({
        colors: expect.any(Object),
        fonts: expect.any(Object),
      })
    }
  })
})
