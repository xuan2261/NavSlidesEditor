import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fieldFixture, fieldPart, fieldPresentation, nativeFields } from './field-fixtures'
import { stableZip } from './feature-fixtures'
import { normalizeTextDocument } from '../../shared/src/pptx-text-document'
import { normalizePptxSemanticDocument } from '../../shared/src/pptx-semantic-document'
import { semanticTextToTipTap, semanticTextFromTipTap, commitSemanticText } from '../../client/src/utils/pptx-semantic-text-bridge'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { patchPlainRun } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const project = (zip) => projectSemanticImport({ zip, presentation: fieldPresentation() })
const sourceOf = (result) => Object.values(result.presentation.pptxSemantic.definitions)
  .find((definition) => definition.source.partUri === fieldPart)

describe('lossless source field extraction, not field evaluation', () => {
  it.each([
    { strict: false, aliases: false }, { strict: false, aliases: true },
    { strict: true, aliases: false }, { strict: true, aliases: true },
  ])('projects inventoried fields and two host occurrences with %j', async (options) => {
    const zip = fieldFixture(nativeFields, options), before = await stableZip(zip)
    const inventory = await buildSemanticInventory(zip)
    const result = await project(zip), source = sourceOf(result)
    const text = source.content.textDocument
    expect(text.paragraphs[0].runs.map((run) => [run.kind, run.text])).toEqual([
      ['text', ' before '], ['field', '13/10/2026'], ['field', '\u2039#\u203a'], ['text', ' after '],
    ])
    const fields = inventory.definitions.filter((item) => item.kind === 'text-field' && item.partUri === fieldPart)
    for (const [index, field] of fields.entries()) {
      expect(text.paragraphs[0].runs[index + 1]).toEqual({
        componentId: field.id, kind: 'field',
        text: index === 0 ? '13/10/2026' : '\u2039#\u203a',
        field: { id: field.attributes.id, type: field.attributes.type },
        properties: { language: 'en-US' }, proofing: { smtClean: false },
      })
      expect(source.components.find((component) => component.id === field.id)).toEqual({
        id: field.id, kind: 'run', locator: field.componentLocators[0],
      })
      expect(field.parentDefinitionId).toBe(text.paragraphs[0].componentId)
      expect(field.preconditionHash).toBe(createHash('sha256').update(await zip.file(fieldPart).async('nodebuffer')).digest('hex'))
      expect(result.admission.dispositions.find((item) => item.definitionId === field.id))
        .toMatchObject({ disposition: 'semantically-mapped', locator: field.componentLocators[0] })
    }
    const instances = Object.values(result.presentation.pptxSemantic.instances).filter((item) => item.definitionId === source.id)
    expect(instances.map((item) => item.slideId)).toEqual(['first', 'second'])
    expect(new Set(instances.map((item) => item.id)).size).toBe(2)
    expect(instances.map((item) => item.relationshipChain)).toEqual([
      ['ppt/slides/slide9.xml', 'layout'], ['ppt/slides/slide3.xml', 'layout'],
    ])
    expect(Object.values(result.presentation.pptxSemantic.instances).filter((item) =>
      result.presentation.pptxSemantic.definitions[item.definitionId].source.nativeId === '900')).toHaveLength(2)
    expect(Object.isFrozen(text.paragraphs[0].runs[1].proofing)).toBe(true)
    expect(normalizeTextDocument(JSON.parse(JSON.stringify(text)))).toEqual(text)
    const serialized = JSON.parse(JSON.stringify(result.presentation.pptxSemantic))
    expect(normalizePptxSemanticDocument(serialized)).toEqual(serialized)
    expect((await project(zip)).inventory).toEqual(inventory)
    expect(result.admission.visualQualification).toBe('unqualified')
    expect(await stableZip(zip)).toEqual(before)
  })

  it('retains whitespace, entities, CDATA, empty caches, custom types, and authored false/absence', async () => {
    const field = (id, cache, properties = '') => `<a:fld id="${id}" type="vendor.custom">${properties}${cache}</a:fld>`
    const result = await project(fieldFixture(
      field('&#65;&amp;B', '<a:t xml:space="preserve"> \t&#xA0;&amp;&lt;\n<![CDATA[<>]]> </a:t>',
        '<a:rPr sz="1234" b="0" i="true" lang="en-US" smtClean="false"><a:latin typeface="A&amp;B"/></a:rPr>') +
      field('empty', '<a:t/>', '<a:rPr smtClean="1"/>') +
      field('absent', '<a:t></a:t>')))
    const runs = sourceOf(result).content.textDocument.paragraphs[0].runs
    expect(runs[1]).toMatchObject({
      field: { id: 'A&B', type: 'vendor.custom' }, text: ' \t\u00a0&<\n<> ',
      properties: { fontSizePt: 12.34, bold: false, italic: true, language: 'en-US', fontLatin: { typeface: 'A&B' } },
      proofing: { smtClean: false },
    })
    expect(runs[2]).toMatchObject({ text: '', proofing: { smtClean: true } })
    expect(runs[3].text).toBe('')
    expect(runs[3]).not.toHaveProperty('proofing')
    const text = sourceOf(result).content.textDocument
    expect(semanticTextFromTipTap(semanticTextToTipTap(text))).toEqual(text)
  })

  it('retains the native cached field through an optional empty paragraph declaration and JSON reopen', async () => {
    // CT_TextField permits pPr; only the empty declaration is currently source-admitted.
    // https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.field
    const zip = fieldFixture('<a:fld id="x" type="slidenum"><a:pPr/><a:t>1</a:t></a:fld>')
    const before = await stableZip(zip)
    const result = await project(zip)
    const source = sourceOf(result)
    const run = source.content.textDocument.paragraphs[0].runs.find((entry) => entry.kind === 'field')
    expect(run).toEqual({
      componentId: expect.any(String), kind: 'field', text: '1',
      field: { id: 'x', type: 'slidenum' }, properties: {},
    })
    const reopened = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(result.presentation.pptxSemantic)))
    expect(reopened.definitions[source.id].content.textDocument).toEqual(source.content.textDocument)
    expect(source.source.preconditionHash)
      .toBe(createHash('sha256').update(await zip.file(fieldPart).async('nodebuffer')).digest('hex'))
    expect(await stableZip(zip)).toEqual(before)
  })

  it('keeps source definitions, hashes and other occurrence exact after bridge edit and JSON reopen', async () => {
    const zip = fieldFixture(), bytes = await stableZip(zip), result = await project(zip)
    const source = sourceOf(result), original = result.presentation, snapshot = JSON.stringify(original)
    const element = original.slides[0].elements.find((item) => item.pptxInstanceId.includes('#shape:2'))
    const editor = semanticTextToTipTap(source.content.textDocument)
    editor.content[0].content[0].text = ' changed '
    const text = semanticTextFromTipTap(editor)
    const updated = commitSemanticText(original, element, text, '<p> changed </p>',
      (deck, map) => ({ ...deck, slides: deck.slides.map((slide, index) => index === 0 ? map(slide) : slide) }))
    const reopened = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(updated.pptxSemantic)))
    expect(() => assertSemanticBaseline(original, updated)).not.toThrow()
    const forged = structuredClone(updated)
    forged.pptxSemantic.definitions[source.id].content.textDocument.paragraphs[0].runs[1].proofing.smtClean = true
    expect(() => assertSemanticBaseline(original, forged)).toThrow(/immutable/)
    expect(reopened.instances[element.pptxInstanceId].overrides.components[source.content.textDocument.componentId].textDocument).toEqual(text)
    expect(reopened.definitions).toEqual(original.pptxSemantic.definitions)
    for (const [id, instance] of Object.entries(original.pptxSemantic.instances)) {
      if (id === element.pptxInstanceId) continue
      expect(updated.pptxSemantic.instances[id]).toBe(instance)
      expect(reopened.instances[id]).toEqual(JSON.parse(JSON.stringify(instance)))
    }
    expect(text.paragraphs[0].runs.slice(1)).toEqual(source.content.textDocument.paragraphs[0].runs.slice(1))
    expect(JSON.stringify(original)).toBe(snapshot)
    expect(await stableZip(zip)).toEqual(bytes)
    expect(() => patchPlainRun(
      `<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:nvSpPr><p:cNvPr id="2"/></p:nvSpPr><p:txBody><a:p>${nativeFields}</a:p></p:txBody></p:sp>`, '2', '13/10/2026', 'changed'))
      .toThrow(/one plain paragraph, run, and text node/)
  })

  it('does not merge adjacent bridge fragments with different local proofing', () => {
    const document = { schemaVersion: 1, componentId: 'body', paragraphs: [{
      componentId: 'p', runs: [{ componentId: 'f', kind: 'field', text: 'a',
        field: { id: 'native', type: 'custom' }, proofing: { smtClean: false } }],
    }] }
    const editor = semanticTextToTipTap(document)
    const next = structuredClone(editor.content[0].content[0])
    next.text = 'b'
    next.marks[0].attrs.pptxRun.run.proofing.smtClean = true
    editor.content[0].content.push(next)
    const runs = semanticTextFromTipTap(editor).paragraphs[0].runs
    expect(runs.map((run) => [run.text, run.proofing.smtClean])).toEqual([['a', false], ['b', true]])
    expect(new Set(runs.map((run) => run.componentId)).size).toBe(2)
  })

  it('rejects inventoried fields outside the parsed text body rather than marking them mapped', async () => {
    const zip = fieldFixture('')
    zip.file(fieldPart, (await zip.file(fieldPart).async('string')).replace('</p:spPr>', `${nativeFields}</p:spPr>`))
    await expect(project(zip)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: fieldPart },
    })
  })

  it('retains structural identities and locators across prefix aliases, but hashes source bytes', async () => {
    const plain = await project(fieldFixture()), aliased = await project(fieldFixture(nativeFields, { aliases: true }))
    const fields = (result) => result.inventory.definitions.filter((item) => item.kind === 'text-field')
    expect(fields(aliased).map((item) => [item.id, item.componentLocators[0].path]))
      .toEqual(fields(plain).map((item) => [item.id, item.componentLocators[0].path]))
    expect(sourceOf(aliased).source.preconditionHash).not.toBe(sourceOf(plain).source.preconditionHash)
  })

  it.each([
    ['missing id', '<a:fld type="slidenum"><a:t>1</a:t></a:fld>'],
    ['empty type', '<a:fld id="x" type=""><a:t>1</a:t></a:fld>'],
    ['duplicate id', '<a:fld id="x" id="y" type="slidenum"><a:t>1</a:t></a:fld>'],
    ['unknown attribute', '<a:fld id="x" type="slidenum" dirty="1"><a:t>1</a:t></a:fld>'],
    ['missing cache', '<a:fld id="x" type="slidenum"/>'],
    ...[
      '<a:t>1</a:t><a:t>2</a:t>', '<a:rPr/><a:rPr/><a:t>1</a:t>',
      '<a:pPr/><a:pPr/><a:t>1</a:t>', '<a:unknown/><a:t>1</a:t>',
      '<a:rPr dirty="1"/><a:t>1</a:t>', '<a:rPr smtClean="2"/><a:t>1</a:t>',
      '<a:rPr b="maybe"/><a:t>1</a:t>', '<a:rPr sz="12.34"/><a:t>1</a:t>',
      '<a:rPr lang="en" lang="fr"/><a:t>1</a:t>',
      '<a:rPr><a:latin typeface="A" pitchFamily="1"/></a:rPr><a:t>1</a:t>',
      '<a:rPr><a:latin typeface="A"/><a:latin typeface="B"/></a:rPr><a:t>1</a:t>',
      '<a:rPr>lost</a:rPr><a:t>1</a:t>', 'lost<a:t>1</a:t>',
      '<a:t unknown="lost">1</a:t>', '<a:t><a:r/></a:t>',
      '<a:t>&bogus;</a:t>', '<u:t xmlns:u="urn:foreign">1</u:t>',
      '<a:t>1</a:t><a:rPr/>',
    ].map((children) => [children, `<a:fld id="x" type="slidenum">${children}</a:fld>`]),
  ])('fails with a source location and no mutation for %s', async (_name, fields) => {
    const zip = fieldFixture(fields), before = await stableZip(zip), input = fieldPresentation()
    await expect(projectSemanticImport({ zip, presentation: input })).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: fieldPart },
    })
    expect(input).toEqual(fieldPresentation())
    expect(await stableZip(zip)).toEqual(before)
  })
})
