import { Input, Select, ColorPicker } from '../../components/ui'
/**
 * Chart-specific properties: chart type, labels, values, series label, color.
 */

export default function ChartProperties({ element, onUpdate }) {
  return (
    <div className="mb-2.5">
      <div className="text-[11px] text-text-muted mb-1">Chart Type</div>
      <Select
        className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
        value={element.chartType || 'bar'}
        onChange={(e) => onUpdate({ chartType: e.target.value })}
      >
        {['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'].map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </Select>
      <div className="text-[11px] text-text-muted mb-1">
        Labels (comma-separated)
      </div>
      <Input
        className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-[11px] transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-1.5"
        type="text"
        value={(element.chartData?.labels || []).join(', ')}
        onChange={(e) =>
          onUpdate({
            chartData: {
              ...element.chartData,
              labels: e.target.value.split(',').map((s) => s.trim()),
            },
          })
        }
      />
      <div className="text-[11px] text-text-muted mb-1">
        Values (comma-separated)
      </div>
      <Input
        className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-[11px] transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-1.5"
        type="text"
        value={((element.chartData?.datasets || [])[0]?.data || []).join(', ')}
        onChange={(e) => {
          const data = e.target.value.split(',').map((s) => Number(s.trim()) || 0)
          const datasets = [
            ...(element.chartData?.datasets || [{ label: 'Series 1', data: [], color: '#6366f1' }]),
          ]
          datasets[0] = { ...datasets[0], data }
          onUpdate({ chartData: { ...element.chartData, datasets } })
        }}
      />
      <div className="text-[11px] text-text-muted mb-1">Series Label</div>
      <Input
        className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-[11px] transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-1.5"
        type="text"
        value={(element.chartData?.datasets || [])[0]?.label || ''}
        onChange={(e) => {
          const datasets = [
            ...(element.chartData?.datasets || [{ label: '', data: [], color: '#6366f1' }]),
          ]
          datasets[0] = { ...datasets[0], label: e.target.value }
          onUpdate({ chartData: { ...element.chartData, datasets } })
        }}
      />
      <div className="flex items-center gap-1.5">
        <div className="text-[11px] text-text-muted">Color</div>
        <ColorPicker
          className="w-7 h-7 p-0.5 bg-card border border-border rounded cursor-pointer"
          value={(element.chartData?.datasets || [])[0]?.color || '#6366f1'}
          onChange={(e) => {
            const datasets = [
              ...(element.chartData?.datasets || [{ label: '', data: [], color: '#6366f1' }]),
            ]
            datasets[0] = { ...datasets[0], color: e.target.value }
            onUpdate({ chartData: { ...element.chartData, datasets } })
          }}
        />
      </div>
    </div>
  )
}
