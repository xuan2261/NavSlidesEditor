import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { fieldFixture, fieldPresentation } from './field-fixtures.js'
import { stableZip } from './feature-fixtures.js'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const identity = '<a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{5F015DD0-9C9C-15D7-1AF3-7AEF11180DE4}"/></a:ext></a:extLst>'
const latent = '<a:extLst xmlns:h="http://schemas.microsoft.com/office/drawing/2010/main">' +
  '<a:ext uri="{909E8E84-426E-40DD-AFC4-6F175D3DCCD1}"><h:hiddenFill><a:noFill/></h:hiddenFill></a:ext>' +
  '<a:ext uri="{91240B29-F687-4F45-9708-019B960494DF}"><h:hiddenLine w="12700"><a:solidFill><a:srgbClr val="123456"/></a:solidFill></h:hiddenLine></a:ext>' +
  '<a:ext uri="{AF507438-7753-43E0-B8FC-AC1667EBCBE1}"><h:hiddenEffects><a:effectLst/></h:hiddenEffects></a:ext></a:extLst>'
const relation = (kind, target) => `<Relationship Id="notes-source" Type="${R}/${kind}" Target="${target}"/>`
async function fixture(root, mutate = (xml) => xml) {
  const zip = fieldFixture()
  const partUri = root === 'notes' ? 'ppt/notesSlides/source.xml' : 'ppt/notesMasters/source.xml'
  const owner = root === 'notes' ? 'ppt/slides/_rels/slide9.xml.rels' : 'ppt/_rels/presentation.xml.rels'
  const target = root === 'notes' ? '../notesSlides/source.xml' : 'notesMasters/source.xml'
  zip.file(owner, (await zip.file(owner).async('string')).replace('</Relationships>',
    `${relation(root === 'notes' ? 'notesSlide' : 'notesMaster', target)}</Relationships>`))
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="20" name="Notes body">${identity}</p:cNvPr><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:spPr>${latent}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Authored notes</a:t></a:r></a:p></p:txBody></p:sp>`
  const xml = mutate(`<p:${root} xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>${shape}</p:spTree></p:cSld></p:${root}>`)
  zip.file(partUri, xml)
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rTheme" Type="${R}/theme" Target="../theme/theme1.xml"/></Relationships>`)
  zip.file('ppt/theme/theme1.xml',
    `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="test"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1></a:clrScheme><a:fontScheme name="test"><a:majorFont><a:latin typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`)
  return { zip, partUri, xml }
}
it.each(['notes', 'notesMaster'])('preserves validated %s extensions as immutable notes, not slide paint', async (root) => {
  const { zip, partUri, xml } = await fixture(root)
  const bytes = await stableZip(zip), incoming = fieldPresentation(), before = structuredClone(incoming)
  for (const geometryInheritance of [false, true]) {
    const { presentation, admission } = await projectSemanticImport({ zip, presentation: incoming, geometryInheritance })
    const notes = Object.values(presentation.pptxSemantic.definitions).find((d) => d.source.partUri === partUri)
    expect(notes.content.slideMetadata.notes.xml).toBe(xml)
    expect(notes.content.slideMetadata.notesText).toBe('Authored notes')
    expect(notes.source.preconditionHash).toBe(createHash('sha256').update(xml).digest('hex'))
    const extensions = notes.content.slideMetadata.notesDefinitions.filter((d) => d.kind === 'unknown-extension')
    expect(extensions.map((d) => d.locator.path)).toEqual([
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 1, 0, 1, 0], [0, 0, 0, 0, 1, 0, 2, 0],
    ])
    for (const extension of extensions) {
      expect(admission.dispositions.find((d) => d.definitionId === extension.id)).toMatchObject({ partUri, locator: extension.locator })
    }
    expect(Object.values(presentation.pptxSemantic.instances).some((i) => i.definitionId.startsWith(`${partUri}#`))).toBe(false)
    expect(Object.values(presentation.pptxSemantic.styles).some((s) => s.source?.partUri === partUri)).toBe(false)
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
    expect(reopened.pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
    expect(() => assertSemanticBaseline(presentation, reopened)).not.toThrow()
  }
  expect(incoming).toEqual(before)
  expect((await stableZip(zip)).equals(bytes)).toBe(true)
})

it.each([
  ['invalid creation GUID', (xml) => xml.replace('id="{5F015DD0-9C9C-15D7-1AF3-7AEF11180DE4}"', 'id="invalid"')],
  ['foreign creation wrapper', (xml) => xml.replace('FF2B5EF4', 'FF2B5EF5')],
  ['creation text', (xml) => xml.replace('<a16:creationId', 'unexpected<a16:creationId')],
  ['wrong hidden wrapper', (xml) => xml.replace('91240B29', '91240B28')],
  ['invalid latent width', (xml) => xml.replace('w="12700"', 'w="-1"')],
  ['foreign latent color', (xml) => xml.replace('val="123456"', 'val="invalid"')],
  ['hidden payload text', (xml) => xml.replace('<a:noFill/>', 'unexpected<a:noFill/>')],
  ['unknown extension sibling', (xml) => xml.replace('</p:notes>', '<p:extLst><p:ext uri="future"><x:future xmlns:x="urn:future"/></p:ext></p:extLst></p:notes>')],
])('rejects %s in notes without changing input or authenticating arbitrary extensions', async (_name, mutate) => {
  const { zip, partUri } = await fixture('notes', mutate)
  const bytes = await stableZip(zip), incoming = fieldPresentation(), before = structuredClone(incoming)
  await expect(projectSemanticImport({ zip, presentation: incoming, geometryInheritance: true }))
    .rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri } })
  expect(incoming).toEqual(before)
  expect((await stableZip(zip)).equals(bytes)).toBe(true)
})
