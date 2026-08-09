import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChartRenderer } from './chart-element-renderer'

describe('chart element renderer', () => {
  it('uses local vendor runtime and escapes script-breakout data', () => {
    const { container } = render(
      <ChartRenderer
        element={{
          chartType: 'bar',
          chartData: {
            labels: ['</script><script>evil()</script>'],
            datasets: [{ label: '</script><img onerror="evil()">', data: [1], color: '#6366f1' }],
          },
        }}
      />
    )

    const srcDoc = container.querySelector('iframe').getAttribute('srcdoc')
    expect(srcDoc).toContain('/vendor/chart.js/dist/chart.umd.js')
    expect(srcDoc).not.toContain('cdn.jsdelivr.net')
    expect(srcDoc).not.toContain('</script><script>evil()')
    expect(srcDoc).not.toContain('</script><img')
    expect(srcDoc).toContain('\\u003c/script>')
  })

  it('[cap:element.chart depth:behavior] uses radial scales for radar charts', () => {
    const { container } = render(
      <ChartRenderer
        element={{
          chartType: 'radar',
          chartData: { labels: ['A'], datasets: [{ label: 'Series', data: [1] }] },
        }}
      />
    )

    const srcDoc = container.querySelector('iframe').getAttribute('srcdoc')
    expect(srcDoc).toContain('scales:{r:')
    expect(srcDoc).not.toContain('scales:{x:')
  })

  it('[cap:element.chart depth:behavior] does not emit cartesian scales for polar area charts', () => {
    const { container } = render(
      <ChartRenderer
        element={{
          chartType: 'polarArea',
          chartData: { labels: ['A'], datasets: [{ label: 'Series', data: [1] }] },
        }}
      />
    )

    const srcDoc = container.querySelector('iframe').getAttribute('srcdoc')
    expect(srcDoc).toContain('scales:{}')
    expect(srcDoc).not.toContain('scales:{x:')
  })

  it('[red defect:renderer.contrast] uses readable chart defaults on light backgrounds', () => {
    const { container } = render(
      <ChartRenderer
        element={{
          chartType: 'bar',
          chartData: { labels: ['A'], datasets: [{ label: 'Series', data: [1] }] },
        }}
      />
    )

    const srcDoc = container.querySelector('iframe').getAttribute('srcdoc')
    expect(srcDoc).toContain("ticks:{color:'#141413'}")
    expect(srcDoc).toContain("grid:{color:'rgba(20,20,19,0.16)'}")
    expect(srcDoc).toContain("legend:{position:'right',labels:{color:'#141413'")
  })

  it('[red defect:renderer.contrast] uses light chart defaults on dark slide backgrounds', () => {
    const { container } = render(
      <ChartRenderer
        element={{
          chartType: 'bar',
          chartData: { labels: ['A'], datasets: [{ label: 'Series', data: [1] }] },
        }}
        slideBackground={{ type: 'color', color: '#1e1e2e' }}
      />
    )

    const srcDoc = container.querySelector('iframe').getAttribute('srcdoc')
    expect(srcDoc).toContain("ticks:{color:'#f8fafc'}")
    expect(srcDoc).toContain("grid:{color:'rgba(248,250,252,0.28)'}")
    expect(srcDoc).toContain("legend:{position:'right',labels:{color:'#f8fafc'")
  })

  it('keeps explicit chart colors ahead of background-derived fallbacks', () => {
    const { container } = render(
      <ChartRenderer
        element={{
          chartType: 'bar',
          axisTextColor: '#facc15',
          gridColor: 'rgba(250,204,21,0.4)',
          legendTextColor: '#22c55e',
          chartData: { labels: ['A'], datasets: [{ label: 'Series', data: [1] }] },
        }}
        slideBackground={{ type: 'color', color: '#1e1e2e' }}
      />
    )

    const srcDoc = container.querySelector('iframe').getAttribute('srcdoc')
    expect(srcDoc).toContain("ticks:{color:'#facc15'}")
    expect(srcDoc).toContain("grid:{color:'rgba(250,204,21,0.4)'}")
    expect(srcDoc).toContain("legend:{position:'right',labels:{color:'#22c55e'")
  })

  it('renders authored legend placement and cartesian axis titles', () => {
    const { container } = render(
      <ChartRenderer
        element={{
          chartType: 'bar',
          legendPosition: 'bottom',
          axisTitles: { category: 'Month', value: 'Revenue' },
          chartData: { labels: ['Jan'], datasets: [{ label: 'Series', data: [1] }] },
        }}
      />
    )

    const srcDoc = container.querySelector('iframe').getAttribute('srcdoc')
    expect(srcDoc).toContain("legend:{position:'bottom'")
    expect(srcDoc).toContain('title:{display:true,text:"Month"}')
    expect(srcDoc).toContain('title:{display:true,text:"Revenue"}')
  })
})
