export function ChartRenderer({ element, isSelected, isDragging }) {
  const { chartType = 'bar', chartData = {} } = element
  const labels = chartData.labels || []
  const datasets = chartData.datasets || []
  const areaFill = chartType === 'line' && element.areaFill === true
  const stacked = element.stacked === true
  const stackedAxis = stacked ? 'stacked:true,' : ''
  const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

  const chartHtml = `<!doctype html><html><head>
<meta charset="utf-8">
<script src="/vendor/chart.js/dist/chart.umd.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden}</style>
</head><body>
<canvas id="c" style="width:100%;height:100%"></canvas>
<script>
new Chart(document.getElementById('c'),{
  type:'${chartType}',
  data:{
    labels:${safeJson(labels)},
    datasets:${safeJson(
      datasets.map((ds) => ({
        label: ds.label || '',
        data: ds.data || [],
        backgroundColor: ds.color || '#6366f1',
        borderColor: ds.color || '#6366f1',
        borderWidth: chartType === 'line' ? 2 : 0,
        fill: chartType === 'line' ? areaFill : undefined,
      }))
    )}
  },
  options:{
    responsive:true,
    maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'rgba(255,255,255,0.7)',font:{size:12}}}},
    scales:${chartType === 'pie' || chartType === 'doughnut' ? '{}' : `{x:{${stackedAxis}ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}},y:{${stackedAxis}ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}}}`}
  }
});
</script></body></html>`

  const chartFrameStyle = {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
    pointerEvents: isSelected && !isDragging ? 'auto' : 'none',
    background: 'transparent',
  }
  return <iframe srcDoc={chartHtml} style={chartFrameStyle} sandbox="allow-scripts" title="Chart" />
}
