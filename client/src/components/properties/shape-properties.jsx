import { Input, Select, ColorPicker } from '../../components/ui'
import { clampNumber } from '../../utils/number-input'
import { computeMixedValues } from '../../utils/selection-mixed-values'
/**
 * Shape and Line specific properties.
 */

const CONNECTION_ANCHORS = [
  ['center', 'Center'], ['n', 'Top'], ['ne', 'Top right'], ['e', 'Right'], ['se', 'Bottom right'],
  ['s', 'Bottom'], ['sw', 'Bottom left'], ['w', 'Left'], ['nw', 'Top left'],
]

function connectionPatch(connections, endpointName, change) {
  const next = { ...(connections || {}) }
  if (!change) delete next[endpointName]
  else next[endpointName] = change
  return Object.keys(next).length ? next : undefined
}

export default function ShapeProperties({ element, onUpdate, elements, selectedElementIds }) {
  const isLine = element.type === 'line'
  const mixed = computeMixedValues(elements || [], selectedElementIds || [], [
    'opacity',
    'fill',
    'stroke',
    'textColor',
  ])

  return (
    <>
      <div className={`grid ${isLine ? 'grid-cols-1' : 'grid-cols-2'} gap-2 mb-2.5`}>
        {!isLine && (
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-text-muted">Fill</div>
            <ColorPicker
              data-testid="prop-shape-fill"
              aria-label="Shape fill color"
              data-mixed={mixed.fill?.isMixed ? 'true' : undefined}
              className="w-full h-8 border border-border rounded cursor-pointer shrink-0"
              value={element.fill || '#6366f1'}
              onChange={(e) => onUpdate({ fill: e.target.value })}
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">Stroke Color</div>
          <ColorPicker
            data-testid="prop-shape-stroke"
            aria-label={isLine ? 'Line color' : 'Shape stroke color'}
            data-mixed={mixed.stroke?.isMixed ? 'true' : undefined}
            className="w-full h-8 border border-border rounded cursor-pointer shrink-0"
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
          data-testid="prop-shape-stroke-width"
          aria-label={isLine ? 'Line width' : 'Shape stroke width'}
          type="range"
          className="w-full accent-accent"
          min={isLine ? '1' : '0'}
          max="20"
          value={element.strokeWidth || (isLine ? 2 : 0)}
          onChange={(e) => {
            const value = clampNumber(e.target.value, isLine ? 1 : 0, 20, null)
            if (value === null) return
            onUpdate({ strokeWidth: value })
          }}
        />
      </div>

      {isLine && (
        <>
          <div className="flex flex-col gap-1 mb-2.5">
            <div className="text-[11px] text-text-muted">Line Style</div>
            <Select
              aria-label="Line style"
              className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
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
                aria-label="Line start marker"
                className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
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
                aria-label="Line end marker"
                className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
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
          {(() => {
            const targets = (elements || []).filter(
              (candidate) => candidate.id !== element.id && candidate.type !== 'line'
            )
            const targetIds = new Set(targets.map((candidate) => candidate.id))
            const controls = [['start', 'Start'], ['end', 'End']]
            return (
              <fieldset className="mb-2.5 rounded border border-border p-2" disabled={element.locked}>
                <legend className="px-1 text-[11px] text-text-muted">Connector attachments</legend>
                {controls.map(([endpointName, label]) => {
                  const connection = element.connections?.[endpointName]
                  const unavailable = connection && !targetIds.has(connection.targetId)
                  return (
                    <div key={endpointName} className="grid grid-cols-2 gap-2 mb-2 last:mb-0">
                      <label className="flex flex-col gap-1 text-[11px] text-text-muted">
                        {label} target
                        <Select
                          aria-label={`${label} connector target`}
                          value={connection?.targetId || ''}
                          onChange={(event) => {
                            const targetId = event.target.value
                            onUpdate({
                              connections: connectionPatch(
                                element.connections,
                                endpointName,
                                targetId ? { targetId, anchor: connection?.anchor || 'center' } : null
                              ),
                            })
                          }}
                        >
                          <option value="">Free endpoint</option>
                          {unavailable && <option value={connection.targetId}>Target unavailable</option>}
                          {targets.map((target) => (
                            <option key={target.id} value={target.id}>
                              {target.name || target.title || `${target.type} ${target.id}`}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] text-text-muted">
                        {label} anchor
                        <Select
                          aria-label={`${label} connector anchor`}
                          disabled={!connection}
                          value={connection?.anchor || 'center'}
                          onChange={(event) => onUpdate({
                            connections: connectionPatch(element.connections, endpointName, {
                              targetId: connection.targetId,
                              anchor: event.target.value,
                            }),
                          })}
                        >
                          {CONNECTION_ANCHORS.map(([value, anchorLabel]) => (
                            <option key={value} value={value}>{anchorLabel}</option>
                          ))}
                        </Select>
                      </label>
                    </div>
                  )
                })}
              </fieldset>
            )
          })()}
        </>
      )}

      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-1">
          Opacity: {mixed.opacity?.isMixed ? '—' : `${Math.round((element.opacity ?? 1) * 100)}%`}
        </div>
        <input
          data-testid="prop-shape-opacity"
          data-mixed={mixed.opacity?.isMixed ? 'true' : undefined}
          aria-label={isLine ? 'Line opacity' : 'Shape opacity'}
          type="range"
          className="w-full accent-accent"
          min="0"
          max="100"
          value={Math.round((element.opacity ?? 1) * 100)}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 100, null)
            if (value === null) return
            onUpdate({ opacity: value / 100 })
          }}
        />
      </div>

      {!isLine && (element.shape === 'rect' || element.shape === 'rounded-rect') && (
        <div className="mb-2.5">
          <div className="text-[11px] text-text-muted mb-1">
            Corner Radius: {element.borderRadius || 0}px
          </div>
          <input
            data-testid="prop-shape-border-radius"
            aria-label="Shape corner radius"
            type="range"
            className="w-full accent-accent"
            min="0"
            max="100"
            value={element.borderRadius || 0}
            onChange={(e) => {
              const value = clampNumber(e.target.value, 0, 100, null)
              if (value === null) return
              onUpdate({ borderRadius: value })
            }}
          />
        </div>
      )}

      {!isLine && (
        <div className="flex flex-col gap-1 mb-2.5">
          <div className="text-[11px] text-text-muted">Label Text</div>
          <Input
            data-testid="prop-shape-label"
            aria-label="Shape label text"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
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
              data-testid="prop-shape-text-size"
              aria-label="Shape label text size"
              className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
              type="number"
              min="8"
              max="144"
              value={element.fontSize || 16}
              onChange={(e) => {
                const value = clampNumber(e.target.value, 8, 144, null)
                if (value === null) return
                onUpdate({ fontSize: value })
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-text-muted">Text Color</div>
            <ColorPicker
              data-testid="prop-shape-text-color"
              aria-label="Shape label text color"
              data-mixed={mixed.textColor?.isMixed ? 'true' : undefined}
              className="w-full h-8 border border-border rounded cursor-pointer shrink-0"
              value={element.textColor || '#ffffff'}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
            />
          </div>
        </div>
      )}
    </>
  )
}
