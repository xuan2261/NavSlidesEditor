import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { buildFeatureFixture } from './feature-fixtures'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { readSemanticTable } = require('../../server/services/pptx-import/ooxml-semantic-table')
const {
  readSemanticEquation,
} = require('../../server/services/pptx-import/ooxml-semantic-equation')
const { readSemanticChart } = require('../../server/services/pptx-import/ooxml-semantic-chart')
const {
  readSemanticSmartArt,
} = require('../../server/services/pptx-import/ooxml-semantic-smartart')
export const fields = {
  table: 'tableDocument',
  chart: 'chartDocument',
  equation: 'ommlDocument',
  diagram: 'smartArtDocument',
}

export async function familyDocumentsFixture(change = () => {}) {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  const D = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
  zip.file(
    'ppt/diagrams/layout1.xml',
    `<d:layoutDef xmlns:d="${D}"><d:layoutNode name="root"><d:alg type="comp"/></d:layoutNode></d:layoutDef>`
  )
  zip.file(
    'ppt/slides/slide1.xml',
    (await zip.file('ppt/slides/slide1.xml').async('string')).replace(
      `${A}/table`,
      A.replace('/main', '/table')
    )
  )
  const label =
    '<d:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Label</a:t></a:r><a:br/><a:fld id="field" type="slidenum"><a:t>1</a:t></a:fld></a:p></d:t>'
  zip.file(
    'ppt/diagrams/data1.xml',
    `<d:dataModel xmlns:d="${D}" xmlns:a="${A}"><d:ptLst><d:pt modelId="0" type="doc">${label}</d:pt><d:pt modelId="1">${label}</d:pt></d:ptLst><d:cxnLst><d:cxn modelId="2" srcId="0" destId="1" srcOrd="0" destOrd="0"/></d:cxnLst></d:dataModel>`
  )
  await change(zip)
  const inventory = await buildSemanticInventory(zip)
  const xml = await zip.file('ppt/slides/slide1.xml').async('string'),
    roots = parseXml(xml)
  const nodes = new Map()
  for (const d of inventory.definitions.filter((d) => d.partUri === 'ppt/slides/slide1.xml')) {
    let n = { children: roots }
    for (const index of d.componentLocators[0].path) n = n.children[index]
    nodes.set(d.id, n)
  }
  const fixtures = {}
  for (const kind of Object.keys(fields)) {
    const source = inventory.definitions.find((d) =>
      kind === 'equation'
        ? d.localName === 'oMathPara'
        : d.kind === 'graphic-frame' &&
          d.nativeId === { table: '7', chart: '8', diagram: '9' }[kind]
    )
    const path = source.componentLocators[0].path
    const components = inventory.definitions.filter(
      (d) =>
        d.id !== source.id &&
        d.partUri === source.partUri &&
        path.every((n, i) => d.componentLocators[0].path[i] === n)
    )
    const context = { zip, inventory, source, xml, nodes, node: nodes.get(source.id), components }
    let result
    if (kind === 'table') result = readSemanticTable(context)
    if (kind === 'equation') result = readSemanticEquation(context)
    if (kind === 'diagram') result = await readSemanticSmartArt(context)
    if (kind === 'chart') {
      const chart = await readSemanticChart(context)
      result = {
        chartDocument: chart.document,
        components: chart.componentDefinitionIds.map((id) => {
          const d = inventory.definitions.find((d) => d.id === id)
          return {
            id,
            partUri: d.partUri,
            kind: {
              'chart-series': 'series',
              'chart-data-point': 'point',
              'chart-workbook-reference': 'property',
              'text-run': 'run',
              paragraph: 'paragraph',
            }[d.kind],
            locator: d.componentLocators[0],
          }
        }),
      }
    }
    const owner =
      kind === 'equation'
        ? inventory.definitions.find(
            (entry) =>
              entry.kind === 'shape' &&
              entry.partUri === source.partUri &&
              entry.componentLocators[0].path.length < path.length &&
              entry.componentLocators[0].path.every((index, i) => path[i] === index)
          )
        : source
    const definition = {
      id: owner.id,
      kind,
      source: {
        partUri: owner.partUri,
        preconditionHash: owner.preconditionHash,
        componentLocator: owner.componentLocators[0],
        ...(owner.nativeId === null ? {} : { nativeId: owner.nativeId }),
      },
      content: { [fields[kind]]: result[fields[kind]] },
      components: result.components,
    }
    fixtures[kind] = {
      schemaVersion: 1,
      definitions: { [definition.id]: definition },
      styles: {},
      fonts: {},
      instances: {
        occurrence: {
          id: 'occurrence',
          definitionId: definition.id,
          slideId: 's1',
          parentInstanceId: null,
          localTransform: [1, 0, 0, 1, 0, 0],
          paintIndex: 0,
          overrides: {},
        },
      },
    }
  }
  return fixtures
}
