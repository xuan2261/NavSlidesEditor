import { describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { renderSemanticTable } from '../../shared/src/pptx-table-renderer.js'

import { options, table } from './semantic-table-renderer-fixtures.js'

describe('bounded canonical table SVG renderer', () => {
  it('uses authored native dimensions without frame fitting or invented grid/header styles', () => {
    const input = table(),
      before = JSON.stringify(input)
    const svg = renderSemanticTable(input, options())
    expect(svg).toContain('width="300" height="100"')
    expect(svg).toContain('viewBox="0 0 300 100"')
    expect(svg).toContain('transform="translate(100 0)"')
    expect(svg).toContain(' A&lt;&amp; ')
    expect(svg).not.toContain('<line')
    expect(svg).not.toContain('<rect')
    expect(JSON.stringify(input)).toBe(before)
  })
  it('renders only merge anchors while retaining covered rich data unchanged', () => {
    const input = table()
    input.rows[0].cells[0].merge.gridSpan = 2
    Object.assign(input.rows[0].cells[1], { anchorCellId: 'a', merge: { hMerge: true } })
    const before = JSON.stringify(input)
    const svg = renderSemanticTable(input, options())
    expect(svg).toContain('data-pptx-table-cell="a"')
    expect(svg).not.toContain('data-pptx-table-cell="b"')
    expect(svg).not.toContain('covered')
    expect(JSON.stringify(input)).toBe(before)
  })
  it('applies cell margins to measured rich runs and retains explicit breaks and font sizes', () => {
    const input = table(),
      cell = input.rows[0].cells[0]
    cell.properties.marginLeftEmu = 95250
    cell.properties.marginTopEmu = 19050
    cell.textDocument.paragraphs[0].runs.push(
      { componentId: 'br', kind: 'break' },
      { componentId: 'large', kind: 'text', text: 'BIG', properties: { fontSizePt: 24 } }
    )
    const svg = renderSemanticTable(input, options())
    expect(svg).toContain('x="10"')
    expect(svg).toContain('font-size:32px')
    expect(svg).toContain('data-pptx-table-line="1"')
    expect(svg).toContain('data-pptx-text-run="large"')
  })
  it('paints direct fills, alpha, native-width borders and diagonals as visible SVG', async () => {
    const input = table()
    input.rows[0].cells[0].properties = {
      fill: { color: { kind: 'srgb', value: 'FF0000' } },
      borders: {
        bottom: { width: 19050, color: { kind: 'srgb', value: '0000FF' } },
        topLeftToBottomRight: { width: 9525, color: { kind: 'srgb', value: '00FF00' } },
      },
    }
    const svg = renderSemanticTable(input, options())
    expect(svg).toContain('stroke-width="2"')
    expect(svg).toContain('x2="100" y2="100"')
    const image = await loadImage(Buffer.from(svg)),
      canvas = createCanvas(300, 100)
    canvas.getContext('2d').drawImage(image, 0, 0)
    expect([...canvas.getContext('2d').getImageData(80, 20, 1, 1).data]).toEqual([255, 0, 0, 255])
  })
  it.each([
    [
      'rtl',
      (d) => {
        d.properties.rtl = true
      },
    ],
    [
      'vertical cell',
      (d) => {
        d.rows[0].cells[0].properties.verticalText = 'vert'
      },
    ],
    [
      'compound border',
      (d) => {
        d.rows[0].cells[0].properties.borders = { top: { compound: 'dbl' } }
      },
    ],
    [
      'unknown underline',
      (d) => {
        d.rows[0].cells[0].textDocument.paragraphs[0].runs[0].properties = { underline: 'wavy' }
      },
    ],
    [
      'unresolved border',
      (d) => {
        d.rows[0].cells[0].properties.borders = { top: {} }
      },
    ],
    [
      'non-none border end',
      (d) => {
        d.rows[0].cells[0].properties.borders = {
          top: { width: 9525, color: { kind: 'srgb', value: 'FF0000' }, headEnd: { type: 'triangle' } },
        }
      },
    ],
  ])('fails explicitly for unsupported %s rather than dropping styling', (_label, mutate) => {
    const input = table()
    mutate(input)
    expect(() => renderSemanticTable(input, options())).toThrow(/PPTX table render unsupported/)
  })
  it('rejects missing measurement, inherited size, paint, or exact output font mapping', () => {
    for (const mutate of [
      (o) => {
        delete o.measurement
      },
      (o) => {
        delete o.textDefaults.run.fontSizePt
      },
      (o) => {
        delete o.textDefaults.run.color
      },
      (o) => {
        delete o.fontFamilies.main
      },
    ]) {
      const opts = options()
      mutate(opts)
      expect(() => renderSemanticTable(table(), opts)).toThrow()
    }
  })
  it('resolves scheme colors through the existing style helper and rejects missing theme bindings', () => {
    const input = table()
    input.properties.fill = {
      color: { kind: 'scheme', value: 'accent1', transforms: [{ kind: 'alpha', value: 50000 }] },
    }
    expect(() => renderSemanticTable(input, options())).toThrow()
    const opts = options()
    opts.theme = {
      id: 'theme',
      source: { part: 'theme', path: '/' },
      colors: { accent1: 'ABCDEF' },
    }
    expect(renderSemanticTable(input, opts)).toContain('fill="#ABCDEF" fill-opacity="0.5"')
  })
  it('renders covered-cell perimeter styling without exposing covered text', () => {
    const input = table()
    input.rows[0].cells[0].merge.gridSpan = 2
    Object.assign(input.rows[0].cells[1], {
      anchorCellId: 'a',
      merge: { hMerge: true },
      properties: {
        borders: { bottom: { width: 9525, color: { kind: 'srgb', value: 'FF0000' } } },
      },
    })
    const svg = renderSemanticTable(input, options())
    expect(svg).toContain('x1="100" y1="100" x2="300" y2="100"')
    expect(svg).toContain('stroke="#FF0000"')
    expect(svg).not.toContain('>covered</text>')
  })
  it('uses native linear RGB tint for cell paint rather than text color arithmetic', () => {
    const input = table()
    input.rows[0].cells[0].properties.fill = {
      color: { kind: 'srgb', value: '000000', transforms: [{ kind: 'tint', value: 50000 }] },
    }
    expect(renderSemanticTable(input, options())).toContain('fill="#BCBCBC"')
  })
})
