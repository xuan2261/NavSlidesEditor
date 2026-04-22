import { Input, Select } from '../../components/ui'
/**
 * Shape and Line specific properties.
 */

export default function ShapeProperties({ element, onUpdate }) {
  const isLine = element.type === 'line'

  return (
    <>
      <div className={`grid ${isLine ? 'grid-cols-1' : 'grid-cols-2'} gap-2 mb-2.5`}>
        {!isLine && (
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-text-muted">Fill</div>
            <input
              type="color"
              className="w-full h-8 border border-border rounded cursor-pointer p-[1px] bg-card shrink-0"
              value={element.fill || '#6366f1'}
              onChange={(e) => onUpdate({ fill: e.target.value })}
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">Stroke Color</div>
          <input
            type="color"
            className="w-full h-8 border border-border rounded cursor-pointer p-[1px] bg-card shrink-0"
            value={element.stroke === 'none' || !element.stroke ? '#ffffff' : element.stroke}
            onChange={(e) => onUpdate({ stroke: e.target.value })}
          />
        </div>
      </div>

      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-1">
          Stroke Width: {element.strokeWidth || (isLine ? 2 : 0)}px
        </div>
        <input
          type="range"
          className="w-full accent-accent"
          min={isLine ? '1' : '0'}
          max="20"
          value={element.strokeWidth || (isLine ? 2 : 0)}
          onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
        />
      </div>

      {isLine && (
        <>
          <div className="flex flex-col gap-1 mb-2.5">
            <div className="text-[11px] text-text-muted">Line Style</div>
            <Select
              className="w-full bg-card border border-border text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-muted"
              value={element.dashArray || ''}
              onChange={(e) => onUpdate({ dashArray: e.target.value })}
            >
              <option value="">Solid</option>
              <option value="5,5">Dashed</option>
              <option value="10,5">Long Dashed</option>
              <option value="2,4">Dotted</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div className="flex flex-col gap-1">
              <div className="text-[11px] text-text-muted">Start Marker</div>
              <Select
                className="w-full bg-card border border-border text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-muted"
                value={element.arrowStart || 'none'}
                onChange={(e) => onUpdate({ arrowStart: e.target.value })}
              >
                <option value="none">None</option>
                <option value="arrow">Arrow</option>
                <option value="circle">Circle</option>
                <option value="square">Square</option>
                <option value="diamond">Diamond</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[11px] text-text-muted">End Marker</div>
              <Select
                className="w-full bg-card border border-border text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-muted"
                value={element.arrowEnd || 'none'}
                onChange={(e) => onUpdate({ arrowEnd: e.target.value })}
              >
                <option value="none">None</option>
                <option value="arrow">Arrow</option>
                <option value="circle">Circle</option>
                <option value="square">Square</option>
                <option value="diamond">Diamond</option>
              </Select>
            </div>
          </div>
        </>
      )}

      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-1">
          Opacity: {Math.round((element.opacity ?? 1) * 100)}%
        </div>
        <input
          type="range"
          className="w-full accent-accent"
          min="0"
          max="100"
          value={Math.round((element.opacity ?? 1) * 100)}
          onChange={(e) => onUpdate({ opacity: Number(e.target.value) / 100 })}
        />
      </div>

      {!isLine && (element.shape === 'rect' || element.shape === 'rounded-rect') && (
        <div className="mb-2.5">
          <div className="text-[11px] text-text-muted mb-1">
            Corner Radius: {element.borderRadius || 0}px
          </div>
          <input
            type="range"
            className="w-full accent-accent"
            min="0"
            max="100"
            value={element.borderRadius || 0}
            onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })}
          />
        </div>
      )}

      {!isLine && (
        <div className="flex flex-col gap-1 mb-2.5">
          <div className="text-[11px] text-text-muted">Label Text</div>
          <Input
            className="w-full bg-card border border-border text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-muted"
            type="text"
            value={element.text || ''}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Text inside shape"
          />
        </div>
      )}

      {!isLine && element.text && (
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-text-muted">Text Size</div>
            <Input
              className="w-full bg-card border border-border text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-muted"
              type="number"
              min="8"
              max="144"
              value={element.fontSize || 16}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-text-muted">Text Color</div>
            <input
              type="color"
              className="w-full h-8 border border-border rounded cursor-pointer p-[1px] bg-card shrink-0"
              value={element.textColor || '#ffffff'}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
            />
          </div>
        </div>
      )}
    </>
  )
}
