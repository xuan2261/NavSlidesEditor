// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'
import { projectSemanticImport } from '../../server/services/pptx-import/semantic-projector'
import { materializeTextDocument } from '../../shared/src/pptx-text-materialization'
import { parseXml, attr } from '../../server/services/pptx-import/ooxml-text-run-xml'
const solid = '<a:ln w="19050" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="tx1"><a:alpha val="50000"/></a:schemeClr></a:solidFill><a:prstDash val="solid"/></a:ln>'
async function project(inherited = solid, direct = '') {
  const zip = await fixture()
  for (const part of [slide, layout, master]) zip.file(part, (await zip.file(part).async('string')).replaceAll('<p:spPr/>',
    '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'))
  zip.file('ppt/presentation.xml', (await zip.file('ppt/presentation.xml').async('string')).replace('</p:presentation>',
    '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'))
  zip.file(layout, (await zip.file(layout).async('string')).replace('<a:latin typeface="+mn-lt"/>', `<a:latin typeface="+mn-lt"/>${inherited}`))
  if (direct) zip.file(slide, (await zip.file(slide).async('string')).replace('<a:rPr/>', `<a:rPr>${direct}</a:rPr>`))
  return (await projectSemanticImport({ zip, geometryInheritance: true,
    presentation: { id: 'deck', slides: [{ id: 'slide', elements: [] }] } })).presentation
}
describe('native outline source through occurrence materialization and compatibility', () => {
  it('paints inherited scheme alpha in both canonical occurrence and compatibility without altering source declarations', async () => {
    const presentation = await project(), model = presentation.pptxSemantic
    const element = presentation.slides[0].elements.find((el) => el._pptxSource.partUri === slide)
    const text = materializeTextDocument(model, element.pptxInstanceId)
    expect(text.paragraphs[0].runs[0].properties.outline).toMatchObject({ width: 19050,
      color: { kind: 'srgb', value: '102030', transforms: [{ kind: 'alpha', value: 50000 }] } })
    expect(element.textHtml).toContain('-webkit-text-stroke-width:2px')
    expect(element.textHtml).toContain('-webkit-text-stroke-color:rgba(16,32,48,0.5)')
    expect(model.definitions[`${slide}#shape:2`].content.textDocument.paragraphs[0].runs[0].properties).not.toHaveProperty('outline')
    const disabled = await project(solid, '<a:ln><a:noFill/></a:ln>')
    const target = disabled.slides[0].elements.find((el) => el._pptxSource.partUri === slide)
    expect(target.textHtml).toContain('-webkit-text-stroke-width:0px')
    expect(materializeTextDocument(disabled.pptxSemantic, target.pptxInstanceId).paragraphs[0].runs[0].properties.outline)
      .toEqual({ fill: 'none', color: { kind: 'none' } })
  })
  it('retains authored omitted width and paints normative zero, not a guessed one-point default', async () => {
    const presentation = await project(solid.replace(' w="19050"', ''))
    const target = presentation.slides[0].elements.find((el) => el._pptxSource.partUri === slide)
    const outline = materializeTextDocument(presentation.pptxSemantic, target.pptxInstanceId).paragraphs[0].runs[0].properties.outline
    expect(outline).not.toHaveProperty('width')
    expect(target.textHtml).toContain('-webkit-text-stroke-width:0px')
  })
  it('locates a late paint rejection at the owning definition without claiming an outline-child locator', async () => {
    const error = await project('', solid.replace('val="solid"', 'val="dash"')).catch((failure) => failure)
    expect(error).toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: { partUri: slide, definitionId: `${slide}#shape:2`, path: expect.any(Array) } })
    const zip = await fixture()
    let node = { children: parseXml(await zip.file(error.sourceLocation.partUri).async('string')) }
    for (const index of error.sourceLocation.path) node = node.children[index]
    expect(node.local).toBe('sp')
    expect(attr(node.children[0].children[0], 'id')).toBe('2')
  })
  it.each([
    solid.replace('cmpd="sng"', 'cmpd="dbl"'), solid.replace('algn="ctr"', 'algn="in"'),
    solid.replace('val="solid"', 'val="dash"'), solid.replace('<a:prstDash val="solid"/>', '<a:custDash><a:ds d="100000" sp="100000"/></a:custDash>'),
    solid.replace('<a:prstDash val="solid"/>', '<a:miter lim="800000"/>'),
    solid.replace('<a:prstDash val="solid"/>', '<a:prstDash val="solid"/><a:prstDash val="solid"/>'),
  ])('rejects unsupported/duplicate ln source at its source locator', async (declaration) => {
    await expect(project('', declaration)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: { partUri: slide, path: expect.any(Array) } })
  })
})
