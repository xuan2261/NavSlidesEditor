import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SvgElementRenderer } from './svg-element-renderer'

describe('Phase 4: SVG override hardening (red-team m6)', () => {
  it('applies a valid hex color override', () => {
    const { container } = render(
      <SvgElementRenderer element={{ type: 'svg', content: '<svg><rect fill="#000"/></svg>', fillOverride: '#ff0000' }} />
    )
    expect(container.innerHTML).toContain('fill="#ff0000"')
  })

  it('rejects an injection attempt and does NOT interpolate it', () => {
    const { container } = render(
      <SvgElementRenderer
        element={{ type: 'svg', content: '<svg><rect fill="#000"/></svg>', fillOverride: 'red" onload="alert(1)' }}
      />
    )
    // The hostile value must not appear and no onload attribute survives
    expect(container.innerHTML).not.toContain('onload')
    expect(container.innerHTML).not.toContain('alert(1)')
    // Original fill stays since override was rejected
    expect(container.innerHTML).toContain('fill="#000"')
  })

  it('re-renders updated SVG content', () => {
    const { container } = render(
      <SvgElementRenderer element={{ type: 'svg', content: '<svg><circle r="5"/></svg>' }} />
    )
    expect(container.innerHTML).toContain('<circle')
  })
})
