import { describe, expect, it } from 'vitest'
import { isRichTableCell, tableCellText } from 'revealjs-shared'
import sourceModule from './table-source-properties.js'
import tableMapper from './map-table.js'
import { cell, fill, frame, mapperContext, packageWithTable, paragraph, parserTable, part, region, run, style } from './table-source-regression-fixtures.js'

async function project(source, original, styles = '') {
  const slide = await sourceModule.applyTableSourceProperties({ slide: { elements: [original] }, zip: packageWithTable(part(source), styles), slideIndex: 0 })
  return { supplemented: slide.elements[0], mapped: tableMapper.mapTable(slide.elements[0], mapperContext())[0] }
}
const basic = (text = 'A', props = '') => frame([[cell(paragraph(run(text)), props)]])
const parsed = (text = '<p>A</p>', props = {}) => parserTable([[{ text, ...props }]])

describe('source table character provenance through canonical mapper', () => {
  it('restores ordinary spaces without changing genuine NBSP, decodes entities once and retains paragraph/br/link structure', async () => {
    const source = frame([[cell(paragraph(run('Heading &amp; more', 'b="1"')) + paragraph(run('Body '), run('linked&#160;text'), '<a:br/>', run('&amp;amp; &lt;tag&gt;')))]])
    const html = '<p><span style="font-size:11pt;font-weight:bold">Heading&nbsp;&amp;&nbsp;more</span></p><p><span style="font-size:11pt;font-weight:normal">Body&nbsp;<a href="https://example.com">linked&nbsp;text</a><br>&amp;amp;&nbsp;&lt;tag&gt;</span></p>'
    const original = parsed(html)
    const { supplemented, mapped } = await project(source, original)
    expect(supplemented.data[0][0].text).toContain('Heading &amp; more')
    expect(original.data[0][0].text).toBe(html)
    expect(isRichTableCell(mapped.data[0][0])).toBe(true)
    expect(Object.keys(mapped.data[0][0])).toEqual(['html'])
    expect(tableCellText(mapped.data[0][0])).toBe('Heading & more\nBody linked\u00a0text\n&amp; <tag>')
    expect(mapped.data[0][0].html).toContain('https://example.com')
    expect(mapped.data[0][0].html).toMatch(/<br\s*\/?\s*>/)
    expect(mapped.data[0][0].html.match(/<p\b/g)).toHaveLength(2)
  })

  it.each([
    ['text mismatch', basic('Other'), parsed('<p>A&nbsp;B</p>')],
    ['paragraph mismatch', basic('A B'), parsed('<p>A&nbsp;</p><p>B</p>')],
    ['missing source body', frame([['<a:tc><a:tcPr/></a:tc>']]), parsed('<p>A&nbsp;B</p>')],
    ['unsupported source text', frame([[cell('<a:p><a:unknown/><a:r><a:t>A B</a:t></a:r></a:p>')]]), parsed('<p>A&nbsp;B</p>')],
    ['conflicting source identity', basic('A B'), parserTable([[{ text: '<p>A&nbsp;B</p>' }]], { sourceId: '99' })],
    ['grid structure mismatch', basic('A B').replace('<a:tblGrid>', '<a:tblGrid><a:gridCol w="12700"/>'), parsed('<p>A&nbsp;B</p>')],
    ['row structure mismatch', frame([[cell(paragraph(run('A B')))], [cell(paragraph(run('C')))]]), parsed('<p>A&nbsp;B</p>')],
    ['foreign DrawingML namespace', basic('A B').replace(/<a:tbl>/, `<a:tbl xmlns:a="urn:not-drawingml">`), parsed('<p>A&nbsp;B</p>')],
  ])('preserves parser cell text for %s', async (_name, source, original) => {
    const { supplemented } = await project(source, original)
    expect(supplemented.data[0][0].text).toBe(original.data[0][0].text)
  })

  it('restores independent matching cells while leaving a nonmatching sibling unchanged', async () => {
    const source = frame([[cell(paragraph(run('A B'))), cell(paragraph(run('Wrong'))) ]])
    const original = parserTable([[{ text: '<p>A&nbsp;B</p>' }, { text: '<p>C&nbsp;D</p>' }]])
    const { supplemented } = await project(source, original)
    expect(supplemented.data[0][0].text).toContain('A B')
    expect(supplemented.data[0][1].text).toBe('<p>C&nbsp;D</p>')
  })

  it('does not borrow character provenance from unrelated duplicate table geometry', async () => {
    const zip = packageWithTable(part(basic('A B'), basic('C D')))
    const original = parserTable([[{ text: '<p>A&nbsp;B</p>' }]], { sourceId: undefined })
    const slide = await sourceModule.applyTableSourceProperties({ slide: { elements: [original] }, zip, slideIndex: 0 })
    expect(slide.elements[0].data[0][0].text).toBe('<p>A&nbsp;B</p>')
  })
})

describe('selected OOXML table fill precedence', () => {
  it('resolves actual tableStyleId through the presentation relationship, not a default ID/name/path', async () => {
    const styles = style('decoy-style', region('wholeTbl', 'FF0000')) + style('selected-style', region('wholeTbl', 'transparent'))
    const source = frame([[cell(paragraph(run('A')))]], { flags: 'firstRow="1"' })
    const { supplemented, mapped } = await project(source, parsed('<p>A</p>', { fillColor: '#123456' }), styles)
    expect(supplemented.data[0][0].fillColor).toBe('transparent')
    expect(mapped.cellStyles.bgColors[0][0]).toBe('transparent')
  })

  it.each([
    ['1', '#445566', '#112233'], ['true', '#445566', '#112233'], ['0', '#112233', '#112233'],
  ])('applies firstRow=%s only to its applicable row', async (flag, first, second) => {
    const source = frame([[cell(paragraph(run('A')))], [cell(paragraph(run('B')))]], { flags: `firstRow="${flag}"` })
    const styles = style('selected-style', region('wholeTbl', '112233') + region('firstRow', '445566'))
    const { mapped } = await project(source, parserTable([[{ text: '<p>A</p>' }], [{ text: '<p>B</p>' }]]), styles)
    expect(mapped.cellStyles.bgColors).toEqual([[first], [second]])
  })

  it('uses direct tcPr fill/noFill above conditional and whole-table styles', async () => {
    const source = frame([[cell(paragraph(run('A')), fill('ABCDEF')), cell(paragraph(run('B')), fill('transparent'))]], { flags: 'firstRow="1"' })
    const styles = style('selected-style', region('wholeTbl', '112233') + region('firstRow', '445566'))
    const { mapped } = await project(source, parserTable([[{ text: '<p>A</p>' }, { text: '<p>B</p>' }]]), styles)
    expect(mapped.cellStyles.bgColors).toEqual([['#ABCDEF', 'transparent']])
  })


  it('resolves direct tcPr noFill even when no style part exists', async () => {
    const { mapped } = await project(basic('A', fill('transparent')), parsed('<p>A</p>', { fillColor: '#123456' }))
    expect(mapped.cellStyles.bgColors[0][0]).toBe('transparent')
  })
  it.each([
    ['missing style', ''],
    ['unknown selected style', style('other-style', region('wholeTbl', 'transparent'))],
    ['transformed fill', style('selected-style', '<a:wholeTbl><a:tcStyle><a:fill><a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="50000"/></a:srgbClr></a:solidFill></a:fill></a:tcStyle></a:wholeTbl>')],
    ['unsupported fill', style('selected-style', '<a:wholeTbl><a:tcStyle><a:fill><a:gradFill/></a:fill></a:tcStyle></a:wholeTbl>')],
    ['foreign style namespace', style('selected-style', region('wholeTbl', 'transparent')).replace('<a:tblStyle ', '<a:tblStyle xmlns:a="urn:foreign" ')],
  ])('keeps parser fill for %s', async (_name, styles) => {
    const { mapped } = await project(basic(), parsed('<p>A</p>', { fillColor: '#123456' }), styles)
    expect(mapped.cellStyles.bgColors[0][0]).toBe('#123456')
  })

  it('does not fall back to wholeTbl when applicable conditional fill is unsupported', async () => {
    const styles = style('selected-style', region('wholeTbl', 'transparent') + '<a:firstRow><a:tcStyle><a:fill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:fill></a:tcStyle></a:firstRow>')
    const source = frame([[cell(paragraph(run('A')))]], { flags: 'firstRow="1"' })
    const { mapped } = await project(source, parsed('<p>A</p>', { fillColor: '#123456' }), styles)
    expect(mapped.cellStyles.bgColors[0][0]).toBe('#123456')
  })

  it('ignores foreign namespace cell properties instead of treating them as direct noFill', async () => {
    const source = basic('A', '<x:noFill xmlns:x="urn:foreign"/>')
    const styles = style('selected-style', region('wholeTbl', 'ABCDEF'))
    const { mapped } = await project(source, parsed(), styles)
    expect(mapped.cellStyles.bgColors[0][0]).toBe('#ABCDEF')
  })
})
