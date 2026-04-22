import { Input, Select } from '../../components/ui'
/**
 * Chart-specific properties: chart type, labels, values, series label, color.
 */

export default function ChartProperties({ element, onUpdate }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Chart Type</div>
      <Select
        className="w-full bg-card border border-border text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-muted"
        value={element.chartType || 'bar'}
        onChange={(e) => onUpdate({ chartType: e.target.value })}
        style={{ padding: '4px 6px', marginBottom: 8 }}
      >
        {['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'].map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </Select>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
        Labels (comma-separated)
      </div>
      <Input
        className="w-full bg-card border border-border text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-muted"
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
        style={{ marginBottom: 6, fontSize: 11, padding: '4px 6px' }}
      />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
        Values (comma-separated)
      </div>
      <Input
        className="w-full bg-card border border-border text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-muted"
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
        style={{ marginBottom: 6, fontSize: 11, padding: '4px 6px' }}
      />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Series Label</div>
      <Input
        className="w-full bg-card border border-border text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-muted"
        type="text"
        value={(element.chartData?.datasets || [])[0]?.label || ''}
        onChange={(e) => {
          const datasets = [
            ...(element.chartData?.datasets || [{ label: '', data: [], color: '#6366f1' }]),
          ]
          datasets[0] = { ...datasets[0], label: e.target.value }
          onUpdate({ chartData: { ...element.chartData, datasets } })
        }}
        style={{ marginBottom: 6, fontSize: 11, padding: '4px 6px' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Color</div>
        <input
          type="color"
          className="w-9 h-7 border border-border rounded cursor-pointer p-[1px] bg-card shrink-0"
          value={(element.chartData?.datasets || [])[0]?.color || '#6366f1'}
          onChange={(e) => {
            const datasets = [
              ...(element.chartData?.datasets || [{ label: '', data: [], color: '#6366f1' }]),
            ]
            datasets[0] = { ...datasets[0], color: e.target.value }
            onUpdate({ chartData: { ...element.chartData, datasets } })
          }}
          style={{
            width: 28,
            height: 28,
            padding: 2,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  )
}
