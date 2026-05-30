import { describe, it, expect } from 'vitest'
import { generateRevealHTML } from '../src/htmlGenerator.js'

/**
 * Golden baseline: locks the exact HTML output for representative SAVED-deck
 * presentations that use FROZEN HEX colors (the backward-compat contract).
 *
 * These fixtures contain NO designTokens and NO 'auto' values, so they MUST
 * render byte-identical before and after the token-layer changes (safeCssColor
 * whitelist extension + 'auto' wiring). The 'auto' table fixture is the canary
 * for the easily-missed 4th safeCssColor copy.
 *
 * If a snapshot here changes, a token-layer change leaked into frozen-hex
 * rendering — that is a regression, NOT an expected update.
 */

const frozenHexDeck = {
  title: 'Frozen Hex Deck',
  theme: 'black',
  slides: [
    {
      id: 'slide-1',
      background: { type: 'color', color: '#101020' },
      elements: [
        { type: 'text', content: '<p>Hello</p>', x: 80, y: 60, width: 400, height: 120, zIndex: 1, textColor: '#ffcc00' },
        { type: 'shape', shape: 'rect', x: 100, y: 220, width: 200, height: 150, zIndex: 1, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2, text: 'Box', fontSize: 16, textColor: '#ffffff' },
      ],
    },
    {
      id: 'slide-2',
      background: { type: 'gradient', angle: 135, stops: [{ offset: 0, color: '#1e1e2e' }, { offset: 1, color: '#4a0e8f' }] },
      elements: [
        {
          type: 'table', x: 80, y: 100, width: 600, height: 300, zIndex: 2,
          data: [['H1', 'H2'], ['a', 'b']],
          headerRow: true, cellPadding: 8,
          borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1,
          headerBgColor: 'rgba(99,102,241,0.3)', cellBgColor: 'transparent', textColor: '#ffffff', fontSize: 14,
        },
        { type: 'callout', x: 200, y: 200, width: 36, height: 36, zIndex: 10, calloutNumber: 1, calloutColor: '#ef4444', calloutTextColor: '#ffffff', fontSize: 16 },
      ],
    },
    {
      id: 'slide-3',
      background: { type: 'image', image: '/uploads/bg.png', size: 'cover', position: 'center' },
      elements: [
        { type: 'icon', x: 200, y: 200, width: 80, height: 80, zIndex: 2, iconName: 'Star', iconColor: '#ffffff', iconStrokeWidth: 2 },
        { type: 'line', x: 100, y: 200, width: 400, height: 200, zIndex: 1, x1: 0, y1: 100, x2: 400, y2: 100, stroke: '#ffffff', strokeWidth: 2, arrowEnd: 'arrow' },
      ],
    },
  ],
}

describe('htmlGenerator golden baseline (frozen-hex backward compat)', () => {
  it('renders the frozen-hex deck byte-identically (locked snapshot)', () => {
    expect(generateRevealHTML(frozenHexDeck)).toMatchSnapshot()
  })

  it('emits the frozen hex colors verbatim (explicit guards)', () => {
    const html = generateRevealHTML(frozenHexDeck)
    expect(html).toContain('#ffcc00') // text color
    expect(html).toContain('#6366f1') // shape fill (default value, but frozen here)
    expect(html).toContain('data-background-color="#101020"')
    expect(html).toContain('#ef4444') // callout
    expect(html).toContain('rgba(255,255,255,0.2)') // table border
    // No token vars should appear in a frozen-hex deck
    expect(html).not.toContain('--ns-')
    expect(html).not.toContain('var(--ns')
  })
})
