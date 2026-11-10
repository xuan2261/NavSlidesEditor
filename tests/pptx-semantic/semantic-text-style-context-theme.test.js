import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const {
  readSemanticTextStyleContext,
  buildSemanticTextStyleContexts,
} = require('../../server/services/pptx-import/ooxml-semantic-text-context')
const { resolveProperty } = require('../../shared/src/pptx-style-resolution')
async function context(zip, definition = `${slide}#shape:2`) {
  const inventory = await buildSemanticInventory(zip)
  const occurrenceId = inventory.occurrences.find((o) => o.definitionId === definition).id
  return readSemanticTextStyleContext({ zip, inventory, occurrenceId })
}
const resolve = (c, property, scope = 'run') =>
  resolveProperty({ property, scope, layers: c.paragraphs[0][scope], theme: c.theme })
it('preserves symbolic font refs and scheme colors with ordered transforms and host color maps', async () => {
  const zip = await fixture()
  zip.file(
    layout,
    (await zip.file(layout).async('string')).replace('<a:latin typeface="+mn-lt"/>', '')
  )
  zip.file(
    master,
    (await zip.file(master).async('string')).replace(
      '<a:solidFill><a:schemeClr val="tx1"><a:tint val="75000"/></a:schemeClr></a:solidFill>',
      ''
    )
  )
  zip.file(
    slide,
    (await zip.file(slide).async('string'))
      .replace(
        '<p:spPr/>',
        '<p:spPr/><p:style><a:fontRef idx="major"><a:schemeClr val="tx1"><a:tint val="75000"/></a:schemeClr></a:fontRef></p:style>'
      )
      .replace('</p:sld>', '<p:clrMapOvr><a:overrideClrMapping tx1="lt1"/></p:clrMapOvr></p:sld>')
  )
  const c = await context(zip)
  expect(resolve(c, 'fontLatin').authored).toEqual({ typeface: '+mj-lt' })
  expect(resolve(c, 'fontLatin').resolved).toBe('Major')
  expect(resolve(c, 'color').authored).toEqual({
    kind: 'scheme',
    value: 'tx1',
    transforms: [{ kind: 'tint', value: 75000 }],
  })
  expect(c.theme.colorMap).toEqual({ tx1: 'lt1' })
})
it('masterClrMapping on a slide bypasses a layout override', async () => {
  const zip = await fixture()
  zip.file(
    slide,
    (await zip.file(slide).async('string')).replace(
      '</p:sld>',
      '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
    )
  )
  zip.file(
    layout,
    (await zip.file(layout).async('string')).replace(
      '</p:sldLayout>',
      '<p:clrMapOvr><a:overrideClrMapping tx1="lt1"/></p:clrMapOvr></p:sldLayout>'
    )
  )
  expect((await context(zip)).theme.colorMap.tx1).toBe('dk1')
})
it('binds layout-owned text to its host without self-inheritance', async () => {
  const c = await context(await fixture(), `${layout}#shape:8`)
  expect(c.bindings.layoutDefinitionId).toBe(null)
  expect(c.bindings.masterDefinitionId).toBe(`${master}#shape:4`)
  expect(resolve(c, 'fontSizePt').resolved).toBe(18)
})
it('returns only explicit selected contexts and rejects duplicate selection atomically', async () => {
  const zip = await fixture(),
    inventory = await buildSemanticInventory(zip)
  const occurrenceId = inventory.occurrences.find((o) => o.definitionId === `${slide}#shape:2`).id
  expect(
    await buildSemanticTextStyleContexts({ zip, inventory, occurrenceIds: [occurrenceId] })
  ).toHaveLength(1)
  await expect(
    buildSemanticTextStyleContexts({ zip, inventory, occurrenceIds: [occurrenceId, occurrenceId] })
  ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
})
it.each([
  '<a:p><a:pPr/></a:p>',
  '<a:p><a:pPr lvl="0"/></a:p>',
  '<a:p><a:pPr><a:defRPr b="1" i="1" sz="3200"/></a:pPr></a:p>',
])('rejects ambiguous inherited paragraphs without choosing by order or property count: %s', async (paragraph) => {
  const zip = await fixture()
  zip.file(
    layout,
    (await zip.file(layout).async('string')).replace(
      '</p:txBody>',
      `${paragraph}</p:txBody>`
    )
  )
  await expect(context(zip)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
})
it('selects inherited paragraph declarations by level rather than paragraph index', async () => {
  const zip = await fixture()
  zip.file(
    layout,
    (await zip.file(layout).async('string')).replace(
      '<a:p><a:pPr/>',
      '<a:p><a:pPr lvl="1"><a:defRPr sz="2400"/></a:pPr></a:p><a:p><a:pPr/>'
    )
  )
  expect(resolve(await context(zip), 'fontSizePt').resolved).toBe(18)
  zip.file(
    slide,
    (await zip.file(slide).async('string')).replace('<a:pPr/>', '<a:pPr lvl="1"/>')
  )
  expect(resolve(await context(zip), 'fontSizePt').resolved).toBe(24)
})
it('keeps two host occurrences of one master source independently bound', async () => {
  const zip = await fixture()
  zip.file(
    'ppt/presentation.xml',
    (await zip.file('ppt/presentation.xml').async('string')).replace(
      '</p:sldIdLst>',
      '<p:sldId id="257" r:id="secondSlide"/></p:sldIdLst>'
    )
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    (await zip.file('ppt/_rels/presentation.xml.rels').async('string')).replace(
      '</Relationships>',
      '<Relationship Id="secondSlide" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/></Relationships>'
    )
  )
  zip.file(
    'ppt/slides/slide3.xml',
    (await zip.file(slide).async('string')).replace(
      '</p:sld>',
      '<p:clrMapOvr><a:overrideClrMapping tx1="lt1"/></p:clrMapOvr></p:sld>'
    )
  )
  zip.file(
    'ppt/slides/_rels/slide3.xml.rels',
    await zip.file('ppt/slides/_rels/slide9.xml.rels').async('string')
  )
  const inventory = await buildSemanticInventory(zip)
  const ids = inventory.occurrences
    .filter((o) => o.definitionId === `${master}#shape:4`)
    .map((o) => o.id)
  const contexts = await buildSemanticTextStyleContexts({ zip, inventory, occurrenceIds: ids })
  expect(contexts).toHaveLength(2)
  expect(contexts.map((c) => c.theme.colorMap.tx1)).toEqual(['dk1', 'lt1'])
  expect(contexts[0].definitionId).toBe(contexts[1].definitionId)
  expect(contexts[0].occurrenceId).not.toBe(contexts[1].occurrenceId)
  expect(contexts.map((c) => resolve(c, 'color').authored)).toEqual([
    { kind: 'scheme', value: 'tx1', transforms: [{ kind: 'tint', value: 75000 }] },
    { kind: 'scheme', value: 'tx1', transforms: [{ kind: 'tint', value: 75000 }] },
  ])
})
it('uses the matched layout default type rather than the slide type for master text styles', async () => {
  const zip = await fixture()
  zip.file(slide, (await zip.file(slide).async('string')).replace('type="obj"', 'type="title"'))
  zip.file(layout, (await zip.file(layout).async('string')).replace('type="body" ', ''))
  expect(resolve(await context(zip), 'italic').resolved).toBe(false)
})
it('rejects an unknown placeholder type at its source location', async () => {
  const zip = await fixture()
  zip.file(slide, (await zip.file(slide).async('string')).replace('type="obj"', 'type="unknown"'))
  await expect(context(zip)).rejects.toMatchObject({
    code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    sourceLocation: { partUri: slide },
  })
})
