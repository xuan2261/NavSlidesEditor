import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'
import { importTableFixture, tableFrame, tablePart } from './table-import-fixture'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const {
  normalizeTextDocument,
  normalizeTextProperties,
  TEXT_PROPERTY_SCOPES,
} = require('../../shared/src/pptx-text-document')
const {
  applyPresentationProjectionOperation: apply,
} = require('../../shared/src/pptx-projection-operation')
const { materializeFamilyDocument } = require('../../shared/src/pptx-family-operations')
const { expandTextContext } = require('../../shared/src/pptx-semantic-text-context-codec')
const copy = (value) => JSON.parse(JSON.stringify(value))
const native =
  '<a:rPr lang="en-US" sz="1800" b="1" dirty="0"><a:solidFill><a:srgbClr val="1F2937"/></a:solidFill><a:latin typeface="Aptos Display" pitchFamily="34" charset="0"/><a:ea typeface="Aptos Display" pitchFamily="34" charset="-122"/><a:cs typeface="Aptos Display" pitchFamily="34" charset="-120"/></a:rPr>'
const properties = {
  language: 'en-US',
  fontSizePt: 18,
  bold: true,
  color: { kind: 'srgb', value: '1F2937' },
  fontLatin: { typeface: 'Aptos Display', pitchFamily: 34, charset: 0 },
  fontEastAsian: { typeface: 'Aptos Display', pitchFamily: 34, charset: -122 },
  fontComplexScript: { typeface: 'Aptos Display', pitchFamily: 34, charset: -120 },
}
async function textImport(runProperties = native, bulletFont, endProperties = '') {
  const zip = await fixture()
  for (const part of [slide, layout, master])
    zip.file(
      part,
      (await zip.file(part).async('string')).replaceAll(
        '<p:spPr/>',
        '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
      )
    )
  zip.file(
    'ppt/presentation.xml',
    (await zip.file('ppt/presentation.xml').async('string')).replace(
      '</p:presentation>',
      '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'
    )
  )
  if (bulletFont)
    zip.file(
      master,
      (await zip.file(master).async('string')).replace('<a:lvl1pPr>', `<a:lvl1pPr>${bulletFont}`)
    )
  const xml = (await zip.file(slide).async('string'))
    .replace('<a:rPr/>', runProperties)
    .replace('</a:p>', `${endProperties}</a:p>`)
  zip.file(slide, xml)
  const result = await projectSemanticImport({
    zip,
    geometryInheritance: true,
    presentation: { id: 'deck', slides: [{ id: 'slide', elements: [] }] },
  })
  expect(await zip.file(slide).async('string')).toBe(xml)
  return { presentation: result.presentation, hash: createHash('sha256').update(xml).digest('hex') }
}
const definitionOf = (presentation, kind) =>
  Object.values(presentation.pptxSemantic.definitions).find(
    (d) => d.source.partUri === (kind === 'table' ? tablePart : slide) && d.kind === kind
  )
const firstRun = (text) => text.paragraphs[0].runs[0]

describe('exact native text run source metadata', () => {
  it.each(['0', '1'])(
    'preserves endParaRPr proofing=%s outside inherited visual properties',
    async (value) => {
      const { presentation } = await textImport(
        native,
        undefined,
        `<a:endParaRPr lang="en-US" sz="1800" dirty="${value}" smtClean="0"/>`
      )
      const definition = definitionOf(presentation, 'shape')
      const paragraph = definition.content.textDocument.paragraphs[0]
      expect(paragraph.endRunProperties).toEqual({ language: 'en-US', fontSizePt: 18 })
      expect(paragraph.endRunProofing).toEqual({ dirty: value === '1', smtClean: false })
      expect(paragraph.runs[0].proofing).toEqual({ dirty: false })
      expect(Object.isFrozen(paragraph.endRunProofing)).toBe(true)
      expect(normalizeSemanticPresentation(copy(presentation))).toEqual(copy(presentation))
      const { presentation: omitted } = await textImport(
        native,
        undefined,
        '<a:endParaRPr sz="1800"/>'
      )
      expect(definitionOf(omitted, 'shape').content.textDocument.paragraphs[0]).not.toHaveProperty(
        'endRunProofing'
      )
    }
  )

  it('validates end-run proofing as its own exact typed canonical record', () => {
    const document = {
      schemaVersion: 1,
      componentId: 'body',
      paragraphs: [{ componentId: 'p', runs: [], endRunProofing: { dirty: false } }],
    }
    expect(normalizeTextDocument(document)).toEqual(document)
    for (const invalid of [{}, { dirty: 0 }, { dirty: false, unknown: true }]) {
      const changed = copy(document)
      changed.paragraphs[0].endRunProofing = invalid
      expect(() => normalizeTextDocument(changed)).toThrow()
    }
  })

  it('keeps table end-run proofing and sibling text immutable across operation replay', async () => {
    const { presentation } = await importTableFixture({
      graphic: tableFrame().replace('</a:p>', '<a:endParaRPr dirty="0" smtClean="1"/></a:p>'),
    })
    const definition = definitionOf(presentation, 'table')
    const table = definition.content.tableDocument
    const instance = Object.values(presentation.pptxSemantic.instances)[0]
    const before = copy(presentation)
    const next = apply(presentation, {
      type: 'table.edit',
      instanceId: instance.id,
      componentId: table.componentId,
      command: { type: 'setRowHeight', rowId: table.rows[1].componentId, heightEmu: 0 },
    })
    const reopened = normalizeSemanticPresentation(copy(next))
    const effective = materializeFamilyDocument(
      definition,
      reopened.pptxSemantic.instances[instance.id]
    )
    const paragraph = effective.rows[0].cells[0].textDocument.paragraphs[0]
    expect(paragraph.endRunProofing).toEqual({ dirty: false, smtClean: true })
    expect(Object.isFrozen(paragraph.endRunProofing)).toBe(true)
    expect(effective.rows.map((r) => r.cells.map((c) => c.textDocument))).toEqual(
      table.rows.map((r) => r.cells.map((c) => c.textDocument))
    )
    expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(presentation).toEqual(before)
  })

  it.each(['dirty="2"', 'dirty="0" dirty="1"', 'a:dirty="0"', 'other="0"'])(
    'rejects invalid end-run source metadata at its exact node: %s',
    async (attrs) => {
      await expect(textImport(native, undefined, `<a:endParaRPr ${attrs}/>`)).rejects.toMatchObject(
        {
          code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
          sourceLocation: { partUri: slide, localName: 'endParaRPr', path: expect.any(Array) },
        }
      )
    }
  )

  it('retains authored proofing and signed font descriptors through text admission and JSON reopen', async () => {
    const { presentation, hash } = await textImport()
    const definition = definitionOf(presentation, 'shape')
    const run = firstRun(definition.content.textDocument)
    expect(run).toMatchObject({ proofing: { dirty: false }, properties })
    expect(run.properties).not.toHaveProperty('dirty')
    expect(TEXT_PROPERTY_SCOPES.run).not.toContain('dirty')
    expect(definition.source.preconditionHash).toBe(hash)
    expect(definition.components.every((c) => c.locator.preconditionHash === hash)).toBe(true)
    expect(normalizeSemanticPresentation(copy(presentation))).toEqual(copy(presentation))
    expect(Object.isFrozen(run.proofing)).toBe(true)
    expect(Object.isFrozen(run.properties.fontEastAsian)).toBe(true)
    expect(presentation.pptxSemantic.fonts).toEqual({})
    const requests = Object.values(presentation.pptxSemantic.styles)
      .filter((style) => style.kind === 'text-context')
      .flatMap(
        (style) =>
          expandTextContext(style.payload, { styles: presentation.pptxSemantic.styles })
            .fontRequests
      )
    expect(requests.find((r) => r.property === 'fontEastAsian')).toMatchObject({
      typeface: 'Aptos Display',
      pitchFamily: 34,
      charset: -122,
    })
  })

  it('retains table source metadata and sibling text through occurrence replay and JSON reopen', async () => {
    const { presentation, hash } = await importTableFixture({
      graphic: tableFrame().replace('<a:rPr sz="1200"/>', native),
    })
    const definition = definitionOf(presentation, 'table'),
      table = definition.content.tableDocument
    const instance = Object.values(presentation.pptxSemantic.instances)[0]
    const before = copy(presentation)
    const next = apply(presentation, {
      type: 'table.edit',
      instanceId: instance.id,
      componentId: table.componentId,
      command: { type: 'setRowHeight', rowId: table.rows[1].componentId, heightEmu: 0 },
    })
    const reopened = normalizeSemanticPresentation(copy(next))
    const effective = materializeFamilyDocument(
      definition,
      reopened.pptxSemantic.instances[instance.id]
    )
    expect(firstRun(effective.rows[0].cells[0].textDocument)).toMatchObject({
      proofing: { dirty: false },
      properties,
    })
    expect(effective.rows.map((r) => r.cells.map((c) => c.textDocument))).toEqual(
      table.rows.map((r) => r.cells.map((c) => c.textDocument))
    )
    expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(presentation).toEqual(before)
    expect(definition.source.preconditionHash).toBe(hash)
    expect(Object.isFrozen(firstRun(effective.rows[0].cells[0].textDocument).proofing)).toBe(true)
  })

  it('retains native master bullet font descriptors in the canonical source and request provenance', async () => {
    const descriptor = {
      typeface: 'Arial',
      panose: '020B0604020202020204',
      pitchFamily: 34,
      charset: 0,
    }
    const { presentation } = await textImport(
      native,
      '<a:buFont typeface="Arial" panose="020B0604020202020204" pitchFamily="34" charset="0"/>'
    )
    const definition = Object.values(presentation.pptxSemantic.definitions).find(
      (d) => d.source.partUri === master && d.content?.textListStyle
    )
    expect(definition.content.textListStyle.entries[0].properties.bulletFont).toEqual(descriptor)
    expect(Object.isFrozen(definition.content.textListStyle.entries[0].properties.bulletFont)).toBe(
      true
    )
    const requests = Object.values(presentation.pptxSemantic.styles)
      .filter((style) => style.kind === 'text-context')
      .flatMap(
        (style) =>
          expandTextContext(style.payload, { styles: presentation.pptxSemantic.styles })
            .fontRequests
      )
    expect(requests.find((r) => r.property === 'bulletFont')).toMatchObject(descriptor)
    expect(normalizeSemanticPresentation(copy(presentation))).toEqual(copy(presentation))
    expect(presentation.pptxSemantic.fonts).toEqual({})
  })

  it.each(['0', 'false', '1', 'true'])(
    'preserves explicit dirty=%s independently of smtClean',
    async (value) => {
      const { presentation } = await textImport(`<a:rPr dirty="${value}" smtClean="0"/>`)
      expect(firstRun(definitionOf(presentation, 'shape').content.textDocument).proofing).toEqual({
        dirty: ['1', 'true'].includes(value),
        smtClean: false,
      })
    }
  )

  it('distinguishes omitted metadata from explicit false and zero', async () => {
    const { presentation } = await textImport('<a:rPr><a:latin typeface="Aptos Display"/></a:rPr>')
    const run = firstRun(definitionOf(presentation, 'shape').content.textDocument)
    expect(run).not.toHaveProperty('proofing')
    expect(run.properties.fontLatin).toEqual({ typeface: 'Aptos Display' })
  })

  it.each([-128, 0, 127])('admits the exact xsd:byte charset bounds: %i', async (value) => {
    const { presentation } = await textImport(
      `<a:rPr><a:latin typeface="Aptos Display" pitchFamily="34" charset="${value}"/></a:rPr>`
    )
    expect(
      firstRun(definitionOf(presentation, 'shape').content.textDocument).properties.fontLatin
    ).toEqual({ typeface: 'Aptos Display', pitchFamily: 34, charset: value })
  })

  it('accepts signed integer and collapsed whitespace lexical forms without adding defaults', async () => {
    const { presentation } = await textImport(
      '<a:rPr dirty=" false "><a:latin typeface="Aptos Display" pitchFamily=" +34 " charset=" -122 "/></a:rPr>'
    )
    const run = firstRun(definitionOf(presentation, 'shape').content.textDocument)
    expect(run.proofing).toEqual({ dirty: false })
    expect(run.properties.fontLatin).toEqual({
      typeface: 'Aptos Display',
      pitchFamily: 34,
      charset: -122,
    })
  })

  it.each([
    ['dirty="yes"', 'rPr'],
    ['dirty="2"', 'rPr'],
    ['dirty="0" dirty="1"', 'rPr'],
    ['a:dirty="0"', 'rPr'],
    ['other="0"', 'rPr'],
    ['pitchFamily="128"', 'latin'],
    ['pitchFamily="-129"', 'latin'],
    ['pitchFamily="3"', 'latin'],
    ['charset="128"', 'latin'],
    ['charset="-129"', 'latin'],
    ['charset="1.5"', 'latin'],
    ['charset="bad"', 'latin'],
    ['charset="+-2"', 'latin'],
    ['charset="0" charset="1"', 'latin'],
    ['a:charset="0"', 'latin'],
    ['unknown="0"', 'latin'],
  ])(
    'rejects malformed, duplicate, namespaced and unknown source metadata at its node: %s',
    async (attrs, localName) => {
      const xml =
        localName === 'rPr'
          ? `<a:rPr ${attrs}/>`
          : `<a:rPr><a:latin typeface="Aptos Display" ${attrs}/></a:rPr>`
      await expect(textImport(xml)).rejects.toMatchObject({
        code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
        sourceLocation: { partUri: slide, localName, path: expect.any(Array) },
      })
    }
  )

  it.each([128, -129, 1.5, '0', null])(
    'rejects invalid descriptor scalars in canonical JSON: %j',
    (value) => {
      for (const field of ['pitchFamily', 'charset'])
        expect(() =>
          normalizeTextProperties(
            { fontLatin: { typeface: 'Aptos Display', [field]: value } },
            'run'
          )
        ).toThrow()
    }
  )

  it.each([128, -129, 1.5, '34', null])(
    'rejects invalid declaration-bound font request descriptor scalars: %j',
    async (value) => {
      const { presentation } = await textImport()
      for (const field of ['pitchFamily', 'charset']) {
        const changed = copy(presentation)
        expect(() => normalizeSemanticPresentation(changed)).not.toThrow()
        const request = Object.values(changed.pptxSemantic.styles)
          .filter((style) => style.kind === 'text-context')
          .flatMap(
            (style) =>
              expandTextContext(style.payload, { styles: changed.pptxSemantic.styles }).fontRequests
          )
          .find((r) => r.property === 'fontEastAsian')
        expect(request).toBeDefined()
        request[field] = value
        expect(() => normalizeSemanticPresentation(changed)).toThrow()
      }
    }
  )

  it.each([0, 'false', null, { dirty: false, unknown: true }])(
    'rejects invalid canonical proofreading metadata: %j',
    (proofing) => {
      expect(() =>
        normalizeTextDocument({
          schemaVersion: 1,
          componentId: 'body',
          paragraphs: [
            { componentId: 'p', runs: [{ componentId: 'r', kind: 'text', text: 'X', proofing }] },
          ],
        })
      ).toThrow()
    }
  )
})
