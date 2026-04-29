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

  it('removes dangerous svg nodes and event handlers', () => {
    const safe = sanitizeSvgContent(
      '<svg><script>alert(1)</script><foreignObject></foreignObject><rect onload="x()" width="10" height="10"/></svg>'
    )
    expect(safe).not.toContain('<script')
    expect(safe).not.toContain('<foreignObject')
    expect(safe).not.toContain('onload=')
  })
})
