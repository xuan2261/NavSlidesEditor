import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownRenderer } from './markdown-element-renderer'

describe('Phase 2: markdown canvas honors textColor/fontSize', () => {
  it('uses element.textColor and element.fontSize when set', () => {
    const { container } = render(
      <MarkdownRenderer element={{ id: 'm1', type: 'markdown', content: '# Hi', textColor: '#ff0000', fontSize: 24 }} />
    )
    const root = container.firstChild
    expect(root.style.color).toBe('rgb(255, 0, 0)')
    expect(root.style.fontSize).toBe('24px')
  })

  it('does not emit the literal auto color sentinel', () => {
    const { container } = render(
      <MarkdownRenderer element={{ id: 'm1', type: 'markdown', content: '# Hi', textColor: 'auto' }} />
    )
    const root = container.firstChild
    expect(root.getAttribute('style')).not.toContain('color: auto')
    expect(root.style.fontSize).toBe('18px')
  })

  it('falls back to white / 18px when unset (preserves legacy look)', () => {
    const { container } = render(
      <MarkdownRenderer element={{ id: 'm1', type: 'markdown', content: '# Hi' }} />
    )
    const root = container.firstChild
    expect(root.style.color).toBe('white')
    expect(root.style.fontSize).toBe('18px')
  })
})
