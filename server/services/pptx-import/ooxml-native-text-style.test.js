import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { parseHtmlTree, mergeInlineStyle } from 'revealjs-shared'
import { applyNativeTextStyles } from './ooxml-native-text-style.js'
import { extractTextMetadata } from './mapper/utils-text.js'
import { decodeXml } from './ooxml-text-run-xml.js'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const namespaces = `xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"`
const themeInfo = { fonts: { major: 'Verdana', minor: 'Verdana' }, scheme: { accent1: '#123456' } }
const defaults = '<a:lvl1pPr><a:defRPr><a:solidFill><a:srgbClr val="07170A"/></a:solidFill><a:latin typeface="Times New Roman"/></a:defRPr></a:lvl1pPr>'
const run = (text, props = 'sz="2800"', children = '') => `<a:r><a:rPr ${props}>${children}</a:rPr><a:t>${text}</a:t></a:r>`
const para = (text, pPr = '', props, children) => `<a:p>${pPr ? `<a:pPr>${pPr}</a:pPr>` : ''}${run(text, props, children)}</a:p>`
const shape = (paragraphs, options = {}) => `<p:sp><p:nvSpPr><p:cNvPr id="${options.id || 2}" name="${options.name || 'Rectangle 1'}"/><p:cNvSpPr/><p:nvPr>${options.ph || ''}</p:nvPr></p:nvSpPr>${options.ref || ''}<p:txBody><a:bodyPr ${options.bodyPr || ''}/><a:lstStyle>${options.list || ''}</a:lstStyle>${paragraphs}</p:txBody></p:sp>`
const part = (kind, content) => `<p:${kind} ${namespaces}><p:cSld><p:spTree>${content}</p:spTree></p:cSld></p:${kind}>`
const rels = (type, target, id = 'rId19') => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/></Relationships>`
const html = (text, style = '') => `<p style="margin-top:20em;margin-bottom:9pt;${style}"><span style="font-family:Verdana;font-size:28pt;color:#999999;">${text}</span></p>`
const element = (content, extra = {}) => ({ type: 'shape', name: 'Rectangle 1', content, left: 48, top: 118, width: 882, height: 383, ...extra })
async function fixture(xml, options = {}) {
  const zip = new JSZip()
  zip.file('ppt/presentation.xml', `<p:presentation ${namespaces}><p:sldIdLst><p:sldId id="100" r:id="rId19"/></p:sldIdLst><p:defaultTextStyle>${options.defaults ?? defaults}</p:defaultTextStyle></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', rels('slide', 'slides/slide18.xml'))
  zip.file('ppt/slides/slide18.xml', part('sld', xml))
  // This distractor proves slideIndex arithmetic cannot select the source part.
  zip.file('ppt/slides/slide1.xml', part('sld', shape(para('Wrong source'))))
  return zip
}
async function apply(zip, elements, extra = {}) {
  return applyNativeTextStyles({ zip, slide: { elements }, slideIndex: 0, scale: { x: 1, y: 1 }, themeInfo, ...extra })
}
function leaves(content) {
  const result = []
  function walk(node, style = {}) {
    if (node.type === 'text') { result.push({ text: node.text, ...style }); return }
    const next = mergeInlineStyle(style, node)
    for (const child of node.children || []) walk(child, next)
  }
  walk(parseHtmlTree(content))
  return result
}
function blocks(content) {
  const result = []
  function walk(node) {
    if (node.tag === 'p' || node.tag === 'li') result.push(node)
    for (const child of node.children || []) walk(child)
  }
  walk(parseHtmlTree(content))
  return result
}
const blockStyles = (content) => blocks(content).map((block) => Object.fromEntries(block.attrs.style.split(';')
  .filter((entry) => entry.trim()).map((entry) => entry.split(':').map((part) => part.trim()))))

describe('native OOXML text style correction before editable mapping', () => {
  it('uses source relationship order and presentation defaults without changing font size, geometry or ZIP', async () => {
    const zip = await fixture(shape(para('Body text')))
    const source = await zip.file('ppt/slides/slide18.xml').async('string')
    const raw = element(html('Body&nbsp;text'), { vAlign: 'mid' })
    const slide = await apply(zip, [raw])
    expect(extractTextMetadata(slide.elements[0].content, {}, { x: 1, y: 1 })).toMatchObject({ fontFamily: 'Times New Roman', fontSize: 28, textColor: '#07170A' })
    expect(slide.elements[0]).toMatchObject({ left: 48, top: 118, width: 882, height: 383, vAlign: 'up' })
    expect(slide.elements[0].content).toContain('font-size:28pt')
    expect(raw.content).toBe(html('Body&nbsp;text'))
    expect(await zip.file('ppt/slides/slide18.xml').async('string')).toBe(source)
  })

  it('splits parser-merged spans by exact source run boundaries and retains mixed explicit faces and bold', async () => {
    const source = `<a:p>${run('A', 'sz="2800" b="1"', '<a:latin typeface="Arial"/>')}${run('B')}${run('C', 'sz="2800"', '<a:latin typeface="Courier New"/><a:solidFill><a:srgbClr val="AA0000"/></a:solidFill>')}</a:p>`
    const zip = await fixture(shape(source))
    const corrected = (await apply(zip, [element(html('ABC', 'font-weight:bold;'))])).elements[0].content
    expect(leaves(corrected).map(({ text, fontFace, color }) => ({ text, fontFace, color }))).toEqual([
      { text: 'A', fontFace: 'Arial', color: '#07170A' }, { text: 'B', fontFace: 'Times New Roman', color: '#07170A' },
      { text: 'C', fontFace: 'Courier New', color: '#AA0000' },
    ])
    expect(corrected).toContain('font-weight:bold')
  })

  it('resolves each property independently through paragraph and list defaults before presentation defaults', async () => {
    const pPr = '<a:defRPr><a:solidFill><a:srgbClr val="AA0000"/></a:solidFill></a:defRPr>'
    const list = '<a:lvl1pPr><a:defRPr><a:latin typeface="Arial"/></a:defRPr></a:lvl1pPr>'
    const zip = await fixture(shape(para('Body', pPr), { list }))
    expect(leaves((await apply(zip, [element(html('Body'))])).elements[0].content)[0]).toMatchObject({ fontFace: 'Arial', color: '#AA0000' })
  })

  it('keeps explicit source font references ahead of presentation defaults', async () => {
    const ref = '<p:style><a:fontRef idx="minor"><a:schemeClr val="accent1"/></a:fontRef></p:style>'
    const zip = await fixture(shape(para('Ref'), { ref }))
    zip.file('ppt/slides/_rels/slide18.xml.rels', rels('slideLayout', '../slideLayouts/slideLayout12.xml'))
    zip.file('ppt/slideLayouts/slideLayout12.xml', part('sldLayout', ''))
    zip.file('ppt/slideLayouts/_rels/slideLayout12.xml.rels', rels('slideMaster', '../slideMasters/slideMaster2.xml'))
    zip.file('ppt/slideMasters/slideMaster2.xml', part('sldMaster', ''))
    zip.file('ppt/slideMasters/_rels/slideMaster2.xml.rels', rels('theme', '../theme/theme2.xml'))
    zip.file('ppt/theme/theme2.xml', `<a:theme ${namespaces}><a:themeElements><a:fontScheme><a:minorFont><a:latin typeface="Verdana"/></a:minorFont></a:fontScheme><a:clrScheme><a:accent1><a:srgbClr val="123456"/></a:accent1></a:clrScheme></a:themeElements></a:theme>`)
    expect(leaves((await apply(zip, [element(html('Ref'))])).elements[0].content)[0]).toMatchObject({ fontFace: 'Verdana', color: '#123456' })
  })

  it('converts source percentages and points, applies normal leading and suppresses first/last spacing by default', async () => {
    const sp = '<a:spcBef><a:spcPct val="20000"/></a:spcBef><a:spcAft><a:spcPts val="600"/></a:spcAft>'
    const zip = await fixture(shape(para('First', sp) + para('Middle', sp) + para('Last', sp)))
    const corrected = (await apply(zip, [element(html('First') + html('Middle') + html('Last'))], { scale: { x: 1.5, y: 0.75 } })).elements[0].content
    const styles = blockStyles(corrected)
    expect(styles[0]['padding-top']).toBe('0px')
    expect(styles[1]).toMatchObject({ 'padding-top': '0.2em', 'padding-bottom': '4.5px' })
    expect(styles[2]['padding-bottom']).toBe('0px')
    expect(styles.every((style) => style['line-height'] === 'normal')).toBe(true)
    expect(styles.every((style) => style['margin-top'] === '0px' && style['margin-bottom'] === '0px')).toBe(true)
  })

  it.each(['1', 'true'])('applies first/last spacing for explicit spcFirstLastPara=%s', async (flag) => {
    const zip = await fixture(shape(para('Only', '<a:spcBef><a:spcPct val="20000"/></a:spcBef><a:spcAft><a:spcPts val="600"/></a:spcAft>'), { bodyPr: `spcFirstLastPara="${flag}"` }))
    const style = blockStyles((await apply(zip, [element(html('Only'))])).elements[0].content)[0]
    expect(style).toMatchObject({ 'padding-top': '0.2em', 'padding-bottom': '6px' })
  })

  it('honors explicit zero precedence for all paragraph spacing properties', async () => {
    const properties = ['spcBef', 'spcAft', 'lnSpc']
    const zero = properties.map((key) => `<a:${key}><a:spcPct val="0"/></a:${key}>`).join('')
    const list = `<a:lvl1pPr>${properties.map((key) => `<a:${key}><a:spcPts val="1200"/></a:${key}>`).join('')}</a:lvl1pPr>`
    const zip = await fixture(shape(para('Zero', zero), { list, bodyPr: 'spcFirstLastPara="1"' }))
    const style = blockStyles((await apply(zip, [element(html('Zero'))])).elements[0].content)[0]
    expect(style).toMatchObject({ 'padding-top': '0em', 'padding-bottom': '0em', 'line-height': '0' })
  })

  it('retains list, hyperlink, break, field and entity structure with exact source association', async () => {
    const source = `<a:p><a:pPr><a:buChar char="•"/></a:pPr>${run('One &amp; ')}<a:br/><a:fld id="{id}" type="slidenum"><a:rPr/><a:t>17</a:t></a:fld></a:p>`
    const content = '<ul><li><span style="font-family:Verdana"><a href="https://example.test" target="_blank">One&nbsp;&amp;&nbsp;</a><br><span data-field="slidenum">17</span></span></li></ul>'
    const zip = await fixture(shape(source))
    const corrected = (await apply(zip, [element(content)])).elements[0].content
    expect(corrected).toContain('<ul><li')
    expect(corrected).toContain('href="https://example.test" target="_blank"')
    expect(corrected).toContain('<br>')
    expect(corrected).toContain('data-field="slidenum"')
    expect(decodeXml(leaves(corrected).map((leaf) => leaf.text).join('').replaceAll('&nbsp;', '&#160;'))).toBe('One & 17')
    expect(leaves(corrected).every((leaf) => leaf.fontFace === 'Times New Roman')).toBe(true)
  })

  it('leaves unresolved identities, unsupported structures and mismatched source text unchanged', async () => {
    const zip = await fixture(shape(para('Source')))
    const inputs = [element(html('Source'), { name: 'Unknown' }), element(html('Different')),
      element('<p><math>Source</math></p>')]
    const corrected = await apply(zip, inputs)
    expect(corrected.elements.map((item) => item.content)).toEqual(inputs.map((item) => item.content))
  })

  it('propagates invalid source XML and invalid scale rather than claiming a fallback correction', async () => {
    const zip = await fixture('<p:sp>')
    await expect(apply(zip, [element(html('Source'))])).rejects.toThrow('Cannot resolve native text source')
    await expect(apply(zip, [], { scale: { y: 0 } })).rejects.toThrow('positive vertical scale')
  })

  it('selects the Latin source face despite different East Asian and complex-script defaults', async () => {
    const fonts = '<a:lvl1pPr><a:defRPr><a:latin typeface="Times New Roman"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr>'
    const zip = await fixture(shape(para('Tiếng Việt')), { defaults: fonts })
    const corrected = (await apply(zip, [element(html('Tiếng Việt'))])).elements[0]
    expect(extractTextMetadata(corrected.content)).toMatchObject({ fontFamily: 'Times New Roman', fontSize: 28 })
  })

  it('does not apply the paragraph terminator font to a visible unformatted run', async () => {
    const source = '<a:p><a:pPr><a:defRPr><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:r><a:t>Visible</a:t></a:r><a:endParaRPr><a:latin typeface="Courier New"/></a:endParaRPr></a:p>'
    const corrected = (await apply(await fixture(shape(source)), [element(html('Visible'))])).elements[0]
    expect(extractTextMetadata(corrected.content).fontFamily).toBe('Arial')
  })

  it.each(['123 …!?', 'Tiếng Việt'])('uses Latin defaults for neutral or decomposed Latin source %s', async (source) => {
    const fonts = '<a:lvl1pPr><a:defRPr><a:latin typeface="Times New Roman"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr>'
    const corrected = (await apply(await fixture(shape(para(source)), { defaults: fonts }), [element(html(source))])).elements[0]
    expect(extractTextMetadata(corrected.content).fontFamily).toBe('Times New Roman')
    expect(leaves(corrected.content).map((leaf) => leaf.text).join('')).toBe(source)
  })

  it.each(['中文', 'العربية', 'Latin 中文', 'Ελληνικά', 'किताब'])('preserves parser family for non-Latin or mixed source %s', async (source) => {
    const corrected = (await apply(await fixture(shape(para(source, '', 'sz="2800"', '<a:latin typeface="Arial"/>'))), [element(html(source))])).elements[0]
    expect(extractTextMetadata(corrected.content)).toMatchObject({ fontFamily: 'Verdana', fontSize: 28 })
    expect(leaves(corrected.content).map((leaf) => leaf.text).join('')).toBe(source)
  })
})
