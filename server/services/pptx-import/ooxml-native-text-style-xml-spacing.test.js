import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { applyNativeTextStyles } from './ooxml-native-text-style.js'
import { parseXml } from './ooxml-text-run-xml.js'
import { extractTextMetadata } from './mapper/utils-text.js'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const ns = `xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"`
const rels = (type, target) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/${type}" Target="${target}"/></Relationships>`

async function fixture(attribute) {
  const zip = new JSZip()
  zip.file('ppt/presentation.xml', `<p:presentation ${ns}><p:sldIdLst><p:sldId id="100" r:id="rId1"/></p:sldIdLst></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', rels('slide', 'slides/slide1.xml'))
  zip.file('ppt/slides/slide1.xml', `<p:sld ${ns}><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Native"/><p:nvPr/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr><a:latin typeface="+mn-lt"/></a:rPr><a:t>Native</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`)
  zip.file('ppt/slides/_rels/slide1.xml.rels', rels('slideLayout', '../slideLayouts/slideLayout1.xml'))
  zip.file('ppt/slideLayouts/slideLayout1.xml', `<p:sldLayout ${ns}><p:cSld><p:spTree/></p:cSld></p:sldLayout>`)
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels('slideMaster', '../slideMasters/slideMaster1.xml'))
  zip.file('ppt/slideMasters/slideMaster1.xml', `<p:sldMaster ${ns}><p:cSld><p:spTree/></p:cSld></p:sldMaster>`)
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels('theme', '../theme/theme1.xml'))
  zip.file('ppt/theme/theme1.xml', `<a:theme ${ns}><a:themeElements><a:fontScheme><a:minorFont><a:latin ${attribute}/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`)
  return zip
}

describe('native relationship-linked theme XML attributes', () => {
  it.each([' ', '\t', '\r\n'])('imports the source font with XML whitespace %j around equals', async (space) => {
    const zip = await fixture(`typeface${space}=${space}"Courier New"`)
    const corrected = await applyNativeTextStyles({ zip, slideIndex: 0, scale: { x: 1, y: 1 },
      slide: { elements: [{ type: 'text', name: 'Native', content: '<p>Native</p>', fontFace: 'Verdana' }] } })
    expect(extractTextMetadata(corrected.elements[0].content).fontFamily).toBe('Courier New')
  })

  it.each(['typeface "Courier New"', 'typeface=Courier', 'typeface == "Courier New"'])('rejects malformed attributes %j', (attribute) => {
    expect(() => parseXml(`<a:latin xmlns:a="${A}" ${attribute}/>`)).toThrow(expect.objectContaining({ code: 'TEXT_XML_INVALID' }))
  })
})
