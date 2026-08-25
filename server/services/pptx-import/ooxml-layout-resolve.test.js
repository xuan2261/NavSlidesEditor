import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { resolveLayoutFromZip } from './ooxml-layout-resolve.js'

describe('ooxml-layout-resolve (T8.1)', () => {
  it('T8.1 injects title from slideLayout with major font', async () => {
    const zip = new JSZip()
    zip.file(
      'ppt/slides/slide1.xml',
      `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/></p:spTree></p:cSld></p:sld>`
    )
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>`
    )
    zip.file(
      'ppt/slideLayouts/slideLayout1.xml',
      `<?xml version="1.0"?>
      <p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld><p:spTree>
          <p:nvGrpSpPr/><p:grpSpPr/>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9000000" cy="1000000"/></a:xfrm></p:spPr>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sldLayout>`
    )
    const { elements, injected } = await resolveLayoutFromZip(
      { elements: [] },
      zip,
      { slideIndex: 0, fonts: { major: 'Aptos Display', minor: 'Aptos' } }
    )
    expect(injected).toBe(1)
    expect(elements[0].fontFamily).toBe('Aptos Display')
    expect(elements[0].content).toMatch(/title/i)
    expect(elements[0]._pptxSource.fromLayoutXml).toBe(true)
  })

  it('does not inject when text exists', async () => {
    const zip = new JSZip()
    const { injected } = await resolveLayoutFromZip(
      { elements: [{ type: 'text', content: '<p>Hi</p>' }] },
      zip,
      { slideIndex: 0 }
    )
    expect(injected).toBe(0)
  })

  it('injects supported layout decorations behind authored slide content', async () => {
    const zip = new JSZip()
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>`
    )
    zip.file(
      'ppt/slideLayouts/slideLayout1.xml',
      `<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/>
          <p:sp><p:nvSpPr><p:cNvPr id="2" name="Top bar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="12700" y="25400"/><a:ext cx="127000" cy="12700"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="005AA9"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>
          <p:sp><p:nvSpPr><p:cNvPr id="3" name="Rule"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="12700" y="38100"/><a:ext cx="127000" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></p:spPr></p:sp>
        </p:spTree></p:cSld>
      </p:sldLayout>`
    )
    const authored = { type: 'text', content: '<p>Hi</p>', x: 20, y: 20, width: 100, height: 30, zIndex: 1 }
    const { elements, injected, decorativeInjected } = await resolveLayoutFromZip(
      { elements: [authored] },
      zip,
      { slideIndex: 0 }
    )

    expect(injected).toBe(0)
    expect(decorativeInjected).toBe(2)
    expect(elements.map((element) => element.type)).toEqual(['shape', 'line', 'text'])
    expect(elements[0]).toMatchObject({ x: 1, y: 2, width: 10, height: 1, fill: '#005AA9' })
    expect(elements[1]).toMatchObject({ x: 1, y: 3, width: 10, height: 0, stroke: '#000000', strokeWidth: 1 })
    expect(elements[2]).toBe(authored)
  })
})
