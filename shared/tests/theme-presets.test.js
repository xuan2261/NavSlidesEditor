import { describe, it, expect } from 'vitest'
import { THEME_PRESETS, getThemePreset } from '../src/theme-presets.js'
import { COLOR_KEYS } from '../src/design-tokens.js'

// The 11 reveal themes the editor's ThemeGallery exposes.
const KNOWN_REVEAL_THEMES = new Set([
  'black', 'white', 'league', 'beige', 'night',
  'serif', 'simple', 'solarized', 'blood', 'moon', 'dracula',
])

describe('theme-presets', () => {
  it('exposes at least 35 presets', () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(35)
  })

  it('every preset id is unique', () => {
    const ids = THEME_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every preset has id, label, category, tokens, revealTheme', () => {
    for (const p of THEME_PRESETS) {
      expect(p.id, `${p.id} id`).toBeTypeOf('string')
      expect(p.label, `${p.id} label`).toBeTruthy()
      expect(p.category, `${p.id} category`).toBeTruthy()
      expect(p.tokens, `${p.id} tokens`).toBeTypeOf('object')
      expect(p.revealTheme, `${p.id} revealTheme`).toBeTruthy()
    }
  })

  it('every preset tokens validate against the Phase-1 token contract', () => {
    for (const p of THEME_PRESETS) {
      // 6 colors
      for (const key of COLOR_KEYS) {
        expect(p.tokens.colors[key], `${p.id}.colors.${key}`).toBeTruthy()
      }
      // 2 fonts
      expect(p.tokens.fonts.heading, `${p.id}.fonts.heading`).toBeTruthy()
      expect(p.tokens.fonts.body, `${p.id}.fonts.body`).toBeTruthy()
      // radius + spacingScale numbers
      expect(p.tokens.radius, `${p.id}.radius`).toBeTypeOf('number')
      expect(p.tokens.spacingScale, `${p.id}.spacingScale`).toBeTypeOf('number')
    }
  })

  it('every color value is a plausible CSS color (hex / rgb / hsl)', () => {
    const colorRe = /^(#[0-9a-fA-F]{3,8}|rgba?\(.+\)|hsla?\(.+\))$/
    for (const p of THEME_PRESETS) {
      for (const key of COLOR_KEYS) {
        expect(colorRe.test(p.tokens.colors[key]), `${p.id}.${key}=${p.tokens.colors[key]}`).toBe(true)
      }
    }
  })

  it('every revealTheme is a known reveal theme', () => {
    for (const p of THEME_PRESETS) {
      expect(KNOWN_REVEAL_THEMES.has(p.revealTheme), `${p.id} -> ${p.revealTheme}`).toBe(true)
    }
  })

  it('getThemePreset returns the preset by id, or null', () => {
    const first = THEME_PRESETS[0]
    expect(getThemePreset(first.id)).toBe(first)
    expect(getThemePreset('does-not-exist')).toBe(null)
  })
})
