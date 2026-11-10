import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fieldFixture, fieldPresentation } from './field-fixtures'
import { stableZip } from './feature-fixtures'
import { normalizePptxSemanticDocument } from '../../shared/src/pptx-semantic-document'
const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const part = 'ppt/presProps.xml'
const extension = '<p:extLst><p:ext uri="{D31A062A-798A-4329-ABDD-BBA856620510}"><x:defaultImageDpi xmlns:x="http://schemas.microsoft.com/office/powerpoint/2010/main" val="220"/></p:ext></p:extLst>'
const root = (children) => `<p:presentationPr xmlns:p="${P}" xmlns:a="${A}">${children}</p:presentationPr>`
const palette = (colors) => `<p:clrMru>${colors}</p:clrMru>`
async function project(children) {
  const zip = fieldFixture(), rels = 'ppt/_rels/presentation.xml.rels'
  zip.file(rels, (await zip.file(rels).async('string')).replace('</Relationships>',
    `<Relationship Id="properties" Type="${R}/presProps" Target="presProps.xml"/></Relationships>`))
  zip.file(part, root(children))
  const before = await stableZip(zip)
  const result = await projectSemanticImport({ zip, presentation: fieldPresentation() })
  expect(await stableZip(zip)).toEqual(before)
  return result.presentation
}
const owner = (deck) => Object.values(deck.pptxSemantic.definitions).find((d) => d.kind === 'presentation-properties')

it('preserves authored MRU color and exact shifted extension parents through JSON reopen', async () => {
  const deck = await project(palette('<a:srgbClr val="F92552"/>') + extension)
  const definition = owner(deck), hash = definition.source.preconditionHash
  expect(definition.content.colorMru).toEqual({ componentId: `${part}#color-mru:0.0`, colors: [{
    source: { partUri: part, preconditionHash: hash,
      componentLocator: { path: [0, 0, 0], preconditionHash: hash } },
    value: { kind: 'srgb', value: 'F92552' },
  }] })
  expect(definition.components.find((c) => c.id === `${part}#color-mru:0.0`)).toEqual({
    id: `${part}#color-mru:0.0`, kind: 'property', locator: { path: [0, 0], preconditionHash: hash },
  })
  expect(definition.content.presentationProperties.defaultImageDpi).toMatchObject({
    value: 220, componentId: `${part}#unknown-extension:0.1.0.0`,
    wrapperLocator: { path: [0, 1, 0], preconditionHash: hash },
  })
  const reopened = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(deck.pptxSemantic)))
  expect(reopened.definitions[definition.id]).toEqual(definition)
  expect(Object.isFrozen(reopened.definitions[definition.id].content.colorMru.colors)).toBe(true)
})

it('retains all DrawingML color choices and ordered source-bound transforms without resolving palette paint', async () => {
  const deck = await project(palette('<a:srgbClr val="102030"><a:alpha val="50000"/><a:inv/></a:srgbClr>' +
    '<a:scrgbClr r="100000" g="-100" b="0"/><a:hslClr hue="1200000" sat="75000" lum="50000"/>' +
    '<a:prstClr val="red"/><a:schemeClr val="accent1"/><a:sysClr val="windowText" lastClr="000000"/>'))
  const colors = owner(deck).content.colorMru.colors
  expect(colors.map((c) => c.value.kind)).toEqual(['srgb', 'scrgb', 'hsl', 'preset', 'scheme', 'system'])
  expect(colors[0].value.transforms.map((t) => t.value)).toEqual([{ kind: 'alpha', value: 50000 }, { kind: 'inv' }])
  expect(colors[0].value.transforms.map((t) => t.source.componentLocator.path)).toEqual([[0, 0, 0, 0], [0, 0, 0, 1]])
  expect(colors[1].value.value).toEqual({ r: 100000, g: -100, b: 0 })
  expect(colors[5].value).toEqual({ kind: 'system', value: 'windowText', lastColor: '000000' })
})

it.each([0, 10, 11])('retains %i ordered MRU entries without synthesizing a setting', async (count) => {
  const definition = owner(await project(palette(Array.from({ length: count }, (_, index) =>
    `<a:srgbClr val="${index.toString(16).padStart(6, '0')}"/>`).join(''))))
  expect(definition.content.presentationProperties).toEqual({})
  expect(definition.content.colorMru.colors.map((entry) => entry.value.value)).toEqual(
    Array.from({ length: count }, (_, index) => index.toString(16).padStart(6, '0')))
})

it.each([
  extension + palette('<a:srgbClr val="F92552"/>'), '<p:clrMru/><p:clrMru/>',
  '<p:clrMru extra="lost"/>', palette('<p:srgbClr val="F92552"/>'),
  palette('<a:srgbClr val="not-rgb"/>'), palette('<a:sysClr val="windowText"/>'),
  palette('<a:srgbClr val="F92552" unexpected="1"/>'),
  palette('<a:srgbClr val="F92552"><a:alpha val="100001"/></a:srgbClr>'),
  palette('<a:srgbClr val="F92552"><a:inv val="1"/></a:srgbClr>'),
  palette('<a:srgbClr val="F92552">lost</a:srgbClr>'), palette('lost'),
  '<p:clrMru/><p:showPr/>', '<p:clrMru/>' + extension + extension,
])('rejects malformed, foreign or misordered palette declarations: %s', async (xml) => {
  await expect(project(xml)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
})

it.each(['palette-parent', 'color-parent', 'transform-parent', 'hash', 'component', 'extension-parent', 'extra'])(
  'rejects forged palette source binding after JSON reopen: %s', async (fault) => {
  const original = await project(palette('<a:srgbClr val="F92552"><a:alpha val="50000"/></a:srgbClr>') + extension)
  const forged = structuredClone(original), definition = owner(forged), mru = definition.content.colorMru
  if (fault === 'palette-parent') definition.components.find((c) => c.id === mru.componentId).locator.path = [0, 1]
  if (fault === 'color-parent') mru.colors[0].source.componentLocator.path = [0, 0]
  if (fault === 'transform-parent') mru.colors[0].value.transforms[0].source.componentLocator.path = [0, 0, 0]
  if (fault === 'hash') mru.colors[0].source.preconditionHash = '0'.repeat(64)
  if (fault === 'component') mru.componentId += '-forged'
  if (fault === 'extension-parent') definition.content.presentationProperties.defaultImageDpi.wrapperLocator.path = [0, 0, 0]
  if (fault === 'extra') mru.colors[0].value.surprise = true
  expect(() => normalizePptxSemanticDocument(forged.pptxSemantic)).toThrow()
  expect(() => assertSemanticBaseline(original, forged)).toThrow()
})

it('keeps duplicate colors as distinct source occurrences and forbids source metadata on project groups', async () => {
  const deck = await project(palette('<a:srgbClr val="F92552"/><a:srgbClr val="F92552"/>'))
  const definition = owner(deck)
  expect(definition.content.colorMru.colors.map((entry) => entry.source.componentLocator.path)).toEqual(
    [[0, 0, 0], [0, 0, 1]])
  const local = structuredClone(deck.pptxSemantic)
  local.definitions.localGroup = { id: 'localGroup', origin: 'project', kind: 'group', source: null,
    components: [], content: {} }
  expect(normalizePptxSemanticDocument(local).definitions.localGroup.content).toEqual({})
  local.definitions.localGroup.content.colorMru = structuredClone(definition.content.colorMru)
  expect(() => normalizePptxSemanticDocument(local)).toThrow(/source definitions/i)
  const forged = structuredClone(deck)
  owner(forged).content.colorMru.colors[0].value.value = 'FFFFFF'
  expect(normalizePptxSemanticDocument(forged.pptxSemantic).definitions[definition.id]
    .content.colorMru.colors[0].value.value).toBe('FFFFFF')
  expect(() => assertSemanticBaseline(deck, forged)).toThrow()
})
