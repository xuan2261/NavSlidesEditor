/**
 * Shape-specific properties: fill, stroke, opacity, corner radius, label text.
 */

export default function ShapeProperties({ element, onUpdate }) {
  return (
    <>
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
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
            Stroke
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
          Stroke Width: {element.strokeWidth || 0}px
        </div>
        <input
          type="range"
          min="0"
          max="20"
          value={element.strokeWidth || 0}
          onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>
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
      {(element.shape === 'rect' || element.shape === 'rounded-rect') && (
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
      {element.text && (
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
