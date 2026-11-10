import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fieldFixture, fieldPart, fieldPresentation } from './field-fixtures'
import { stableZip } from './feature-fixtures'
import { normalizeTextDocument } from '../../shared/src/pptx-text-document'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')

async function fixture(properties, options = {}) {
  const zip = fieldFixture('', options)
  const prefix = options.aliases ? 'draw' : 'a'
  const xml = await zip.file(fieldPart).async('string')
  zip.file(
    fieldPart,
    xml.replace(`<${prefix}:p>`, `<${prefix}:p>${properties.replaceAll('a:', `${prefix}:`)}`)
  )
  return zip
}

async function project(zip) {
  const result = await projectSemanticImport({ zip, presentation: fieldPresentation() })
  const definition = Object.values(result.presentation.pptxSemantic.definitions).find(
    (entry) => entry.source.partUri === fieldPart
  )
  return { result, definition, paragraph: definition.content.textDocument.paragraphs[0] }
}

it.each([
  { strict: false, aliases: false },
  { strict: true, aliases: false },
  { strict: false, aliases: true },
  { strict: true, aliases: true },
])('retains explicit native paragraph level zero with %j', async (options) => {
  const zip = await fixture('<a:pPr lvl="0"/>', options)
  const before = await stableZip(zip)
  const { result, definition, paragraph } = await project(zip)
  expect(paragraph.properties).toEqual({ level: 0 })
  expect(paragraph.runs.map((run) => run.text)).toEqual([' before ', ' after '])
  expect(definition.components.some((component) => component.id === paragraph.componentId)).toBe(
    true
  )
  expect(
    normalizeTextDocument(JSON.parse(JSON.stringify(definition.content.textDocument)))
  ).toEqual(definition.content.textDocument)
  expect(
    Object.values(result.presentation.pptxSemantic.instances).filter(
      (instance) => instance.definitionId === definition.id
    )
  ).toHaveLength(2)
  expect(result.admission.visualQualification).toBe('unqualified')
  expect(await stableZip(zip)).toEqual(before)
})

it.each([1, 2, 3, 4, 8])('retains native paragraph level %i', async (level) => {
  expect((await project(await fixture(`<a:pPr lvl="${level}"/>`))).paragraph.properties).toEqual({
    level,
  })
})

it('preserves absence separately from explicit level zero', async () => {
  expect((await project(await fixture(''))).paragraph).not.toHaveProperty('properties')
  expect((await project(await fixture('<a:pPr/>'))).paragraph.properties).toEqual({})
  expect((await project(await fixture('<a:pPr lvl="&#48;"/>'))).paragraph.properties).toEqual({
    level: 0,
  })
})

it.each([
  '<a:pPr lvl="9"/>',
  '<a:pPr lvl="-1"/>',
  '<a:pPr lvl="0.5"/>',
  '<a:pPr lvl=""/>',
  '<a:pPr lvl="true"/>',
  '<a:pPr lvl="&unknown;"/>',
  '<a:pPr lvl="0" lvl="1"/>',
  '<a:pPr unknown="0"/>',
  '<a:pPr>lost</a:pPr>',
  '<a:pPr><a:unknown/></a:pPr>',
  '<a:pPr/><a:pPr/>',
  '<p:pPr lvl="0"/>',
])('rejects malformed or unsupported paragraph declarations: %s', async (properties) => {
  const zip = await fixture(properties)
  const before = await stableZip(zip)
  await expect(project(zip)).rejects.toMatchObject({
    code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    sourceLocation: { partUri: fieldPart },
  })
  expect(await stableZip(zip)).toEqual(before)
})
