import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { buildFeatureFixture } from './feature-fixtures'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
export const D = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
export const slidePart = 'ppt/slides/slide1.xml'

export async function familyFixture(nativeId = '8', mutate = async () => {}) {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  // A diagnostic supported graph/layout, not a replacement corpus or visual oracle.
  zip.file(
    'ppt/diagrams/data1.xml',
    `<d:dataModel xmlns:d="${D}"><d:ptLst><d:pt modelId="1" type="doc"/><d:pt modelId="2" type="node"/></d:ptLst><d:cxnLst><d:cxn modelId="3" type="parOf" srcId="1" destId="2" srcOrd="0" destOrd="0"/></d:cxnLst></d:dataModel>`
  )
  zip.file(
    'ppt/diagrams/layout1.xml',
    `<d:layoutDef xmlns:d="${D}"><d:layoutNode name="root"><d:alg type="comp"/></d:layoutNode></d:layoutDef>`
  )
  zip.file('ppt/diagrams/quickStyle1.xml', `<d:styleDef xmlns:d="${D}"/>`)
  zip.file('ppt/diagrams/colors1.xml', `<d:colorsDef xmlns:d="${D}"/>`)
  await mutate(zip)
  const inventory = await buildSemanticInventory(zip)
  const source = inventory.definitions.find(
    (d) => d.partUri === slidePart && d.nativeId === nativeId
  )
  const nodes = new Map()
  for (const part of inventory.parts.filter((p) => /\.(xml|rels)$/.test(p.partUri))) {
    const roots = parseXml(await zip.file(part.partUri).async('string'))
    for (const item of inventory.definitions.filter((d) => d.partUri === part.partUri)) {
      let node = { children: roots }
      for (const index of item.componentLocators[0].path) node = node.children[index]
      nodes.set(item.id, node)
    }
  }
  const path = source.componentLocators[0].path
  const components = inventory.definitions.filter(
    (d) =>
      d.id !== source.id &&
      d.partUri === source.partUri &&
      d.componentLocators[0].path.length > path.length &&
      path.every((n, i) => d.componentLocators[0].path[i] === n)
  )
  return {
    zip,
    inventory,
    source,
    nodes,
    node: nodes.get(source.id),
    components,
    xml: await zip.file(source.partUri).async('string'),
  }
}
