import { describe, it, expect } from 'vitest'
import { markdownToHtml } from './markdown-utils'

describe('markdownToHtml', () => {
  it('converts h1 heading', () => {
    const result = markdownToHtml('# Hello')
    expect(result).toContain('<h1>Hello</h1>')
  })

  it('converts h2 heading', () => {
    const result = markdownToHtml('## Hello')
    expect(result).toContain('<h2>Hello</h2>')
  })

  it('converts h3 heading', () => {
    const result = markdownToHtml('### Hello')
    expect(result).toContain('<h3>Hello</h3>')
  })

  it('converts h4 heading', () => {
    const result = markdownToHtml('#### Hello')
    expect(result).toContain('<h4>Hello</h4>')
  })

  it('converts bold text', () => {
    const result = markdownToHtml('**bold text**')
    expect(result).toContain('<strong>bold text</strong>')
  })

  it('converts italic text', () => {
    const result = markdownToHtml('*italic text*')
    expect(result).toContain('<em>italic text</em>')
  })

  it('converts inline code', () => {
    const result = markdownToHtml('`code`')
    expect(result).toContain('<code')
    expect(result).toContain('code</code>')
  })

  it('converts code blocks with language', () => {
    const result = markdownToHtml('```js\nconsole.log("hi")\n```')
    expect(result).toContain('<pre')
    expect(result).toContain('<code')
    expect(result).toContain('console.log("hi")')
  })

  it('converts code blocks with escaped HTML', () => {
    const result = markdownToHtml('```\n<p>test</p>\n```')
    expect(result).toContain('<pre')
    expect(result).toContain('&lt;p&gt;test&lt;/p&gt;')
  })

  it('converts links with safe href', () => {
    const result = markdownToHtml('[Google](https://google.com)')
    expect(result).toContain('<a href="https://google.com"')
    expect(result).toContain('Google</a>')
  })

  it('ignores unsafe hrefs (javascript:)', () => {
    const result = markdownToHtml('[Click](javascript:alert(1))')
    expect(result).toContain('<a href="#"')
    expect(result).not.toContain('javascript:')
  })

  it('ignores unsafe hrefs (data:)', () => {
    const result = markdownToHtml('[Click](data:text/html,<script>alert(1)</script>)')
    expect(result).toContain('<a href="#"')
    expect(result).not.toContain('data:text')
  })

  it('converts unordered lists', () => {
    const result = markdownToHtml('- item one\n- item two')
    expect(result).toContain('<ul')
    expect(result).toContain('<li>item one</li>')
    expect(result).toContain('<li>item two</li>')
  })

  it('converts horizontal rules', () => {
    const result = markdownToHtml('---')
    expect(result).toContain('<hr')
  })

  it('wraps plain text in paragraph tags', () => {
    const result = markdownToHtml('Just some plain text')
    expect(result).toContain('<p')
    expect(result).toContain('Just some plain text</p>')
  })

  it('handles empty input', () => {
    const result = markdownToHtml('')
    expect(result).toBe('')
  })
})
