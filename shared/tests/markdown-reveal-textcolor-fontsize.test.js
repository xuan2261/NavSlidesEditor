import { describe, expect, it } from 'vitest'
import { renderElement } from '../src/element-renderers.js'

const base = { id: 'm1', x: 0, y: 0, width: 300, height: 200, zIndex: 1, type: 'markdown' }

describe('Phase 2 reveal: markdown honors textColor/fontSize (red-team M3)', () => {
  it('threads textColor + fontSize into the normal (srcdoc) branch', () => {
    const html = renderElement({ ...base, content: '# Hi', textColor: '#ff0000', fontSize: 24 }, {}, {})
    expect(html).toContain('#ff0000')
    expect(html).toContain('24px')
  })

  it('threads textColor + fontSize into the forPrint branch', () => {
    const html = renderElement({ ...base, content: '# Hi', textColor: '#ff0000', fontSize: 24 }, {}, { forPrint: true })
    expect(html).toContain('#ff0000')
    expect(html).toContain('24px')
  })

  it('renders markdown as sanitized HTML in the forPrint branch', () => {
    const html = renderElement({
      ...base,
      content: [
        '# Heading',
        '',
        '- One',
        '- Two',
        '',
        '[safe](https://example.com)',
        '[unsafe](javascript:alert(1))',
        '<script>alert(1)</script><img src=x onerror="alert(1)">',
      ].join('\n'),
    }, {}, { forPrint: true })

    expect(html).toContain('<h1>Heading</h1>')
    expect(html).toContain('<ul><li>One</li><li>Two</li></ul>')
    expect(html).toContain('<a href="https://example.com"')
    expect(html).toContain('<a href="#"')
    expect(html).not.toContain('# Heading')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
  })

  it('[red defect:renderer.contrast] uses readable dark text / 18px defaults when unset (srcdoc)', () => {
    const html = renderElement({ ...base, content: '# Hi' }, {}, {})
    expect(html).toContain('color:#141413')
    expect(html).toContain('18px')
  })
})
