import { describe, expect, it } from 'vitest'
import { renderElement } from '../src/element-renderers.js'

// Canonical element type list lives in the client factory; mirror the keys here
// (kept in sync by the registry-parity test below).
const CLIENT_ELEMENT_TYPES = [
  'text', 'image', 'shape', 'code', 'latex', 'html', 'markdown', 'chart',
  'video', 'audio', 'table', 'icon', 'callout', 'qrcode', 'drawing', 'line',
  'svg', 'timeline', 'game',
]

const base = { id: 'el-1', x: 0, y: 0, width: 800, height: 400, zIndex: 1 }

describe('element export parity (editor vs reveal/print HTML)', () => {
  it('emits timeline event images as <image> with an escaped href', () => {
    const html = renderElement(
      {
        ...base,
        type: 'timeline',
        timelineStart: '2000',
        timelineEnd: '2025',
        events: [
          { id: 'e1', date: '2010', title: 'Launch', imageUrl: '/uploads/pic.png?a=1&b=2', side: 'top' },
        ],
      },
      {},
      {}
    )
    expect(html).toContain('<image')
    // href present and HTML-escaped (& -> &amp;)
    expect(html).toContain('/uploads/pic.png?a=1&amp;b=2')
    expect(html).not.toContain('a=1&b=2"')
  })

  it('renders a bottom-side timeline event image too', () => {
    const html = renderElement(
      {
        ...base,
        type: 'timeline',
        timelineStart: '2000',
        timelineEnd: '2025',
        events: [
          { id: 'e2', date: '2015', title: 'Below', image: '/uploads/below.png', side: 'bottom' },
        ],
      },
      {},
      {}
    )
    expect(html).toContain('<image')
    expect(html).toContain('/uploads/below.png')
  })

  it('renders a non-empty labeled static block for a game element (never empty, never throws)', () => {
    let html
    expect(() => {
      html = renderElement(
        { ...base, type: 'game', gameType: 'jeopardy', width: 640, height: 480 },
        {},
        {}
      )
    }).not.toThrow()
    expect(html).toBeTruthy()
    expect(html.length).toBeGreaterThan(0)
    // recognizable label + game-type badge
    expect(html.toLowerCase()).toContain('game')
    expect(html).toContain('jeopardy')
  })

  it('escapes game-derived text in the static block', () => {
    const html = renderElement(
      { ...base, type: 'game', gameType: '<script>evil</script>', title: '<img onerror=1>' },
      {},
      {}
    )
    expect(html).not.toContain('<script>evil')
    expect(html).not.toContain('<img onerror')
  })

  it('registry parity: every client element type has a reveal/print renderer', () => {
    for (const type of CLIENT_ELEMENT_TYPES) {
      const html = renderElement({ ...base, type }, {}, {})
      expect(html, `type "${type}" produced empty output`).toBeTruthy()
    }
  })

  it('line marker def ids do not collide when element ids share an 8-char prefix', () => {
    const mk = (id) =>
      renderElement(
        { ...base, id, type: 'line', x1: 0, y1: 10, x2: 100, y2: 10, arrowEnd: 'arrow' },
        {},
        {}
      )
    const a = mk('abcd1234-line-A')
    const b = mk('abcd1234-line-B')
    const idOf = (html) => html.match(/marker id="(me-[^"]+)"/)[1]
    expect(idOf(a)).not.toBe(idOf(b))
  })

  it('svg fillOverride recolors shape paint but leaves gradient defs and url() refs intact', () => {
    const html = renderElement(
      {
        ...base,
        type: 'svg',
        fillOverride: '#00ff00',
        content:
          '<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/></linearGradient></defs><rect fill="#123456" width="10" height="10"/><circle fill="url(#g)" r="5"/></svg>',
      },
      {},
      {}
    )
    // recolored the solid rect
    expect(html).toContain('fill="#00ff00"')
    // gradient stop color preserved (defs untouched)
    expect(html).toContain('stop-color="#ff0000"')
    // url() gradient reference preserved
    expect(html).toContain('fill="url(#g)"')
  })
})
