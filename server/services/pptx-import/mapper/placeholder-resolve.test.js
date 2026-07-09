import { describe, expect, it } from 'vitest'
import { resolveLayoutPlaceholders } from './placeholder-resolve.js'

describe('placeholder-resolve (T4.2)', () => {
  it('T4.2 injects title text when slide has no text content', () => {
    const slide = { elements: [] }
    const graphSlide = {
      nodes: [
        {
          id: '2',
          kind: 'shape',
          ph: { type: 'title' },
          xfrm: { x: 10, y: 20, cx: 400, cy: 60 },
        },
      ],
    }
    const { elements, injected } = resolveLayoutPlaceholders(slide, graphSlide, { slideIndex: 0 })
    expect(injected).toBe(1)
    expect(elements[0].type).toBe('text')
    expect(elements[0].content).toMatch(/title/i)
    expect(elements[0]._pptxSource.nodeId).toBe('2')
  })

  it('does not inject when text already present', () => {
    const slide = { elements: [{ type: 'text', content: '<p>Hello</p>' }] }
    const graphSlide = { nodes: [{ id: '2', kind: 'shape', ph: { type: 'title' } }] }
    const { injected } = resolveLayoutPlaceholders(slide, graphSlide)
    expect(injected).toBe(0)
  })
})
