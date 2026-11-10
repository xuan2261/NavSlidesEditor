import chartRender from 'revealjs-shared/src/pptx-chart-render.js'
import { useLayoutEffect, useRef, useState } from 'react'
import { usePptxSourceFonts } from '../hooks/use-pptx-source-fonts'

export default function NativeChartRenderer({
  chartDocument,
  theme,
  isSelected,
  isDragging,
  fontRuntime,
  width,
  height,
}) {
  const sharedFonts = usePptxSourceFonts()
  const container = useRef(null)
  const [size, setSize] = useState(null)
  useLayoutEffect(() => {
    if (width && height) return
    const node = container.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const { width: w, height: h } = entries[0].contentRect
      setSize((previous) =>
        previous?.width === w && previous?.height === h ? previous : { width: w, height: h }
      )
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [width, height])
  const result = chartRender.projectChartRender(chartDocument, {
    width: width ?? size?.width,
    height: height ?? size?.height,
    fontRuntime: fontRuntime ?? sharedFonts.fontRuntime,
    theme,
  })
  if (result.svg)
    return (
      <div
        ref={container}
        data-native-chart-svg
        style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{ __html: result.svg }}
      />
    )
  if (!result.supported)
    return (
      <div ref={container} style={{ width: '100%', height: '100%' }}>
        <div role="status" data-native-chart-unsupported className="p-2 text-xs">
          {result.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      </div>
    )
  const config = JSON.stringify(result.config).replace(/</g, '\\u003c')
  const html = `<!doctype html><html><head><meta charset="utf-8">
<script src="/vendor/chart.js/dist/chart.umd.js"></script>
<style>*{margin:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:transparent}</style>
</head><body><canvas id="chart"></canvas><script>
new Chart(document.getElementById('chart'),${config});
</script></body></html>`
  return (
    <div ref={container} style={{ width: '100%', height: '100%' }}>
      <iframe
        title="Source chart"
        sandbox="allow-scripts"
        srcDoc={html}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          pointerEvents: isSelected && !isDragging ? 'auto' : 'none',
        }}
      />
    </div>
  )
}
