import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'
import { arg, doc, flatten, node, options, run, val, W } from './omml-rendering-fixtures'

const require = createRequire(import.meta.url)
const { layoutOmmlDocument } = require('../../shared/src/pptx-omml-layout')
const { renderOmmlDocument } = require('../../shared/src/pptx-omml-renderer')
const layout = (input) => layoutOmmlDocument(input, options).layout
const near = (a, b) => expect(a).toBeCloseTo(b, 8)

describe('source-preserving measured OMML renderer', () => {
  it('uses real unequal glyph advances and preserves source identity without cached output', () => {
    const input = doc(run('iii'), run('WWW'))
    const before = JSON.stringify(input)
    const result = renderOmmlDocument(input, options)
    expect(result.document).toEqual(input)
    expect(Object.isFrozen(result.document.root)).toBe(true)
    expect(JSON.stringify(input)).toBe(before)
    const [small, large] = result.layout.children
    expect(large.width).toBeGreaterThan(small.width * 2)
    near(large.x, small.width)
    expect(result.svg).toContain('data-component-id=')
    expect(result.svg).not.toMatch(/<image|foreignObject/)
    expect(renderOmmlDocument(JSON.parse(before), options)).toEqual(result)
  })

  it('centers a real fraction about its rule with separated ink bounds', () => {
    const fraction = layout(doc(node('f', [arg('num', 'WW'), arg('den', 'i')]))).children[0]
    const [num, den] = fraction.children
    const rule = fraction.primitives[0]
    near(num.x + num.width / 2, den.x + den.width / 2)
    expect(num.y + num.descent).toBeLessThan(rule.y1 - rule.strokeWidth / 2)
    expect(den.y - den.ascent).toBeGreaterThan(rule.y1 + rule.strokeWidth / 2)
    near(rule.y1, -options.getMathMetrics(options).axisHeight)
  })

  it.each(['sSubSup', 'sPre'])('places %s slots without changing authored order', (type) => {
    const children = [arg('e', 'X'), arg('sub', 'jj'), arg('sup', 'WW')]
    if (type === 'sPre') children.push(children.shift())
    const box = layout(doc(node(type, children))).children[0]
    expect(box.children.map((child) => child.type)).toEqual(children.map((child) => child.type))
    const base = box.children.find((child) => child.type === 'e')
    const sub = box.children.find((child) => child.type === 'sub')
    const sup = box.children.find((child) => child.type === 'sup')
    expect(sup.y + sup.descent).toBeLessThan(sub.y - sub.ascent)
    expect(type === 'sPre' ? sub.x + sub.width <= base.x : sub.x >= base.width).toBe(true)
    near(flatten(sup).find((child) => child.type === 't').primitives[0].style.fontSize, 16.8)
  })

  it('renders radical degree and overbar, limits, n-ary operator and delimited matrix', () => {
    const matrix = node('m', [
      node('mr', [arg('e', 'WW'), arg('e', '1')]),
      node('mr', [arg('e', 'i'), arg('e', '222')]),
    ])
    const input = doc(
      node('rad', [arg('deg', '3'), arg('e', 'x')]),
      node('limLow', [arg('e', 'lim'), arg('lim', 'x')]),
      node('nary', [
        node('naryPr', [val('chr', '\u2211'), val('limLoc', 'undOvr')]),
        arg('sub', '0'),
        arg('sup', 'n'),
        arg('e', 'x'),
      ]),
      node('d', [node('dPr', [val('begChr', '['), val('endChr', ']')]), node('e', [matrix])])
    )
    const result = renderOmmlDocument(input, options)
    const [radical, limit, nary, delimiter] = result.layout.children
    expect(radical.primitives.some((primitive) => primitive.kind === 'line')).toBe(true)
    expect(radical.children.find((child) => child.type === 'deg').y).toBeLessThan(0)
    expect(limit.children[1].y).toBeGreaterThan(limit.children[0].descent)
    expect(nary.children.map((child) => child.type)).toEqual(['sub', 'sup', 'e'])
    const rows = flatten(delimiter).find((child) => child.type === 'm').children
    expect(rows[1].y - rows[1].ascent).toBeGreaterThan(rows[0].y + rows[0].descent)
    near(
      rows[0].children[0].x + rows[0].children[0].width / 2,
      rows[1].children[0].x + rows[1].children[0].width / 2
    )
    expect(result.svg).toContain('\u2211')
    expect(result.svg).toContain('\u221a')
  })

  it('applies run font, half-point size, color and bold before measurement and SVG escaping', () => {
    const input = doc(
      run('<x & "y">', [
        node('rPr', [val('b', '1', W), val('sz', '36', W), val('color', 'AABBCC', W)], [], W),
      ])
    )
    const result = renderOmmlDocument(input, options)
    const text = flatten(result.layout).find((child) => child.type === 't').primitives[0]
    expect(text.style).toMatchObject({ fontSize: 24, bold: true, color: '#AABBCC' })
    const svg = new JSDOM(result.svg, { contentType: 'image/svg+xml' }).window.document
    expect(svg.querySelector('text').textContent).toBe('<x & "y">')
    expect(svg.querySelector('text').getAttribute('font-weight')).toBe('bold')
    expect(svg.querySelector('parsererror')).toBeNull()
  })

  it('rejects unsupported properties at their exact component and path without mutating source', () => {
    const unsupported = val('brk', '1')
    unsupported.attributes = []
    const input = doc(run('x', [node('rPr', [unsupported])]))
    const before = JSON.stringify(input)
    expect(() => layout(input)).toThrow(
      expect.objectContaining({
        code: 'PPTX_OMML_RENDER_UNSUPPORTED',
        componentId: unsupported.componentId,
        path: [0, 0, 0],
      })
    )
    expect(JSON.stringify(input)).toBe(before)
  })

  it('requires measured glyphs and explicit math metrics rather than guesses', () => {
    const input = doc(run('x'))
    expect(() => layoutOmmlDocument(input, { ...options, measureText: undefined })).toThrow()
    expect(() => layoutOmmlDocument(input, { ...options, getMathMetrics: undefined })).toThrow()
    expect(() =>
      layoutOmmlDocument(input, {
        ...options,
        measureText: () => ({ advanceWidth: NaN }),
      })
    ).toThrow(
      expect.objectContaining({ componentId: input.root.children[0].children[0].componentId })
    )
  })
})
