import { describe, expect, it } from 'vitest'
import { renderElement } from '../src/element-renderers.js'

describe('element-renderers safety behavior', () => {
  const base = {
    id: 'el-1',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    zIndex: 1,
  }

  it('sanitizes text element HTML', () => {
    const html = renderElement(
      { ...base, type: 'text', content: '<p onclick="x()">Hi</p><script>alert(1)</script>' },
      {},
      {}
    )
    expect(html).toContain('<p>Hi</p>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onclick=')
  })

  it('sanitizes dangerous svg content', () => {
    const html = renderElement(
      {
        ...base,
        type: 'svg',
        content:
          '<svg><script>alert(1)</script><foreignObject></foreignObject><rect onload="x()" width="10" height="10" /></svg>',
      },
      {},
      {}
    )
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<foreignObject')
    expect(html).not.toContain('onload=')
  })

  it('keeps html embed scripts intact', () => {
    const html = renderElement(
      { ...base, type: 'html', content: '<script>window.__trusted = true</script>' },
      {},
      {}
    )
    expect(html).toContain('srcdoc=')
    expect(html).toContain('window.__trusted = true')
  })

  it('uses data-pdf-iframe for html embeds in print output', () => {
    const html = renderElement(
      { ...base, type: 'html', content: '<script>window.__trusted = true</script>' },
      {},
      { forPrint: true }
    )

    expect(html).toContain('data-pdf-iframe=')
    expect(html).not.toContain('srcdoc=')
    expect(decodeURIComponent(html.match(/data-pdf-iframe="([^"]+)"/)[1])).toContain(
      'window.__trusted = true'
    )
  })

  it('applies latex font size and color in present and print output', () => {
    const element = {
      ...base,
      type: 'latex',
      content: '\\frac{a}{b}',
      fontSize: 28,
      textColor: '#10b981',
    }

    const presentHtml = renderElement(element, {}, {})
    expect(presentHtml).toContain('font-size:calc(28px * var(--font-zoom, 1))')
    expect(presentHtml).toContain('color:#10b981')

    const printHtml = renderElement(element, {}, { forPrint: true })
    expect(printHtml).toContain('font-size:calc(28px * var(--font-zoom, 1))')
    expect(printHtml).toContain('color:#10b981')
  })

  it('renders video trim and playback rate attributes', () => {
    const html = renderElement(
      {
        ...base,
        type: 'video',
        src: 'https://example.com/demo.ogv',
        startTime: 5,
        endTime: 12,
        playbackRate: 1.25,
      },
      {},
      {}
    )

    expect(html).toContain('src="https://example.com/demo.ogv#t=5,12"')
    expect(html).toContain('onloadedmetadata="this.playbackRate=1.25"')
  })

  it('omits default video trim and playback rate attributes', () => {
    const html = renderElement(
      {
        ...base,
        type: 'video',
        src: 'https://example.com/demo.ogv',
        startTime: 0,
        endTime: 0,
        playbackRate: 1,
      },
      {},
      {}
    )

    expect(html).toContain('src="https://example.com/demo.ogv"')
    expect(html).not.toContain('#t=')
    expect(html).not.toContain('onloadedmetadata=')
  })

  it('keeps invalid video trim end time as start-only media fragment', () => {
    const html = renderElement(
      {
        ...base,
        type: 'video',
        src: 'https://example.com/demo.ogv',
        startTime: 10,
        endTime: 5,
      },
      {},
      {}
    )

    expect(html).toContain('src="https://example.com/demo.ogv#t=10"')
  })
})
