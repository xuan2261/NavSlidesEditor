import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShapeRenderer } from './shape-element-renderer'

describe('ShapeRenderer', () => {
  it('renders sanitized rich shape text when textHtml is present', () => {
    const { container } = render(
      <ShapeRenderer
        element={{
          shape: 'rect',
          width: 160,
          height: 80,
          fill: '#ffffff',
          text: 'Bold rest',
          textHtml:
            '<strong>Bold</strong> <span style="color:#112233;font-size:18pt;background-image:url(javascript:bad)">rest</span><script>bad()</script>',
        }}
      />
    )

    expect(container.querySelector('foreignObject')).toBeTruthy()
    expect(container.innerHTML).toContain('<strong>Bold</strong>')
    expect(container.innerHTML).toContain('color: #112233')
    expect(container.innerHTML).toContain('font-size: 24px')
    expect(container.innerHTML).not.toContain('background-image')
    expect(container.innerHTML).not.toContain('<script')
  })

  it('applies imported text insets to rich shape text content', () => {
    const { container } = render(
      <ShapeRenderer
        element={{
          shape: 'rect',
          width: 160,
          height: 80,
          textHtml: '<span>Inset</span>',
          _pptxImportMeta: {
            textInsets: { left: 10, right: 11, top: 5, bottom: 6 },
            textInsetsUnit: 'px',
          },
        }}
      />
    )

    const textContent = container.querySelector('foreignObject div')
    expect(textContent.style.paddingLeft).toBe('10px')
    expect(textContent.style.paddingRight).toBe('11px')
    expect(textContent.style.paddingTop).toBe('5px')
    expect(textContent.style.paddingBottom).toBe('6px')
  })

  it('converts legacy unmarked shape text insets from pt to px', () => {
    const { container } = render(
      <ShapeRenderer
        element={{
          shape: 'rect',
          width: 160,
          height: 80,
          textHtml: '<span>Legacy inset</span>',
          _pptxImportMeta: {
            textInsets: { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6 },
          },
        }}
      />
    )

    const textContent = container.querySelector('foreignObject div')
    expect(textContent.style.paddingLeft).toBe('9.6px')
    expect(textContent.style.paddingTop).toBe('4.8px')
  })
})
