import { Button, Input, Select, ColorPicker } from '../../components/ui'
/**
 * Chart-specific properties: chart type, labels, values, series label, color.
 */

export default function ChartProperties({ element, onUpdate }) {
  const chartData = element.chartData || {}
  const preserveOnly = element._pptxChartMeta?.preservationTier === 'preserve-only'
  const originalType = String(element._pptxChartMeta?.originalType || 'chart')
  const originalTypeLabel = `${originalType.charAt(0).toUpperCase()}${originalType.slice(1)}`
  const datasets = chartData.datasets?.length
    ? chartData.datasets
    : [{ label: 'Series 1', data: [], color: '#6366f1' }]
  const updateDataset = (index, patch) => {
    const next = datasets.map((dataset, i) => (i === index ? { ...dataset, ...patch } : dataset))
    onUpdate({ chartData: { ...chartData, datasets: next } })
  }
  const addSeries = () => {
    const label = `Series ${datasets.length + 1}`
    onUpdate({
      chartData: {
        ...chartData,
        datasets: [...datasets, { label, data: [], color: '#6366f1' }],
      },
    })
  }
  const removeSeries = (index) => {
    if (datasets.length <= 1) return
    onUpdate({ chartData: { ...chartData, datasets: datasets.filter((_, i) => i !== index) } })
  }

  return (
    <div className="mb-2.5">
      {preserveOnly && (
        <div data-testid="prop-chart-preserve-only-notice" className="mb-2 rounded-sm border border-border bg-hover px-2 py-1.5 text-[11px] text-text-secondary">
          {originalTypeLabel} is preserved from the original PPTX and cannot be edited.
        </div>
      )}
      <div className="text-[11px] text-text-muted mb-1">Chart Type</div>
      <Select
        data-testid="prop-chart-type"
        className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
        value={element.chartType || 'bar'}
        disabled={preserveOnly}
        onChange={(e) => onUpdate({ chartType: e.target.value })}
      >
        {['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'].map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </Select>
      <div className="flex flex-col gap-1 mb-2">
        {element.chartType === 'line' && (
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
            <input
              data-testid="prop-chart-area-fill"
              type="checkbox"
              checked={element.areaFill === true}
              disabled={preserveOnly}
              onChange={(e) => onUpdate({ areaFill: e.target.checked })}
              className="accent-accent"
            />
            <span>Fill area under line</span>
          </label>
        )}
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
          <input
            data-testid="prop-chart-stacked"
            type="checkbox"
            checked={element.stacked === true}
            disabled={preserveOnly}
            onChange={(e) => onUpdate({ stacked: e.target.checked })}
            className="accent-accent"
          />
          <span>Stacked</span>
        </label>
      </div>
      <div className="text-[11px] text-text-muted mb-1">
        Labels (comma-separated)
      </div>
      <Input
        data-testid="prop-chart-labels"
        className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-[11px] transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-1.5"
        type="text"
        value={(element.chartData?.labels || []).join(', ')}
        disabled={preserveOnly}
        onChange={(e) =>
          onUpdate({
            chartData: {
              ...chartData,
              labels: e.target.value.split(',').map((s) => s.trim()),
            },
          })
        }
      />
      {datasets.map((dataset, index) => (
        <div key={index} className="mb-2 border-t border-border pt-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-[11px] text-text-muted">Series {index + 1}</div>
            <Button
              data-testid={`prop-chart-remove-series-${index}`}
              variant="secondary"
              className="text-[11px] px-1.5 py-0.5"
              disabled={preserveOnly || datasets.length <= 1}
              onClick={() => removeSeries(index)}
            >
              Remove
            </Button>
          </div>
          <div className="text-[11px] text-text-muted mb-1">Series Label</div>
          <Input
            data-testid={`prop-chart-series-label-${index}`}
            className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-[11px] transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-1.5"
            type="text"
            value={dataset.label || ''}
            disabled={preserveOnly}
            onChange={(e) => updateDataset(index, { label: e.target.value })}
          />
          <div className="text-[11px] text-text-muted mb-1">Values (comma-separated)</div>
          <Input
            data-testid={`prop-chart-values-${index}`}
            className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-[11px] transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-1.5"
            type="text"
            value={(dataset.data || []).join(', ')}
            disabled={preserveOnly}
            onChange={(e) =>
              updateDataset(index, {
                data: e.target.value.split(',').map((s) => Number(s.trim()) || 0),
              })
            }
          />
          <div className="flex items-center gap-1.5">
            <div className="text-[11px] text-text-muted">Color</div>
            <ColorPicker
              data-testid={`prop-chart-color-${index}`}
              className="w-7 h-7 p-0.5 bg-card border border-border rounded cursor-pointer"
              value={dataset.color || '#6366f1'}
              disabled={preserveOnly}
              onChange={(e) => updateDataset(index, { color: e.target.value })}
            />
          </div>
        </div>
      ))}
      <Button
        data-testid="prop-chart-add-series"
        variant="secondary"
        className="w-full text-[11px] px-1.5 py-1 justify-center"
        disabled={preserveOnly}
        onClick={addSeries}
      >
        Add Series
      </Button>
    </div>
  )
}
