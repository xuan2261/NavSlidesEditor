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
})
