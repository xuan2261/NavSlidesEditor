import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fieldFixture, fieldPart, fieldPresentation } from './field-fixtures'
import { stableZip } from './feature-fixtures'
import { normalizePptxSemanticDocument } from '../../shared/src/pptx-semantic-document'
import {
  createSemanticClipboard,
  pasteSemanticClipboard,
} from '../../client/src/utils/pptx-semantic-clipboard'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const namespace = 'http://schemas.microsoft.com/office/drawing/2014/main'
const extensionUri = '{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}'
const guid = '{D52C8818-99FA-4D69-965D-869392AE6222}'
const leaf = (attributes = `id="${guid}"`, uri = namespace) =>
  `<ci:creationId xmlns:ci="${uri}" ${attributes}/>`
const project = (zip) => projectSemanticImport({ zip, presentation: fieldPresentation() })
const definitionOf = (document) =>
  Object.values(document.definitions).find((item) => item.source.partUri === fieldPart)

async function fixture(payload = leaf(), options = {}, uri = extensionUri) {
  const zip = fieldFixture(undefined, options)
  const drawing = options.strict
    ? 'http://purl.oclc.org/ooxml/drawingml/main'
    : 'http://schemas.openxmlformats.org/drawingml/2006/main'
  const metadata = `<extLst xmlns="${drawing}"><ext uri="${uri}">${payload}</ext></extLst>`
  const xml = await zip.file(fieldPart).async('string')
  zip.file(
    fieldPart,
    xml.replace(
      /<([^:>]+):cNvPr\b([^>]*?)\/>/,
      (_, prefix, attributes) => `<${prefix}:cNvPr${attributes}>${metadata}</${prefix}:cNvPr>`
    )
  )
  return zip
}

it.each([
  { strict: false, aliases: false },
  { strict: false, aliases: true },
  { strict: true, aliases: false },
  { strict: true, aliases: true },
])('preserves source-bound native creation identity with %j', async (options) => {
  const zip = await fixture(leaf(), options)
  const before = await stableZip(zip)
  const inventory = await buildSemanticInventory(zip)
  const source = inventory.definitions.find(
    (item) => item.partUri === fieldPart && item.namespaceUri === namespace
  )
  const result = await project(zip)
  const document = result.presentation.pptxSemantic
  const definition = definitionOf(document)
  expect(definition.source.creationId).toEqual({ value: guid, componentId: source.id })
  expect(definition.components.find((item) => item.id === source.id)).toEqual({
    id: source.id,
    kind: 'property',
    locator: source.componentLocators[0],
  })
  expect(
    result.admission.dispositions.find((item) => item.definitionId === source.id)
  ).toMatchObject({ disposition: 'semantically-mapped', locator: source.componentLocators[0] })
  expect(Object.isFrozen(definition.source.creationId)).toBe(true)
  expect(
    Object.values(document.instances).filter((item) => item.definitionId === definition.id)
  ).toHaveLength(2)
  const serialized = JSON.parse(JSON.stringify(document))
  expect(normalizePptxSemanticDocument(serialized)).toEqual(serialized)
  const forged = structuredClone(result.presentation)
  definitionOf(forged.pptxSemantic).source.creationId.value =
    '{00000000-0000-0000-0000-000000000000}'
  expect(() => assertSemanticBaseline(result.presentation, forged)).toThrow()
  expect(result.admission.visualQualification).toBe('unqualified')
  expect(await stableZip(zip)).toEqual(before)
})

it('retains independent group and leaf identities without treating GUIDs as global keys', async () => {
  const zip = await fixture()
  const metadata = `<a:extLst><a:ext uri="${extensionUri}">${leaf()}</a:ext></a:extLst>`
  const group = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="4" name="Group">${metadata}</p:cNvPr><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/><a:chOff x="0" y="0"/><a:chExt cx="914400" cy="457200"/></a:xfrm></p:grpSpPr>`
  zip.file(
    fieldPart,
    (await zip.file(fieldPart).async('string'))
      .replace('<p:spTree>', `<p:spTree>${group}`)
      .replace('</p:spTree>', '</p:grpSp></p:spTree>')
  )
  const result = await project(zip)
  const definitions = Object.values(result.presentation.pptxSemantic.definitions).filter(
    (item) => item.source.partUri === fieldPart
  )
  expect(definitions.map((item) => item.source.nativeId)).toEqual(['4', '2'])
  expect(definitions.map((item) => item.source.creationId.value)).toEqual([guid, guid])
  expect(new Set(definitions.map((item) => item.source.creationId.componentId)).size).toBe(2)
  for (const definition of definitions)
    expect(
      result.admission.dispositions.find(
        (item) => item.definitionId === definition.source.creationId.componentId
      )?.disposition
    ).toBe('semantically-mapped')
})

it('keeps creation provenance exact through source-bound clipboard and JSON reopen', async () => {
  const original = (await project(await fixture())).presentation
  const slide = original.slides[0]
  const element = slide.elements.find((item) => item.pptxInstanceId.includes('#shape:2'))
  const clipboard = createSemanticClipboard({
    presentation: original,
    slide,
    selectedElementIds: [element.id],
  })
  const pasted = pasteSemanticClipboard({
    presentation: original,
    slideId: original.slides[1].id,
    clipboard: JSON.parse(JSON.stringify(clipboard)),
  }).presentation
  const reopened = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(pasted.pptxSemantic)))
  expect(reopened.definitions).toEqual(original.pptxSemantic.definitions)
  const added = pasted.slides[1].elements.at(-1)
  const instance = reopened.instances[added.pptxInstanceId]
  expect(reopened.definitions[instance.definitionId].source.creationId.value).toBe(guid)
  expect(() => assertSemanticBaseline(original, pasted)).not.toThrow()
})

it.each([
  [leaf('id="not-a-guid"')],
  [leaf(`id="${guid}" extra="lost"`)],
  [`<ci:creationId xmlns:ci="${namespace}" id="${guid}"><ci:extra/></ci:creationId>`],
  [leaf() + leaf()],
  [leaf(), '{00000000-0000-0000-0000-000000000000}'],
  [leaf(`id="${guid}"`, 'urn:unimplemented:creation')],
  [`<ci:creationId xmlns:ci="${namespace}" id="${guid}">lost</ci:creationId>`],
  [leaf(`id="${guid}" id="${guid}"`)],
])('rejects unsupported creation metadata without false mapping: %s', async (payload, uri) => {
  const zip = await fixture(payload, {}, uri)
  const before = await stableZip(zip)
  await expect(project(zip)).rejects.toMatchObject({
    code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    sourceLocation: { partUri: fieldPart },
  })
  expect(await stableZip(zip)).toEqual(before)
})

it.each(['outside-nonvisual', 'wrong-owner-kind'])(
  'rejects misplaced creation identity %s',
  async (placement) => {
    const zip = placement === 'outside-nonvisual' ? fieldFixture() : await fixture()
    const xml = await zip.file(fieldPart).async('string')
    zip.file(
      fieldPart,
      placement === 'outside-nonvisual'
        ? xml.replace('</p:spPr>', `${leaf()}</p:spPr>`)
        : xml.replaceAll('p:nvSpPr', 'p:nvPicPr')
    )
    await expect(project(zip)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: { partUri: fieldPart },
    })
  }
)

it.each(['invalid-guid', 'missing-component', 'opaque-extra', 'run-component'])(
  'validates canonical creation identity %s',
  async (fault) => {
    const result = await project(fieldFixture())
    const document = structuredClone(result.presentation.pptxSemantic)
    const definition = definitionOf(document)
    definition.source.creationId = {
      value: guid,
      componentId: definition.components.find((item) => item.kind === 'property').id,
    }
    if (fault === 'invalid-guid') definition.source.creationId.value = 'invalid'
    if (fault === 'missing-component') definition.source.creationId.componentId = 'missing'
    if (fault === 'opaque-extra') definition.source.creationId.rawXml = '<opaque/>'
    if (fault === 'run-component')
      definition.source.creationId.componentId = definition.components.find(
        (item) => item.kind === 'run'
      ).id
    expect(() => normalizePptxSemanticDocument(document)).toThrow()
  }
)
