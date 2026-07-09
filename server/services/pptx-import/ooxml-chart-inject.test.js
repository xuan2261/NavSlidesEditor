import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { injectChartsFromSceneGraph, parseOoxmlChart } from './ooxml-chart-parser.js'
import { buildOoxmlSceneGraph } from './ooxml-scene-graph/index.js'

const BAR_XML = `<?xml version="1.0"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart><c:plotArea><c:barChart>
    <c:ser>
      <c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>S1</c:v></c:pt></c:strCache></c:strRef></c:tx>
      <c:cat><c:strRef><c:strCache>
        <c:pt idx="0"><c:v>A</c:v></c:pt><c:pt idx="1"><c:v>B</c:v></c:pt>
      </c:strCache></c:strRef></c:cat>
      <c:val><c:numRef><c:numCache>
        <c:pt idx="0"><c:v>10</c:v></c:pt><c:pt idx="1"><c:v>20</c:v></c:pt>
      </c:numCache></c:numRef></c:val>
    </c:ser>
  </c:barChart></c:plotArea></c:chart>
</c:chartSpace>`

async function chartZip() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
     xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
     xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <p:cSld><p:spTree>
        <p:nvGrpSpPr/><p:grpSpPr/>
        <p:graphicFrame>
          <p:nvGraphicFramePr><p:cNvPr id="4" name="Chart 1"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
          <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
            <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId3"/>
          </a:graphicData></a:graphic>
        </p:graphicFrame>
      </p:spTree></p:cSld>
    </p:sld>`
  )
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
    </Relationships>`
  )
  zip.file('ppt/charts/chart1.xml', BAR_XML)
  return zip
}

describe('injectChartsFromSceneGraph (T5.2-ish)', () => {
  it('injects editable chart element from OOXML when none mapped', async () => {
    const zip = await chartZip()
    const graph = await buildOoxmlSceneGraph(zip)
    const stats = {}
    const warnings = []
    const elements = await injectChartsFromSceneGraph({
      elements: [],
      graphSlide: graph.slides[0],
      zip,
      slideIndex: 0,
      stats,
      warnings,
    })
    expect(elements.some((e) => e.type === 'chart')).toBe(true)
    const chart = elements.find((e) => e.type === 'chart')
    expect(chart.chartData.datasets[0].data).toEqual([10, 20])
    expect(chart.chartData.labels).toEqual(['A', 'B'])
    expect(chart._pptxSource.nodeId).toBeTruthy()
    expect(stats.chartCount).toBe(1)
  })

  it('does not duplicate when chart already present for node', async () => {
    const zip = await chartZip()
    const graph = await buildOoxmlSceneGraph(zip)
    const nodeId = String(graph.slides[0].nodes.find((n) => n.kind === 'graphicFrame').id)
    const elements = await injectChartsFromSceneGraph({
      elements: [{ type: 'chart', chartType: 'bar', chartData: { labels: [], datasets: [] }, _pptxSource: { nodeId } }],
      graphSlide: graph.slides[0],
      zip,
      slideIndex: 0,
      stats: {},
      warnings: [],
    })
    expect(elements.filter((e) => e.type === 'chart')).toHaveLength(1)
  })

  it('claims unstamped parser chart instead of duplicating', async () => {
    const zip = await chartZip()
    const graph = await buildOoxmlSceneGraph(zip)
    const elements = await injectChartsFromSceneGraph({
      elements: [
        {
          type: 'chart',
          chartType: 'bar',
          chartData: { labels: ['X'], datasets: [{ label: 'S', data: [1] }] },
        },
      ],
      graphSlide: graph.slides[0],
      zip,
      slideIndex: 0,
      stats: {},
      warnings: [],
      scale: { x: 0.75, y: 0.75 },
    })
    expect(elements.filter((e) => e.type === 'chart')).toHaveLength(1)
    expect(elements[0]._pptxSource?.nodeId).toBeTruthy()
  })

  it('applies scale to injected geometry', async () => {
    const zip = await chartZip()
    const graph = await buildOoxmlSceneGraph(zip)
    // Force inject by starting empty
    const graphSlide = graph.slides[0]
    const node = graphSlide.nodes.find((n) => n.kind === 'graphicFrame')
    node.xfrm = { x: 100, y: 200, cx: 400, cy: 300 }
    const elements = await injectChartsFromSceneGraph({
      elements: [],
      graphSlide,
      zip,
      slideIndex: 0,
      stats: {},
      warnings: [],
      scale: { x: 0.5, y: 0.5 },
    })
    const chart = elements.find((e) => e.type === 'chart')
    expect(chart.x).toBe(50)
    expect(chart.y).toBe(100)
    expect(chart.width).toBe(200)
    expect(chart.height).toBe(150)
  })
})

describe('parseOoxmlChart support matrix', () => {
  it('marks barChart as native bar', () => {
    const p = parseOoxmlChart(BAR_XML)
    expect(p.supportStatus === 'native' || p.navType === 'bar').toBe(true)
  })
})
