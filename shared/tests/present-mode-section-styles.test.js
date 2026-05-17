import { describe, it, expect } from 'vitest'
import { generateRevealHTML } from '../src/htmlGenerator.js'
import { renderElement } from '../src/element-renderers.js'

const base = { id: 'el-1', x: 0, y: 0, width: 400, height: 300, zIndex: 1 }

describe('Present mode section styles', () => {
  const presentation = {
    title: 'CSS Test',
    theme: 'black',
    slides: [
      {
        id: 'slide-1',
        elements: [
          { ...base, type: 'text', content: '<p>Hello</p>' },
        ],
        background: { type: 'color', color: '#000' },
      },
    ],
  }

  it('applies overflow:hidden to sections', () => {
    const html = generateRevealHTML(presentation)
    expect(html).toMatch(/overflow:\s*hidden/)
  })

  it('includes reveal override stylesheet and section line-height reset', () => {
    const html = generateRevealHTML(presentation)
    expect(html).toContain('/reveal-overrides.css')
    expect(html).toMatch(/\.reveal \.slides section \{[^}]*line-height:\s*normal/)
  })

  it('does not contain contain:paint on sections', () => {
    const html = generateRevealHTML(presentation)
    expect(html).not.toContain('contain: paint')
    expect(html).not.toContain('contain:paint')
  })

  it('uses px units for section dimensions, not em', () => {
    const html = generateRevealHTML(presentation)
    // Section padding should be 0 (px-based), not em-based
    expect(html).toMatch(/padding:\s*0/)
  })

  it('only applies data-auto-animate to slides with autoAnimate flag', () => {
    const html = generateRevealHTML({
      ...presentation,
      slides: [
        { id: 's1', elements: [], background: { type: 'color', color: '#000' } },
        { id: 's2', elements: [], background: { type: 'color', color: '#000' }, autoAnimate: true },
      ],
    })
    // Count data-auto-animate occurrences — should be exactly 1
    const matches = html.match(/data-auto-animate/g) || []
    expect(matches.length).toBe(1)
  })

  it('renders HTML embeds with data URL iframe in present mode', () => {
    const html = renderElement(
      { ...base, type: 'html', content: '<div>embed</div>' },
      {},
      {}
    )
    expect(html).toContain('<iframe')
    expect(html).toContain('src="data:text/html;charset=utf-8,')
    expect(html).not.toContain('srcdoc=')
  })

  it('renders HTML embeds with data-pdf-iframe in print mode', () => {
    const html = renderElement(
      { ...base, type: 'html', content: '<div>embed</div>' },
      {},
      { forPrint: true }
    )
    expect(html).toContain('data-pdf-iframe=')
    expect(html).not.toContain('srcdoc=')
  })

  it('renders LaTeX directly with KaTeX hook in present mode', () => {
    const html = renderElement(
      { ...base, type: 'latex', content: 'E=mc^2' },
      {},
      {}
    )
    expect(html).toContain('data-math-latex=')
    expect(html).toContain('data-math-display="true"')
    expect(html).not.toContain('<iframe')
  })

  it('renders LaTeX with data-math-latex in print mode', () => {
    const html = renderElement(
      { ...base, type: 'latex', content: '\\frac{a}{b}' },
      {},
      { forPrint: true }
    )
    expect(html).toContain('data-math-latex=')
    expect(html).not.toContain('<iframe')
  })
})
