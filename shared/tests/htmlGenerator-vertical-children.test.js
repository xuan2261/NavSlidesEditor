import { describe, it, expect } from 'vitest'
import { generateRevealHTML } from '../src/htmlGenerator.js'

// LOCK test (Red Team #13): vertical export is ALREADY implemented in
// htmlGenerator (nested <section> when slide.children.length > 0). This guards
// that behavior + confirms child element content is sanitized like the parent.

function deckWithChildren() {
  return {
    id: 'p1',
    title: 'Vertical',
    slides: [
      {
        id: 's1',
        background: { type: 'color', color: '#111' },
        elements: [{ id: 'pa', type: 'text', x: 0, y: 0, width: 200, height: 80, content: '<p>parent</p>' }],
        children: [
          {
            id: 'c1',
            background: { type: 'color', color: '#222' },
            elements: [{ id: 'ca', type: 'text', x: 0, y: 0, width: 200, height: 80, content: '<p>child one</p>' }],
          },
          {
            id: 'c2',
            background: { type: 'color', color: '#333' },
            elements: [{ id: 'cb', type: 'text', x: 0, y: 0, width: 200, height: 80, content: '<p>child two</p>' }],
          },
        ],
      },
    ],
  }
}

describe('generateRevealHTML — vertical children (lock)', () => {
  it('emits a nested vertical <section> stack for slides with children', () => {
    const html = generateRevealHTML(deckWithChildren())
    // A vertical stack wraps the parent + its children in an outer <section>.
    expect(html).toMatch(/<section>\s*<section/)
    expect(html).toContain('parent')
    expect(html).toContain('child one')
    expect(html).toContain('child two')
  })

  it('does NOT wrap flat (childless) decks in an extra vertical section', () => {
    const flat = {
      id: 'p2',
      title: 'Flat',
      slides: [{ id: 's1', elements: [{ id: 'e', type: 'text', x: 0, y: 0, width: 100, height: 50, content: '<p>x</p>' }] }],
    }
    const html = generateRevealHTML(flat)
    // No empty outer <section> immediately followed by another <section>.
    expect(html).not.toMatch(/<section>\s*<section><section/)
  })

  it('sanitizes child element content through the same renderText path (no raw script)', () => {
    const deck = deckWithChildren()
    deck.slides[0].children[0].elements[0].content = '<p>ok</p><script>alert(1)</script>'
    const html = generateRevealHTML(deck)
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})
