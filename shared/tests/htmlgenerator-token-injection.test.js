import { describe, it, expect } from 'vitest'
import { generateRevealHTML } from '../src/htmlGenerator.js'

/**
 * Token injection: a deck that uses designTokens or 'auto' elements must get a
 * :root{--ns-*} block, per-slide overrides keyed by data-slide-idx, and 'auto'
 * color fields resolved to var(--ns-*) in BOTH the string renderers and SVG.
 *
 * The 'auto' table fixture is the canary for the 4th safeCssColor copy.
 */

const tokenDeck = {
  title: 'Token Deck',
  theme: 'black',
  designTokens: { colors: { accent: '#e11d48', text: '#0f172a' } },
  slides: [
    {
      id: 's1',
      elements: [
        { type: 'shape', shape: 'rect', x: 10, y: 10, width: 100, height: 80, zIndex: 1, fill: 'auto', stroke: 'auto' },
        { type: 'text', content: '<p>Hi</p>', x: 10, y: 100, width: 200, height: 60, zIndex: 1, textColor: 'auto' },
        {
          type: 'table', x: 10, y: 200, width: 300, height: 120, zIndex: 2,
          data: [['H1', 'H2'], ['a', 'b']], headerRow: true,
          headerBgColor: 'auto', cellBgColor: 'auto', borderColor: 'auto', textColor: 'auto', fontSize: 14, cellPadding: 8,
        },
      ],
    },
    {
      id: 's2',
      designTokens: { colors: { accent: '#16a34a' } },
      elements: [
        { type: 'shape', shape: 'circle', x: 10, y: 10, width: 80, height: 80, zIndex: 1, fill: 'auto' },
      ],
    },
  ],
}

describe('htmlGenerator token injection', () => {
  const html = generateRevealHTML(tokenDeck)

  it('emits a :root token block with deck accent + text', () => {
    expect(html).toContain('--ns-accent:#e11d48')
    expect(html).toContain('--ns-text:#0f172a')
    expect(html).toMatch(/:root\s*\{[^}]*--ns-accent/)
  })

  it("resolves shape fill:'auto' to var(--ns-accent) via style (SVG attr cannot resolve vars)", () => {
    expect(html).toContain('fill:var(--ns-accent)')
    expect(html).toContain('stroke:var(--ns-accent2)')
  })

  it("resolves text textColor:'auto' to var(--ns-text)", () => {
    expect(html).toContain('color:var(--ns-text)')
  })

  it("resolves table 'auto' cells to token vars (canary for 4th safeCssColor copy)", () => {
    expect(html).toContain('background:var(--ns-accent)') // header bg
    expect(html).toContain('var(--ns-surface)') // cell bg
    expect(html).toContain('var(--ns-muted)') // border color
  })

  it('adds data-slide-idx attr only to slides with per-slide overrides', () => {
    expect(html).toContain('data-slide-idx="1"') // s2 has override
    expect(html).not.toContain('data-slide-idx="0"') // s1 has no override
  })

  it('emits a per-slide override block keyed by data-slide-idx', () => {
    expect(html).toMatch(/\[data-slide-idx="1"\]\s*\{[^}]*--ns-accent:#16a34a/)
  })

  it('merges deck tokens into per-slide block (inherits non-overridden text)', () => {
    // s2 only overrides accent; text should still be the deck-level #0f172a
    expect(html).toMatch(/\[data-slide-idx="1"\]\s*\{[^}]*--ns-text:#0f172a/)
  })
})

describe('htmlGenerator: deck with NO tokens stays clean', () => {
  it('does not inject any --ns- vars for a frozen-hex deck', () => {
    const html = generateRevealHTML({
      title: 'Plain',
      slides: [{ id: 'x', elements: [{ type: 'text', content: 'hi', x: 0, y: 0, width: 100, height: 50, textColor: '#fff' }] }],
    })
    expect(html).not.toContain('--ns-')
    expect(html).not.toContain('data-slide-idx')
  })
})
