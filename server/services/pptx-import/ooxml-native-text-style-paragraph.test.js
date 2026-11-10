import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { parseHtmlTree } from 'revealjs-shared'
import { applyNativeTextStyles } from './ooxml-native-text-style.js'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const ns = `xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"`
const raw = '<p><span style="font-weight:bold">A&nbsp;&nbsp;&nbsp;&nbsp;B</span></p>'
const shape = (ph, list = '', direct = '', paragraphs = '') => `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Native"/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle>${list}</a:lstStyle>${paragraphs || `<a:p>${direct}<a:r><a:t>A&#9;B</a:t></a:r></a:p>`}</p:txBody></p:sp>`
const part = (kind, content) => `<p:${kind} ${ns}><p:cSld><p:spTree>${content}</p:spTree></p:cSld></p:${kind}>`
const rels = (type, target) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/${type}" Target="${target}"/></Relationships>`
const list = (attributes, children = '') => `<a:lvl1pPr ${attributes}>${children}</a:lvl1pPr>`
const tabs = (values) => `<a:tabLst>${values.map(([pos, align]) => `<a:tab pos="${pos}" algn="${align}"/>`).join('')}</a:tabLst>`
async function fixture(options = {}) {
  const zip = new JSZip()
  zip.file('ppt/presentation.xml', `<p:presentation ${ns}><p:sldIdLst><p:sldId id="100" r:id="rId1"/></p:sldIdLst><p:defaultTextStyle>${options.defaults ?? list('defTabSz="914400"')}</p:defaultTextStyle></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', rels('slide', 'slides/slide1.xml'))
  zip.file('ppt/slides/slide1.xml', part('sld', shape('<p:ph type="body" idx="7"/>', options.list, options.direct, options.paragraphs)))
  zip.file('ppt/slides/_rels/slide1.xml.rels', rels('slideLayout', '../slideLayouts/slideLayout1.xml'))
  zip.file('ppt/slideLayouts/slideLayout1.xml', part('sldLayout', shape('<p:ph type="body" idx="7"/>', options.layout)))
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels('slideMaster', '../slideMasters/slideMaster1.xml'))
  zip.file('ppt/slideMasters/slideMaster1.xml', part('sldMaster', shape('<p:ph type="body" idx="1"/>', options.master)))
  return zip
}
const styles = (node) => Object.fromEntries(String(node.attrs.style || '').split(';').filter((entry) => entry.trim())
  .map((entry) => { const colon = entry.indexOf(':'); return [entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()] }))
const stops = (style) => (style['--pptx-tab-stops'] || '').split(',').filter(Boolean)
  .map((entry) => { const [position, align] = entry.split(':'); return { position: Number(position), align } })
async function apply(options, content = raw, scale = { x: 0.75, y: 0.75 }) {
  const zip = await fixture(options)
  const result = await applyNativeTextStyles({ zip, slideIndex: 0, scale,
    slide: { elements: [{ type: 'text', name: 'Native', content }] } })
  return result.elements[0].content
}

describe('native paragraph indentation and tab inheritance', () => {
  it('keeps inherited default tab distance and source first-line indent at mapped scale', async () => {
    const result = parseHtmlTree(await apply({ direct: '<a:pPr indent="457189" algn="just"/>' })).children[0]
    const css = styles(result)
    expect(parseFloat(css['tab-size'])).toBe(54)
    expect(parseFloat(css['text-indent'])).toBeCloseTo(27, 2)
    expect(css['text-align']).toBe('justify')
    expect(css['white-space']).toBe('pre-wrap')
  })

  it.each([
    [{ direct: '<a:pPr defTabSz="457200"/>', list: list('defTabSz="609600"'), layout: list('defTabSz="304800"'), master: list('defTabSz="152400"') }, 27],
    [{ list: list('defTabSz="609600"'), layout: list('defTabSz="304800"'), master: list('defTabSz="152400"') }, 36],
    [{ layout: list('defTabSz="304800"'), master: list('defTabSz="152400"') }, 18],
    [{ master: list('defTabSz="152400"') }, 9],
    [{}, 54],
  ])('uses the nearest source paragraph tab declaration for %j', async (options, expected) => {
    const css = styles(parseHtmlTree(await apply(options)).children[0])
    expect(parseFloat(css['tab-size'])).toBe(expected)
  })
  it('honors zero indent ahead of inherited hanging indentation and retains paragraph margins', async () => {
    const css = styles(parseHtmlTree(await apply({ direct: '<a:pPr indent="0" marL="304800" marR="152400"/>',
      list: list('indent="-457200"') })).children[0])
    expect(parseFloat(css['text-indent'])).toBe(0)
    expect(parseFloat(css['margin-left'])).toBe(18)
    expect(parseFloat(css['margin-right'])).toBe(9)
  })

  it('inherits aligned stops without merging a nearer explicit list into the ancestor list', async () => {
    const inherited = list('', tabs([[914400, 'r'], [1828800, 'ctr']]))
    const inheritedCss = styles(parseHtmlTree(await apply({ master: inherited })).children[0])
    expect(stops(inheritedCss)).toEqual([{ position: 54, align: 'r' }, { position: 108, align: 'ctr' }])
    const direct = `<a:pPr>${tabs([[1371600, 'dec'], [457200, 'l']])}</a:pPr>`
    const css = styles(parseHtmlTree(await apply({ master: inherited, direct })).children[0])
    expect(stops(css)).toEqual([{ position: 27, align: 'l' }, { position: 81, align: 'dec' }])
  })

  it('preserves explicit source stop declarations even when the paragraph has no current tabs', async () => {
    const output = await apply({ master: list('', tabs([[914400, 'r']])),
      paragraphs: '<a:p><a:r><a:t>Plain text</a:t></a:r></a:p>' }, '<p>Plain&nbsp;text</p>')
    expect(stops(styles(parseHtmlTree(output).children[0]))).toEqual([{ position: 54, align: 'r' }])
  })

  it('lets an explicitly empty tab list suppress inherited stops while preserving actual tabs', async () => {
    const output = await apply({ master: list('', tabs([[914400, 'r']])), direct: '<a:pPr><a:tabLst/></a:pPr>' })
    const css = styles(parseHtmlTree(output).children[0])
    expect(stops(css)).toEqual([])
    expect(output.includes('\t')).toBe(true)
  })

  it('uses the OOXML default distance when no source paragraph declares defTabSz', async () => {
    const css = styles(parseHtmlTree(await apply({ defaults: '' })).children[0])
    expect(parseFloat(css['tab-size'])).toBe(54)
  })

  it.each(['defTabSz="0"', 'defTabSz="3000000000"', 'rtl="1"', 'indent="bad"'])('retains parser fallback for unsupported tab layout %s', async (attrs) => {
    expect(await apply({ direct: `<a:pPr ${attrs}/>` })).toBe(raw)
  })
  it.each([
    { entries: [[-1, 'l']] },
    { entries: [[914400, 'invalid']] },
    { entries: [[3000000000, 'l']] },
    { entries: Array.from({ length: 257 }, (_, index) => [index, 'l']) },
  ])('retains parser fallback for invalid or excessive explicit tab stops', async ({ entries }) => {
    expect(await apply({ direct: `<a:pPr>${tabs(entries)}</a:pPr>` })).toBe(raw)
  })

  it('rejects invalid horizontal scale before deriving source tab coordinates', async () => {
    await expect(apply({}, raw, { x: 0, y: 0.75 })).rejects.toThrow(TypeError)
  })

  it('represents adjacent before and after spacing additively without collapsible margins', async () => {
    const spacing = '<a:pPr><a:spcBef><a:spcPts val="400"/></a:spcBef><a:spcAft><a:spcPts val="400"/></a:spcAft></a:pPr>'
    const paragraphs = `<a:p>${spacing}<a:r><a:t>First</a:t></a:r></a:p><a:p>${spacing}<a:r><a:t>Second</a:t></a:r></a:p>`
    const output = await apply({ paragraphs }, '<p>First</p><p>Second</p>', { x: 1, y: 1 })
    const [first, second] = parseHtmlTree(output).children.map(styles)
    expect(parseFloat(first['padding-bottom']) + parseFloat(second['padding-top'])).toBe(8)
    expect([first['margin-bottom'], second['margin-top']].every((value) => parseFloat(value) === 0)).toBe(true)
  })
})
