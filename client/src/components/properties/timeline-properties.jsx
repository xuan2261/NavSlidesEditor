import { Input, Select, ColorPicker } from '../../components/ui'
import { clampNumber } from '../../utils/number-input'

export default function TimelineProperties({ element, onUpdate }) {
  const spacing = element.tickSpacing || 'auto'
  const startDate = element.timelineStart ?? element.startDate ?? '2000'
  const endDate = element.timelineEnd ?? element.endDate ?? '2025'
  const yearMode = ['year', '10year', '100year', '1000year'].includes(spacing) ||
    (spacing === 'auto' && /^-?\d+$/.test(String(startDate)))
  const items = (element.events || element.items || []).map((item) => ({
    ...item,
    title: item.title ?? item.label ?? '',
    imageUrl: item.imageUrl ?? item.image ?? '',
    connectorOffset: item.connectorOffset ?? item.connectorLength ?? element.connectorOffset ?? 0,
  }))

  const updateRange = (changes) => {
    const next = { ...changes }
    if (changes.timelineStart !== undefined) next.startDate = changes.timelineStart
    if (changes.timelineEnd !== undefined) next.endDate = changes.timelineEnd
    onUpdate(next)
  }

  const updateItems = (nextItems) => {
    onUpdate({
      events: nextItems,
      items: nextItems.map((item) => ({
        ...item,
        label: item.title ?? item.label ?? '',
        image: item.imageUrl ?? item.image ?? '',
        connectorLength: item.connectorOffset ?? item.connectorLength ?? 0,
      })),
    })
  }

  const updateItem = (idx, changes) => {
    const next = [...items]
    next[idx] = { ...next[idx], ...changes }
    updateItems(next)
  }

  const removeItem = (idx) => {
    updateItems(items.filter((_, i) => i !== idx))
  }

  const addItem = () => {
    const startYear = parseInt(startDate) || 0
    const endYear = parseInt(endDate) || 2025
    const midDate = yearMode
      ? String(Math.round((startYear + endYear) / 2))
      : new Date((new Date(startDate).getTime() + new Date(endDate).getTime()) / 2)
          .toISOString()
          .split('T')[0]
    updateItems([
        ...items,
        {
          id: crypto.randomUUID(),
          date: midDate,
          title: 'New Event',
          description: '',
          imageUrl: '',
          side: items.length % 2 === 0 ? 'top' : 'bottom',
        },
      ])
  }

  return (
    <div className="mb-2.5">
      <div className="text-[11px] text-text-muted mb-1">Tick Spacing</div>
      <Select
        className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent mb-2"
        value={spacing}
        onChange={(e) => onUpdate({ tickSpacing: e.target.value })}
      >
        <option value="auto">Auto</option>
        <option value="day">1 Day</option>
        <option value="month">1 Month</option>
        <option value="year">1 Year</option>
        <option value="10year">10 Years</option>
        <option value="100year">100 Years</option>
        <option value="1000year">1000 Years</option>
      </Select>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <div className="text-[11px] text-text-muted mb-1">
            Start{yearMode ? ' (year)' : ''}
          </div>
          {yearMode ? (
            <Input
              type="number"
              className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs"
              value={parseInt(startDate) || 0}
              onChange={(e) => updateRange({ timelineStart: String(parseInt(e.target.value) || 0) })}
            />
          ) : (
            <Input
              type="date"
              className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs"
              value={startDate || ''}
              onChange={(e) => updateRange({ timelineStart: e.target.value })}
            />
          )}
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-1">
            End{yearMode ? ' (year)' : ''}
          </div>
          {yearMode ? (
            <Input
              type="number"
              className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs"
              value={parseInt(endDate) || 0}
              onChange={(e) => updateRange({ timelineEnd: String(parseInt(e.target.value) || 0) })}
            />
          ) : (
            <Input
              type="date"
              className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs"
              value={endDate || ''}
              onChange={(e) => updateRange({ timelineEnd: e.target.value })}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <div className="text-[10px] text-text-muted mb-1">Line</div>
          <ColorPicker
            value={element.lineColor || '#6366f1'}
            onChange={(e) => onUpdate({ lineColor: e.target.value })}
            className="w-full h-7 border border-border rounded cursor-pointer"
          />
        </div>
        <div>
          <div className="text-[10px] text-text-muted mb-1">Dots</div>
          <ColorPicker
            value={element.dotColor || element.lineColor || '#6366f1'}
            onChange={(e) => onUpdate({ dotColor: e.target.value })}
            className="w-full h-7 border border-border rounded cursor-pointer"
          />
        </div>
        <div>
          <div className="text-[10px] text-text-muted mb-1">Text</div>
          <ColorPicker
            value={element.textColor || '#ffffff'}
            onChange={(e) => onUpdate({ textColor: e.target.value })}
            className="w-full h-7 border border-border rounded cursor-pointer"
          />
        </div>
      </div>

      <div className="text-[11px] text-text-muted mb-1">Font Size</div>
      <Input
        type="number"
        min={8}
        max={24}
        className="w-16 bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs mb-2"
        value={element.fontSize || 11}
        onChange={(e) => onUpdate({ fontSize: clampNumber(e.target.value, 8, 24, 11) })}
      />

      <div className="text-[11px] text-text-muted mb-1.5 font-medium">Events</div>
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="bg-card border border-border rounded p-2 mb-1.5"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-text-muted font-semibold">#{idx + 1}</span>
            <div className="flex gap-1 items-center">
              <Select
                className="text-[10px] px-1 py-0.5 bg-card border border-border rounded text-text-secondary"
                value={item.side || 'top'}
                onChange={(e) => updateItem(idx, { side: e.target.value })}
              >
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </Select>
              <button
                className="text-danger text-sm leading-none px-1 cursor-pointer"
                onClick={() => removeItem(idx)}
              >
                x
              </button>
            </div>
          </div>
          {yearMode ? (
            <Input
              type="number"
              className="w-full bg-card border border-border text-text-primary px-2 py-1 rounded-sm text-[11px] mb-1"
            value={parseInt(item.date) || 0}
            onChange={(e) => updateItem(idx, { date: String(parseInt(e.target.value) || 0) })}
              placeholder="Year"
            />
          ) : (
            <Input
              type="date"
              className="w-full bg-card border border-border text-text-primary px-2 py-1 rounded-sm text-[11px] mb-1"
              value={item.date || ''}
              onChange={(e) => updateItem(idx, { date: e.target.value })}
            />
          )}
          <Input
            type="text"
            className="w-full bg-card border border-border text-text-primary px-2 py-1 rounded-sm text-[11px] mb-1"
            value={item.title || ''}
            placeholder="Label"
            onChange={(e) => updateItem(idx, { title: e.target.value })}
          />
          <Input
            type="text"
            className="w-full bg-card border border-border text-text-primary px-2 py-1 rounded-sm text-[11px] mb-1"
            value={item.description || ''}
            placeholder="Description (optional)"
            onChange={(e) => updateItem(idx, { description: e.target.value })}
          />
          <Input
            type="text"
            className="w-full bg-card border border-border text-text-primary px-2 py-1 rounded-sm text-[11px] mb-1"
            value={item.imageUrl || ''}
            placeholder="Image URL (optional)"
            onChange={(e) => updateItem(idx, { imageUrl: e.target.value })}
          />
        </div>
      ))}
      <button
        className="btn btn-secondary w-full justify-center text-xs py-1.5"
        onClick={addItem}
      >
        + Add Event
      </button>
    </div>
  )
}
