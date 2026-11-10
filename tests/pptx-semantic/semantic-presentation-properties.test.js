import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { fieldFixture, fieldPresentation } from './field-fixtures'
import { stableZip } from './feature-fixtures'
import { normalizePptxSemanticDocument } from '../../shared/src/pptx-semantic-document'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const part = 'ppt/presProps.xml'
const specs = [
  ['discardImageEditData', '2010', '{E76CE94A-603C-4142-B9EB-6D1370010A27}', '0', false],
  ['defaultImageDpi', '2010', '{D31A062A-798A-4329-ABDD-BBA856620510}', '32767', 32767],
  ['chartTrackingRefBased', '2012', '{FD5EFAAD-0ECE-453E-9831-46B23BE46B34}', '1', true],
]
const wrapper = ([name, year, guid, val]) =>
  `<p:ext uri="${guid}"><x:${name} xmlns:x="http://schemas.microsoft.com/office/powerpoint/${year}/main" val="${val}"/></p:ext>`
const payload = specs.map(wrapper).join('')
const root = (body = payload) =>
  `<p:presentationPr xmlns:p="${P}"><p:extLst>${body}</p:extLst></p:presentationPr>`
async function fixture(xml = root(), rel = 'presProps', targetMode) {
  const zip = fieldFixture()
  const relPart = 'ppt/_rels/presentation.xml.rels'
  zip.file(
    relPart,
    (await zip.file(relPart).async('string')).replace(
      '</Relationships>',
      `<Relationship Id="properties" Type="${R}/${rel}" Target="presProps.xml"${targetMode === undefined ? '' : ` TargetMode="${targetMode}"`}/></Relationships>`
    )
  )
  zip.file(part, xml)
  return zip
}
const project = (zip) => projectSemanticImport({ zip, presentation: fieldPresentation() })
const owner = (document) =>
  Object.values(document.definitions).find(
    (definition) => definition.kind === 'presentation-properties'
  )

it.each([undefined, 'Internal'])(
  'accepts the internal properties relationship mode %s',
  async (mode) => {
    const result = await project(await fixture(root(), 'presProps', mode))
    expect(
      owner(result.presentation.pptxSemantic).content.presentationProperties.defaultImageDpi.value
    ).toBe(32767)
  }
)

it.each(['External', 'internal', 'unknown'])(
  'rejects non-internal properties mode %s',
  async (mode) => {
    await expect(project(await fixture(root(), 'presProps', mode))).rejects.toThrow()
  }
)

it('rejects duplicate exact properties owner relationships', async () => {
  const zip = await fixture()
  const relPart = 'ppt/_rels/presentation.xml.rels'
  zip.file(
    relPart,
    (await zip.file(relPart).async('string')).replace(
      '</Relationships>',
      `<Relationship Id="duplicate-properties" Type="${R}/presProps" Target="presProps.xml"/></Relationships>`
    )
  )
  await expect(project(zip)).rejects.toThrow(/ambiguous presentation properties owner/)
})

it.each([
  ['false', 'true', '0', false, true, 0],
  ['1', '0', '4294967295', true, false, 4294967295],
])('retains valid explicit typed variants %s/%s/%s', async (discard, tracking, dpi, a, b, c) => {
  const xml = root(
    specs
      .map((spec, index) => wrapper([...spec.slice(0, 3), [discard, dpi, tracking][index]]))
      .join('')
  )
    .replace(/(<\/?)p:/g, '$1pres:')
    .replace('xmlns:p=', 'xmlns:pres=')
  const properties = owner((await project(await fixture(xml))).presentation.pptxSemantic).content
    .presentationProperties
  expect(properties.discardImageEditData.value).toBe(a)
  expect(properties.chartTrackingRefBased.value).toBe(b)
  expect(properties.defaultImageDpi.value).toBe(c)
})

it('keeps absent declarations absent and accepts an empty native property root', async () => {
  const single = owner(
    (await project(await fixture(root(wrapper(specs[1]))))).presentation.pptxSemantic
  )
  expect(Object.keys(single.content.presentationProperties)).toEqual(['defaultImageDpi'])
  const empty = await project(await fixture(`<p:presentationPr xmlns:p="${P}"/>`))
  expect(owner(empty.presentation.pptxSemantic)).toBeUndefined()
})

it('preserves exact typed values with owner, namespace, wrapper, component and part bindings', async () => {
  const zip = await fixture()
  const before = await stableZip(zip)
  const result = await project(zip)
  const document = result.presentation.pptxSemantic
  const definition = owner(document)
  const hash = createHash('sha256').update(root()).digest('hex')
  expect(definition.source).toEqual({
    partUri: part,
    preconditionHash: hash,
    componentLocator: { path: [0], preconditionHash: hash },
  })
  for (const [index, [name, year, guid, , value]] of specs.entries()) {
    const entry = definition.content.presentationProperties[name]
    const id = `${part}#unknown-extension:0.0.${index}.0`
    expect(entry).toEqual({
      value,
      namespaceUri: `http://schemas.microsoft.com/office/powerpoint/${year}/main`,
      extensionUri: guid,
      componentId: id,
      wrapperLocator: { path: [0, 0, index], preconditionHash: hash },
    })
    expect(definition.components[index]).toEqual({
      id,
      kind: 'property',
      locator: { path: [0, 0, index, 0], preconditionHash: hash },
    })
    expect(result.admission.dispositions.find((item) => item.definitionId === id)).toMatchObject({
      disposition: 'semantically-mapped',
      partUri: part,
    })
    expect(Object.isFrozen(entry.wrapperLocator.path)).toBe(true)
  }
  expect(result.trustedSemanticImportMetadata.definitions[definition.id]).toEqual(definition)
  const reopened = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(document)))
  expect(reopened).toEqual(JSON.parse(JSON.stringify(document)))
  expect(owner(reopened)).toEqual(definition)
  expect(Object.isFrozen(owner(reopened).content.presentationProperties)).toBe(true)
  expect(
    Object.values(document.instances).some((item) => item.definitionId === definition.id)
  ).toBe(false)
  expect(result.admission.visualQualification).toBe('unqualified')
  expect(await stableZip(zip)).toEqual(before)
})

it.each([
  root(payload.replace('val="0"', '')),
  root(payload.replace('val="0"', 'val="2"')),
  root(payload.replace('val="0"', 'val="False"')),
  root(payload.replace('val="32767"', 'val="1.5"')),
  root(payload.replace('val="32767"', 'val="-1"')),
  root(payload.replace('val="32767"', 'val="4294967296"')),
  root(payload.replace('val="1"', 'val=""')),
  root(payload.replace('val="0"', 'val="0" extra="lost"')),
  root(payload.replace('val="0"', 'val="0" val="1"')),
  root(payload.replace('val="0"/>', 'val="0"><x:extra/></x:discardImageEditData>')),
  root(payload.replace('val="0"/>', 'val="0">lost</x:discardImageEditData>')),
  root(payload + wrapper(specs[0])),
  root(payload.replace('2010/main', '2099/main')),
  root(payload.replace('E76CE94A', '00000000')),
  root(payload.replace('<p:ext uri=', '<p:ext extra="lost" uri=')),
  root(payload.replace('</p:ext>', '<p:extra/></p:ext>')),
  root(payload).replace('<p:extLst>', '<p:extLst extra="lost">'),
  root(payload).replace('<p:extLst>', '<p:extLst/><p:extLst>'),
  root(payload).replace('</p:presentationPr>', '<p:extra/></p:presentationPr>'),
  root(payload).replaceAll('p:presentationPr', 'p:sld'),
  root(payload + '<p:ext uri="unknown"><x:future xmlns:x="urn:future"/></p:ext>'),
])('rejects malformed or unrecognized presentation properties: %s', async (xml) => {
  await expect(project(await fixture(xml))).rejects.toThrow()
})

it('rejects a properties part without its exact presentation relationship type', async () => {
  await expect(project(await fixture(root(), 'customXml'))).rejects.toThrow()
})

it.each(['value', 'namespace', 'guid', 'owner', 'locator', 'hash', 'delete'])(
  'rejects immutable-source tamper: %s',
  async (fault) => {
    const original = (await project(await fixture())).presentation
    const forged = structuredClone(original)
    const definition = owner(forged.pptxSemantic)
    const entry = definition.content.presentationProperties.discardImageEditData
    if (fault === 'value') entry.value = true
    if (fault === 'namespace') entry.namespaceUri = 'urn:forged'
    if (fault === 'guid') entry.extensionUri = specs[1][2]
    if (fault === 'owner') definition.source.partUri = 'ppt/other.xml'
    if (fault === 'locator') entry.wrapperLocator.path = [0, 5, 0]
    if (fault === 'hash') definition.source.preconditionHash = '0'.repeat(64)
    if (fault === 'delete') delete forged.pptxSemantic.definitions[definition.id]
    expect(() => assertSemanticBaseline(original, forged)).toThrow()
  }
)

it.each(['value', 'extra', 'component', 'wrapper', 'namespace', 'guid', 'unknown', 'occurrence'])(
  'validates the canonical presentation-properties contract: %s',
  async (fault) => {
    const document = structuredClone((await project(await fixture())).presentation.pptxSemantic)
    const entry = owner(document).content.presentationProperties.defaultImageDpi
    if (fault === 'value') entry.value = '32767'
    if (fault === 'extra') entry.rawXml = '<opaque/>'
    if (fault === 'component') entry.componentId = 'missing'
    if (fault === 'wrapper') entry.wrapperLocator.path = [0]
    if (fault === 'namespace') entry.namespaceUri = 'urn:unknown'
    if (fault === 'guid') entry.extensionUri = specs[0][2]
    if (fault === 'unknown') owner(document).content.presentationProperties.future = entry
    if (fault === 'occurrence')
      Object.values(document.instances)[0].definitionId = owner(document).id
    expect(() => normalizePptxSemanticDocument(document)).toThrow()
  }
)
