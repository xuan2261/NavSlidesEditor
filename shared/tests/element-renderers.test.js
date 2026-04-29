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
})
