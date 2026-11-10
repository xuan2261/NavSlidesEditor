import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { ommlSourceFixture, slide, math, M } from './omml-source-context-fixture'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { readSemanticTextAdmission } = require('../../server/services/pptx-import/ooxml-semantic-text-admission')
const { resolveProperty } = require('../../shared/src/pptx-style-resolution')
const A14 = 'http://schemas.microsoft.com/office/drawing/2010/main'
const wrapped = (value = math) => `<a14:m xmlns:a14="${A14}" xmlns:m="${M}">${value}</a14:m>`
const text = (value) => `<a:r><a:rPr/><a:t>${value}</a:t></a:r>`
const field = '<a:fld id="{11111111-1111-1111-1111-111111111111}" type="slidenum"><a:rPr/><a:t>1</a:t></a:fld>'
async function fixture(paragraphs) {
  const zip = await ommlSourceFixture({ placeholder: true })
  zip.file(slide, (await zip.file(slide).async('string')).replace(/<a:p>[\s\S]*?<\/a:p>/, paragraphs))
  return zip
}
const project = (zip, presentation = { id: 'deck', slides: [{ id: 'slide', elements: [] }] }) =>
  projectSemanticImport({ zip, geometryInheritance: true, presentation })
const ownerId = `${slide}#shape:2`
async function admissionContext(zip) {
  const inventory = await buildSemanticInventory(zip)
  const xml = await zip.file(slide).async('string'), roots = parseXml(xml), nodes = new Map()
  for (const d of inventory.definitions.filter((d) => d.partUri === slide)) {
    let n = { children: roots }
    for (const i of d.componentLocators[0].path) n = n.children[i]
    nodes.set(d.id, n)
  }
  const source = inventory.definitions.find((d) => d.id === ownerId)
  const components = inventory.definitions.filter((d) => d.partUri === slide && d.id !== source.id)
  return { source, components, nodes, xml, node: nodes.get(source.id) }
}

it('preserves ordered text, fields, wrapped/direct equations and every paragraph with mapped source IDs', async () => {
  const direct = `<m:oMath xmlns:m="${M}"><m:r><m:t>y</m:t></m:r></m:oMath>`
  const zip = await fixture(`<a:p><a:pPr lvl="0"><a:defRPr sz="1400" b="0"/></a:pPr>${text('before')}${wrapped()}${field}${direct}${text('after')}<a:endParaRPr sz="9900"/></a:p><a:p>${text('second')}</a:p>`)
  const before = await zip.file(slide).async('string')
  const result = await project(zip), definition = result.presentation.pptxSemantic.definitions[ownerId]
  expect(definition.kind).not.toBe('equation')
  const paragraphs = definition.content.textDocument.paragraphs
  expect(paragraphs).toHaveLength(2)
  expect(paragraphs[0].runs.map((r) => r.kind)).toEqual(['text', 'equation', 'field', 'equation', 'text'])
  expect(paragraphs[0].runs.filter((r) => r.kind === 'text').map((r) => r.text)).toEqual(['before', 'after'])
  expect(paragraphs[1].runs[0].text).toBe('second')
  const context = Object.values(result.admission.textStyleContexts).find((c) => c.definitionId === ownerId)
  expect(context.paragraphs[0].runs).toHaveLength(5)
  for (const index of [1, 3]) {
    const run = paragraphs[0].runs[index], source = context.paragraphs[0].runs[index]
    expect(run).not.toHaveProperty('text')
    expect(run).not.toHaveProperty('field')
    expect(run.componentId).toBe(`${slide}#${index === 1 ? 'unknown-extension' : 'inline-equation'}:${source.source.path}`)
    expect(resolveProperty({ property: 'fontSizePt', scope: 'run', layers: source.layers, theme: context.theme }).resolved).toBe(14)
    expect(source.layers.entries[0].kind).toBe('paragraph')
    expect(definition.components.find((c) => c.id === run.componentId)).toMatchObject({ kind: 'run', locator: { path: source.source.path.split('.').map(Number) } })
    expect(definition.components.find((c) => c.id === run.ommlDocument.root.componentId).kind).toBe('property')
  }
  const inventory = await buildSemanticInventory(zip)
  const mathIds = inventory.definitions.filter((d) => d.partUri === slide && d.kind === 'math-component').map((d) => d.id)
  expect(mathIds.length).toBeGreaterThan(0)
  for (const id of mathIds) {
    expect(definition.components.some((c) => c.id === id)).toBe(true)
    expect(result.admission.dispositions.some((d) => d.definitionId === id && d.disposition === 'semantically-mapped')).toBe(true)
  }
  expect(await zip.file(slide).async('string')).toBe(before)
})

it('inherits containing paragraph styles without interpreting math run formatting as DrawingML runs', async () => {
  const equation = '<m:oMath><m:r><a:rPr sz="2400" b="1"/><m:t>x</m:t></m:r></m:oMath>'
  const zip = await fixture(`<a:p><a:pPr><a:defRPr sz="1400" b="0"/></a:pPr>${text('before')}${wrapped(equation)}</a:p>`)
  const result = await project(zip)
  const definition = result.presentation.pptxSemantic.definitions[ownerId]
  const run = definition.content.textDocument.paragraphs[0].runs[1]
  expect(run.ommlDocument.root.children[0].children[0]).toMatchObject({ type: 'rPr', attributes: expect.arrayContaining([
    { namespaceUri: '', name: 'sz', value: '2400' }, { namespaceUri: '', name: 'b', value: '1' },
  ]) })
  const context = Object.values(result.admission.textStyleContexts).find((c) => c.definitionId === ownerId)
  const layers = context.paragraphs[0].runs[1].layers
  expect(layers.entries.some((e) => e.kind === 'run')).toBe(false)
  expect(resolveProperty({ property: 'fontSizePt', scope: 'run', layers, theme: context.theme }).resolved).toBe(14)
  expect(resolveProperty({ property: 'bold', scope: 'run', layers, theme: context.theme }).resolved).toBe(false)
})

it.each([wrapped(), `<m:oMath xmlns:m="${M}"><m:r><m:t>x</m:t></m:r></m:oMath>`])(
  'keeps an exact one-equation paragraph on the standalone route', async (entry) => {
    const result = await project(await fixture(`<a:p><a:pPr/>${entry}<a:endParaRPr/></a:p>`))
    const definition = result.presentation.pptxSemantic.definitions[ownerId]
    expect(definition.kind).toBe('equation')
    expect(definition.content.ommlDocument.root.type).toBe('oMath')
    expect(definition.content.textDocument).toBeUndefined()
  }
)
it('does not swallow an empty sibling paragraph into standalone equation routing', async () => {
  const result = await project(await fixture(`<a:p>${wrapped()}</a:p><a:p/>`))
  const definition = result.presentation.pptxSemantic.definitions[ownerId]
  expect(definition.kind).not.toBe('equation')
  expect(definition.content.textDocument.paragraphs.map((p) => p.runs.length)).toEqual([1, 0])
})
it.each([
  wrapped().replace(A14, 'urn:wrong'),
  wrapped().replace(M, 'urn:wrong'),
  wrapped(`${math}${math}`),
  wrapped('<m:oMath><m:unsupported/></m:oMath>'),
  `${wrapped()}<a:pPr/>`,
  `<a:endParaRPr/>${wrapped()}`,
  '<m:oMath xmlns:m="urn:wrong"/>',
])('rejects malformed namespace, sequence or AST without partial mutation: %s', async (entry) => {
  const zip = await fixture(`<a:p>${text('before')}${entry}${text('after')}</a:p>`)
  const presentation = { id: 'deck', slides: [{ id: 'slide', elements: [] }] }, before = structuredClone(presentation)
  await expect(project(zip, presentation)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: slide } })
  expect(presentation).toEqual(before)
})
it.each(['parent', 'missing', 'duplicate', 'locator', 'wrapper-parent', 'wrapper-locator'])(
  'rejects %s math component ownership rather than inventing inventory', async (mode) => {
    const context = await admissionContext(await fixture(`<a:p>${text('before')}${wrapped()}</a:p>`))
    const root = context.components.find((c) => c.localName === (mode.startsWith('wrapper-') ? 'm' : 'oMath'))
    if (mode.endsWith('parent')) root.parentDefinitionId = context.source.id
    if (mode === 'missing') context.components = context.components.filter((c) => c.id !== root.id)
    if (mode === 'duplicate') {
      const duplicate = { ...root, id: `${root.id}:duplicate` }
      context.components.push(duplicate)
      context.nodes.set(duplicate.id, context.nodes.get(root.id))
    }
    if (mode.endsWith('locator')) root.componentLocators = [{ ...root.componentLocators[0], path: [0] }]
    expect(() => readSemanticTextAdmission(context, (_, detail) => { throw new Error(detail) }))
      .toThrow(/component|owner|locator/i)
  }
)
