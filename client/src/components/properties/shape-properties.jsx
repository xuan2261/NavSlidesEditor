/**
 * Shape and Line specific properties.
 */

export default function ShapeProperties({ element, onUpdate }) {
  const isLine = element.type === 'line'

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isLine ? '1fr' : '1fr 1fr',
          gap: 8,
          marginBottom: 10,
        }}
      >
        {!isLine && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
              Fill
            </div>
            <input
              type="color"
              style={{
                width: '100%',
                height: 32,
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--bg-card)',
                cursor: 'pointer',
              }}
              value={element.fill || '#6366f1'}
              onChange={(e) => onUpdate({ fill: e.target.value })}
            />
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
            Stroke Color
          </div>
          <input
            type="color"
            style={{
              width: '100%',
              height: 32,
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'var(--bg-card)',
              cursor: 'pointer',
            }}
            value={
              element.stroke === 'none' || !element.stroke
                ? '#ffffff'
                : element.stroke
            }
            onChange={(e) => onUpdate({ stroke: e.target.value })}
          />
        </div>
      </div>
      
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
          Stroke Width: {element.strokeWidth || (isLine ? 2 : 0)}px
        </div>
        <input
          type="range"
          min={isLine ? "1" : "0"}
          max="20"
          value={element.strokeWidth || (isLine ? 2 : 0)}
          onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>

      {isLine && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
              Line Style
            </div>
            <select
              className="prop-input"
              value={element.dashArray || ''}
              onChange={(e) => onUpdate({ dashArray: e.target.value })}
            >
              <option value="">Solid</option>
              <option value="5,5">Dashed</option>
              <option value="10,5">Long Dashed</option>
              <option value="2,4">Dotted</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                Start Marker
              </div>
              <select
                className="prop-input"
                value={element.arrowStart || 'none'}
                onChange={(e) => onUpdate({ arrowStart: e.target.value })}
              >
                <option value="none">None</option>
                <option value="arrow">Arrow</option>
                <option value="circle">Circle</option>
                <option value="square">Square</option>
                <option value="diamond">Diamond</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                End Marker
              </div>
              <select
                className="prop-input"
                value={element.arrowEnd || 'none'}
                onChange={(e) => onUpdate({ arrowEnd: e.target.value })}
              >
                <option value="none">None</option>
                <option value="arrow">Arrow</option>
                <option value="circle">Circle</option>
                <option value="square">Square</option>
                <option value="diamond">Diamond</option>
              </select>
            </div>
          </div>
        </>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
          Opacity: {Math.round((element.opacity ?? 1) * 100)}%
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round((element.opacity ?? 1) * 100)}
          onChange={(e) => onUpdate({ opacity: Number(e.target.value) / 100 })}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>
      
      {!isLine && (element.shape === 'rect' || element.shape === 'rounded-rect') && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
            Corner Radius: {element.borderRadius || 0}px
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={element.borderRadius || 0}
            onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>
      )}
      
      {!isLine && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
            Label Text
          </div>
          <input
            className="prop-input"
            type="text"
            value={element.text || ''}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Text inside shape"
          />
        </div>
      )}
      
      {!isLine && element.text && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
              Text Size
            </div>
            <input
              className="prop-input"
              type="number"
              min="8"
              max="144"
              value={element.fontSize || 16}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
              style={{ padding: '4px 6px' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
              Text Color
            </div>
            <input
              type="color"
              style={{
                width: '100%',
                height: 32,
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--bg-card)',
                cursor: 'pointer',
              }}
              value={element.textColor || '#ffffff'}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
            />
          </div>
        </div>
      )}
    </>
  )
}
