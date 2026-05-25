import { describe, expect, it } from 'vitest'
import shapeMapper from './map-shape.js'

const { mapShape } = shapeMapper

function context() {
  return {
    scale: { x: 1, y: 1 },
    zIndex: 3,
    slideIndex: 0,
    warnings: [],
    stats: { shapeCount: 0 },
  }
}

describe('pptx mapShape', () => {
  it('maps line geometry and arrow markers', () => {
    const result = mapShape({
      type: 'shape',
      shapType: 'straightConnector1',
      left: 10,
      top: 20,
      width: 100,
      height: 0,
      borderColor: '#123456',
      borderWidth: 2,
      arrowType: 'triangle',
    }, context())[0]

    expect(result).toMatchObject({
      type: 'line',
      stroke: '#123456',
      strokeWidth: 2,
      arrowEnd: 'arrow',
      zIndex: 3,
    })
  })

  it('maps rich text shape metadata, gradient fill, and shadow', () => {
    const ctx = context()
    const result = mapShape({
      type: 'shape',
      shapType: 'roundRect',
      left: 1,
      top: 2,
      width: 80,
      height: 40,
      fill: { type: 'gradient', value: { colors: [{ color: '#000', pos: 0 }, { color: '#fff', pos: 100 }] } },
      borderColor: '#222222',
      borderWidth: 1,
      content: '<p style="text-align:center"><span style="font-size:20pt;color:#abcdef">Hello</span></p>',
      shadow: { h: 1, v: 2, blur: 3, color: '#444444' },
    }, ctx)[0]

    expect(ctx.stats.shapeCount).toBe(1)
    expect(result).toMatchObject({
      type: 'shape',
      shape: 'rounded-rect',
      fill: 'gradient',
      stroke: '#222222',
      text: 'Hello',
      textAlign: 'center',
      fontSize: 20,
      textColor: '#abcdef',
      shadowX: 1,
      shadowY: 2,
      shadowBlur: 3,
      shadowColor: '#444444',
    })
    expect(result.fillGradient.gradient).toContain('linear-gradient')
  })

  it('maps custom path shapes to SVG content', () => {
    const result = mapShape({
      type: 'shape',
      shapType: 'customGeometry',
      left: 0,
      top: 0,
      width: 20,
      height: 10,
      path: 'M0 0 L10 10',
      fill: '#fff',
      borderColor: '#000',
    }, context())[0]

    expect(result.type).toBe('svg')
    expect(result.content).toContain('<path')
    expect(result.content).toContain('M0 0 L10 10')
  })
})
