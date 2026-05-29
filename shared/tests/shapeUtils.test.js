import { describe, expect, it } from 'vitest'
import { SHAPES, buildSvgGradientData, gradientFallbackColor, shapeSvgString } from '../src/shapeUtils.js'

describe('shapeUtils', () => {
  it('exposes the documented shape catalog', () => {
    expect(SHAPES.map((shape) => shape.id)).toEqual([
      'rect',
      'rounded-rect',
      'circle',
      'triangle',
      'diamond',
      'arrow-right',
      'star',
      'line',
      'hexagon',
      'pentagon',
      'cloud',
      'cylinder',
      'parallelogram',
      'trapezoid',
      'bracket',
    ])
  })

  it('renders configurable SVG geometry, text, border radius, and dashed lines', () => {
    const rounded = shapeSvgString({
      shape: 'rect',
      width: 120,
      height: 80,
      fill: '#111111',
      stroke: '#eeeeee',
      strokeWidth: 4,
      borderRadius: 12,
      text: 'Label',
      fontSize: 18,
    })
    expect(rounded).toContain('<rect x="2" y="2" width="116" height="76" rx="12"')
    expect(rounded).toContain('fill="#111111"')
    expect(rounded).toContain('stroke="#eeeeee"')
    expect(rounded).toContain('font-size="18"')
    expect(rounded).toContain('>Label</text>')

    const line = shapeSvgString({
      shape: 'line',
      width: 100,
      height: 20,
      fill: '#ff0000',
      strokeWidth: 5,
      dashArray: '4 2',
    })
    expect(line).toContain('<line')
    expect(line).toContain('stroke-dasharray="4 2"')
  })

  it('escapes shape text content to prevent markup injection', () => {
    const escaped = shapeSvgString({
      shape: 'rect',
      width: 120,
      height: 80,
      text: '<script>alert(1)</script>',
    })
    expect(escaped).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(escaped).not.toContain('<script>alert(1)</script>')

    const safeColor = shapeSvgString({
      shape: 'rect',
      width: 120,
      height: 80,
      text: 'Label',
      textColor: '" onload="bad',
    })
    expect(safeColor).toContain('fill="#ffffff"')
    expect(safeColor).not.toContain('onload=')
  })

  it('renders sanitized rich shape text when textHtml is present', () => {
    const rich = shapeSvgString({
      shape: 'rect',
      width: 160,
      height: 80,
      text: 'Bold rest',
      textHtml: '<strong>Bold</strong> <span style="color:#112233;font-size:18pt;background-image:url(javascript:bad)">rest</span><script>bad()</script>',
    })

    expect(rich).toContain('<foreignObject')
    expect(rich).toContain('<strong>Bold</strong>')
    expect(rich).toContain('color: #112233')
    expect(rich).toContain('font-size: 24px')
    expect(rich).not.toContain('background-image')
    expect(rich).not.toContain('<script')
  })

  it('removes unquoted dangerous attributes from rich shape text', () => {
    const rich = shapeSvgString({
      shape: 'rect',
      width: 160,
      height: 80,
      textHtml: '<img src=x onerror=alert(1)><a href=javascript:alert(1)>link</a>',
    })

    expect(rich).not.toContain('onerror')
    expect(rich).not.toContain('javascript:')
    expect(rich).toContain('href="#"')
    expect(rich).toContain('src="#"')
  })

  it('applies imported text insets to shared rich shape text content', () => {
    const rich = shapeSvgString({
      shape: 'rect',
      width: 160,
      height: 80,
      textHtml: '<span>Inset</span>',
      _pptxImportMeta: {
        textInsets: { left: 10, right: 11, top: 5, bottom: 6 },
        textInsetsUnit: 'px',
      },
    })

    expect(rich).toContain('padding-left:10px')
    expect(rich).toContain('padding-right:11px')
    expect(rich).toContain('padding-top:5px')
    expect(rich).toContain('padding-bottom:6px')
  })

  it('converts legacy unmarked shared shape text insets from pt to px', () => {
    const rich = shapeSvgString({
      shape: 'rect',
      width: 160,
      height: 80,
      textHtml: '<span>Legacy inset</span>',
      _pptxImportMeta: {
        textInsets: { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6 },
      },
    })

    expect(rich).toContain('padding-left:9.6px')
    expect(rich).toContain('padding-top:4.8px')
  })

  it('adds imported PPTX wrapping styles to shared rich shape text', () => {
    const rich = shapeSvgString({
      shape: 'rect',
      width: 160,
      height: 80,
      textHtml: '<span>Long text</span>',
      _pptxImportMeta: { textFit: 'wrap', version: 1 },
    })

    expect(rich).toContain('overflow-wrap:anywhere')
    expect(rich).toContain('white-space:pre-wrap')
    expect(rich).toContain('word-break:normal')
  })

  it('does not emit negative rect dimensions when stroke exceeds shape size', () => {
    const rich = shapeSvgString({
      shape: 'rect',
      width: 3,
      height: 3,
      strokeWidth: 8,
      fill: '#ffffff',
      stroke: '#000000',
    })

    expect(rich).not.toContain('width="-')
    expect(rich).not.toContain('height="-')
  })

  describe('buildSvgGradientData', () => {
    const grad = (angle) => ({
      id: 'el-1',
      fillGradient: {
        type: 'gradient',
        angle,
        stops: [{ offset: 0, color: '#fff' }, { offset: 1, color: '#000' }],
      },
    })

    it('maps CSS angle 90 (to-right) to a left→right unit-square vector', () => {
      const data = buildSvgGradientData(grad(90))
      expect(data.id).toContain('el-1')
      expect(data.x1).toBeCloseTo(0, 5)
      expect(data.y1).toBeCloseTo(0.5, 5)
      expect(data.x2).toBeCloseTo(1, 5)
      expect(data.y2).toBeCloseTo(0.5, 5)
      expect(data.stops).toHaveLength(2)
    })

    it('maps CSS angle 180 (to-bottom) to a top→bottom unit-square vector', () => {
      const data = buildSvgGradientData(grad(180))
      expect(data.x1).toBeCloseTo(0.5, 5)
      expect(data.y1).toBeCloseTo(0, 5)
      expect(data.x2).toBeCloseTo(0.5, 5)
      expect(data.y2).toBeCloseTo(1, 5)
    })

    it('returns null without a gradient or with fewer than two stops', () => {
      expect(buildSvgGradientData({ id: 'x', fill: '#fff' })).toBeNull()
      expect(buildSvgGradientData({ id: 'x', fillGradient: { stops: [{ offset: 0, color: '#fff' }] } })).toBeNull()
      expect(buildSvgGradientData(undefined)).toBeNull()
    })
  })

  it('renders a gradient-filled shape as a real SVG linearGradient', () => {
    const svg = shapeSvgString({
      id: 'shape-7',
      shape: 'rect',
      width: 200,
      height: 100,
      fill: 'gradient',
      fillGradient: {
        type: 'gradient',
        angle: 90,
        stops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#000000' }],
      },
    })

    expect(svg).toContain('<linearGradient')
    expect(svg).toMatch(/fill="url\(#[^)]*shape-7[^)]*\)"/)
    expect(svg).toContain('<stop')
    // The invalid literal paint must never reach the SVG.
    expect(svg).not.toContain('fill="gradient"')
  })

  it('falls back to a solid fill when no gradient is present', () => {
    const svg = shapeSvgString({ shape: 'rect', width: 80, height: 40, fill: '#123456' })
    expect(svg).toContain('fill="#123456"')
    expect(svg).not.toContain('<linearGradient')
  })

  it('renders a degenerate single-stop gradient as its solid stop color, never the literal', () => {
    const svg = shapeSvgString({
      id: 'shape-1stop',
      shape: 'rect',
      width: 120,
      height: 60,
      fill: 'gradient',
      fillGradient: {
        type: 'gradient',
        angle: 90,
        stops: [{ offset: 0, color: '#abcdef' }],
      },
    })

    expect(svg).not.toContain('<linearGradient')
    expect(svg).not.toContain('fill="gradient"')
    expect(svg).toContain('fill="#abcdef"')
  })

  it('exposes gradientFallbackColor as the first stop color', () => {
    expect(buildSvgGradientData).toBeDefined()
    expect(gradientFallbackColor({ fillGradient: { stops: [{ offset: 0, color: '#0f0f0f' }] } })).toBe('#0f0f0f')
    expect(gradientFallbackColor({ fill: '#123' }, '#6366f1')).toBe('#6366f1')
  })
})
