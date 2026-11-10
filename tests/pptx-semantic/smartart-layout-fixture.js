import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const JSZip = require('jszip')
const {
  smartArtSource,
} = require('../../server/services/pptx-import/ooxml-semantic-smartart-source')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const {
  readSmartArtLayout,
} = require('../../server/services/pptx-import/ooxml-semantic-smartart-layout')
const { normalizeSmartArtDocument } = require('../../shared/src/pptx-smartart-document')
const D = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
export const partUri = 'ppt/diagrams/layout.xml'

export async function fixture({
  count = 3,
  algorithm = 'lin',
  direction = 'fromL',
  change = (x) => x,
} = {}) {
  const xml = change(`<d:layoutDef xmlns:d="${D}" uniqueId="authored-layout">
    <d:layoutNode name="root"><d:alg type="${algorithm}">${algorithm === 'lin' ? `<d:param type="linDir" val="${direction}"/><d:param type="${['fromL', 'fromR'].includes(direction) ? 'vertAlign' : 'horzAlign'}" val="${['fromL', 'fromR'].includes(direction) ? 't' : 'l'}"/>` : ''}</d:alg>
      <d:constrLst>
        <d:constr type="w" for="ch" forName="item" refType="w" fact="0.2"/>
        <d:constr type="h" for="ch" forName="item" refType="h" fact="0.5"/>
        <d:constr type="sp" val="10"/>
      </d:constrLst>
      <d:forEach axis="des" ptType="node"><d:layoutNode name="item" styleLbl="node1">
        <d:presOf axis="self"/><d:alg type="comp"/><d:shape type="rect"/>
      </d:layoutNode></d:forEach>
    </d:layoutNode></d:layoutDef>`)
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>'
  )
  zip.file(
    'ppt/presentation.xml',
    '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>'
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="layout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramLayout" Target="diagrams/layout.xml"/></Relationships>'
  )
  zip.file(partUri, xml)
  const inventory = await buildSemanticInventory(zip)
  const source = smartArtSource({ zip, inventory, source: { id: 'frame' } })
  const part = await source.load(partUri)
  const layout = readSmartArtLayout(part)
  const document = normalizeSmartArtDocument({
    schemaVersion: 1,
    componentId: 'data',
    points: Array.from({ length: count + 1 }, (_, i) => ({
      componentId: `p${i}`,
      modelId: String(i),
      type: i ? 'node' : 'doc',
      properties: [],
    })),
    connections: Array.from({ length: count }, (_, i) => ({
      componentId: `c${i}`,
      modelId: String(count + 1 + i),
      type: 'parOf',
      sourceId: String(i),
      destinationId: String(i + 1),
      sourceOrder: 0,
      destinationOrder: 0,
    })),
    relationships: ['data', 'layout', 'style', 'colors'].map((role) => ({
      role,
      relationshipId: role,
      relationshipType: `http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagram${{ data: 'Data', layout: 'Layout', style: 'QuickStyle', colors: 'Colors' }[role]}`,
      partUri: `ppt/diagrams/${role}.xml`,
      preconditionHash: role === 'layout' ? part.hash : 'a'.repeat(64),
    })),
    layout,
  })
  return { document, inventory, source, xml }
}
