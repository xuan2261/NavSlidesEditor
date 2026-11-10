import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { afterEach, expect, it } from 'vitest'
import { buildNativeChartFixture } from './chart-native-fixtures.js'
const require = createRequire(import.meta.url)
const { parseFile } = require('../../server/services/pptx-import/parse-worker')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { readSemanticChart } = require('../../server/services/pptx-import/ooxml-semantic-chart')
const { projectChartRender } = require('../../shared/src/pptx-chart-render')
const roots = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive:true, force:true }))) })
async function parseLiteral(family) {
  const zip = await JSZip.loadAsync(await buildNativeChartFixture(family))
  const part = 'ppt/charts/chart1.xml'
  // Keep the valid literal choice; make an actual sparse 0,2 domain, not refs.
  const xml = (await zip.file(part).async('string')).replaceAll('ptCount val="2"','ptCount val="3"').replaceAll('pt idx="1"','pt idx="2"')
  zip.file(part,xml)
  const bytes = await zip.generateAsync({ type:'nodebuffer' })
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'chart-literal-worker-'))
  roots.push(root)
  const file = path.join(root,'literal.pptx')
  await fs.writeFile(file,bytes)
  const parsed = await parseFile(file,'literal.pptx')
  expect(parsed).toMatchObject({ ok:true, parser:'pptxtojson', packageVersion:'2.0.2' })
  expect(await fs.readFile(file)).toEqual(bytes)
  const inventory = await buildSemanticInventory(zip)
  const source = inventory.definitions.find(d => d.kind === 'graphic-frame' && d.nativeId === '8')
  const { document } = await readSemanticChart({ zip,inventory,source })
  const chart = parsed.output.slides.flatMap(s=>s.elements).find(e=>e.type === 'chart')
  return { chart, document, xml }
}
it('passes literal numeric bubble channels through the real pinned parser and native SVG consumer without dropping sparse slots', async () => {
  const { chart,document,xml } = await parseLiteral('bubbleChart')
  expect(xml).toContain('<c:numLit>')
  expect(xml).not.toContain('<c:numRef>')
  expect(chart.data).toEqual([[5,null,15],[5,null,15],[1,null,4]])
  const series = document.plots[0].series[0]
  expect(series.data.bubbleSize.kind).toBe('numLit')
  expect(series.data.bubbleSize.cache.count).toBe(3)
  expect(series.data.xVal.cache.count).toBe(3)
  const rendered = projectChartRender(document,{ width:400,height:300 })
  expect(rendered.supported).toBe(true)
  const points = rendered.model.series[0].points
  expect(points.map(p=>p.index)).toEqual([0,2])
  expect(points[1].x).toBe(300)
  expect(points[1].radius/points[0].radius).toBeCloseTo(2)
  expect(rendered.svg).toContain('data-chart-point="2"')
  expect(rendered.svg).not.toContain('data-chart-point="1"')
})
it('retains literal string categories and numeric values in the real parser rather than returning an empty native chart', async () => {
  const { chart,document } = await parseLiteral('bar3DChart')
  expect(document.plots[0].series[0].data.cat.cache.count).toBe(3)
  expect(document.plots[0].series[0].data.val.cache.count).toBe(3)
  expect(chart.data[0].xlabels).toEqual({ 0:'A',2:'B' })
  expect(chart.data[0].values.map(p=>({ index:Number(p.x),value:p.y }))).toEqual([{ index:0,value:4 },{ index:2,value:8 }])
  const rendered = projectChartRender(document,{ width:400,height:300 })
  expect(rendered.supported).toBe(true)
  expect(rendered.model.series[0].points.map(p=>p.index)).toEqual([0,2])
  expect(rendered.svg).toContain('data-chart-family="bar3DChart"')
  expect(rendered.svg).toContain('data-chart-point="2"')
})
