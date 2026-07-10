import { describe, expect, it } from 'vitest'
import { parseOoxmlChart, detectOoxmlChartType } from './ooxml-chart-parser.js'

const BAR_CHART_XML = `<?xml version="1.0"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart>
    <c:title><c:tx><c:rich><a:p><a:r><a:t>Bar chart</a:t></a:r></a:p></c:rich></c:tx></c:title>
    <c:plotArea>
      <c:barChart>
        <c:barDir val="col"/>
        <c:ser>
          <c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>Revenue</c:v></c:pt></c:strCache></c:strRef></c:tx>
          <c:spPr><a:solidFill><a:srgbClr val="C0504D"/></a:solidFill></c:spPr>
          <c:cat><c:strRef><c:strCache>
            <c:pt idx="0"><c:v>Q1</c:v></c:pt>
            <c:pt idx="1"><c:v>Q2</c:v></c:pt>
          </c:strCache></c:strRef></c:cat>
          <c:val><c:numRef><c:numCache>
            <c:pt idx="0"><c:v>12</c:v></c:pt>
            <c:pt idx="1"><c:v>18</c:v></c:pt>
          </c:numCache></c:numRef></c:val>
        </c:ser>
        <c:ser>
          <c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>Services</c:v></c:pt></c:strCache></c:strRef></c:tx>
          <c:val><c:numRef><c:numCache>
            <c:pt idx="0"><c:v>5</c:v></c:pt>
            <c:pt idx="1"><c:v>9</c:v></c:pt>
          </c:numCache></c:numRef></c:val>
        </c:ser>
      </c:barChart>
    </c:plotArea>
  </c:chart>
</c:chartSpace>`

const PIE_CHART_XML = `<?xml version="1.0"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  <c:chart><c:plotArea><c:pieChart>
    <c:ser>
      <c:cat><c:strRef><c:strCache>
        <c:pt idx="0"><c:v>A</c:v></c:pt><c:pt idx="1"><c:v>B</c:v></c:pt>
      </c:strCache></c:strRef></c:cat>
      <c:val><c:numRef><c:numCache>
        <c:pt idx="0"><c:v>40</c:v></c:pt><c:pt idx="1"><c:v>60</c:v></c:pt>
      </c:numCache></c:numRef></c:val>
    </c:ser>
  </c:pieChart></c:plotArea></c:chart>
</c:chartSpace>`

describe('ooxml-chart-parser (T5.1)', () => {
  it('T5.1 parse bar chart XML → ≥1 series with numeric values', () => {
    expect(detectOoxmlChartType(BAR_CHART_XML)).toBe('barChart')
    const parsed = parseOoxmlChart(BAR_CHART_XML)
    expect(parsed).toBeTruthy()
    expect(parsed.navType).toBe('bar')
    expect(parsed.chartData.datasets.length).toBeGreaterThanOrEqual(1)
    expect(parsed.chartData.datasets[0].data).toEqual([12, 18])
    expect(parsed.chartData.labels).toEqual(['Q1', 'Q2'])
    expect(parsed.chartData.datasets[0].label).toBe('Revenue')
    expect(parsed.chartData.datasets[1].label).toBe('Services')
    expect(parsed.title).toBe('Bar chart')
  })

  it('parses pie chart categories and values', () => {
    const parsed = parseOoxmlChart(PIE_CHART_XML)
    expect(parsed.navType).toBe('pie')
    expect(parsed.chartData.labels).toEqual(['A', 'B'])
    expect(parsed.chartData.datasets[0].data).toEqual([40, 60])
  })

  it('returns empty structure for invalid input', () => {
    expect(parseOoxmlChart(null)).toBeNull()
    const empty = parseOoxmlChart('<c:chartSpace/>')
    expect(empty.empty).toBe(true)
  })

  it('detects combo multi-plot OOXML and throws a structured strict failure', () => {
    const combo = BAR_CHART_XML.replace(
      '</c:plotArea>',
      '<c:lineChart><c:ser><c:val><c:numLit><c:pt idx="0"><c:v>1</c:v></c:pt></c:numLit></c:val></c:ser></c:lineChart></c:plotArea>'
    )
    expect(detectOoxmlChartType(combo)).toBe('comboChart')
    expect(() => parseOoxmlChart(combo, { strict: true })).toThrow(
      expect.objectContaining({
        type: 'import-failed',
        code: 'chart-unsupported-strict',
        chartType: 'comboChart',
      })
    )
  })
})
