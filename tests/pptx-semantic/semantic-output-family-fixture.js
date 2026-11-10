import { createRequire } from 'node:module'
import { familyDocumentsFixture } from './family-documents-fixture'
const require = createRequire(import.meta.url)
const { projectOmmlShape } = require('../../server/services/pptx-import/semantic-omml-adapter')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')

// Explicit synthetic source declarations exercise dispatch, not native calibration.
export async function sourceOutputFamilies() {
  const D = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
  const defaults =
    '<a:pPr><a:defRPr sz="1200" b="0" i="0"><a:solidFill><a:srgbClr val="123456"/></a:solidFill><a:latin typeface="KaTeX_Main"/></a:defRPr></a:pPr>'
  let mathContext
  const fixtures = await familyDocumentsFixture(async (zip) => {
    const slide = 'ppt/slides/slide1.xml'
    zip.file(
      slide,
      (await zip.file(slide).async('string'))
        .replace(
          /<m:oMathPara>[\s\S]*?<\/m:oMathPara>/,
          '<m:oMathPara><m:oMath><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>Output math</m:t></m:r></m:oMath></m:oMathPara>'
        )
        .replace(/<a:p><a14:m/g, `<a:p>${defaults}<a14:m`)
    )
    const chart = 'ppt/charts/chart1.xml'
    zip.file(
      chart,
      (await zip.file(chart).async('string'))
        .replace(/c:barChart/g, 'c:pieChart')
        .replace(
          /<c:barDir[^>]*\/>|<c:grouping[^>]*\/>|<c:axId[^>]*\/>|<c:catAx>[\s\S]*?<\/c:catAx>|<c:valAx>[\s\S]*?<\/c:valAx>/g,
          ''
        )
        .replace(
          '</c:ser>',
          '<c:spPr><a:solidFill><a:srgbClr val="123456"/></a:solidFill></c:spPr></c:ser>'
        )
        .replace(
          '</c:chartSpace>',
          `<c:txPr><a:bodyPr/><a:lstStyle/><a:p>${defaults}</a:p></c:txPr></c:chartSpace>`
        )
    )
    zip.file(
      'ppt/diagrams/layout1.xml',
      `<d:layoutDef xmlns:d="${D}"><d:layoutNode name="root"><d:alg type="lin"><d:param type="linDir" val="fromL"/><d:param type="vertAlign" val="t"/></d:alg><d:constrLst><d:constr type="w" for="ch" refType="w" fact="0.8"/><d:constr type="h" for="ch" refType="h" fact="0.8"/></d:constrLst><d:forEach axis="ch" ptType="node"><d:layoutNode name="item" styleLbl="node0"><d:presOf axis="self"/><d:alg type="comp"/><d:shape type="rect"/></d:layoutNode></d:forEach></d:layoutNode></d:layoutDef>`
    )
    const data = 'ppt/diagrams/data1.xml'
    zip.file(
      data,
      (await zip.file(data).async('string'))
        .replace(/<a:p>/g, `<a:p>${defaults}`)
        .replace(
          /<a:bodyPr\/>/g,
          '<a:bodyPr wrap="none" anchor="t" vert="horz" lIns="0" rIns="0" tIns="0" bIns="0"><a:noAutofit/></a:bodyPr>'
        )
    )
    const inventory = await buildSemanticInventory(zip)
    const source = inventory.definitions.find((d) => d.localName === 'oMathPara')
    const owner = inventory.definitions.find(
      (d) =>
        d.kind === 'shape' &&
        d.partUri === source.partUri &&
        d.componentLocators[0].path.length < source.componentLocators[0].path.length &&
        d.componentLocators[0].path.every((n, i) => n === source.componentLocators[0].path[i])
    )
    const xml = await zip.file(slide).async('string'),
      roots = parseXml(xml),
      nodes = new Map()
    for (const entry of inventory.definitions.filter((d) => d.partUri === slide)) {
      let node = { children: roots }
      for (const index of entry.componentLocators[0].path) node = node.children[index]
      nodes.set(entry.id, node)
    }
    mathContext = {
      zip,
      inventory,
      source: owner,
      xml,
      nodes,
      node: nodes.get(owner.id),
      components: inventory.definitions.filter(
        (d) =>
          d.id !== owner.id &&
          d.partUri === slide &&
          d.componentLocators[0].path.length > owner.componentLocators[0].path.length &&
          owner.componentLocators[0].path.every((n, i) => n === d.componentLocators[0].path[i])
      ),
    }
  })
  const projectedMath = await projectOmmlShape(mathContext)
  Object.values(fixtures.equation.definitions)[0].content = projectedMath.content
  Object.values(fixtures.equation.definitions)[0].components = projectedMath.components
  for (const semantic of Object.values(fixtures))
    Object.values(semantic.definitions)[0].content.extent = { cx: 2743200, cy: 1828800 }
  return fixtures
}
