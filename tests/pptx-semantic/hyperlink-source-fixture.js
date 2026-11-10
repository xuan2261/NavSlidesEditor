import { createRequire } from 'node:module'
import { fieldFixture, fieldPart, fieldPresentation } from './field-fixtures.js'
import { tableFrame } from './table-import-fixture.js'
const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { parseXml, descendants } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { relationshipPart } = require('../../server/services/pptx-import/slide-order')
const { sourceNamespace } = require('../../server/services/pptx-import/semantic-source-slides')
export const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
export const linkDeclarations = '<a:hlinkClick r:id="website" tooltip="Source &amp; docs" history="0" highlightClick="0" endSnd="0"/><a:hlinkMouseOver r:id="jump" action="ppaction://hlinksldjump"/>'
export const linkRun = (links = linkDeclarations) => `<a:r><a:rPr sz="1800">${links}</a:rPr><a:t>Linked source</a:t></a:r>`

export async function hyperlinkFixture({ links = linkDeclarations, table = false,
  url = 'https://example.test/source?x=1&amp;y=2', relationType = 'hyperlink', external = true } = {}) {
  const zip = fieldFixture(linkRun(links))
  if (table) zip.file(fieldPart, (await zip.file(fieldPart).async('string'))
    .replace(/<p:sp>[\s\S]*?<\/p:sp>/, tableFrame().replace('<a:rPr sz="1200"/>',
      `<a:rPr sz="1200">${links}</a:rPr>`)))
  const part = relationshipPart(fieldPart)
  zip.file(part, (await zip.file(part).async('string')).replace('</Relationships>',
    `<Relationship Id="website" Type="${R}/${relationType}" Target="${url}"${external ? ' TargetMode="External"' : ''}/><Relationship Id="jump" Type="${R}/slide" Target="../slides/slide3.xml"/></Relationships>`))
  return zip
}
export async function projectHyperlinks(options) {
  const zip = await hyperlinkFixture(options)
  const original = await zip.file(fieldPart).async('string')
  const result = await projectSemanticImport({ zip, presentation: fieldPresentation() })
  return { ...result, zip, original }
}
export async function hyperlinkContext(zip, sourcePart = fieldPart) {
  const inventory = await buildSemanticInventory(zip)
  const all = inventory.definitions.filter((d) => d.partUri === sourcePart)
  const link = all.find((d) => d.kind === 'hyperlink')
  const byId = new Map(inventory.definitions.map((d) => [d.id, d]))
  let source = link
  while (source.nativeId === null) source = byId.get(source.parentDefinitionId)
  const xml = await zip.file(sourcePart).async('string'), roots = parseXml(xml), nodes = new Map()
  for (const d of all) {
    let node = { children: roots }
    for (const index of d.componentLocators[0].path) node = node.children[index]
    nodes.set(d.id, node)
  }
  const components = all.filter((d) => {
    let parent = byId.get(d.parentDefinitionId)
    while (parent && parent.nativeId === null) parent = byId.get(parent.parentDefinitionId)
    return parent?.id === source.id
  })
  const relXml = await zip.file(relationshipPart(sourcePart)).async('string')
  const relations = descendants({ children: parseXml(relXml) }, (n) => n.local === 'Relationship')
  return { link, inventory, context: { source, xml, node: nodes.get(source.id), nodes, components,
    relationships: () => relations,
    sourceId: sourceNamespace(inventory), slideParts: new Set(inventory.slides.map((s) => s.partUri)),
  } }
}
