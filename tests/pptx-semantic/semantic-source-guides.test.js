import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fieldFixture, fieldPresentation, fieldPart } from './field-fixtures'
import { stableZip } from './feature-fixtures'
import { normalizePptxSemanticDocument } from '../../shared/src/pptx-semantic-document'
const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const N = 'http://schemas.microsoft.com/office/powerpoint/2012/main'
const spec = [
  ['ppt/presentation.xml', 'presentation', 'sldGuideLst', '{EFAFB233-063F-42B5-8137-9DF3F51BA10A}'],
  ['ppt/presentation.xml', 'presentation', 'notesGuideLst', '{2D200454-40CA-4A62-9FC3-DE9A4176ACB9}'],
  [fieldPart, 'sldLayout', 'sldGuideLst', '{DCECCB84-F9BA-43D5-87BE-67443E8EF086}'],
  ['ppt/slideMasters/slideMaster1.xml', 'sldMaster', 'sldGuideLst', '{27BBF7A9-308A-43DC-89C8-2F10F3537804}'],
  ['ppt/handoutMasters/handoutMaster1.xml', 'handoutMaster', 'sldGuideLst', '{56416CCD-93CA-4268-BC5B-53C4BB910035}'],
  ['ppt/notesMasters/notesMaster1.xml', 'notesMaster', 'sldGuideLst', '{620B2872-D7B9-4A21-9093-7833F8D536E1}'],
]
const guide = (attrs = 'id="7"', color = '<a:srgbClr val="CC3366"/>', after = '') =>
  `<g:guide ${attrs}><g:clr>${color}</g:clr>${after}</g:guide>`
const extension = (local, guid, children = '', attrs = '') =>
  `<p:extLst><p:ext uri="${guid}"><g:${local} xmlns:g="${N}" ${attrs}>${children}</g:${local}></p:ext></p:extLst>`
async function project(children = '', { row = spec[0], attrs = '', transform = (xml) => xml } = {}) {
  const zip = fieldFixture(), [part, root, local, guid] = row
  if (!zip.file(part)) {
    zip.file(part, `<p:${root} xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree/></p:cSld></p:${root}>`)
    const rels = 'ppt/_rels/presentation.xml.rels'
    zip.file(rels, (await zip.file(rels).async('string')).replace('</Relationships>',
      `<Relationship Id="guide-owner" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${root}" Target="${part.slice(4)}"/></Relationships>`))
  }
  zip.file(part, (await zip.file(part).async('string')).replace(`</p:${root}>`,
    `${transform(extension(local, guid, children, attrs))}</p:${root}>`))
  const before = await stableZip(zip)
  const result = await projectSemanticImport({ zip, presentation: fieldPresentation() })
  expect(await stableZip(zip)).toEqual(before)
  return result
}
const owner = (deck) => Object.values(deck.pptxSemantic.definitions).find((d) => d.kind === 'source-guide-list')

it.each(spec)('preserves exact empty guide source and JSON reopen for %s %s %s %s', async (...row) => {
  const { presentation, trustedSemanticImportMetadata } = await project('', { row })
  const definition = owner(presentation)
  expect(definition.content.sourceGuideList).toMatchObject({
    ownerRoot: { localName: row[1] }, localName: row[2], namespaceUri: N,
    extensionUri: row[3], guides: [],
  })
  expect(trustedSemanticImportMetadata.definitions[definition.id]).toEqual(definition)
  expect(normalizePptxSemanticDocument(JSON.parse(JSON.stringify(presentation.pptxSemantic)))
    .definitions[definition.id]).toEqual(definition)
  expect(Object.values(presentation.pptxSemantic.instances).some((i) => i.definitionId === definition.id)).toBe(false)
})

it('retains guide identity, signed native position, explicit disables and source-bound color transforms', async () => {
  const { presentation } = await project(guide('id="4294967295" name="A &amp; B" orient="horz" pos="-2147483648" userDrawn="false"',
    '<a:schemeClr val="accent1"><a:alpha val="50000"/><a:inv/></a:schemeClr>', '<g:extLst/>') +
    guide('id="0"') + '<g:extLst/>')
  const definition = owner(presentation), record = definition.content.sourceGuideList
  expect(record.guides[0].value).toMatchObject({
    id: 4294967295, name: 'A & B', orient: 'horz', pos: -2147483648, userDrawn: false,
    color: { value: { kind: 'scheme', value: 'accent1', transforms: [
      { value: { kind: 'alpha', value: 50000 } }, { value: { kind: 'inv' } },
    ] } }, extensionList: { value: {} },
  })
  expect(record.guides[1].value).toEqual({ id: 0, color: expect.objectContaining({ value: { kind: 'srgb', value: 'CC3366' } }) })
  expect(record.extensionList.value).toEqual({})
  const base = definition.components[0].locator.path
  expect(record.guides[0].source.componentLocator.path).toEqual([...base, 0])
  expect(record.guides[0].value.color.source.componentLocator.path).toEqual([...base, 0, 0, 0])
  const forged = structuredClone(presentation)
  owner(forged).content.sourceGuideList.guides[0].value.pos = 123
  expect(() => assertSemanticBaseline(presentation, forged)).toThrow()
})

it.each([
  guide('id="1"') + guide('id="1"'), guide(''), guide('id="-1"'), guide('id="4294967296"'),
  guide('id="+01"') + guide('id="1"'),
  guide('id="1" orient="diagonal"'), guide('id="1" pos="2147483648"'), guide('id="1" userDrawn="yes"'),
  guide('id="1" unsupported="lost"'), '<g:guide id="1"/>',
  guide('id="1"', '<a:srgbClr val="CC3366"/><a:srgbClr val="FFFFFF"/>'),
  guide('id="1"', '<a:srgbClr val="CC3366" bad="lost"/>'),
  guide('id="1"', '<a:srgbClr val="CC3366"/>', '<g:extLst><p:ext uri="future"/></g:extLst>'),
  '<g:extLst/>' + guide(), guide() + '<g:extLst/><g:extLst/>', 'lost', '<g:unknown/>',
])('rejects unsupported or malformed guide payload without source mutation: %s', async (children) => {
  await expect(project(children)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
})

it.each([
  (xml) => xml.replace(N, 'urn:foreign'),
  (xml) => xml.replace('EFAFB233', '00000000'),
  (xml) => xml.replace('<p:ext uri=', '<p:ext extra="lost" uri='),
  (xml) => xml.replace('</p:extLst>', '</p:extLst><p:extLst/>'),
])('rejects wrong namespace, URI, wrapper or duplicate root extension ownership', async (transform) => {
  await expect(project('', { transform })).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
})

it.each(['source', 'guide', 'color', 'transform', 'wrapper', 'component', 'occurrence', 'project']) (
  'rejects forged guide provenance and placement after reopen: %s', async (fault) => {
    const { presentation } = await project(guide('id="1"', '<a:srgbClr val="CC3366"><a:alpha val="50000"/></a:srgbClr>'))
    const document = structuredClone(presentation.pptxSemantic), definition = owner({ pptxSemantic: document })
    const value = definition.content.sourceGuideList
    if (fault === 'source') value.guides[0].source.preconditionHash = '0'.repeat(64)
    if (fault === 'guide') value.guides[0].source.componentLocator.path.pop()
    if (fault === 'color') value.guides[0].value.color.source.componentLocator.path.pop()
    if (fault === 'transform') value.guides[0].value.color.value.transforms[0].source.componentLocator.path.pop()
    if (fault === 'wrapper') value.wrapperLocator.path.pop()
    if (fault === 'component') definition.components.pop()
    if (fault === 'occurrence') Object.values(document.instances)[0].definitionId = definition.id
    if (fault === 'project') document.definitions.localGroup = { id: 'localGroup', kind: 'group', origin: 'project', source: null,
      components: [], content: { sourceGuideList: value } }
    expect(() => normalizePptxSemanticDocument(document)).toThrow()
  })

it.each([['wrong-type', 'urn:wrong'], ['wrong-mode', 'External']])(
  'rejects a reachable guide owner without the authoritative relationship: %s', async (fault, value) => {
    const zip = fieldFixture(), part = fieldPart, row = spec[2]
    zip.file(part, (await zip.file(part).async('string')).replace('</p:sldLayout>',
      `${extension(row[2], row[3])}</p:sldLayout>`))
    for (const slide of [9, 3]) {
      const rel = `ppt/slides/_rels/slide${slide}.xml.rels`
      const xml = await zip.file(rel).async('string')
      zip.file(rel, fault === 'wrong-type' ? xml.replace('/slideLayout"', `/${value}"`) :
        xml.replace('Target="', `TargetMode="${value}" Target="`))
    }
    const before = await stableZip(zip)
    await expect(projectSemanticImport({ zip, presentation: fieldPresentation() }))
      .rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
    expect(await stableZip(zip)).toEqual(before)
  })

it('retains optional empty name, signed-position maximum and explicit enabled flag', async () => {
  const { presentation } = await project(guide('id="+01" name="" orient="vert" pos="2147483647" userDrawn="1"'))
  const value = owner(presentation).content.sourceGuideList.guides[0].value
  expect(value).toMatchObject({ id: 1, name: '', orient: 'vert', pos: 2147483647, userDrawn: true })
})

it('retains nonempty notes-master guides while complete notes source remains authenticated', async () => {
  const { presentation } = await project(guide('id="17" pos="-42"', '<a:srgbClr val="112233"/>', '<g:extLst/>') +
    '<g:extLst/>', { row: spec[5] })
  const definition = owner(presentation), value = definition.content.sourceGuideList
  expect(value.guides[0].value).toMatchObject({ id: 17, pos: -42, color: { value: { kind: 'srgb', value: '112233' } },
    extensionList: { value: {} } })
  const base = definition.components[0].locator.path
  expect(definition.components.map((entry) => entry.locator.path)).toEqual(
    [base, [...base, 0], [...base, 0, 0], [...base, 0, 1], [...base, 1]])
  const metadata = Object.values(presentation.pptxSemantic.definitions).find((entry) =>
    entry.source.partUri === spec[5][0] && entry.content.slideMetadata)
  expect(metadata.content.slideMetadata.notesDefinitions.map((entry) => entry.id)).toEqual(
    definition.components.map((entry) => entry.id))
  expect(metadata.content.slideMetadata.notes.source.preconditionHash).toBe(definition.source.preconditionHash)
})

it('rejects unparsed notes extensions beside a recognized guide list', async () => {
  await expect(project(guide(), { row: spec[5], transform: (xml) => xml.replace('</p:extLst>',
    `<p:ext uri="{00000000-0000-0000-0000-000000000000}"><g:future xmlns:g="${N}"/></p:ext></p:extLst>`) }))
    .rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
})

it('rejects guide declarations in ordinary occurrence overrides', async () => {
  const { presentation } = await project()
  const doc = structuredClone(presentation.pptxSemantic)
  Object.values(doc.instances)[0].overrides.sourceGuideList = owner(presentation).content.sourceGuideList
  expect(() => normalizePptxSemanticDocument(doc)).toThrow(/guide lists cannot be overridden/i)
})
