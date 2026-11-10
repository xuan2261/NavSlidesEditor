import { describe, expect, it } from 'vitest'
import { isRichTableCell, mergeInlineStyle, parseHtmlTree, tableCellHtml, tableCellText, tableCellPptxRuns } from 'revealjs-shared'
import { renderElement } from '../../../../shared/src/element-renderers.js'
import tableMapper from './map-table.js'
import { mapperContext } from './table-source-regression-fixtures.js'

function mapCell(text, props = {}, scale = { x: 1, y: 1 }) {
  return tableMapper.mapTable({ type: 'table', width: 200, height: 80, data: [[{ text, ...props }]] }, mapperContext(scale))[0]
}
function textStyles(html) {
  const entries = []
  const visit = (node, inherited = {}) => {
    if (node.type === 'text') {
      if (node.text.trim()) entries.push({ text: node.text, style: inherited })
      return
    }
    const resolved = node.type === 'element' ? mergeInlineStyle(inherited, node) : inherited
    // An explicit normal weight resets CSS inheritance; mergeInlineStyle only sets bold.
    if (/(?:^|;)\s*font-weight\s*:\s*(?:normal|[1-5]00)\s*(?:;|$)/i.test(node.attrs?.style || '')) resolved.bold = false
    for (const child of node.children || []) visit(child, resolved)
  }
  visit(parseHtmlTree(html))
  return entries
}

describe('canonical rich table import typography', () => {
  it('emits sanitized HTML as the sole rich authority with 700 heading and 400 body', () => {
    const result = mapCell('<p><span style="font-weight:bold">Heading</span></p><p><span style="font-weight:normal">Body</span></p>', { fontBold: true })
    const rich = result.data[0][0]
    expect(isRichTableCell(rich)).toBe(true)
    expect(Object.keys(rich)).toEqual(['html'])
    expect(tableCellText(rich)).toBe('Heading\nBody')
    const runs = tableCellPptxRuns(rich)
    expect(runs.find((run) => run.text === 'Heading').options.bold).toBe(true)
    expect(runs.find((run) => run.text === 'Body').options.bold).toBe(false)
    const paragraphs = parseHtmlTree(rich.html).children.filter((node) => node.tag === 'p')
    expect(paragraphs).toHaveLength(2)
    for (const paragraph of paragraphs) {
      for (const side of ['top', 'right', 'bottom', 'left']) expect(paragraph.attrs.style).toMatch(new RegExp(`(?:^|;)\\s*margin-${side}:\\s*0px(?:;|$)`))
      expect(paragraph.attrs.style).toMatch(/(?:^|;)\s*line-height:\s*normal(?:;|$)/)
    }
  })

  it('uses explicit normal run styles rather than inheriting a header/cell bold fallback', () => {
    const result = mapCell('<p><b>Heading</b> <span style="font-weight:400">normal</span></p>', { fontBold: true })
    const runs = tableCellPptxRuns(result.data[0][0])
    expect(runs.find((run) => run.text === 'Heading').options.bold).toBe(true)
    expect(runs.find((run) => run.text === 'normal').options.bold).toBe(false)
  })

  it('inherits cell fontBold in unstyled rich runs for rendered HTML and reconstructed PPTX', () => {
    const result = mapCell('<p><span>Inherited</span></p>', { fontBold: true })
    const rich = result.data[0][0]
    expect(isRichTableCell(rich)).toBe(true)
    expect.soft(textStyles(renderElement(result, {}, {})).find((entry) => entry.text === 'Inherited').style.bold).toBe(true)
    const runs = tableCellPptxRuns(rich, { bold: result.cellStyles.isBold[0][0] })
    expect.soft(runs.find((run) => run.text === 'Inherited').options.bold).toBe(true)
  })

  it('preserves an explicit 400 run inside a cell with inherited bold in HTML and reconstructed PPTX', () => {
    const result = mapCell('<p><span>Inherited</span><span style="font-weight:400">Normal</span></p>', { fontBold: true })
    const rendered = textStyles(renderElement(result, {}, {}))
    expect.soft(rendered.map((entry) => ({ text: entry.text, bold: entry.style.bold }))).toEqual([
      { text: 'Inherited', bold: true }, { text: 'Normal', bold: false },
    ])
    const runs = tableCellPptxRuns(result.data[0][0], { bold: result.cellStyles.isBold[0][0] })
    expect.soft(runs.map((run) => ({ text: run.text, bold: run.options.bold }))).toEqual([
      { text: 'Inherited', bold: true }, { text: 'Normal', bold: false },
    ])
  })

  it('recovers sanitized parser point units, then applies canvas scale exactly once for every run', () => {
    const html = '<p><span style="font-size:11pt;font-family:Aptos">Heading</span><span style="font-size:18pt">Body</span></p>'
    const result = mapCell(html, {}, { x: 3, y: 2 })
    expect(isRichTableCell(result.data[0][0])).toBe(true)
    const entries = textStyles(result.data[0][0].html)
    expect(entries.find((entry) => entry.text === 'Heading').style.fontSize).toBe(22)
    expect(entries.find((entry) => entry.text === 'Body').style.fontSize).toBe(36)
    expect(entries.find((entry) => entry.text === 'Heading').style.fontFace).toBe('Aptos')
  })

  it('scales parser point font, absolute line height and letter spacing on their owning axes exactly once', () => {
    const html = '<p style="line-height:12pt"><span style="font-size:11pt;letter-spacing:2pt">Text</span></p>'
    const rich = mapCell(html, {}, { x: 3, y: 2 }).data[0][0]
    expect(isRichTableCell(rich)).toBe(true)
    const consumed = tableCellHtml(rich)
    expect.soft(textStyles(consumed).find((entry) => entry.text === 'Text').style).toMatchObject({ fontSize: 22, charSpacing: 6 })
    const paragraph = parseHtmlTree(consumed).children.find((node) => node.tag === 'p')
    expect.soft(paragraph.attrs.style).toMatch(/(?:^|;)\s*line-height:\s*24px(?:;|$)/)
    const runs = tableCellPptxRuns(rich)
    expect.soft(runs.find((run) => run.text === 'Text').options).toMatchObject({ fontSize: 16.5, charSpacing: 4.5 })
  })

  it('keeps a parser unitless line-height multiplier unchanged under unequal canvas scales', () => {
    const rich = mapCell('<p style="line-height:1.2"><span style="font-size:11pt">Text</span></p>', {}, { x: 3, y: 2 }).data[0][0]
    const consumed = tableCellHtml(rich)
    const paragraph = parseHtmlTree(consumed).children.find((node) => node.tag === 'p')
    expect(paragraph.attrs.style).toMatch(/(?:^|;)\s*line-height:\s*1.2(?:;|$)/)
    expect(textStyles(consumed).find((entry) => entry.text === 'Text').style.fontSize).toBe(22)
  })

  it('retains explicit paragraph line height while eliminating parser paragraph margins', () => {
    const result = mapCell('<p style="margin:10pt 0;line-height:1.25"><span>Text</span></p>')
    const paragraph = parseHtmlTree(result.data[0][0].html).children.find((node) => node.tag === 'p')
    expect(paragraph.attrs.style).toMatch(/line-height:\s*1.25(?:;|$)/)
    for (const side of ['top', 'right', 'bottom', 'left']) expect(paragraph.attrs.style).toMatch(new RegExp(`(?:^|;)\\s*margin-${side}:\\s*0px(?:;|$)`))
  })

  it('does not invent run-boundary spaces or collapse authored spaces and entities', () => {
    const rich = mapCell('<p><b>A</b><span>B &amp; &amp;amp; &lt;x&gt;</span><br>C&nbsp; D  E</p>').data[0][0]
    expect(tableCellText(rich)).toBe('AB & &amp; <x>\nC\u00a0 D  E')
  })

  it('retains safe hyperlinks and removes script/event/unsafe href content before rich emission', () => {
    const rich = mapCell('<p onclick="bad()"><a href="https://example.com">Safe</a><a href="javascript:bad()">Text</a></p><script>bad()</script>').data[0][0]
    expect(isRichTableCell(rich)).toBe(true)
    expect(rich.html).toContain('https://example.com')
    expect(rich.html).not.toMatch(/javascript:|onclick|<script|bad\(\)/)
    expect(tableCellText(rich)).toBe('SafeText')
  })

  it('keeps non-HTML parser text primitive rather than treating literal values as markup', () => {
    expect(mapCell('A &amp; B').data[0][0]).toBe('A &amp; B')
    expect(mapCell(0).data[0][0]).toBe(0)
    expect(mapCell(false).data[0][0]).toBe(false)
  })
})
