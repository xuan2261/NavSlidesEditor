import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'
import { JSDOM } from 'jsdom'

const require = createRequire(import.meta.url)
const {
  sanitizeRichTextHtml,
  sanitizeMarkdownHtml,
  sanitizeRichTextStyle,
  sanitizeMediaSrc,
  sanitizeHref,
  sanitizeSvgHtml,
  convertCssLengthToPx,
} = require('../src/content-safety.js')

describe('shared rich text content safety', () => {
  test('converts supported absolute CSS lengths to px', () => {
    expect(convertCssLengthToPx('40pt', 'font-size')).toBe('53.3px')
    expect(convertCssLengthToPx('2pt', 'letter-spacing')).toBe('2.7px')
    expect(convertCssLengthToPx('30.87pt', 'line-height')).toBe('41.2px')
    expect(convertCssLengthToPx('1in', 'font-size')).toBe('96px')
    expect(convertCssLengthToPx('2.54cm', 'font-size')).toBe('96px')
    expect(convertCssLengthToPx('25.4mm', 'font-size')).toBe('96px')
  })

  test('leaves unsupported or already-normalized CSS values unchanged', () => {
    expect(convertCssLengthToPx('16px', 'font-size')).toBe('16px')
    expect(convertCssLengthToPx('1.2em', 'font-size')).toBe('1.2em')
    expect(convertCssLengthToPx('inherit', 'font-size')).toBe('inherit')
    expect(convertCssLengthToPx('40pt', 'margin')).toBe('40pt')
  })

  test('sanitizes style declarations with unit conversion', () => {
    expect(sanitizeRichTextStyle('color: red; font-size: 40pt; letter-spacing: 2pt')).toBe(
      'color: red; font-size: 53.3px; letter-spacing: 2.7px'
    )
  })

  test('preserves editor-supported line-height and highlight styles', () => {
    expect(
      sanitizeRichTextStyle('line-height: 1.5; line-height: 30.87pt; background-color: #fef08a')
    ).toBe('line-height: 1.5; line-height: 41.2px; background-color: #fef08a')
  })

  test('removes unsafe style declarations from rich text html', () => {
    const safe = sanitizeRichTextHtml(
      '<p style="font-size: 18pt; position:absolute; background:url(https://example.test/x.png); color: expression(alert(1))">Hi</p>'
    )

    expect(safe).toContain('font-size: 24px')
    expect(safe).not.toContain('position')
    expect(safe).not.toContain('url(')
    expect(safe).not.toContain('expression')
  })

  test('preserves tel links for server client shared parity', () => {
    expect(sanitizeHref('tel:+1234567890')).toBe('tel:+1234567890')
    expect(sanitizeRichTextHtml('<a href="tel:+1234567890">Call</a>')).toContain(
      'href="tel:+1234567890"'
    )
  })
  test('preserves a single inert code language without admitting active classes or document authority', () => {
    const literal = '  const tag = "<strong>literal</strong>";\n\n'
    const source =
      '<pre class="language-python"><code class="fragment hljs nohighlight language-javascript language-python arbitrary" ' +
      'onclick="alert(1)" data-highlighted="yes" data-navslides-runtime="local" data-ns-generated-frame="true" ' +
      'srcdoc="attack" style="position:absolute;background:url(https://example.test/x);color:expression(alert(1))">' +
      '  const tag = "&lt;strong&gt;literal&lt;/strong&gt;";\n\n</code></pre>' +
      '<code class="language- language-javascript/evil language-&quot;bad">plain</code>' +
      '<p class="language-javascript">Prose</p><script>window.compromised=true</script>' +
      '<iframe data-ns-generated-frame="true" srcdoc="attack"></iframe>' +
      '<a href="javascript:alert(1)">Unsafe reference</a><img src="data:text/html,attack">'
    const dom = new JSDOM(sanitizeMarkdownHtml(source), { url: 'https://navslides.test/' })
    try {
      const document = dom.window.document,
        code = document.querySelector('pre code')
      expect(code.className).toBe('language-javascript')
      expect(code.textContent).toBe(literal)
      expect(code.querySelector('strong')).toBeNull()
      expect(document.querySelector('pre').hasAttribute('class')).toBe(false)
      expect(document.querySelector('p').hasAttribute('class')).toBe(false)
      expect(document.querySelector('body > code').hasAttribute('class')).toBe(false)
      expect(document.querySelector('script, iframe')).toBeNull()
      expect(
        [...document.body.querySelectorAll('*')]
          .flatMap((node) => [...node.attributes])
          .filter((attribute) => /^(?:on|data-|srcdoc$|style$)/.test(attribute.name))
      ).toEqual([])
      expect(document.querySelector('a').getAttribute('href')).toBe('#')
      expect(document.querySelector('img').hasAttribute('src')).toBe(false)
    } finally {
      dom.window.close()
    }
  })

  test.each([
    '<iframe data-ns-generated-frame="true" srcdoc="&lt;script data-navslides-runtime=local&gt;window.rootEscape=true&lt;/script&gt;"></iframe>',
    '<SVG><foreignObject><iframe data-ns-generated-frame=true></iframe></foreignObject></SVG><object data="data:text/html,attack"></object><embed src="data:text/html,attack">',
    '<template><iframe data-ns-generated-frame=true></iframe></template><math><mtext><style></style><iframe data-ns-generated-frame=true></iframe></mtext></math>',
  ])('rich prose cannot grant root runtime or frame authority: %s', (attack) => {
    const source =
      '<p style="line-height:2"><strong>Lesson</strong> <a href="https://example.test/lesson">Read</a></p>' +
      attack +
      '<span data-ns-generated-frame=true data-navslides-runtime=local data-html-dependencies="{}" data-ns-srcdoc="attack" srcdoc="attack">Safe prose</span>'
    const dom = new JSDOM(sanitizeRichTextHtml(source), { url: 'https://navslides.test/' })
    try {
      const document = dom.window.document
      expect(document.querySelector('iframe,object,embed,script,svg,math,template') === null).toBe(
        true
      )
      expect(
        [...document.body.querySelectorAll('*')]
          .flatMap((node) => [...node.attributes])
          .filter((attribute) =>
            /^(?:data-ns-|data-navslides-|data-html-dependencies$|srcdoc$)/.test(attribute.name)
          )
      ).toEqual([])
      expect(document.querySelector('strong').textContent).toBe('Lesson')
      expect(document.querySelector('p').style.lineHeight).toBe('2')
      expect(document.querySelector('a').href).toBe('https://example.test/lesson')
      expect(document.body.textContent).toContain('Safe prose')
    } finally {
      dom.window.close()
    }
  })

  test('href policy rejects control characters and attribute breakout payloads', () => {
    expect(sanitizeHref('/safe/path')).toBe('/safe/path')
    expect(sanitizeHref('/x" onclick="evil()')).toBe('#')
    expect(sanitizeHref("#x' onmouseover='evil()")).toBe('#')
    expect(sanitizeHref('https://example.com/a\nb')).toBe('#')
  })

  test('media src policy rejects executable, local file, and unsafe data schemes', () => {
    expect(sanitizeMediaSrc('/uploads/a.mp4')).toBe('/uploads/a.mp4')
    expect(sanitizeMediaSrc('https://cdn.example.com/a.mp4')).toBe('https://cdn.example.com/a.mp4')
    expect(sanitizeMediaSrc('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
    expect(sanitizeMediaSrc('javascript:alert(1)')).toBe('')
    expect(sanitizeMediaSrc('file:///tmp/a.mp4')).toBe('')
    expect(sanitizeMediaSrc('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(sanitizeMediaSrc('mailto:person@example.com')).toBe('')
  })

  test('svg policy removes active content and neutralizes external references', () => {
    const safe = sanitizeSvgHtml(
      '<svg><script>alert(1)</script><foreignObject><p>x</p></foreignObject><rect onclick="x()" /><use href="https://evil.example/s.svg#x"/><image xlink:href="javascript:alert(1)"/><image src="http://evil.example/p.png"/><use href="#safe"/></svg>'
    )

    expect(safe).not.toContain('<script')
    expect(safe).not.toContain('<foreignObject')
    expect(safe).not.toContain('onclick=')
    expect(safe).not.toContain('https://evil.example')
    expect(safe).not.toContain('javascript:')
    expect(safe).not.toContain('http://evil.example')
    expect(safe).toContain('href="#safe"')
  })
})
