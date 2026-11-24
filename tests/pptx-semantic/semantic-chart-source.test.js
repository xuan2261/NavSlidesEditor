import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { buildFeatureFixture } from './feature-fixtures.js'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { readSemanticChart } = require('../../server/services/pptx-import/ooxml-semantic-chart')
const { normalizeChartDocument } = require('../../shared/src/pptx-chart-document')
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const part = 'ppt/charts/chart1.xml'
const values = (name, type = 'numLit') =>
  `<c:${name}><c:${type}>${type.endsWith('Ref') ? '<c:f>Data!$B$2:$B$3</c:f><c:numCache>' : ''}<c:ptCount val="2"/><c:pt idx="0"><c:v>7</c:v></c:pt><c:pt idx="1"><c:v>11</c:v></c:pt>${type.endsWith('Ref') ? '</c:numCache>' : ''}</c:${type}></c:${name}>`
const series = (index = 0, data = values('val')) =>
  `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>Series ${index}</c:v></c:tx>${data}</c:ser>`
const chart = (plots, extra = '') =>
  `<c:chartSpace xmlns:c="${C}" xmlns:r="${R}"><c:style val="12"/><c:chart><c:plotArea><c:layout/>${plots}</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend></c:chart>${extra}</c:chartSpace>`
async function read(xml, change) {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  if (xml) zip.file(part, xml)
  if (change) await change(zip)
  const inventory = await buildSemanticInventory(zip)
  const source = inventory.definitions.find((d) => d.kind === 'graphic-frame' && d.nativeId === '8')
  return { ...(await readSemanticChart({ zip, inventory, source })), inventory }
}

describe('strict relationship-bound source chart reader', () => {
  it('reads the real authored chart with axes, caches and workbook metadata', async () => {
    const result = await read()
    const d = result.document
    expect(d.plots[0].family).toBe('barChart')
    expect(d.plots[0].options).toMatchObject({ barDir: 'col', grouping: 'clustered' })
    expect(d.axes.map((a) => a.id)).toEqual([100, 200])
    expect(d.plots[0].series[0].data.cat.formula).toBe('Data!$A$2:$A$3')
    expect(d.plots[0].series[0].data.val.cache.points.map((p) => p.value)).toEqual([7, 11])
    expect(d.workbook).toMatchObject({ external: false, target: 'ppt/embeddings/feature-data.xlsx' })
    const components = result.inventory.definitions.filter((s) => s.partUri === part)
    expect(new Set(result.componentDefinitionIds)).toEqual(new Set(components.map((s) => s.id)))
    expect(normalizeChartDocument(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })
  it('preserves ordered multiple series, combo families, exact identities and style', async () => {
    const result = await read(chart(`<c:pieChart>${series(1)}${series(0)}</c:pieChart><c:doughnutChart><c:holeSize val="60"/>${series(2)}</c:doughnutChart>`))
    expect(result.document.plots.map((p) => p.family)).toEqual(['pieChart', 'doughnutChart'])
    expect(result.document.plots[0].series.map((s) => s.order)).toEqual([1, 0])
    expect(result.document.style).toBe(12)
    expect(result.document.legend).toEqual({ legendPos: 'b', overlay: false })
    for (const s of result.document.plots.flatMap((p) => p.series)) {
      expect(result.inventory.definitions.find((d) => d.id === s.id).componentLocators[0].path).toEqual(s.source.path)
    }
  })
  it.each(['lineChart', 'areaChart', 'radarChart', 'stockChart', 'surfaceChart',
    'line3DChart', 'area3DChart', 'surface3DChart', 'pie3DChart', 'bar3DChart', 'ofPieChart'])(
    'does not coerce source family %s', async (family) => {
      const d = (await read(chart(`<c:${family}>${series()}</c:${family}>`))).document
      expect(d.plots[0].family).toBe(family)
    })
  it.each(['scatterChart', 'bubbleChart'])('retains numeric x/y/bubble channels for %s', async (family) => {
    const data = values('xVal') + values('yVal', 'numRef') + (family === 'bubbleChart' ? values('bubbleSize') : '')
    const d = (await read(chart(`<c:${family}>${series(0, data)}</c:${family}>`))).document
    expect(d.plots[0].series[0].data.yVal.formula).toBe('Data!$B$2:$B$3')
    expect(d.plots[0].series[0].data.xVal.cache.points[0].value).toBe(7)
  })
  it('retains source title, data label settings and sparse caches without inventing values', async () => {
    const sparse = values('val').replace('<c:pt idx="0"><c:v>7</c:v></c:pt>', '')
    const xml = chart(`<c:pieChart>${series(0, sparse)}<c:dLbls><c:showVal val="1"/><c:separator> / </c:separator><c:dLbl><c:idx val="1"/><c:tx><c:v>Label &amp; text</c:v></c:tx><c:showPercent val="0"/></c:dLbl></c:dLbls></c:pieChart>`)
      .replace('<c:chart>', '<c:chart><c:title><c:tx><c:strRef><c:f>Data!$C$1</c:f></c:strRef></c:tx></c:title>')
    const d = (await read(xml)).document
    expect(d.title).toEqual({ kind: 'strRef', formula: 'Data!$C$1' })
    expect(d.plots[0].dataLabels).toEqual({
      options: { showVal: true, separator: ' / ' },
      labels: [{ index: 1, text: { kind: 'text', value: 'Label & text' }, options: { showPercent: false } }],
    })
    expect(d.plots[0].series[0].data.val.cache).toMatchObject({ count: 2, points: [{ index: 1, value: 11 }] })
  })
  it('uses namespace URIs rather than requiring chart and relationship prefixes', async () => {
    const xml = chart(`<c:pieChart>${series()}</c:pieChart>`)
      .replace(/(<\/?)c:/g, '$1chartAlias:').replace('xmlns:c=', 'xmlns:chartAlias=')
    expect((await read(xml)).document.plots[0].family).toBe('pieChart')
  })
  it('rejects duplicate series indices/orders and unresolved axis references', async () => {
    await expect(read(chart(`<c:pieChart>${series()}${series()}</c:pieChart>`))).rejects.toThrow(/duplicate/i)
    await expect(read(chart(`<c:lineChart>${series()}<c:axId val="100"/></c:lineChart>`))).rejects.toThrow(/axis/i)
  })
  it.each([
    (x) => x.replace('ptCount val="2"', 'ptCount val="1"'),
    (x) => x.replace('idx="1"', 'idx="0"'),
    (x) => x.replace('idx="1"', 'idx="2"'),
    (x) => x.replace('<c:v>7</c:v>', '<c:v>NaN</c:v>'),
    (x) => x.replace('</c:ser>', '<c:unknownRequired/></c:ser>'),
    (x) => x.replace('<c:style val="12"/>', '<c:extLst/>'),
    (x) => x.replace('<c:idx val="0"/>', '<c:idx val="-1"/>'),
    (x) => x.replace('<c:style val="12"/>', '<c:style val="12">ignored</c:style>'),
    (x) => x.replace('<c:ser>', '<c:ser>ignored'),
  ])('rejects malformed or unknown required semantics with a source location', async (mutate) => {
    await expect(read(mutate(chart(`<c:pieChart>${series()}</c:pieChart>`)))).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_CHART_FAILED', sourceLocation: { partUri: part },
    })
  })
  it('rejects chart relationship type substitution and missing workbook parts', async () => {
    await expect(read(null, async (zip) => {
      const p = 'ppt/slides/_rels/slide1.xml.rels'
      zip.file(p, (await zip.file(p).async('string')).replace(`${R}/chart`, `${R}/image`))
    })).rejects.toThrow(/relationship/i)
    await expect(read(null, (zip) => zip.remove('ppt/embeddings/feature-data.xlsx'))).rejects.toThrow(/missing/i)
  })
  it('preserves denied external workbook as inert metadata without fetching or detaching', async () => {
    const xml = chart(`<c:pieChart>${series(0, values('val', 'numRef'))}</c:pieChart>`, '<c:externalData r:id="book"><c:autoUpdate val="1"/></c:externalData>')
    const result = await read(xml, (zip) => {
      zip.file('ppt/charts/_rels/chart1.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="book" Type="${R}/package" Target="https://example.invalid/data.xlsx" TargetMode="External"/></Relationships>`)
    })
    expect(result.document.workbook).toMatchObject({ external: true, target: 'https://example.invalid/data.xlsx', autoUpdate: true })
    expect(result.document.plots[0].series[0].data.val.kind).toBe('numRef')
  })
  it('rejects stale source bytes and missing inventoried component identities', async () => {
    const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
    const inventory = await buildSemanticInventory(zip)
    const source = inventory.definitions.find((d) => d.kind === 'graphic-frame' && d.nativeId === '8')
    const input = { zip, inventory, source }
    const xml = await zip.file(part).async('string')
    zip.file(part, xml.replace('<c:v>7</c:v>', '<c:v>8</c:v>'))
    await expect(readSemanticChart(input)).rejects.toThrow(/hash/i)
    zip.file(part, xml)
    inventory.definitions = inventory.definitions.filter((d) => d.kind !== 'chart-data-point')
    await expect(readSemanticChart(input)).rejects.toThrow(/component identity/i)
  })
})
