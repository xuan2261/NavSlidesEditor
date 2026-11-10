// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'
import { projectSemanticImport } from '../../server/services/pptx-import/semantic-projector'
import { materializeTextDocument } from '../../shared/src/pptx-text-materialization'
import { normalizeTextProperties } from '../../shared/src/pptx-text-document'
import { resolveProperty } from '../../shared/src/pptx-style-resolution'

const highlight = '<a:highlight><a:schemeClr val="tx1"><a:alpha val="50000"/></a:schemeClr></a:highlight>'
async function project(inherited = highlight, direct = '') {
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
const target = (presentation) => presentation.slides[0].elements.find((el) => el._pptxSource.partUri === slide)

describe('authored text highlight admission and occurrence paint', () => {
  it('resolves inherited scheme alpha without baking it into source runs or mutating definitions', async () => {
    const presentation = await project(), model = presentation.pptxSemantic
    const before = structuredClone(model)
    const text = materializeTextDocument(model, target(presentation).pptxInstanceId)
    expect(text.paragraphs[0].runs[0].properties.highlight).toEqual({
      kind: 'srgb', value: '102030', transforms: [{ kind: 'alpha', value: 50000 }],
    })
    expect(model.definitions[`${slide}#shape:2`].content.textDocument.paragraphs[0].runs[0].properties)
      .not.toHaveProperty('highlight')
    expect(model).toEqual(before)
  })
  it.each([
    ['<a:srgbClr val="FFFF00"><a:alpha val="0"/></a:srgbClr>', { kind: 'srgb', value: 'FFFF00', transforms: [{ kind: 'alpha', value: 0 }] }, 'FFFF00', 0],
    ['<a:prstClr val="yellow"/>', { kind: 'preset', value: 'yellow' }, 'FFFF00', 100000],
  ])('retains a direct declaration and defeats inherited highlight, including transparent paint: %s', async (color, authored, rgb, alpha) => {
    const presentation = await project(highlight, `<a:highlight>${color}</a:highlight>`)
    const model = presentation.pptxSemantic, element = target(presentation)
    const source = model.definitions[`${slide}#shape:2`].content.textDocument
    expect(source.paragraphs[0].runs[0].properties.highlight).toEqual(authored)
    const paint = materializeTextDocument(model, element.pptxInstanceId).paragraphs[0].runs[0].properties.highlight
    expect(paint).toEqual({ kind: 'srgb', value: rgb,
      ...(alpha === 100000 ? {} : { transforms: [{ kind: 'alpha', value: alpha }] }) })
    const restored = JSON.parse(JSON.stringify(model))
    expect(materializeTextDocument(restored, element.pptxInstanceId).paragraphs[0].runs[0].properties.highlight).toEqual(paint)
    expect(restored.definitions[`${slide}#shape:2`].content.textDocument).toEqual(source)
  })
  it('uses an explicit occurrence clear without resurrecting an inherited color', () => {
    const none = { kind: 'none' }
    expect(normalizeTextProperties({ highlight: none }, 'run')).toEqual({ highlight: none })
    const result = resolveProperty({ property: 'highlight', scope: 'run', layers: { target: {}, entries: [
      { id: 'base', kind: 'paragraph', source: { part: 'layout', path: 'p' }, properties: { highlight: { kind: 'srgb', value: 'FFFF00' } } },
      { id: 'direct', kind: 'run', source: { part: 'slide', path: 'r' }, properties: { highlight: none } },
    ] } })
    expect(result.resolved).toEqual(none)
    expect(result.source).toMatchObject({ part: 'slide', path: 'r' })
    expect(() => normalizeTextProperties({ highlight: { kind: 'none', value: 'FFFF00' } }, 'run')).toThrow()
  })
  it.each([
    '<a:highlight/>',
    '<a:highlight><a:noFill/></a:highlight>',
    '<a:highlight><a:srgbClr val="FFFF00"/><a:prstClr val="yellow"/></a:highlight>',
    '<a:highlight><a:srgbClr val="oops"/></a:highlight>',
    '<a:highlight><a:schemeClr val="tx1"><a:alpha val="100001"/></a:schemeClr></a:highlight>',
    '<a:highlight><a:srgbClr val="FFFF00"/></a:highlight><a:highlight><a:srgbClr val="FFFFFF"/></a:highlight>',
    '<foreign:highlight xmlns:foreign="urn:foreign"><a:srgbClr val="FFFF00"/></foreign:highlight>',
  ])('rejects malformed, duplicate or foreign highlight at the authored part: %s', async (declaration) => {
    await expect(project('', declaration)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: { partUri: slide, path: expect.any(Array) } })
  })
})
