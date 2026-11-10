import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { nativeChartXml as xml, nativeChartPaint as paint, buildNativeChartFixture } from './chart-native-fixtures.js'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { readSemanticChart } = require('../../server/services/pptx-import/ooxml-semantic-chart')
const { projectChartRender } = require('../../shared/src/pptx-chart-render')
async function read(bytes) {
  const zip = await JSZip.loadAsync(await buildNativeChartFixture())
  zip.file('ppt/charts/chart1.xml', bytes)
  const inventory = await buildSemanticInventory(zip)
  const source = inventory.definitions.find(d => d.kind === 'graphic-frame' && d.nativeId === '8')
  return { ...(await readSemanticChart({ zip, inventory, source })), zip }
}
it('reads authored projection into canonical source semantics and changes actual projected SVG geometry', async () => {
  const first = await read(xml(20)), second = await read(xml(60))
  expect(first.document.view3D).toEqual({ rotX: 20, rotY: 40, depthPercent: 150, hPercent: 80, rAngAx: false, perspective: 60 })
  const a = projectChartRender(first.document, { width: 400, height: 300 })
  const b = projectChartRender(second.document, { width: 400, height: 300 })
  expect(a.supported).toBe(true)
  expect(b.supported).toBe(true)
  expect(a.model.series[0].points[0].vertices).not.toEqual(b.model.series[0].points[0].vertices)
  expect(a.svg).toContain('data-chart-face=')
  expect(await first.zip.file('ppt/charts/chart1.xml').async('string')).toBe(xml(20))
})
it.each(['91', 'NaN', '20.5'])('rejects invalid source projection %s with source location', async angle => {
  await expect(read(xml(angle))).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_CHART_FAILED', sourceLocation: { partUri: 'ppt/charts/chart1.xml' } })
})
it('reads authored stock range/candle paints rather than substituting ordinary series lines', async () => {
  const base = xml(20).replace(/<c:view3D>.*?<\/c:view3D>/, '')
  const ser = base.match(/<c:ser>.*?<\/c:ser>/)[0]
  const stock = `<c:stockChart>${[0, 1, 2, 3].map(i => ser.replace(/(<c:(?:idx|order) val=")0/g, `$1${i}`)).join('')}<c:hiLowLines>${paint}</c:hiLowLines><c:upDownBars><c:gapWidth val="200"/><c:upBars>${paint}</c:upBars><c:downBars>${paint}</c:downBars></c:upDownBars><c:axId val="1"/><c:axId val="2"/></c:stockChart>`
  const { document } = await read(base.replace(/<c:bar3DChart>.*?<\/c:bar3DChart>/, stock))
  expect(document.plots[0].hiLowLines.line.fill.color).toBe('445566')
  expect(document.plots[0].upDownBars.gapWidth).toBe(200)
  expect(projectChartRender(document, { width: 400, height: 300 }).svg).toContain('data-chart-stock-body=')
})
