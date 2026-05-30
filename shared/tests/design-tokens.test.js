import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TOKENS,
  AUTO_FIELD_MAP,
  resolveAutoColor,
  resolveColorField,
  isTokenVar,
  tokensToCssVars,
} from '../src/design-tokens.js'

describe('design-tokens', () => {
  describe('DEFAULT_TOKENS mirrors current hardcoded defaults', () => {
    it('accent mirrors shape.fill default #6366f1', () => {
      expect(DEFAULT_TOKENS.colors.accent).toBe('#6366f1')
    })
    it('text mirrors the white default #ffffff', () => {
      expect(DEFAULT_TOKENS.colors.text).toBe('#ffffff')
    })
    it('bg mirrors the slide print fallback #1e1e2e', () => {
      expect(DEFAULT_TOKENS.colors.bg).toBe('#1e1e2e')
    })
    it('has all 6 documented color tokens', () => {
      for (const key of ['bg', 'surface', 'accent', 'accent2', 'text', 'muted']) {
        expect(DEFAULT_TOKENS.colors[key]).toBeTruthy()
      }
    })
    it('has 2 fonts, radius, spacingScale', () => {
      expect(DEFAULT_TOKENS.fonts.heading).toBeTruthy()
      expect(DEFAULT_TOKENS.fonts.body).toBeTruthy()
      expect(DEFAULT_TOKENS.radius).toBeTypeOf('number')
      expect(DEFAULT_TOKENS.spacingScale).toBeTypeOf('number')
    })
  })

  describe('resolveAutoColor', () => {
    it('shape.fill -> var(--ns-accent)', () => {
      expect(resolveAutoColor('shape', 'fill')).toBe('var(--ns-accent)')
    })
    it('shape.stroke -> var(--ns-accent2)', () => {
      expect(resolveAutoColor('shape', 'stroke')).toBe('var(--ns-accent2)')
    })
    it('text.textColor -> var(--ns-text)', () => {
      expect(resolveAutoColor('text', 'textColor')).toBe('var(--ns-text)')
    })
    it('table.textColor -> var(--ns-text)', () => {
      expect(resolveAutoColor('table', 'textColor')).toBe('var(--ns-text)')
    })
    it('table.headerBgColor -> var(--ns-accent)', () => {
      expect(resolveAutoColor('table', 'headerBgColor')).toBe('var(--ns-accent)')
    })
    it('table.cellBgColor -> var(--ns-surface)', () => {
      expect(resolveAutoColor('table', 'cellBgColor')).toBe('var(--ns-surface)')
    })
    it('icon.iconColor -> var(--ns-text)', () => {
      expect(resolveAutoColor('icon', 'iconColor')).toBe('var(--ns-text)')
    })
    it('unknown (type, field) -> safe var(--ns-text) fallback, no throw', () => {
      expect(resolveAutoColor('nope', 'nada')).toBe('var(--ns-text)')
      expect(resolveAutoColor('shape', 'mysteryField')).toBe('var(--ns-text)')
    })
  })

  describe('resolveColorField', () => {
    it("returns var for the 'auto' sentinel", () => {
      expect(resolveColorField('auto', 'shape', 'fill')).toBe('var(--ns-accent)')
    })
    it('passes frozen hex through untouched', () => {
      expect(resolveColorField('#abcdef', 'shape', 'fill')).toBe('#abcdef')
    })
    it('passes rgba through untouched', () => {
      expect(resolveColorField('rgba(1,2,3,0.5)', 'table', 'borderColor')).toBe('rgba(1,2,3,0.5)')
    })
    it('passes undefined through untouched', () => {
      expect(resolveColorField(undefined, 'shape', 'fill')).toBe(undefined)
    })
  })

  describe('isTokenVar', () => {
    it('accepts our var shape', () => {
      expect(isTokenVar('var(--ns-accent)')).toBe(true)
      expect(isTokenVar('var(--ns-accent2)')).toBe(true)
    })
    it('rejects arbitrary css vars and other values', () => {
      expect(isTokenVar('var(--evil)')).toBe(false)
      expect(isTokenVar('#fff')).toBe(false)
      expect(isTokenVar('red')).toBe(false)
      expect(isTokenVar(undefined)).toBe(false)
    })
  })

  describe('tokensToCssVars', () => {
    it('contains all 6 colors for DEFAULT_TOKENS', () => {
      const css = tokensToCssVars(DEFAULT_TOKENS)
      expect(css).toContain('--ns-bg:#1e1e2e')
      expect(css).toContain('--ns-surface:')
      expect(css).toContain('--ns-accent:#6366f1')
      expect(css).toContain('--ns-accent2:')
      expect(css).toContain('--ns-text:#ffffff')
      expect(css).toContain('--ns-muted:')
    })
    it('emits font + radius vars', () => {
      const css = tokensToCssVars(DEFAULT_TOKENS)
      expect(css).toContain('--ns-font-heading:')
      expect(css).toContain('--ns-font-body:')
      expect(css).toContain('--ns-radius:8px')
    })
    it('falls back to DEFAULT_TOKENS when given nothing', () => {
      expect(tokensToCssVars(undefined)).toContain('--ns-accent:#6366f1')
    })
    it('only emits provided colors for a partial override', () => {
      const css = tokensToCssVars({ colors: { accent: '#e11d48' } })
      expect(css).toContain('--ns-accent:#e11d48')
      expect(css).not.toContain('--ns-bg')
    })
  })

  describe('AUTO_FIELD_MAP integrity', () => {
    it('every mapped token name exists in DEFAULT_TOKENS.colors', () => {
      for (const type of Object.keys(AUTO_FIELD_MAP)) {
        for (const field of Object.keys(AUTO_FIELD_MAP[type])) {
          const token = AUTO_FIELD_MAP[type][field]
          expect(DEFAULT_TOKENS.colors[token]).toBeTruthy()
        }
      }
    })
  })
})
