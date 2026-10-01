import { describe, it, expect } from 'vitest'
import { markdownToHtml } from './markdown-utils'

function renderMarkdown(source) {
  const root = document.createElement('div')
  root.innerHTML = markdownToHtml(source)
  return root
}

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

  it('renders fenced code with language as literal text', () => {
    const root = renderMarkdown('```js\nconsole.log("hi")\n```')
    expect(root.querySelector('pre > code').textContent.trimEnd()).toBe('console.log("hi")')
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

  it('does not parse emphasis, links, headings, lists, or entities inside fenced code', () => {
    const literal = 'const t = **literal**\n# heading\n- item\n[link](https://example.com)\n---\n<tag> &lt; &'
    const root = renderMarkdown(`\`\`\`js\n${literal}\n\`\`\`\n\n**outside**`)
    const code = root.querySelector('pre > code')
    expect(code.textContent.trimEnd()).toBe(literal)
    expect(code.children).toHaveLength(0)
    expect(root.querySelector('pre p')).toBeNull()
    expect(root.querySelector('p strong').textContent).toBe('outside')
  })

  it('preserves markdown syntax and entities inside inline code', () => {
    const literal = '**literal** *em* [link](https://example.com) <tag> &lt; &'
    const root = renderMarkdown(`before \`${literal}\` after **outside**`)
    const code = root.querySelector('p > code')
    expect(code.textContent).toBe(literal)
    expect(code.children).toHaveLength(0)
    expect(root.querySelector('p > strong').textContent).toBe('outside')
  })

  it('supports inline backticks and language punctuation without breaking code boundaries', () => {
    const root = renderMarkdown('`` `inner` **literal** ``\n\n```c++\na * b\n```\n\nAfter')
    expect(root.querySelector('p > code').textContent).toBe('`inner` **literal**')
    expect(root.querySelector('pre > code').textContent.trimEnd()).toBe('a * b')
    expect(root.querySelector('pre + p').textContent).toBe('After')
  })
})
