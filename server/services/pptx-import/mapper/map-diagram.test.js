import { describe, expect, it } from 'vitest'
import diagramMapper from './map-diagram.js'

const { flattenDiagramElement, isConnectorNode } = diagramMapper

function context() {
  return {
    scale: { x: 1, y: 1 },
    zIndex: 1,
    slideIndex: 0,
    warnings: [],
  }
}

describe('pptx diagram mapper', () => {
  it('maps boxes before connectors and increments shared zIndex', () => {
    const ctx = context()
    const result = flattenDiagramElement({
      type: 'diagram',
      left: 10,
      top: 20,
      width: 200,
      height: 100,
      elements: [
        { shapType: 'line', x1: 0, y1: 0, x2: 50, y2: 0 },
        { shapType: 'rect', left: 5, top: 6, width: 40, height: 20, text: '<b>A</b>' },
      ],
    }, ctx)

    expect(result.map((item) => item.type)).toEqual(['shape', 'line'])
    expect(result[0]).toMatchObject({ x: 15, y: 26, text: 'A', zIndex: 2 })
    expect(result[1]).toMatchObject({ x1: 10, y1: 20, x2: 60, y2: 20, zIndex: 3 })
    expect(ctx.zIndex).toBe(3)
  })

  it('detects line-like connector nodes', () => {
    expect(isConnectorNode({ shapType: 'straightConnector1' })).toBe(true)
    expect(isConnectorNode({ shapType: 'rect' })).toBe(false)
  })
})
