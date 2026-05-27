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
    const ctx = { ...context(), scale: { x: 4 / 3, y: 2 } }
    const result = flattenDiagramElement({
      type: 'diagram',
      left: 10,
      top: 20,
      width: 200,
      height: 100,
      elements: [
        { shapType: 'line', x1: 0, y1: 0, x2: 50, y2: 0, borderWidth: 2 },
        {
          shapType: 'rect',
          left: 5,
          top: 6,
          width: 40,
          height: 20,
          borderWidth: 1,
          content: '<p><span style="font-size:18pt;color:#abcdef">A</span></p>',
        },
      ],
    }, ctx)

    expect(result.map((item) => item.type)).toEqual(['shape', 'line'])
    expect(result[0]).toMatchObject({
      x: 20,
      y: 52,
      text: 'A',
      zIndex: 2,
      strokeWidth: 1.8,
      fontSize: 24,
      textColor: '#abcdef',
    })
    expect(result[1]).toMatchObject({
      x1: 13,
      y1: 40,
      x2: 80,
      y2: 40,
      zIndex: 3,
      strokeWidth: 3.6,
    })
    expect(ctx.zIndex).toBe(3)
  })

  it('detects line-like connector nodes', () => {
    expect(isConnectorNode({ shapType: 'straightConnector1' })).toBe(true)
    expect(isConnectorNode({ shapType: 'rect' })).toBe(false)
  })

  it('uses rich node content for metadata when textList supplies plain display text', () => {
    const ctx = context()
    const result = flattenDiagramElement({
      type: 'diagram',
      width: 100,
      height: 50,
      elements: [
        {
          shapType: 'rect',
          content: '<p><span style="font-size:18pt;color:#abcdef">Rich Label</span></p>',
        },
      ],
      textList: [{ text: 'Plain Label' }],
    }, ctx)

    expect(result[0]).toMatchObject({
      text: 'Plain Label',
      fontSize: 24,
      textColor: '#abcdef',
    })
  })
})
