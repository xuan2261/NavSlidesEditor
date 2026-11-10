import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { readFile } from 'node:fs/promises'
import { buildFeatureFixture } from './feature-fixtures.js'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { readSemanticChart } = require('../../server/services/pptx-import/ooxml-semantic-chart')
const { applyChartOperation } = require('../../shared/src/pptx-chart-operations')
const { normalizeChartDocument } = require('../../shared/src/pptx-chart-document')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const paint = '<c:spPr><a:solidFill><a:srgbClr val="C0504D"/></a:solidFill><a:ln w="25400" cap="flat"><a:solidFill><a:srgbClr val="123456"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/></c:spPr>'
const textStyle = '<a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="0" i="0" u="none" strike="noStrike"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr></a:p>'
async function sourceDocument(extra = '', mutate = x => x) {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  const xml = `<c:chartSpace xmlns:c="${C}" xmlns:a="${A}"><c:chart><c:plotArea><c:pieChart>
    <c:ser><c:idx val="7"/><c:order val="2"/><c:tx><c:v>Sales</c:v></c:tx>${paint}
    <c:dPt><c:idx val="2"/><c:spPr><a:solidFill><a:srgbClr val="00CC99"/></a:solidFill></c:spPr></c:dPt>
    <c:cat><c:strLit><c:ptCount val="3"/><c:pt idx="2"><c:v>Third</c:v></c:pt></c:strLit></c:cat>
    <c:val><c:numRef><c:f>Data!$B$2:$B$4</c:f><c:numCache><c:ptCount val="3"/><c:pt idx="2"><c:v>11</c:v></c:pt></c:numCache></c:numRef></c:val>
    <c:dLbls><c:txPr>${textStyle}</c:txPr><c:numFmt formatCode="0.0" sourceLinked="0"/><c:showVal val="1"/><c:showCatName val="1"/><c:separator> / </c:separator></c:dLbls>
    </c:ser></c:pieChart></c:plotArea></c:chart>${extra}</c:chartSpace>`
  zip.file('ppt/charts/chart1.xml', mutate(xml))
  const inventory = await buildSemanticInventory(zip)
  const source = inventory.definitions.find(d => d.kind === 'graphic-frame' && d.nativeId === '8')
  return (await readSemanticChart({ zip, inventory, source })).document
}
describe('source chart paint and label completion', () => {
  it('admits the actual pie/scatter corpus source with source text, markers and point colors', async () => {
    const zip = await JSZip.loadAsync(await readFile('server/data/test-corpus/chart-pie-scatter.pptx'))
    const inventory = await buildSemanticInventory(zip)
    const charts = []
    for (const source of inventory.definitions.filter(d => d.kind === 'graphic-frame'))
      charts.push((await readSemanticChart({ zip, inventory, source })).document)
    const pie = charts.find(d => d.plots[0].family === 'pieChart')
    const scatter = charts.find(d => d.plots[0].family === 'scatterChart')
    expect(pie.plots[0].series[0].pointStyles.map(p => p.index)).toEqual([0, 1, 2, 3])
    expect(pie.plots[0].series[0].pointStyles[0].paint.fill.color).toBe('5DA5DA')
    expect(pie.title).toMatchObject({ kind: 'text', value: 'Pie chart', textStyle: { fontFamily: 'Arial', fontSizePt: 18 } })
    expect(scatter.plots[0].series[0].marker).toEqual({ symbol: 'circle', size: 6 })
    expect(scatter.plots[0].series[0].markerPaint.fill.color).toBe('C0504D')
    expect(scatter.axes[0].textStyle).toMatchObject({ fontFamily: 'Arial', fontSizePt: 12 })
    expect(scatter.plots[0].series[0].data.xVal.kind).toBe('numRef')
    expect(scatter.workbook.fetchPolicy).toBe('deny')
    expect(pie.visualSources.every(s => inventory.definitions.some(d => d.id === s.definitionId))).toBe(true)
  })
  it('keeps the actual bar/line corpus unresolved axis fail-closed after consuming source styles', async () => {
    const zip = await JSZip.loadAsync(await readFile('server/data/test-corpus/chart-bars-lines.pptx'))
    const inventory = await buildSemanticInventory(zip)
    for (const source of inventory.definitions.filter(d => d.kind === 'graphic-frame'))
      await expect(readSemanticChart({ zip, inventory, source })).rejects.toThrow(/plot axisIds/)
  })
  it('admits exact inventoried rich chart visual components through the central canonical boundary', async () => {
    const zip = await JSZip.loadAsync(await readFile('server/data/test-corpus/chart-pie-scatter.pptx'))
    const inventory = await buildSemanticInventory(zip)
    const source = inventory.definitions.find(d => d.kind === 'graphic-frame')
    const result = await readSemanticChart({ zip, inventory, source })
    const definition = { id: source.id, kind: 'chart',
      source: { partUri: source.partUri, preconditionHash: source.preconditionHash,
        componentLocator: source.componentLocators[0], nativeId: source.nativeId },
      content: { chartDocument: result.document },
      components: result.componentDefinitionIds.map(id => {
        const d = inventory.definitions.find(d => d.id === id)
        return { id, partUri: d.partUri, locator: d.componentLocators[0], kind: {
          'chart-series': 'series', 'chart-data-point': 'point', 'chart-workbook-reference': 'property',
          paragraph: 'paragraph', 'text-run': 'run',
        }[d.kind] }
      }),
    }
    const model = { schemaVersion: 1, definitions: { [definition.id]: definition }, styles: {}, fonts: {},
      instances: { occurrence: { id: 'occurrence', definitionId: definition.id, slideId: 's1',
        parentInstanceId: null, localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} } } }
    const normalized = normalizePptxSemanticDocument(model)
    expect(normalized.definitions[definition.id].content.chartDocument.visualSources).toEqual(result.document.visualSources)
  })
  it('retains explicit source paint, line units and sparse point overrides', async () => {
    const d = await sourceDocument()
    const series = d.plots[0].series[0]
    expect(series.paint).toEqual({ fill: { kind: 'solid', color: 'C0504D' },
      line: { fill: { kind: 'solid', color: '123456' }, widthEmu: 25400, cap: 'flat', dash: 'solid', join: 'round' } })
    expect(series.pointStyles).toEqual([{ index: 2, options: {}, paint: { fill: { kind: 'solid', color: '00CC99' } } }])
    expect(series.dataLabels.textStyle).toEqual({ fontFamily: 'Arial', fontSizePt: 12, bold: false, italic: false, color: '000000' })
    expect(series.dataLabels.numberFormat).toEqual({ formatCode: '0.0', sourceLinked: false })
    expect(normalizeChartDocument(JSON.parse(JSON.stringify(d)))).toEqual(d)
    const local = applyChartOperation(d, { type: 'chart.data.convert-local', seriesId: series.id, channel: 'val', basis: 'cache-snapshot' })
    const edited = applyChartOperation(local, { type: 'chart.data.set-point', seriesId: series.id, channel: 'val', index: 2, value: 15 })
    expect(edited.plots[0].series[0].data.val.cache.points[0].source).toEqual(series.data.val.cache.points[0].source)
    expect(edited.plots[0].series[0].pointStyles).toEqual(series.pointStyles)
    expect(series.data.val.formula).toBe('Data!$B$2:$B$4')
  })
  it('retains uniform source rich title and preserves its style during text editing', async () => {
    const d = await sourceDocument('', x => x.replace('<c:chart>', `<c:chart><c:title><c:tx><c:rich>${textStyle.replace('</a:p>', '<a:r><a:t>Revenue</a:t></a:r></a:p>')}</c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>`))
    expect(d.title).toEqual({ kind: 'text', value: 'Revenue', textStyle: { fontFamily: 'Arial', fontSizePt: 12, bold: false, italic: false, color: '000000' } })
    expect(applyChartOperation(d, { type: 'chart.title.set', value: 'Edited' }).title).toEqual({ ...d.title, value: 'Edited' })
  })
  it.each([
    x => x.replace('val="C0504D"', 'val="not-a-color"'),
    x => x.replace('<a:effectLst/>', '<a:effectLst><a:outerShdw/></a:effectLst>'),
    x => x.replace('w="25400"', 'w="-1"'),
    x => x.replace('<a:latin typeface="Arial"/>', '<a:latin typeface="Arial"/><a:unknown/>'),
  ])('rejects unsupported source visuals with the actual chart location', async mutate => {
    await expect(sourceDocument('', mutate)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_CHART_FAILED',
      sourceLocation: { partUri: 'ppt/charts/chart1.xml' } })
  })
})
