import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { afterEach, expect, it } from 'vitest'
import { buildNativeChartFixture } from './chart-native-fixtures.js'
const require = createRequire(import.meta.url)
const { parseFile } = require('../../server/services/pptx-import/parse-worker')
const { mapPptxOutput } = require('../../server/services/pptx-import/mapper')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { readSemanticChart } = require('../../server/services/pptx-import/ooxml-semantic-chart')
const { projectChartRender } = require('../../shared/src/pptx-chart-render')
const roots = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => fs.rm(root,{ recursive:true,force:true }))) })

it.each([['bubbleChart',1],['bubbleChart',2],['scatterChart',1],['scatterChart',2]])('maps real pinned-parser %s with %i sparse XY series without losing coordinates or magnitudes',async (family,count)=>{
  const zip = await JSZip.loadAsync(await buildNativeChartFixture('bubbleChart'))
  const part = 'ppt/charts/chart1.xml'
  let xml = (await zip.file(part).async('string')).replaceAll('ptCount val="2"','ptCount val="3"').replaceAll('pt idx="1"','pt idx="2"')
  xml = xml.replace(/<c:yVal>.*?<\/c:yVal>/s,channel=>channel.replace('<c:v>5</c:v>','<c:v>6</c:v>').replace('<c:v>15</c:v>','<c:v>16</c:v>'))
  if (count === 2) {
    const first = xml.match(/<c:ser>.*?<\/c:ser>/s)[0]
    const second = first.replace('<c:idx val="0"/>','<c:idx val="1"/>').replace('<c:order val="0"/>','<c:order val="1"/>').replaceAll('<c:v>5</c:v>','<c:v>7</c:v>').replaceAll('<c:v>15</c:v>','<c:v>17</c:v>').replaceAll('<c:v>6</c:v>','<c:v>8</c:v>').replaceAll('<c:v>16</c:v>','<c:v>18</c:v>')
    xml = xml.replace(first,first+second)
  }
  // Cartesian source SVG requires authored numeric tick units even on hidden
  // axes; the bubble fixture deliberately leaves those automatic.
  if (family === 'scatterChart') xml = xml.replaceAll('bubbleChart','scatterChart').replaceAll(/<c:bubbleSize>.*?<\/c:bubbleSize>/gs,'').replace('<c:scatterChart>','<c:scatterChart><c:scatterStyle val="line"/>').replaceAll('</c:valAx>','<c:majorUnit val="5"/></c:valAx>')
  zip.file(part,xml)
  const bytes = await zip.generateAsync({ type:'nodebuffer' })
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'chart-parser-mapper-'))
  roots.push(root)
  const file = path.join(root,'source.pptx')
  await fs.writeFile(file,bytes)
  const parsed = await parseFile(file,'source.pptx')
  expect(parsed).toMatchObject({ ok:true,parser:'pptxtojson',packageVersion:'2.0.2' })
  const mapped = await mapPptxOutput({ output:parsed.output,zip,originalName:'source.pptx',uploadsDir:root })
  const chart = mapped.presentation.slides.flatMap(s=>s.elements).find(e=>e.type === 'chart')
  expect(chart._pptxChartMeta.originalType).toBe(family)
  expect(chart.chartData.datasets).toHaveLength(count)
  for (let i=0;i<count;i++) {
    expect(chart.chartData.datasets[i].data).toEqual(i === 0 ? [6,null,16] : [8,null,18])
    expect(chart.chartData.datasets[i].xValues).toEqual(i === 0 ? [5,null,15] : [7,null,17])
    if (family === 'bubbleChart') expect(chart.chartData.datasets[i].bubbleSizes).toEqual([1,null,4])
  }
  // Mapping is not enough: consume the same source through its canonical SVG path.
  const inventory = await buildSemanticInventory(zip)
  const source = inventory.definitions.find(d=>d.kind === 'graphic-frame' && d.nativeId === '8')
  const { document } = await readSemanticChart({ zip,inventory,source })
  const rendered = projectChartRender(document,{ width:400,height:300 })
  expect(rendered.supported, JSON.stringify(rendered.reasons)).toBe(true)
  expect(rendered.model.series).toHaveLength(count)
  expect(rendered.model.series.map(s=>s.points.map(p=>p.index))).toEqual(Array.from({ length:count },()=>[0,2]))
  expect(rendered.model.series[0].points.map(p=>p.x)).toEqual([100,300])
  expect(rendered.model.series[0].points[0].y).toBeCloseTo(210)
  expect(rendered.model.series[0].points[1].y).toBeCloseTo(60)
  if (family === 'bubbleChart') expect(rendered.svg).toContain('data-chart-point="2"')
  else expect(rendered.svg).toContain('<path data-chart-series=')
  expect(await fs.readFile(file)).toEqual(bytes)
})
