import { describe, expect, it } from 'vitest'
import { renderElement, buildBaseStyle } from '../src/element-renderers.js'

const base = { id: 'el-1', x: 0, y: 0, width: 200, height: 100, zIndex: 1 }

describe('Phase 1 reveal: opacity single-apply', () => {
  it('buildBaseStyle includes opacity for generic types', () => {
    const style = buildBaseStyle({ ...base, type: 'image', opacity: 0.5 })
    expect(style).toContain('opacity:0.5')
  })

  it('does not emit opacity when unset or 1', () => {
    expect(buildBaseStyle({ ...base, type: 'image' })).not.toContain('opacity:')
    expect(buildBaseStyle({ ...base, type: 'image', opacity: 1 })).not.toContain('opacity:')
  })

  it('shape opacity is applied exactly once (no nested double-apply)', () => {
    const html = renderElement({ ...base, type: 'shape', shape: 'rect', fill: '#f00', opacity: 0.5 }, {}, {})
    const matches = html.match(/opacity:0\.5/g) || []
    expect(matches.length).toBe(1)
  })
})

describe('Phase 1 reveal: image flip', () => {
  it('renderImage emits scaleX(-1) for flipH', () => {
    const html = renderElement({ ...base, type: 'image', src: '/x.png', flipH: true }, {}, {})
    expect(html).toContain('scaleX(-1)')
  })

  it('renderImage emits scaleY(-1) for flipV', () => {
    const html = renderElement({ ...base, type: 'image', src: '/x.png', flipV: true }, {}, {})
    expect(html).toContain('scaleY(-1)')
  })

  it('no flip transform when flags unset', () => {
    const html = renderElement({ ...base, type: 'image', src: '/x.png' }, {}, {})
    expect(html).not.toContain('scaleX(-1)')
    expect(html).not.toContain('scaleY(-1)')
  })
})
