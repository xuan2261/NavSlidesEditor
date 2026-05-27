import { describe, expect, it } from 'vitest'
import { sanitizeRichTextHtml, sanitizeSvgContent } from './content-safety'

describe('content safety helpers', () => {
  it('removes script tags and event attributes from rich text html', () => {
    const safe = sanitizeRichTextHtml(
      '<p onclick="alert(1)">Hi</p><script>alert(2)</script><a href="javascript:alert(1)">x</a>'
    )
    expect(safe).not.toContain('<script')
    expect(safe).not.toContain('onclick=')
    expect(safe).toContain('href="#"')
  })

  it('normalizes legacy pptx pt styles and removes unsafe css', () => {
    const safe = sanitizeRichTextHtml(
      '<p style="font-size: 40pt; letter-spacing: 2pt; position:absolute; background:url(https://example.test/x.png); color: expression(alert(1))">Hi</p>'
    )

    expect(safe).toContain('font-size: 53.3px')
    expect(safe).toContain('letter-spacing: 2.7px')
    expect(safe).not.toContain('position')
    expect(safe).not.toContain('url(')
    expect(safe).not.toContain('expression')
  })

  it('preserves editor line-height highlight and tel links', () => {
    const safe = sanitizeRichTextHtml(
      '<p style="line-height: 1.5"><span style="line-height: 30.87pt; background-color: #fef08a"><a href="tel:+1234567890">Call</a></span></p>'
    )

    expect(safe).toContain('line-height: 1.5')
    expect(safe).toContain('line-height: 41.2px')
    expect(safe).toContain('background-color: #fef08a')
    expect(safe).toContain('href="tel:+1234567890"')
  })

  it('removes dangerous svg nodes and event handlers', () => {
    const safe = sanitizeSvgContent(
      '<svg><script>alert(1)</script><foreignObject></foreignObject><rect onload="x()" width="10" height="10"/></svg>'
    )
    expect(safe).not.toContain('<script')
    expect(safe).not.toContain('<foreignObject')
    expect(safe).not.toContain('onload=')
  })
})
