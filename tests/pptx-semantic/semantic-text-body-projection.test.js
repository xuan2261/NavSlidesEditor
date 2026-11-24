import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fieldFixture, fieldPart, fieldPresentation } from './field-fixtures'
import { stableZip } from './feature-fixtures'
import { normalizeTextDocument } from '../../shared/src/pptx-text-document'
import { normalizePptxSemanticDocument } from '../../shared/src/pptx-semantic-document'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const project = (zip) => projectSemanticImport({ zip, presentation: fieldPresentation() })
const nativeBody = '<a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="ctr"><a:normAutofit/></a:bodyPr>'
const expectedBody = {
  verticalText: 'horz', insetLeftEmu: 91440, insetTopEmu: 45720,
  insetRightEmu: 91440, insetBottomEmu: 45720, rtlColumns: false,
  verticalAlign: 'ctr', autofit: { mode: 'normal' },
}
async function fixture(body, options) {
  const zip = fieldFixture('', options)
  const xml = await zip.file(fieldPart).async('string')
  const prefix = options?.aliases ? 'draw' : 'a'
  zip.file(fieldPart, xml.replace(`<${prefix}:bodyPr/>`, body.replaceAll('a:', `${prefix}:`)))
  return zip
}
const sourceOf = (result) => Object.values(result.presentation.pptxSemantic.definitions)
  .find((definition) => definition.source.partUri === fieldPart)

describe('native text body extraction and exact owner admission', () => {
  it.each([
    { strict: false, aliases: false }, { strict: true, aliases: false },
    { strict: false, aliases: true }, { strict: true, aliases: true },
  ])('preserves the native master body declarations with %j', async (options) => {
    const zip = await fixture(nativeBody, options), before = await stableZip(zip)
    const result = await project(zip), source = sourceOf(result)
    expect(source.content.textDocument.body).toEqual(expectedBody)
    expect(normalizeTextDocument(JSON.parse(JSON.stringify(source.content.textDocument))))
      .toEqual(source.content.textDocument)
    const serialized = JSON.parse(JSON.stringify(result.presentation.pptxSemantic))
    expect(normalizePptxSemanticDocument(serialized)).toEqual(serialized)
    expect(Object.isFrozen(source.content.textDocument.body.autofit)).toBe(true)
    const disposition = result.admission.dispositions.find((item) => item.definitionId === source.id)
    expect(disposition).toMatchObject({ disposition: 'semantically-mapped', partUri: fieldPart })
    expect(source.source.preconditionHash).toBe(result.inventory.definitions.find((item) => item.id === source.id).preconditionHash)
    expect(source.components.find((item) => item.id === source.content.textDocument.componentId))
      .toEqual({
        id: '2:body', kind: 'property', locator: {
          path: [...source.source.componentLocator.path, 2],
          preconditionHash: source.source.preconditionHash,
        },
      })
    expect(Object.values(result.presentation.pptxSemantic.instances)
      .filter((instance) => instance.definitionId === source.id)).toHaveLength(2)
    expect(result.admission.visualQualification).toBe('unqualified')
    expect(await stableZip(zip)).toEqual(before)
  })

  it.each([
    ['<a:bodyPr/>', {}],
    ['<a:bodyPr rtlCol="false" anchorCtr="0" spcFirstLastPara="false" wrap="none" rot="-60000"><a:noAutofit/></a:bodyPr>',
      { rtlColumns: false, anchorCenter: false, spaceFirstLastParagraph: false, wrap: false, rotation: -60000, autofit: { mode: 'none' } }],
    ['<a:bodyPr rtlCol="true" anchorCtr="1" spcFirstLastPara="true" wrap="square"><a:spAutoFit/></a:bodyPr>',
      { rtlColumns: true, anchorCenter: true, spaceFirstLastParagraph: true, wrap: true, autofit: { mode: 'shape' } }],
    ['<a:bodyPr><a:normAutofit fontScale="85000" lnSpcReduction="12000"/></a:bodyPr>',
      { autofit: { mode: 'normal', fontScale: 85000, lineSpaceReduction: 12000 } }],
    ['<a:bodyPr numCol="1" compatLnSpc="0"><a:prstTxWarp prst="textNoShape"/></a:bodyPr>',
      { columnCount: 1, compatibleLineSpacing: false, presetTextWarp: 'textNoShape' }],
    ['<a:bodyPr upright="1"/>', { upright: true }],
    ['<a:bodyPr upright="false"/>', { upright: false }],
  ])('retains authored values without adding defaults: %s', async (body, expected) => {
    const result = await project(await fixture(body))
    expect(sourceOf(result).content.textDocument.body ?? {}).toEqual(expected)
  })

  it.each([
    '<a:bodyPr rtlCol="2"/>', '<a:bodyPr rtlCol="0" rtlCol="1"/>',
    '<a:bodyPr upright="2"/>',
    '<a:bodyPr rtlCol="&bogus;"/>', '<a:bodyPr unknown="0"/>',
    '<a:bodyPr lIns="1.5"/>', '<a:bodyPr lIns="2147483648"/>',
    '<a:bodyPr vert="unknown"/>', '<a:bodyPr anchor="middle"/>',
    '<a:bodyPr wrap="1"/>', '<a:bodyPr>lost</a:bodyPr>',
    '<a:bodyPr><a:unknown/></a:bodyPr>',
    '<a:bodyPr><a:normAutofit fontScale="100001"/></a:bodyPr>',
    '<a:bodyPr><a:noAutofit fontScale="50000"/></a:bodyPr>',
    '<a:bodyPr><a:normAutofit/><a:spAutoFit/></a:bodyPr>',
    '<a:bodyPr><a:prstTxWarp prst="textNoShape"><wrong:avLst xmlns:wrong="urn:foreign"/></a:prstTxWarp></a:bodyPr>',
    '<a:bodyPr><a:prstTxWarp prst="textNoShape"><a:avLst unknown="1"/></a:prstTxWarp></a:bodyPr>',
    '<a:bodyPr><a:prstTxWarp prst="textNoShape"><a:avLst><a:gd name="adj" fmla="val 1"/></a:avLst></a:prstTxWarp></a:bodyPr>',
    '<a:bodyPr><a:spAutoFit/><a:prstTxWarp prst="textNoShape"><a:avLst/></a:prstTxWarp></a:bodyPr>',
    '<a:bodyPr><a:normAutofit><a:unknown/></a:normAutofit></a:bodyPr>',
    '<a:bodyPr><a:normAutofit>lost</a:normAutofit></a:bodyPr>',
    '<a:bodyPr/><a:bodyPr/>',
    '<a:bodyPr/><p:txBody><a:bodyPr rtlCol="1"/></p:txBody>',
  ])('rejects unsupported or malformed declarations with a source location: %s', async (body) => {
    await expect(project(await fixture(body))).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: fieldPart },
    })
  })

  it('rejects a body declaration outside its exact text-body owner', async () => {
    const zip = await fixture('<a:bodyPr/>')
    zip.file(fieldPart, (await zip.file(fieldPart).async('string'))
      .replace('</p:spPr>', `${nativeBody}</p:spPr>`))
    await expect(project(zip)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: fieldPart },
    })
  })

  it('validates rtlColumns as an optional boolean in canonical JSON', () => {
    for (const rtlColumns of [false, true]) {
      const document = { schemaVersion: 1, componentId: 'body', body: { rtlColumns }, paragraphs: [] }
      expect(normalizeTextDocument(document)).toEqual(document)
    }
    expect(() => normalizeTextDocument({
      schemaVersion: 1, componentId: 'body', body: { rtlColumns: 0 }, paragraphs: [],
    })).toThrow()
  })
})
