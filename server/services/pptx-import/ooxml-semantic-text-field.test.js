import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { parseXml } = require('./ooxml-text-run-xml')
const { readSemanticTextField } = require('./ooxml-semantic-text-field')
const xml = '<fld xmlns="http://schemas.openxmlformats.org/drawingml/2006/main" id="native" type="custom"><rPr xmlns:d="http://schemas.openxmlformats.org/drawingml/2006/main" smtClean="0"><d:latin typeface="Arial"/></rPr><pPr/><t/></fld>'
function fixture(sourceXml = xml) {
  const node = parseXml(sourceXml)[0]
  const field = {
    id: 'field', kind: 'text-field', parentDefinitionId: 'paragraph',
    partUri: 'ppt/slides/slide9.xml', preconditionHash: 'a'.repeat(64),
  }
  return { node, context: {
    xml: sourceXml, source: { partUri: field.partUri, preconditionHash: field.preconditionHash },
    components: [field], nodes: new Map([[field.id, node]]),
  } }
}
const fail = (source, message) => { throw Object.assign(new Error(message), { source }) }

describe('field source association', () => {
  it('accepts default namespaces and local prefix declarations without losing proofing', () => {
    const { node, context } = fixture()
    expect(readSemanticTextField(node, 'paragraph', context, fail)).toEqual({
      componentId: 'field', kind: 'field', text: '', field: { id: 'native', type: 'custom' },
      properties: { fontLatin: { typeface: 'Arial' } }, proofing: { smtClean: false },
    })
  })
  it.each([
    ['kumimoji="0" cap="none" normalizeH="false"', { kumimoji: false, capitalization: 'none', normalizeHeight: false }],
    ['kumimoji="true" cap="small" normalizeH="1"', { kumimoji: true, capitalization: 'small', normalizeHeight: true }],
    ['cap="all"', { capitalization: 'all' }],
  ])('retains field typography declarations %s without evaluating the cached value', (attrs, properties) => {
    const { node, context } = fixture(xml.replace('smtClean="0"', `smtClean="0" ${attrs}`))
    expect(readSemanticTextField(node, 'paragraph', context, fail)).toMatchObject({
      kind: 'field', text: '', properties: { fontLatin: { typeface: 'Arial' }, ...properties }, proofing: { smtClean: false },
    })
  })
  it.each(['kumimoji="yes"', 'cap="uppercase"', 'normalizeH="2"'])('rejects malformed field typography %s', (attrs) => {
    const { node, context } = fixture(xml.replace('smtClean="0"', attrs))
    expect(() => readSemanticTextField(node, 'paragraph', context, fail)).toThrow(/field/)
  })
  const fieldXml = (children) => `<fld xmlns="http://schemas.openxmlformats.org/drawingml/2006/main" id="native" type="custom">${children}</fld>`
  it('accepts explicit empty pPr pair', () => {
    const { node, context } = fixture(fieldXml('<rPr/><pPr></pPr><t>1</t>'))
    expect(readSemanticTextField(node, 'paragraph', context, fail)).toMatchObject({
      kind: 'field', text: '1', field: { id: 'native', type: 'custom' }, properties: {},
    })
  })
  it('admits and parses field pPr defRPr allowing direct rPr overrides', () => {
    const { node, context } = fixture(
      fieldXml('<rPr b="1" altLang="en-US"/><pPr><defRPr sz="2400" i="1" b="0"/></pPr><t>1</t>')
    )
    const result = readSemanticTextField(node, 'paragraph', context, fail)
    expect(result).toMatchObject({
      kind: 'field',
      text: '1',
      properties: {
        fontSizePt: 24,
        italic: true,
        bold: true,
        altLanguage: 'en-US',
      },
    })
  })
  it('rejects malformed defRPr in field paragraph properties', () => {
    const { node, context } = fixture(
      fieldXml('<pPr><defRPr cap="invalid"/></pPr><t>1</t>')
    )
    expect(() => readSemanticTextField(node, 'paragraph', context, fail)).toThrow(/field/)
  })
  it.each([
    ['attributes', '<rPr/><pPr algn="ctr"/><t>x</t>', /field pPr attribute algn/],
    ['children', '<rPr/><pPr><spcBef/></pPr><t>x</t>', /field paragraph properties/],
    ['text', '<rPr/><pPr>unexpected</pPr><t>x</t>', /field pPr text/],
    ['order', '<pPr/><rPr/><t>x</t>', /field children/],
    ['duplicates', '<rPr/><pPr/><pPr/><t>x</t>', /field children/],
    ['foreign namespace', '<bad:pPr xmlns:bad="urn:wrong"/><t>x</t>', /field children/],
  ])('rejects unsupported field paragraph properties (%s)', (_name, children, error) => {
    const { node, context } = fixture(fieldXml(children))
    expect(() => readSemanticTextField(node, 'paragraph', context, fail)).toThrow(error)
  })
  it.each([
    (context) => { context.components = [] },
    (context) => { context.components.push(context.components[0]) },
    (context) => { context.nodes = new Map() },
    (context) => { context.components[0].parentDefinitionId = 'other-paragraph' },
    (context) => { context.components[0].kind = 'text-run' },
    (context) => { context.components[0].partUri = 'ppt/slides/slide3.xml' },
    (context) => { context.components[0].preconditionHash = 'b'.repeat(64) },
  ])('rejects missing, duplicate, stale or foreign inventoried identity', (mutate) => {
    const { node, context } = fixture()
    mutate(context)
    expect(() => readSemanticTextField(node, 'paragraph', context, fail)).toThrow(/source association/)
  })
})
