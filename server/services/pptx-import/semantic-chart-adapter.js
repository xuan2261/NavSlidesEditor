const { readGraphicFrame, finishFrame } = require('./semantic-frame-adapter')
const { readSemanticChart } = require('./ooxml-semantic-chart')
const C = new Set([
  'http://schemas.openxmlformats.org/drawingml/2006/chart',
  'http://purl.oclc.org/ooxml/drawingml/chart',
])

async function projectChartFrame(context) {
  const s = readGraphicFrame(context)
  if (!C.has(s.attrs(s.payload, ['uri']).uri)) s.fail(s.payload, 'wrong chart payload URI')
  s.children(s.payload, [[C, 'chart']])
  const result = await readSemanticChart(context)
  const kinds = {
    'chart-series': 'series',
    'chart-data-point': 'point',
    'chart-workbook-reference': 'property',
    'text-run': 'run',
    paragraph: 'paragraph',
  }
  const components = result.componentDefinitionIds.map((id) => {
    const matches = context.inventory.definitions.filter((d) => d.id === id)
    const d = matches[0]
    if (matches.length !== 1 || !kinds[d.kind] || d.componentLocators.length !== 1)
      s.fail(s.payload, 'wrong chart component kind or identity')
    return { id, kind: kinds[d.kind], partUri: d.partUri, locator: d.componentLocators[0] }
  })
  return {
    kind: 'chart',
    content: {
      chartDocument: result.document,
      frameProperties: s.frameProperties,
      extent: s.extent,
    },
    components: [...components, ...s.metadata],
    extent: s.extent,
    sourceTransform: s.sourceTransform,
    localTransform: s.localTransform,
    compatibility: { type: 'chart' },
    mappedDefinitionIds: finishFrame(s, result.componentDefinitionIds),
  }
}
module.exports = { projectChartFrame }
