import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { fieldFixture, fieldPresentation, fieldPart } from './field-fixtures'
import { stableZip } from './feature-fixtures'
import { normalizePptxSemanticDocument } from '../../shared/src/pptx-semantic-document'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const themePart = 'ppt/theme/theme1.xml'
const creationUri = '{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}'
const themeUri = '{05A4C25C-085E-4340-85A3-A5531E510DB2}'
const creation = `<p:extLst><p:ext uri="${creationUri}"><x:creationId xmlns:x="http://schemas.microsoft.com/office/powerpoint/2010/main" val="2138786550"/></p:ext></p:extLst>`
const family = `<a:extLst><a:ext uri="${themeUri}"><x:themeFamily xmlns:x="http://schemas.microsoft.com/office/thememl/2012/main" name="Office Theme" id="{62F939B6-93AF-4DB8-9C6B-D6C7DFDC589F}" vid="{4A3C46E8-61CC-4603-A589-7422A47A8E4A}"/></a:ext></a:extLst>`
async function fixture(common = creation, theme = family, mode = '') {
  const zip = fieldFixture()
  zip.file(
    fieldPart,
    (await zip.file(fieldPart).async('string')).replace('</p:cSld>', `${common}</p:cSld>`)
  )
  zip.file(
    themePart,
    `<a:theme xmlns:a="${A}" name="Office Theme"><a:themeElements/>${theme}</a:theme>`
  )
  const relPart = 'ppt/slideMasters/_rels/slideMaster1.xml.rels'
  zip.file(
    relPart,
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="theme" Type="${R}/theme" Target="../theme/theme1.xml"${mode}/></Relationships>`
  )
  return zip
}
const project = (zip) => projectSemanticImport({ zip, presentation: fieldPresentation() })
const identities = (doc) =>
  Object.values(doc.definitions).filter((d) => d.kind === 'source-part-identity')
const identity = (doc, type) =>
  identities(doc).find((d) => d.content.sourcePartIdentity.type === type)

it('retains notes and notes-master common-slide identities with exact bidirectional ownership', async () => {
  const zip = await fixture()
  const slidePart = 'ppt/slides/slide9.xml'
  zip.file(
    slidePart,
    (await zip.file(slidePart).async('string')).replace('</p:cSld>', `${creation}</p:cSld>`)
  )
  const slideRels = 'ppt/slides/_rels/slide9.xml.rels'
  zip.file(
    slideRels,
    (await zip.file(slideRels).async('string')).replace(
      '</Relationships>',
      `<Relationship Id="notes" Type="${R}/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`
    )
  )
  zip.file(
    'ppt/notesSlides/notesSlide1.xml',
    `<p:notes xmlns:p="${P}"><p:cSld><p:spTree/>${creation}</p:cSld></p:notes>`
  )
  zip.file(
    'ppt/notesMasters/notesMaster1.xml',
    `<p:notesMaster xmlns:p="${P}"><p:cSld><p:spTree/>${creation}</p:cSld></p:notesMaster>`
  )
  zip.file(
    'ppt/notesSlides/_rels/notesSlide1.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="slide" Type="${R}/slide" Target="../slides/slide9.xml"/><Relationship Id="master" Type="${R}/notesMaster" Target="../notesMasters/notesMaster1.xml"/></Relationships>`
  )
  const before = await stableZip(zip)
  const doc = (await project(zip)).presentation.pptxSemantic
  const common = identities(doc).filter(
    (d) => d.content.sourcePartIdentity.type === 'commonSlideCreationId'
  )
  expect(common.map((d) => d.content.sourcePartIdentity.ownerRoot.localName).sort()).toEqual([
    'notes',
    'notesMaster',
    'sld',
    'sldLayout',
  ])
  expect(common.every((d) => Object.isFrozen(d.content.sourcePartIdentity.ownerLocator))).toBe(true)
  expect(
    Object.values(doc.instances).some((i) => common.some((d) => d.id === i.definitionId))
  ).toBe(false)
  expect(normalizePptxSemanticDocument(JSON.parse(JSON.stringify(doc)))).toEqual(
    JSON.parse(JSON.stringify(doc))
  )
  expect(await stableZip(zip)).toEqual(before)
  zip.file(
    'ppt/notesSlides/_rels/notesSlide1.xml.rels',
    (await zip.file('ppt/notesSlides/_rels/notesSlide1.xml.rels').async('string')).replace(
      `${R}/notesMaster`,
      `${R}/customXml`
    )
  )
  await expect(project(zip)).rejects.toThrow(/relationship owner/)
})

it('preserves a theme shared by slide and notes masters without conflating source owners', async () => {
  const zip = await fixture()
  const presentationRels = 'ppt/_rels/presentation.xml.rels'
  zip.file(
    presentationRels,
    (await zip.file(presentationRels).async('string')).replace(
      '</Relationships>',
      `<Relationship Id="notesMaster" Type="${R}/notesMaster" Target="notesMasters/notesMaster1.xml"/></Relationships>`
    )
  )
  zip.file(
    'ppt/notesMasters/notesMaster1.xml',
    `<p:notesMaster xmlns:p="${P}"><p:cSld><p:spTree/></p:cSld></p:notesMaster>`
  )
  zip.file(
    'ppt/notesMasters/_rels/notesMaster1.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="theme" Type="${R}/theme" Target="../theme/theme1.xml"/></Relationships>`
  )
  const before = await stableZip(zip)
  const doc = (await project(zip)).presentation.pptxSemantic
  expect(identities(doc)).toHaveLength(2)
  expect(identity(doc, 'themeFamily').source.partUri).toBe(themePart)
  expect(normalizePptxSemanticDocument(JSON.parse(JSON.stringify(doc)))).toEqual(
    JSON.parse(JSON.stringify(doc))
  )
  expect(await stableZip(zip)).toEqual(before)
  zip.file(
    'ppt/notesMasters/notesMaster1.xml',
    `<p:unrelated xmlns:p="${P}"><p:cSld><p:spTree/></p:cSld></p:unrelated>`
  )
  await expect(project(zip)).rejects.toThrow(/relationship owner/)
})

it.each(['', ' TargetMode="Internal"'])(
  'preserves typed identities and frozen source bindings %s',
  async (mode) => {
    const zip = await fixture(creation, family, mode)
    const before = await stableZip(zip)
    const result = await project(zip)
    const doc = result.presentation.pptxSemantic
    expect(identities(doc)).toHaveLength(2)
    for (const [type, part, root, ns, path, value] of [
      ['commonSlideCreationId', fieldPart, 'sldLayout', P, [0, 0, 1, 0, 0], 2138786550],
      [
        'themeFamily',
        themePart,
        'theme',
        A,
        [0, 1, 0, 0],
        {
          name: 'Office Theme',
          id: '{62F939B6-93AF-4DB8-9C6B-D6C7DFDC589F}',
          vid: '{4A3C46E8-61CC-4603-A589-7422A47A8E4A}',
        },
      ],
    ]) {
      const d = identity(doc, type)
      const hash = createHash('sha256')
        .update(await zip.file(part).async('nodebuffer'))
        .digest('hex')
      expect(d.source).toEqual({
        partUri: part,
        preconditionHash: hash,
        componentLocator: { path: [0], preconditionHash: hash },
      })
      expect(d.content.sourcePartIdentity).toMatchObject({
        type,
        value,
        ownerRoot: { localName: root, namespaceUri: ns },
        componentId: `${part}#unknown-extension:${path.join('.')}`,
        ownerLocator: { path: type === 'themeFamily' ? [0] : [0, 0], preconditionHash: hash },
        wrapperLocator: { path: path.slice(0, -1), preconditionHash: hash },
      })
      expect(d.components).toEqual([
        {
          id: d.content.sourcePartIdentity.componentId,
          kind: 'property',
          locator: { path, preconditionHash: hash },
        },
      ])
      expect(
        result.admission.dispositions.find((item) => item.definitionId === d.components[0].id)
          ?.disposition
      ).toBe('semantically-mapped')
      expect(result.trustedSemanticImportMetadata.definitions[d.id]).toEqual(d)
      expect(Object.values(doc.instances).some((item) => item.definitionId === d.id)).toBe(false)
      expect(Object.isFrozen(d.content.sourcePartIdentity.wrapperLocator.path)).toBe(true)
    }
    const reopened = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(doc)))
    expect(reopened).toEqual(JSON.parse(JSON.stringify(doc)))
    expect(
      Object.isFrozen(identity(reopened, 'themeFamily').content.sourcePartIdentity.value)
    ).toBe(true)
    expect(await stableZip(zip)).toEqual(before)
    expect(result.admission.visualQualification).toBe('unqualified')
  }
)

it.each(['0', '4294967295', '+1', '0001'])(
  'accepts unsignedInt lexical value %s with prefix aliases',
  async (value) => {
    const zip = await fixture(creation.replace('2138786550', value))
    for (const part of [fieldPart, themePart])
      zip.file(
        part,
        (await zip.file(part).async('string'))
          .replace(/(<\/?)p:/g, '$1pres:')
          .replaceAll('xmlns:p=', 'xmlns:pres=')
          .replace(/(<\/?)a:/g, '$1draw:')
          .replaceAll('xmlns:a=', 'xmlns:draw=')
          .replace(/(<\/?)x:/g, '$1identity:')
          .replaceAll('xmlns:x=', 'xmlns:identity=')
      )
    expect(
      identity((await project(zip)).presentation.pptxSemantic, 'commonSlideCreationId').content
        .sourcePartIdentity.value
    ).toBe(Number(value))
  }
)

it.each([
  creation.replace('2138786550', '-1'),
  creation.replace('2138786550', '4294967296'),
  creation.replace('2138786550', '1.5'),
  creation.replace('2138786550', ''),
  creation.replace(' val=', ' extra="lost" val='),
  creation.replace(' val=', ' val="0" val='),
  creation.replace('/>', '>lost</x:creationId>'),
  creation.replace('/>', '><x:extra/></x:creationId>'),
  creation.replace('2010/main', '2012/main'),
  creation.replace('BB962C8B', '00000000'),
  creation.replace('<p:ext uri=', '<p:ext extra="lost" uri='),
  creation.replace('<p:extLst>', '<p:extLst extra="lost">'),
  creation.replace('</p:ext>', '<p:extra/></p:ext>'),
  creation.replace('</p:ext>', 'lost</p:ext>'),
  creation + creation,
  creation.replace('</p:extLst>', '<p:ext uri="future"><p:extra/></p:ext></p:extLst>'),
])('rejects malformed common slide identity %s', async (common) => {
  await expect(project(await fixture(common))).rejects.toThrow()
})

it.each([
  family.replace('62F939B6', 'invalid'),
  family.replace('4A3C46E8', 'invalid'),
  family.replace(' name="Office Theme"', ''),
  family.replace(' vid=', ' extra="lost" vid='),
  family.replace(' vid=', ' vid="duplicate" vid='),
  family.replace('/>', '>lost</x:themeFamily>'),
  family.replace('/>', '><x:extra/></x:themeFamily>'),
  family.replace('2012/main', '2099/main'),
  family.replace('05A4C25C', '00000000'),
  family + family,
  family.replace('<a:extLst>', '<a:extLst>lost'),
])('rejects malformed theme family identity %s', async (theme) => {
  await expect(project(await fixture(creation, theme))).rejects.toThrow()
})

it.each([
  'relationship',
  'external',
  'mode',
  'root',
  'common-owner',
  'duplicate-owner',
  'root-duplicate',
])('rejects wrong or ambiguous source ownership %s', async (fault) => {
  const zip = await fixture()
  const relPart = 'ppt/slideMasters/_rels/slideMaster1.xml.rels'
  if (fault === 'relationship')
    zip.file(
      relPart,
      (await zip.file(relPart).async('string')).replace(`${R}/theme`, `${R}/customXml`)
    )
  if (fault === 'external' || fault === 'mode')
    zip.file(
      relPart,
      (await zip.file(relPart).async('string')).replace(
        ' Target=',
        ` TargetMode="${fault === 'external' ? 'External' : 'internal'}" Target=`
      )
    )
  if (fault === 'external')
    zip.file(
      relPart,
      (await zip.file(relPart).async('string')).replace(
        '</Relationships>',
        `<Relationship Id="unrelated" Type="${R}/customXml" Target="../theme/theme1.xml"/></Relationships>`
      )
    )
  if (fault === 'root')
    zip.file(
      themePart,
      (await zip.file(themePart).async('string'))
        .replaceAll('a:theme ', 'a:themeOverride ')
        .replaceAll('</a:theme>', '</a:themeOverride>')
    )
  if (fault === 'common-owner')
    zip.file(
      fieldPart,
      (await zip.file(fieldPart).async('string'))
        .replace(creation, '')
        .replace('</p:sldLayout>', `${creation}</p:sldLayout>`)
    )
  if (fault === 'duplicate-owner')
    zip.file(
      fieldPart,
      (await zip.file(fieldPart).async('string')).replace(
        '</p:sldLayout>',
        `<p:cSld>${creation}</p:cSld></p:sldLayout>`
      )
    )
  if (fault === 'root-duplicate')
    zip.file(themePart, (await zip.file(themePart).async('string')) + `<a:theme xmlns:a="${A}"/>`)
  await expect(project(zip)).rejects.toThrow()
})

it.each(['value', 'namespace', 'wrapper', 'owner', 'hash', 'delete', 'delete-property'])(
  'rejects immutable baseline tamper %s',
  async (fault) => {
    const original = (await project(await fixture())).presentation
    const forged = structuredClone(original)
    const d = identity(forged.pptxSemantic, 'commonSlideCreationId')
    const entry = d.content.sourcePartIdentity
    if (fault === 'value') entry.value++
    if (fault === 'namespace') entry.namespaceUri = 'urn:forged'
    if (fault === 'wrapper') entry.wrapperLocator.path[2]++
    if (fault === 'owner') d.source.partUri = themePart
    if (fault === 'hash') d.source.preconditionHash = '0'.repeat(64)
    if (fault === 'delete') delete forged.pptxSemantic.definitions[d.id]
    if (fault === 'delete-property') delete d.content.sourcePartIdentity
    expect(() => assertSemanticBaseline(original, forged)).toThrow()
  }
)

it.each([
  'value',
  'guid',
  'extra',
  'component',
  'wrapper',
  'owner',
  'namespace',
  'occurrence',
  'kind',
  'source-extra',
])('rejects canonical identity forgery %s', async (fault) => {
  const doc = structuredClone((await project(await fixture())).presentation.pptxSemantic)
  const d = identity(doc, 'themeFamily'),
    entry = d.content.sourcePartIdentity
  if (fault === 'value') entry.value.id = 'not-guid'
  if (fault === 'guid') entry.extensionUri = creationUri
  if (fault === 'extra') entry.rawXml = '<opaque/>'
  if (fault === 'component') entry.componentId = 'missing'
  if (fault === 'wrapper') entry.wrapperLocator.path = [0]
  if (fault === 'owner') entry.ownerRoot.localName = 'sldLayout'
  if (fault === 'namespace') entry.ownerRoot.namespaceUri = P
  if (fault === 'occurrence') Object.values(doc.instances)[0].definitionId = d.id
  if (fault === 'kind') d.kind = 'shape'
  if (fault === 'source-extra')
    d.source.creationId = {
      value: '{62F939B6-93AF-4DB8-9C6B-D6C7DFDC589F}',
      componentId: entry.componentId,
    }
  expect(() => normalizePptxSemanticDocument(doc)).toThrow()
})
