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

  it('keeps white / 18px defaults when unset (srcdoc)', () => {
    const html = renderElement({ ...base, content: '# Hi' }, {}, {})
    expect(html).toContain('color:white')
    expect(html).toContain('18px')
  })
})
