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
      strokeWidth: 1.3,
      fontSize: 36,
      textColor: '#abcdef',
    })
    expect(result[1]).toMatchObject({
      x1: 13,
      y1: 40,
      x2: 80,
      y2: 40,
      zIndex: 3,
      strokeWidth: 2.7,
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
      fontSize: 18,
      textColor: '#abcdef',
    })
  })

  it('attaches fit-meta to a diagram node with text so long labels clamp', () => {
    const ctx = context()
    const result = flattenDiagramElement({
      type: 'diagram',
      width: 200,
      height: 90,
      elements: [
        {
          shapType: 'rect',
          width: 200,
          height: 40,
          content: '<p><span style="font-size:18pt">A long diagram node label that should clamp</span></p>',
        },
      ],
      textList: [{ text: 'A long diagram node label that should clamp' }],
    }, ctx)

    const node = result[0]
    expect(Number.isFinite(node._pptxImportMeta?.fitFontSizePx)).toBe(true)
    // 18pt source at scale.y 1 → 18 canvas px; fit clamp never exceeds source.
    expect(node._pptxImportMeta.fitFontSizePx).toBeLessThanOrEqual(18)
    expect(node.fontSize).toBe(18)
  })

  it('scales diagram node font by a non-uniform deck scale.y', () => {
    const ctx = { ...context(), scale: { x: 1, y: 0.5 } }
    const result = flattenDiagramElement({
      type: 'diagram',
      width: 200,
      height: 90,
      elements: [
        { shapType: 'rect', width: 200, height: 80, content: '<p><span style="font-size:18pt">Node</span></p>' },
      ],
      textList: [{ text: 'Node' }],
    }, ctx)

    expect(result[0].fontSize).toBe(9)
  })

  it('does not force fit-meta onto a diagram node without text', () => {
    const ctx = context()
    const result = flattenDiagramElement({
      type: 'diagram',
      width: 200,
      height: 90,
      elements: [{ shapType: 'rect', width: 80, height: 40 }],
      textList: [],
    }, ctx)

    expect(result[0]._pptxImportMeta).toBeUndefined()
  })
})
