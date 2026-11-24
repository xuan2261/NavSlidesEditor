import { describe, expect, it } from 'vitest'
import cells from '../src/table-cell-utils.js'
import { renderElement } from '../src/element-renderers.js'
const { createRichTableCell, tableCellText, tableCellHtml, updateTableCellText, replaceTableCellText, tableCellPptxRuns } = cells
const rich = () => createRichTableCell('<p><strong>Head &amp; title</strong></p><p><span style="font-weight:400">Body&nbsp;  words<br>Next &#169;</span></p>')

describe('canonical rich table cells', () => {
  it('decodes exactly once, preserving source NBSP, repeated spaces and paragraph/break boundaries', () => {
    expect(tableCellText(rich())).toBe('Head & title\nBody\u00a0  words\nNext ©')
    expect(tableCellText(createRichTableCell('<p>&amp;nbsp; &amp;amp; &#xA0; &#9;</p>'))).toBe('&nbsp; &amp; \u00a0 \t')
    expect(tableCellText('<b>A&nbsp;</b>')).toBe('<b>A&nbsp;</b>')
    expect(tableCellHtml('<b>A&nbsp;</b>')).toBe('&lt;b&gt;A&amp;nbsp;&lt;/b&gt;')
  })
  it('sanitizes hostile markup in the actual shared HTML consumer without treating strings as HTML', () => {
    const cell = createRichTableCell('<p onclick="alert(1)">Safe<img src="x" onerror="alert(1)"><script>bad()</script><a href="javascript:alert(1)">link</a></p>')
    const html = renderElement({ type:'table', data:[[cell,'<script>literal</script>']], width:300,height:100 }, {}, {})
    expect(html).not.toMatch(/onclick|onerror|javascript:|<script>|<img/)
    expect(html).toContain('&lt;script&gt;literal&lt;/script&gt;')
    expect(tableCellText(cell)).toBe('Safelink')
  })
  it('replaces across styled leaves using decoded offsets and literal replacements without touching attributes', () => {
    const cell = createRichTableCell('<p><b>AB &amp; </b><i>CD AB</i></p><p>tail</p>')
    const next = replaceTableCellText(cell,/AB/g,'<$&>',{start:7,global:false})
    expect(tableCellText(next)).toBe('AB & CD <AB>\ntail')
    expect(tableCellHtml(next)).toContain('&lt;AB&gt;')
    const cross = replaceTableCellText(cell,/& CD/g,'joined')
    expect(tableCellText(cross)).toBe('AB joined AB\ntail')
    expect(tableCellHtml(cross)).toContain('<b>')
    expect(tableCellText(cell)).toBe('AB & CD AB\ntail')
  })
  it('preserves rich formatting around inspector edits and updates paragraph boundaries', () => {
    const cell = rich()
    const next = updateTableCellText(cell,'Head & title\nBody\u00a0  changed\nNext ©')
    expect(tableCellText(next)).toBe('Head & title\nBody\u00a0  changed\nNext ©')
    expect(tableCellHtml(next)).toContain('<strong>Head &amp; title</strong>')
    const joined = updateTableCellText(cell,'Head & titleBody\u00a0  words\nNext ©!')
    expect(tableCellText(joined)).toBe('Head & titleBody\u00a0  words\nNext ©!')
    expect(tableCellText(JSON.parse(JSON.stringify(next)))).toBe(tableCellText(next))
  })
  it.each([
    ['<p></p><p>A</p>', 'X\nA'],
    ['<p>A</p><p></p>', 'A\nX'],
    ['<p>A<br></p>', 'A\nX'],
    ['<p>A<br><br>B</p>', 'A\nX\nB'],
    ['<p></p><p></p><p>A</p>', '\nX\nA'],
  ])('authors empty paragraph and break gaps at their decoded positions: %s', (html, text) => {
    const cell = createRichTableCell(html)
    const edited = updateTableCellText(cell, text)
    expect(tableCellText(edited)).toBe(text)
    expect(tableCellHtml(edited).match(/<p\b/g)).toHaveLength(html.match(/<p\b/g).length)
    expect(tableCellHtml(edited).match(/<br>/g) || []).toHaveLength((html.match(/<br>/g) || []).length)
    const replaced = replaceTableCellText(cell, /\n/g, '\nX', { global: false })
    expect(tableCellText(replaced)).toBe(tableCellText(cell).replace(/\n/, '\nX'))
  })
  it('exports explicit mixed weight, whitespace and paragraph boundaries as rich PPTX runs', () => {
    const runs = tableCellPptxRuns(rich())
    expect(runs.filter(r => r.text).map(r=>r.text).join('')).toBe('Head & titleBody\u00a0  wordsNext ©')
    expect(runs.find(r=>r.text.startsWith('Head')).options.bold).toBe(true)
    expect(runs.find(r=>r.text.startsWith('Body')).options.bold).toBe(false)
    expect(runs.filter(r=>r.options.breakLine)).toHaveLength(2)
    expect(tableCellPptxRuns(0)).toBe('0')
  })
})
