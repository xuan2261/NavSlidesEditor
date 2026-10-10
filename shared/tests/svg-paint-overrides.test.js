import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'

const require = createRequire(import.meta.url)
const { applySvgPaintOverrides } = require('../src/svg-paint-overrides.js')
const { DOMParser } = new JSDOM('').window
const overrides = { fillOverride: '#22c55e', strokeOverride: '#123456' }
const parse = (source, paints = overrides) => {
  const document = new DOMParser().parseFromString(
    applySvgPaintOverrides(
      source.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"'),
      paints
    ),
    'image/svg+xml'
  )
  expect(document.querySelector('parsererror')).toBeNull()
  return document
}

describe('SVG paint overrides', () => {
  it('supplies inherited paint for unpainted shapes without changing geometry', () => {
    const document = parse(
      '<svg viewBox="0 0 24 24"><path d="M0 0L9 9" style="opacity:.5"/><circle cx="2" cy="3" r="1"/></svg>'
    )
    const svg = document.documentElement
    expect(svg.getAttribute('fill')).toBe('#22c55e')
    expect(svg.getAttribute('stroke')).toBe('#123456')
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(document.querySelector('path').getAttribute('d')).toBe('M0 0L9 9')
    expect(document.querySelector('path').getAttribute('style')).toBe('opacity:.5')
    expect(document.querySelector('circle').getAttribute('cx')).toBe('2')
    expect(document.querySelector('circle').getAttribute('r')).toBe('1')
  })

  it.each(['"', "'"])(
    'overrides explicit paints and preserves inline priority with %s quotes',
    (quote) => {
      const document = parse(
        `<svg fill=${quote}#333${quote}><path fill=${quote}#444${quote} stroke=${quote}#555${quote} style=${quote}fill:rgb(1,2,3) !important;stroke:#666 !important;opacity:.5${quote}/></svg>`
      )
      const path = document.querySelector('path')
      expect(document.documentElement.getAttribute('fill')).toBe('#22c55e')
      expect(path.getAttribute('fill')).toBe('#22c55e')
      expect(path.getAttribute('stroke')).toBe('#123456')
      expect(path.style.getPropertyValue('fill')).toBe('#22c55e')
      expect(path.style.getPropertyPriority('fill')).toBe('important')
      expect(path.style.getPropertyValue('stroke')).toBe('#123456')
      expect(path.style.getPropertyPriority('stroke')).toBe('important')
      expect(path.style.opacity).toBe('0.5')
    }
  )

  it('preserves gradients, nested definitions, stylesheets, and authored metadata', () => {
    const document = parse(
      `<svg><style>.a{fill:#111;stroke:#222}</style><defs fill="#333"><linearGradient id="g"><stop stop-color="#444"/></linearGradient><defs><path fill="#555"/></defs></defs><path data-fill="#666" aria-label="fill=red" fill="url(#g)" stroke-width="2" fill-opacity=".4" d="M0 0L9 9"/></svg>`
    )
    expect(document.querySelector('style').textContent).toBe('.a{fill:#111;stroke:#222}')
    expect(document.querySelector('defs').getAttribute('fill')).toBe('#333')
    expect(document.querySelector('defs path').getAttribute('fill')).toBe('#555')
    expect(document.querySelector('stop').getAttribute('stop-color')).toBe('#444')
    const path = document.querySelector('svg > path')
    expect(path.getAttribute('fill')).toBe('url(#g)')
    expect(path.getAttribute('data-fill')).toBe('#666')
    expect(path.getAttribute('aria-label')).toBe('fill=red')
    expect(path.getAttribute('stroke-width')).toBe('2')
    expect(path.getAttribute('fill-opacity')).toBe('.4')
  })

  it.each([
    'url(#gradient)',
    ' URL( #gradient ) #fff ',
    "uRl( '#gradient' ) rgb(1, 2, 3)",
    'url( &quot;#gradient&quot; ) none',
  ])('preserves referenced paint %s', (paint) => {
    const document = parse(`<svg><path fill="${paint}" stroke="${paint}"/></svg>`)
    const original = new DOMParser()
      .parseFromString(`<svg><path fill="${paint}" stroke="${paint}"/></svg>`, 'image/svg+xml')
      .querySelector('path')
    expect(document.querySelector('path').getAttribute('fill')).toBe(original.getAttribute('fill'))
    expect(document.querySelector('path').getAttribute('stroke')).toBe(
      original.getAttribute('stroke')
    )
  })

  it('keeps quoted URL styles and paint-looking metadata out of attribute parsing', () => {
    const document = parse(
      `<svg><path data-note=" fill='#111' stroke='#222' style='fill:#333' &gt;" fill='url("#g") #fff' style='stroke:URL("#g") none;fill:#444;--note:"x;fill:#555"'/></svg>`
    )
    const path = document.querySelector('path')
    expect(path.getAttribute('fill')).toBe('url("#g") #fff')
    expect(path.getAttribute('data-note')).toBe(" fill='#111' stroke='#222' style='fill:#333' >")
    expect(path.getAttribute('style')).toContain('stroke:URL("#g") none')
    expect(path.getAttribute('style')).toContain('fill:#22c55e')
    expect(path.getAttribute('style')).toContain('--note:"x;fill:#555"')
  })

  it.each([
    '#abc',
    '#abcd',
    '#aabbcc',
    '#aabbccdd',
    'rgb(1, 2, 3)',
    'rgba(1,2,3,.5)',
    'hsl(120deg,50%,50%)',
    'hsla(120,50%,50%,.5)',
    'transparent',
    'currentColor',
    'none',
  ])('admits safe paint %s without altering unrelated content', (color) => {
    const document = parse('<svg><path fill="#333" d="M0 0L9 9"/></svg>', {
      fillOverride: ` ${color} `,
    })
    expect(document.documentElement.getAttribute('fill')).toBe(color)
    expect(document.querySelector('path').getAttribute('fill')).toBe(color)
    expect(document.querySelector('path').getAttribute('d')).toBe('M0 0L9 9')
  })

  it.each([
    'red',
    'var(--paint)',
    'url(#gradient)',
    '#ggg',
    'CURRENTCOLOR',
    'None',
    'rgb(1 2 3 / .5)',
    `#333' onload='alert(1)`,
    '#333" onload="alert(1)',
    '#333;stroke:red',
    '$&',
    '$1',
    '$`',
    "$'",
    '<script>alert(1)</script>',
    null,
    123,
    {},
  ])('rejects invalid paint %s without creating markup or rewriting authored paint', (value) => {
    const document = parse(
      '<svg><path fill="#333" stroke="#444" style="fill:#555;stroke:#666"/></svg>',
      { fillOverride: value, strokeOverride: value }
    )
    expect(document.documentElement.getAttribute('fill')).toBeNull()
    expect(document.querySelector('path').getAttribute('fill')).toBe('#333')
    expect(document.querySelector('path').getAttribute('stroke')).toBe('#444')
    expect(document.querySelector('path').style.getPropertyValue('fill')).toBe('#555')
    expect(document.querySelector('script,[onload]')).toBeNull()
  })

  it('admits one valid paint independently and restores authored paints when cleared', () => {
    const source = '<svg><path fill="#333" stroke="#444"/></svg>'
    const changed = parse(source, { fillOverride: 'red', strokeOverride: '#abc' })
    expect(changed.querySelector('path').getAttribute('fill')).toBe('#333')
    expect(changed.querySelector('path').getAttribute('stroke')).toBe('#abc')
    const cleared = parse(source, { fillOverride: '', strokeOverride: undefined })
    expect(cleared.documentElement.getAttribute('fill')).toBeNull()
    expect(cleared.querySelector('path').getAttribute('fill')).toBe('#333')
    expect(cleared.querySelector('path').getAttribute('stroke')).toBe('#444')
  })
})
