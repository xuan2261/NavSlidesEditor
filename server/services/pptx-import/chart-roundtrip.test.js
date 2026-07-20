import { describe, expect, it } from 'vitest'
import { parseOoxmlChart } from './ooxml-chart-parser.js'
import { supportRow } from './chart-support-matrix.js'

const xml = `<c:chartSpace xmlns:c="chart"><c:chart><c:plotArea><c:scatterChart>
<c:ser><c:xVal><c:numRef><c:f>Sheet1!$A$2:$A$3</c:f><c:numCache>
<c:formatCode>0.00</c:formatCode><c:pt idx="0"><c:v>1</c:v></c:pt>
</c:numCache></c:numRef></c:xVal></c:ser></c:scatterChart></c:plotArea></c:chart>
<c:extLst><c:ext uri="opaque"><x:payload xmlns:x="x">keep</x:payload></c:ext></c:extLst>
</c:chartSpace>`

describe('chart preservation baseline', () => {
  it('defaults every non-bar family to preserve-only without coercion', () => {
    for (const family of [
      'areaChart', 'pieChart', 'doughnutChart', 'scatterChart',
      'bubbleChart', 'comboChart', 'radarChart', 'stockChart', 'surfaceChart',
      'histogramChart', 'waterfallChart', 'funnelChart', 'boxWhiskerChart',
      'treemapChart', 'sunburstChart',
    ]) {
      expect(supportRow(family)).toMatchObject({ status: 'preserve-only', navType: null })
    }
    expect(supportRow('lineChart')).toMatchObject({
      status: 'preserve-only', navType: 'line', nativeType: 'lineChart',
    })
    expect(supportRow('barChart')).toMatchObject({ status: 'conditional', navType: 'bar' })
  })

  it('retains native family, formulas, caches, formats, relationships and extensions', () => {
    const parsed = parseOoxmlChart(xml, {
      chartPath: 'ppt/charts/chart1.xml',
      relationshipsXml: `<Relationships><Relationship Id="rId1" Type="package"
        Target="../embeddings/Microsoft_Excel_Worksheet1.xlsx"/></Relationships>`,
    })
    expect(parsed.ooxmlType).toBe('scatterChart')
    expect(parsed.supportStatus).toBe('preserve-only')
    expect(parsed.navType).toBeNull()
    expect(parsed.native.nativeFamily).toEqual(['scatterChart'])
    expect(parsed.native.references[0]).toMatchObject({
      formula: 'Sheet1!$A$2:$A$3', numberFormat: '0.00',
      cache: [{ index: 0, value: '1' }],
    })
    expect(parsed.native.relationshipClosure[0].target)
      .toBe('ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx')
    expect(parsed.native.opaqueExtensions[0]).toContain('keep')
  })
})
