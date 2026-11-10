import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { applyNativeTextStyles } from './ooxml-native-text-style.js'
import { extractTextMetadata } from './mapper/utils-text.js'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const ns = `xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"`
const text = '<a:p><a:r><a:rPr sz="2800"/><a:t>Native</a:t></a:r></a:p>'
const face = (font) => `<a:lvl1pPr><a:defRPr><a:latin typeface="${font}"/></a:defRPr></a:lvl1pPr>`
const shape = ({ name = 'Native', id = 2, ph = '', bodyPr = '', list = '', paragraphs = text } = {}) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody><a:bodyPr ${bodyPr}/><a:lstStyle>${list}</a:lstStyle>${paragraphs}</p:txBody></p:sp>`
const part = (kind, content, extra = '') => `<p:${kind} ${ns}><p:cSld><p:spTree>${content}</p:spTree></p:cSld>${extra}</p:${kind}>`
const rels = (type, target) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/${type}" Target="${target}"/></Relationships>`
const raw = (extra = {}) => ({ name: 'Native', type: 'text', vAlign: 'down',
  content: '<p><span style="font-family:Verdana;font-size:28pt;color:#999999">Native</span></p>', ...extra })
async function fixture(slideShape = shape(), defaults = face('Times New Roman')) {
  const zip = new JSZip()
  zip.file('ppt/presentation.xml', `<p:presentation ${ns}><p:sldIdLst><p:sldId id="100" r:id="rId1"/></p:sldIdLst><p:defaultTextStyle>${defaults}</p:defaultTextStyle></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', rels('slide', 'slides/slide18.xml'))
  zip.file('ppt/slides/slide18.xml', part('sld', slideShape))
  return zip
}
const apply = (zip, element = raw()) => applyNativeTextStyles({ zip, slide: { elements: [element] }, slideIndex: 0,
  scale: { x: 1, y: 1 }, themeInfo: { fonts: { major: 'Wrong Theme Font', minor: 'Wrong Theme Font' }, scheme: { tx1: '#123456' } } })

async function withPlaceholderInheritance(bodyPr = '') {
  const zip = await fixture(shape({ ph: '<p:ph idx="5"/>', bodyPr }))
  zip.file('ppt/slides/_rels/slide18.xml.rels', rels('slideLayout', '../slideLayouts/slideLayout12.xml'))
  zip.file('ppt/slideLayouts/slideLayout12.xml', part('sldLayout', shape({ ph: '<p:ph type="body" idx="5"/>',
    bodyPr: 'anchor="ctr" spcFirstLastPara="true"', list: '<a:lvl1pPr><a:spcBef><a:spcPct val="20000"/></a:spcBef></a:lvl1pPr>' })))
  zip.file('ppt/slideLayouts/_rels/slideLayout12.xml.rels', rels('slideMaster', '../slideMasters/slideMaster2.xml'))
  zip.file('ppt/slideMasters/slideMaster2.xml', part('sldMaster', shape({ ph: '<p:ph type="body" idx="1"/>', list: face('Arial') }),
    `<p:txStyles><p:bodyStyle>${face('Courier New')}</p:bodyStyle></p:txStyles>`))
  return zip
}

async function withTheme() {
  const zip = await withPlaceholderInheritance()
  const paragraphs = '<a:p><a:r><a:rPr><a:latin typeface="+mn-lt"/><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:rPr><a:t>Native</a:t></a:r></a:p>'
  zip.file('ppt/slides/slide18.xml', part('sld', shape({ ph: '<p:ph idx="5"/>', paragraphs })))
  zip.file('ppt/slideMasters/slideMaster2.xml', part('sldMaster', '', '<p:clrMap tx1="lt1"/>'))
  zip.file('ppt/slideMasters/_rels/slideMaster2.xml.rels', rels('theme', '../theme/theme2.xml'))
  zip.file('ppt/theme/theme2.xml', `<a:theme ${ns}><a:themeElements><a:fontScheme><a:minorFont><a:latin typeface="Courier New"/></a:minorFont></a:fontScheme><a:clrScheme><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:accent1><a:srgbClr val="00AA00"/></a:accent1></a:clrScheme></a:themeElements></a:theme>`)
  return zip
}

describe('native source provenance and placeholder text inheritance', () => {
  it('does not replace a placeholder master font with the ordinary-shape presentation default', async () => {
    const corrected = (await apply(await withPlaceholderInheritance())).elements[0]
    expect(extractTextMetadata(corrected.content)).toMatchObject({ fontFamily: 'Arial', fontSize: 28, textColor: '#999999' })
    expect(corrected.vAlign).toBe('mid')
    expect(Number(corrected.content.match(/padding-top:\s*([\d.]+)/u)?.[1])).toBe(0.2)
  })

  it('does not apply ordinary presentation font defaults to unresolved placeholders', async () => {
    const corrected = (await apply(await fixture(shape({ ph: '<p:ph type="body" idx="5"/>' })))).elements[0]
    expect(extractTextMetadata(corrected.content)).toMatchObject({ fontFamily: 'Verdana', textColor: '#999999' })
  })

  it.each([['spcPct', '120000', '1.2'], ['spcPts', '600', '4.5px']])('converts explicit %s line spacing without a font-size change', async (kind, amount, expected) => {
    const paragraphs = `<a:p><a:pPr><a:lnSpc><a:${kind} val="${amount}"/></a:lnSpc></a:pPr><a:r><a:rPr sz="2800"/><a:t>Native</a:t></a:r></a:p>`
    const zip = await fixture(shape({ paragraphs }))
    const corrected = (await applyNativeTextStyles({ zip, slide: { elements: [raw()] }, slideIndex: 0,
      scale: { x: 1.5, y: 0.75 }, themeInfo: {} })).elements[0]
    expect(corrected.content).toContain(`line-height: ${expected};`)
    expect(corrected.content).toContain('font-size:28pt')
  })

  it('preserves explicit anchor and false first/last flags before inherited true', async () => {
    const corrected = (await apply(await withPlaceholderInheritance('anchor="b" spcFirstLastPara="0"'))).elements[0]
    expect(corrected.vAlign).toBe('down')
    expect(Number(corrected.content.match(/padding-top:\s*([\d.]+)/u)?.[1])).toBe(0)
  })

  it('resolves exact native master origins even when a foreground shape has the same name', async () => {
    const zip = await fixture(shape({ list: face('Arial') }))
    zip.file('ppt/slideMasters/slideMaster2.xml', part('sldMaster', shape({ list: face('Courier New'), bodyPr: 'anchor="ctr"' })))
    const corrected = (await apply(zip, raw({ _pptxNativePartUri: 'ppt/slideMasters/slideMaster2.xml' }))).elements[0]
    expect(extractTextMetadata(corrected.content).fontFamily).toBe('Courier New')
    expect(corrected.vAlign).toBe('mid')
  })

  it('uses an exact source ID despite duplicate shape names, leaving ambiguous names unchanged', async () => {
    const zip = await fixture(shape({ id: 2, list: face('Arial') }) + shape({ id: 3, list: face('Courier New') }))
    const ambiguous = raw()
    expect((await apply(zip, ambiguous)).elements[0]).toBe(ambiguous)
    const corrected = (await apply(zip, raw({ sourceId: 3 }))).elements[0]
    expect(extractTextMetadata(corrected.content).fontFamily).toBe('Courier New')
  })

  it('matches decoded native names and keeps named grouped children intact', async () => {
    const zip = await fixture(`<p:grpSp>${shape({ name: 'Body &amp; Text', list: face('Arial') })}</p:grpSp>`)
    const group = { type: 'group', elements: [raw({ name: 'Body & Text' })] }
    const corrected = (await apply(zip, group)).elements[0]
    expect(corrected.type).toBe('group')
    expect(extractTextMetadata(corrected.elements[0].content).fontFamily).toBe('Arial')
    expect(group.elements[0].content).toContain('font-family:Verdana')
  })

  it('leaves unresolved fonts and transformed colors in parser rich text instead of guessing defaults', async () => {
    const paragraphs = '<a:p><a:r><a:rPr><a:ea typeface="+mn-ea"/><a:solidFill><a:srgbClr val="AA0000"><a:alpha val="50000"/></a:srgbClr></a:solidFill></a:rPr><a:t>中文</a:t></a:r></a:p>'
    const corrected = (await apply(await fixture(shape({ paragraphs })), raw({ content: raw().content.replace('>Native<', '>中文<') }))).elements[0]
    expect(extractTextMetadata(corrected.content)).toMatchObject({ fontFamily: 'Verdana', textColor: '#999999' })
  })

  it('leaves an undeclared ordinary source font unchanged while resolving native normal layout', async () => {
    const corrected = (await apply(await fixture(shape(), ''))).elements[0]
    expect(extractTextMetadata(corrected.content).fontFamily).toBe('Verdana')
    expect(corrected.content).toContain('line-height: normal')
    expect(corrected.vAlign).toBe('up')
  })

  it('preserves empty paragraph markup rather than truncating a trailing paragraph', async () => {
    const zip = await fixture(shape({ paragraphs: text + '<a:p><a:endParaRPr/></a:p>' }))
    const corrected = (await apply(zip, raw({ content: raw().content + '<p><span>&nbsp;</span></p>' }))).elements[0]
    expect(corrected.content).toContain('<span>&nbsp;</span>')
    expect((corrected.content.match(/<p /g) || []).length).toBe(2)
  })

  it('uses the theme linked to the applicable master, not the deck-wide first theme', async () => {
    const zip = await withPlaceholderInheritance()
    const paragraphs = '<a:p><a:r><a:rPr><a:latin typeface="+mn-lt"/></a:rPr><a:t>Native</a:t></a:r></a:p>'
    zip.file('ppt/slides/slide18.xml', part('sld', shape({ ph: '<p:ph idx="5"/>', paragraphs })))
    zip.file('ppt/slideMasters/_rels/slideMaster2.xml.rels', rels('theme', '../theme/theme2.xml'))
    zip.file('ppt/theme/theme1.xml', `<a:theme ${ns}><a:themeElements><a:fontScheme><a:minorFont><a:latin typeface="Verdana"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`)
    zip.file('ppt/theme/theme2.xml', `<a:theme ${ns}><a:themeElements><a:fontScheme><a:minorFont><a:latin typeface="Courier New"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`)
    expect(extractTextMetadata((await apply(zip)).elements[0].content).fontFamily).toBe('Courier New')
  })

  it('resolves scheme text color through the master map and nearer slide override', async () => {
    const zip = await withPlaceholderInheritance()
    const paragraphs = '<a:p><a:r><a:rPr><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:rPr><a:t>Native</a:t></a:r></a:p>'
    const slideShape = shape({ ph: '<p:ph idx="5"/>', paragraphs })
    zip.file('ppt/slides/slide18.xml', part('sld', slideShape))
    zip.file('ppt/slideMasters/slideMaster2.xml', part('sldMaster', shape({ ph: '<p:ph type="body" idx="1"/>' }), '<p:clrMap tx1="lt1"/>'))
    zip.file('ppt/slideMasters/_rels/slideMaster2.xml.rels', rels('theme', '../theme/theme2.xml'))
    zip.file('ppt/theme/theme2.xml', `<a:theme ${ns}><a:themeElements><a:clrScheme><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:accent1><a:srgbClr val="00AA00"/></a:accent1></a:clrScheme></a:themeElements></a:theme>`)
    expect(extractTextMetadata((await apply(zip)).elements[0].content).textColor).toBe('#FFFFFF')
    zip.file('ppt/slides/slide18.xml', part('sld', slideShape, '<p:clrMapOvr><a:overrideClrMapping tx1="accent1"/></p:clrMapOvr>'))
    expect(extractTextMetadata((await apply(zip)).elements[0].content).textColor).toBe('#00AA00')
  })

  it('prioritizes the inherited explicit paragraph over its list-level default', async () => {
    const zip = await withPlaceholderInheritance()
    const paragraphs = '<a:p><a:pPr><a:defRPr><a:latin typeface="Courier New"/></a:defRPr><a:spcBef><a:spcPct val="30000"/></a:spcBef></a:pPr><a:r><a:t>Native</a:t></a:r></a:p>'
    zip.file('ppt/slideLayouts/slideLayout12.xml', part('sldLayout', shape({ ph: '<p:ph type="body" idx="5"/>', bodyPr: 'spcFirstLastPara="true"', list: face('Arial'), paragraphs })))
    const corrected = (await apply(zip)).elements[0]
    expect(extractTextMetadata(corrected.content).fontFamily).toBe('Courier New')
    expect(Number(corrected.content.match(/padding-top:\s*([\d.]+)/u)?.[1])).toBe(0.3)
  })

  it.each(['missingRelation', 'missingTheme', 'ambiguous', 'external', 'slideOverride', 'layoutOverride', 'masterOverride'])('preserves parser theme-dependent styles for %s association', async (mode) => {
    const zip = await withTheme()
    const masterRels = 'ppt/slideMasters/_rels/slideMaster2.xml.rels'
    if (mode === 'missingRelation') zip.remove(masterRels)
    if (mode === 'missingTheme') zip.remove('ppt/theme/theme2.xml')
    if (mode === 'ambiguous') zip.file(masterRels, rels('theme', '../theme/theme2.xml').replace('</Relationships>', '<Relationship Id="rId2" Type="' + R + '/theme" Target="../theme/theme1.xml"/></Relationships>'))
    if (mode === 'external') zip.file(masterRels, rels('theme', '../theme/theme2.xml').replace('Target=', 'TargetMode="External" Target='))
    if (mode.endsWith('Override')) {
      const target = mode === 'slideOverride' ? 'ppt/slides/_rels/slide18.xml.rels' : mode === 'layoutOverride' ? 'ppt/slideLayouts/_rels/slideLayout12.xml.rels' : masterRels
      zip.file(target, (await zip.file(target).async('string')).replace('</Relationships>', '<Relationship Id="override" Type="' + R + '/themeOverride" Target="../theme/themeOverride1.xml"/></Relationships>'))
    }
    expect(extractTextMetadata((await apply(zip)).elements[0].content)).toMatchObject({ fontFamily: 'Verdana', textColor: '#999999', fontSize: 28 })
  })

  it.each(['', '<a:alpha val="50000"/>'])('does not fabricate missing or transformed source scheme color %s', async (transform) => {
    const zip = await withTheme()
    const color = transform ? `<a:lt1><a:srgbClr val="FFFFFF">${transform}</a:srgbClr></a:lt1>` : ''
    zip.file('ppt/theme/theme2.xml', `<a:theme ${ns}><a:themeElements><a:fontScheme><a:minorFont><a:latin typeface="Courier New"/></a:minorFont></a:fontScheme><a:clrScheme>${color}</a:clrScheme></a:themeElements></a:theme>`)
    expect(extractTextMetadata((await apply(zip)).elements[0].content)).toMatchObject({ fontFamily: 'Courier New', textColor: '#999999' })
  })

  it('uses layout color overrides unless a nearer slide requests the master mapping', async () => {
    const zip = await withTheme()
    zip.file('ppt/slideLayouts/slideLayout12.xml', part('sldLayout', '', '<p:clrMapOvr><a:overrideClrMapping tx1="accent1"/></p:clrMapOvr>'))
    expect(extractTextMetadata((await apply(zip)).elements[0].content).textColor).toBe('#00AA00')
    const source = await zip.file('ppt/slides/slide18.xml').async('string')
    zip.file('ppt/slides/slide18.xml', source.replace('</p:sld>', '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'))
    expect(extractTextMetadata((await apply(zip)).elements[0].content).textColor).toBe('#FFFFFF')
  })

  it('honors native child IDs over parser IDs and preserves unmatched provenance', async () => {
    const zip = await fixture(shape({ id: 2, list: face('Arial') }) + shape({ id: 3, list: face('Courier New') }))
    const source = { nodeId: '3', kind: 'shape' }
    const corrected = (await apply(zip, raw({ sourceId: 2, _pptxNativeSource: source, _pptxNativePartUri: 'ppt/slides/slide18.xml', _pptxNativeLayer: 'master' }))).elements[0]
    expect(extractTextMetadata(corrected.content).fontFamily).toBe('Courier New')
    expect(corrected).toMatchObject({ _pptxNativeSource: source, _pptxNativePartUri: 'ppt/slides/slide18.xml', _pptxNativeLayer: 'master' })
    const unmatched = raw({ sourceId: 2, _pptxNativeSource: { nodeId: '3/unmatched-0', kind: 'shape' } })
    expect((await apply(zip, unmatched)).elements[0]).toBe(unmatched)
  })

  it.each(['', '+mn-ea'])('preserves parser font for an unavailable theme Latin face %s', async (font) => {
    const zip = await withTheme()
    zip.file('ppt/theme/theme2.xml', `<a:theme ${ns}><a:themeElements><a:fontScheme><a:minorFont><a:latin typeface="${font}"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`)
    expect(extractTextMetadata((await apply(zip)).elements[0].content).fontFamily).toBe('Verdana')
  })
})
