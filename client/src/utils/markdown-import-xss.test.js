import { describe, it, expect } from 'vitest'
import { markdownToSlidesWithWarnings } from './markdown-import.js'
import { isSafeHref } from './url-safety.js'

// C3 — defense-in-depth: the markdown link href must never break out of the
// `href="..."` attribute. The body is already HTML-escaped before the link
// regex, so this is NOT a live XSS; the residual gap is an unescaped `"` in the
// href interpolation plus isSafeHref blindly trusting relative/anchor forms.

describe('isSafeHref attribute-breakout hardening', () => {
  it('rejects relative/anchor hrefs containing quotes or angle brackets', () => {
    expect(isSafeHref('/x"><img src=x onerror=alert(1)>')).toBe(false)
    expect(isSafeHref('/x" onmouseover="alert(1)')).toBe(false)
    expect(isSafeHref("#a' onclick='x")).toBe(false)
    expect(isSafeHref('./a<b')).toBe(false)
    expect(isSafeHref('../a>b')).toBe(false)
  })

  it('still allows legitimate relative, anchor, and absolute hrefs', () => {
    expect(isSafeHref('/docs/page')).toBe(true)
    expect(isSafeHref('#section')).toBe(true)
    expect(isSafeHref('./rel')).toBe(true)
    expect(isSafeHref('../up')).toBe(true)
    expect(isSafeHref('https://example.com/a?b=1')).toBe(true)
    expect(isSafeHref('mailto:a@b.com')).toBe(true)
  })
})

describe('markdown link import — no attribute breakout', () => {
  it('does not emit an unescaped quote that breaks out of the href attribute', () => {
    const md = `[t](/x"><img src=x onerror=alert(1)>)`
    const { slides } = markdownToSlidesWithWarnings(md)
    const content = slides[0].elements[0].content
    // The raw breakout sequence `">` (quote immediately closing the attr+tag)
    // must not survive verbatim inside an <a ...> tag.
    expect(content).not.toMatch(/href="[^"]*"\s*>/)
    // No literal unescaped double-quote should appear between href=" and the
    // intended closing quote followed by attacker markup.
    expect(content).not.toContain('"><img')
  })

  it('escapes or blocks an injected event-handler attribute via the href', () => {
    const md = `[t](/x" onmouseover="alert(1))`
    const { slides } = markdownToSlidesWithWarnings(md)
    const content = slides[0].elements[0].content
    expect(content).not.toContain('" onmouseover="')
  })
})
