import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { sanitizeRichTextHtml } = require('../src/content-safety.js')
function paragraph(style) {
  return new JSDOM(
    sanitizeRichTextHtml(`<p style="${style}">Content</p>`)
  ).window.document.querySelector('p')
}
describe('native paragraph style admission', () => {
  it('preserves bounded source lengths and an inert stop list', () => {
    const p = paragraph(
      'padding-top:4px;padding-bottom:0.5em;text-indent:-36px;margin-left:12px;white-space:pre-wrap;tab-size:72px;--pptx-tab-stops:90:l,180:r,270:ctr,360:dec'
    )
    expect(p.style.paddingTop).toBe('4px')
    expect(p.style.paddingBottom).toBe('0.5em')
    expect(p.style.textIndent).toBe('-36px')
    expect(p.style.tabSize).toBe('72px')
    expect(p.style.getPropertyValue('--pptx-tab-stops')).toBe('90:l,180:r,270:ctr,360:dec')
  })
  it.each([
    'url(https://external.test/a)',
    '90:l,Infinity:r',
    '100001:l',
    '-1:l',
    '90:evil',
    Array(257).fill('90:l').join(','),
  ])('rejects invalid tab stop metadata: %s', (value) => {
    expect(
      paragraph(`--pptx-tab-stops:${value};color:red`).style.getPropertyValue('--pptx-tab-stops')
    ).toBe('')
  })
  it('drops unsafe source lengths and marker payloads without granting CSS position or script authority', () => {
    const p = paragraph(
      'padding-top:-1px;tab-size:0px;text-indent:calc(1px + 2px);--pptx-tab:2;position:absolute;white-space:var(--unsafe)'
    )
    expect(p.getAttribute('style')).toBeNull()
  })
})
