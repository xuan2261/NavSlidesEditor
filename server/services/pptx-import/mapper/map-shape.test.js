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
    }, { ...context(), scale: { x: 4 / 3, y: 1 } })[0]

    expect(result).toMatchObject({
      type: 'line',
      stroke: '#123456',
      strokeWidth: 3.6,
      arrowEnd: 'arrow',
      zIndex: 3,
    })
  })

  it('maps rich text shape metadata, gradient fill, and shadow', () => {
    const ctx = { ...context(), scale: { x: 4 / 3, y: 2 } }
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
      fontSize: 26.7,
      textColor: '#abcdef',
      strokeWidth: 1.8,
      shadowX: 1.8,
      shadowY: 5.3,
      shadowBlur: 5.3,
      shadowColor: '#444444',
    })
    expect(result.fillGradient.gradient).toContain('linear-gradient')
  })

  it('stores shape text import insets as canvas px metadata', () => {
    const result = mapShape({
      type: 'shape',
      shapType: 'rect',
      left: 0,
      top: 0,
      width: 200,
      height: 50,
      insetLeft: 7.2,
      insetRight: 7.2,
      insetTop: 3.6,
      insetBottom: 3.6,
      content: '<p>X</p>',
    }, { ...context(), scale: { x: 1, y: 1 } })[0]

    expect(result._pptxImportMeta).toMatchObject({
      textInsets: { left: 9.6, right: 9.6, top: 4.8, bottom: 4.8 },
      textInsetsUnit: 'px',
    })
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
      borderWidth: 2,
    }, { ...context(), scale: { x: 4 / 3, y: 1 } })[0]

    expect(result.type).toBe('svg')
    expect(result.width).toBe(27)
    expect(result.height).toBe(10)
    expect(result.content).toContain('<path')
    expect(result.content).toContain('width="100%"')
    expect(result.content).toContain('height="100%"')
    expect(result.content).toContain('viewBox="0 0 20 10"')
    expect(result.content).toContain('preserveAspectRatio="none"')
    expect(result.content).toContain('M0 0 L10 10')
    expect(result.content).toContain('stroke-width="2.7"')
  })

  it('maps path-only unknown shapes to SVG content', () => {
    const result = mapShape({
      type: 'shape',
      left: 0,
      top: 0,
      width: 20,
      height: 10,
      path: 'M0 0 C5 10 15 10 20 0',
      fill: '#fff',
      borderColor: '#000',
      borderWidth: 2,
    }, { ...context(), scale: { x: 4 / 3, y: 1 } })[0]

    expect(result.type).toBe('svg')
    expect(result.content).toContain('M0 0 C5 10 15 10 20 0')
  })

  it('keeps built-in rect paths as rich text shapes', () => {
    const result = mapShape({
      type: 'shape',
      shapType: 'rect',
      left: 0,
      top: 0,
      width: 200,
      height: 50,
      path: 'M 0 0 L 200 0 L 200 50 L 0 50 Z',
      content: '<p><span style="font-size:24pt;color:#111827">Title</span></p>',
    }, { ...context(), scale: { x: 4 / 3, y: 1 } })[0]

    expect(result).toMatchObject({
      type: 'shape',
      shape: 'rect',
      text: 'Title',
      fontSize: 32,
      textColor: '#111827',
      width: 267,
      height: 50,
    })
    expect(result.textHtml).toContain('Title')
  })

  it('uses transparent fill for text-only shapes without explicit fill', () => {
    const result = mapShape({
      type: 'shape',
      shapType: 'rect',
      left: 0,
      top: 0,
      width: 200,
      height: 50,
      fill: null,
      content: '<p>Label</p>',
    }, context())[0]

    expect(result).toMatchObject({
      type: 'shape',
      fill: 'transparent',
      text: 'Label',
    })
  })
})
