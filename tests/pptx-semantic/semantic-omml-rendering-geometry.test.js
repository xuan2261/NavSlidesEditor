import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { A, arg, doc, flatten, node, options, run, val } from './omml-rendering-fixtures'

const require = createRequire(import.meta.url)
const { renderOmmlDocument } = require('../../shared/src/pptx-omml-renderer')
const render = (...atoms) => renderOmmlDocument(doc(...atoms), options)
const lines = (box) => box.primitives.filter((p) => p.kind === 'line')

describe('OMML derived geometry and nonflattening boundaries', () => {
  it.each(['bar', 'noBar', 'lin', 'skw'])(
    'retains numerator/denominator for %s fractions',
    (type) => {
      const result = render(
        node('f', [node('fPr', [val('type', type)]), arg('num', 'abc'), arg('den', 'd')])
      )
      const box = result.layout.children[0]
      expect(box.children.map((child) => child.type)).toEqual(['num', 'den'])
      expect(lines(box).length).toBe(type === 'bar' ? 1 : 0)
      if (['lin', 'skw'].includes(type)) {
        expect(box.children[1].x).toBeGreaterThan(box.children[0].width)
        expect(result.svg).toContain('\u2044')
      } else expect(box.children[0].y).toBeLessThan(box.children[1].y)
    }
  )

  it('keeps hidden radical degrees and operator limits in derived source tree but not paint', () => {
    const result = render(
      node('rad', [node('radPr', [node('degHide')]), arg('deg', 'DO_NOT_PAINT'), arg('e', 'x')]),
      node('nary', [
        node('naryPr', [node('subHide'), val('supHide', 'true')]),
        arg('sub', 'HIDDEN_LOW'),
        arg('sup', 'HIDDEN_HIGH'),
        arg('e', 'x'),
      ])
    )
    expect(result.svg).not.toMatch(/DO_NOT_PAINT|HIDDEN_LOW|HIDDEN_HIGH/)
    expect(result.document.root.children[0].children[1].children[0].children[0].text).toBe(
      'DO_NOT_PAINT'
    )
    const hidden = flatten(result.layout).filter((b) => b.hidden)
    expect(hidden.map((b) => b.type)).toEqual(['deg', 'sub', 'sup'])
    expect(hidden.every((b) => b.width === 0 && b.ascent === 0 && b.descent === 0)).toBe(true)
  })

  it('aligns declared matrix columns and top/bottom baselines from measured cells', () => {
    const make = (baseJc) =>
      node('m', [
        node('mPr', [
          val('baseJc', baseJc),
          node('mcs', [
            node('mc', [node('mcPr', [val('count', '1'), val('mcJc', 'right')])]),
            node('mc', [node('mcPr', [val('mcJc', 'left')])]),
          ]),
        ]),
        node('mr', [arg('e', 'i'), arg('e', 'WW')]),
        node('mr', [arg('e', 'WWW'), arg('e', 'i')]),
      ])
    for (const alignment of ['top', 'bottom']) {
      const rows = render(make(alignment)).layout.children[0].children
      expect(rows[alignment === 'top' ? 0 : 1].y).toBe(0)
      expect(rows[0].children[0].x + rows[0].children[0].width).toBeCloseTo(
        rows[1].children[0].x + rows[1].children[0].width,
        8
      )
      expect(rows[0].children[1].x).toBe(rows[1].children[1].x)
    }
  })

  it('renders accents, bars, border strikes, grouping characters, functions and upper limits', () => {
    const result = render(
      node('acc', [arg('e', 'xy')]),
      node('bar', [node('barPr', [val('pos', 'bot')]), arg('e', 'z')]),
      node('borderBox', [
        node('borderBoxPr', [node('strikeBLTR'), node('hideTop')]),
        arg('e', 'w'),
      ]),
      node('groupChr', [arg('e', 'x+y')]),
      node('func', [arg('fName', 'sin'), arg('e', 'x')]),
      node('limUpp', [arg('e', 'lim'), arg('lim', 'n')]),
      node('box', [arg('e', 'u')])
    )
    const [accent, bar, border, group, func, limit] = result.layout.children
    expect(accent.ascent).toBeGreaterThan(accent.children[0].ascent)
    expect(lines(bar)[0].y1).toBeGreaterThan(bar.children[0].descent)
    expect(lines(border)).toHaveLength(4)
    expect(group.descent).toBeGreaterThan(group.children[0].descent)
    const text = flatten(func.children[0]).find((b) => b.type === 't')
    expect(text.primitives[0].style.italic).toBe(false)
    expect(limit.children[1].y + limit.children[1].descent).toBeLessThan(-limit.children[0].ascent)
  })

  it('stacks equation array rows without joining or inventing paragraph breaks', () => {
    const input = {
      schemaVersion: 1,
      root: node('oMathPara', [
        node('oMathParaPr', [val('jc', 'right')]),
        node('oMath', [node('eqArr', [arg('e', 'WW'), arg('e', 'y')])]),
      ]),
    }
    const { layout } = renderOmmlDocument(input, options)
    expect(layout.children[0].x + layout.children[0].width).toBeCloseTo(layout.width, 8)
    const rows = layout.children[0].children[0].children
    expect(rows[1].y - rows[1].ascent).toBeGreaterThan(rows[0].y + rows[0].descent)
    input.root.children.push(node('oMath', [run('z')]))
    expect(() => renderOmmlDocument(input, options)).toThrow(/paragraph line-layout context/)
  })

  it('honors invisible phantom extents and explicit zero dimensions', () => {
    const full = render(node('phant', [arg('e', 'WWW')])).layout.children[0]
    const zero = render(
      node('phant', [
        node('phantPr', [node('zeroWid'), node('zeroAsc'), node('zeroDesc')]),
        arg('e', 'WWW'),
      ])
    )
    expect(full.width).toBeGreaterThan(0)
    expect(full.hidden).toBe(true)
    expect(zero.layout.width).toBe(0)
    expect(zero.svg).not.toContain('WWW')
  })

  it('applies DrawingML run baseline and explicit sizes to measured ink bounds', () => {
    const pr = node(
      'rPr',
      [],
      [
        { namespaceUri: '', name: 'sz', value: '3000' },
        { namespaceUri: '', name: 'baseline', value: '25000' },
      ],
      A
    )
    const result = render(run('x', [pr]))
    const r = result.layout.children[0],
      t = r.children[0]
    expect(t.primitives[0].style.fontSize).toBe(40)
    expect(t.y).toBe(-10)
    expect(r.ascent).toBe(t.ascent + 10)
  })

  it.each([
    () => node('r', [node('rPr', [val('scr', 'double-struck')]), { ...node('t'), text: 'x' }]),
    () => node('m', [node('mPr', [val('rSpRule', '3')]), node('mr', [arg('e', 'x')])]),
    () =>
      node('nary', [
        node('naryPr', [node('grow')]),
        arg('sub', 'i'),
        arg('sup', 'n'),
        arg('e', 'x'),
      ]),
    () => node('eqArr', [node('eqArrPr', [node('maxDist')]), arg('e', 'x')]),
  ])('fails located for admitted features without a renderer implementation', (make) => {
    expect(() => render(make())).toThrow(
      expect.objectContaining({
        code: 'PPTX_OMML_RENDER_UNSUPPORTED',
        componentId: expect.any(String),
        path: expect.any(Array),
      })
    )
  })

  it('recomputes after source edits and does not store derived SVG in the editable document', () => {
    const source = doc(run('i'))
    const a = renderOmmlDocument(source, options)
    source.root.children[0].children[0].text = 'WWWW'
    const b = renderOmmlDocument(source, options)
    expect(b.layout.width).toBeGreaterThan(a.layout.width)
    expect(Object.keys(b.document)).toEqual(['schemaVersion', 'root'])
    expect(a.document.root.children[0].children[0].text).toBe('i')
  })
})
