/**
 * Common element controls shared across all element types:
 * Position (X/Y/W/H/Rotation), Lock, Fragment animation, Drop Shadow, Layer buttons, Delete.
 */

export default function CommonElementControls({
  element,
  onUpdate,
  onBringForward,
  onSendBackward,
  onDelete,
}) {
  return (
    <>
      {/* Position */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>X</div>
          <input
            className="prop-input"
            type="number"
            value={Math.round(element.x)}
            onChange={(e) => onUpdate({ x: Number(e.target.value) })}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Y</div>
          <input
            className="prop-input"
            type="number"
            value={Math.round(element.y)}
            onChange={(e) => onUpdate({ y: Number(e.target.value) })}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Rot</div>
          <input
            className="prop-input"
            type="number"
            step="1"
            value={Math.round(element.rotation || 0)}
            onChange={(e) => onUpdate({ rotation: Number(e.target.value) % 360 })}
            title="Rotation angle in degrees"
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>W</div>
          <input
            className="prop-input"
            type="number"
            value={Math.round(element.width)}
            onChange={(e) => onUpdate({ width: Number(e.target.value) })}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>H</div>
          <input
            className="prop-input"
            type="number"
            value={Math.round(element.height)}
            onChange={(e) => onUpdate({ height: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* Lock */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          marginBottom: 8,
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={element.locked || false}
          onChange={(e) => onUpdate({ locked: e.target.checked })}
          style={{ accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {element.locked ? '🔒' : '🔓'} Lock element
        </span>
      </label>

      {/* Fragment animation */}
      <div style={{ marginBottom: 10 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={element.fragment || false}
            onChange={(e) =>
              onUpdate({
                fragment: e.target.checked,
                fragmentIndex: element.fragmentIndex ?? 1,
              })
            }
            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Fragment (animate in)
          </span>
        </label>
        {element.fragment && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                Order
              </div>
              <input
                className="prop-input"
                type="number"
                min="1"
                max="20"
                value={element.fragmentIndex ?? 1}
                onChange={(e) => onUpdate({ fragmentIndex: Number(e.target.value) })}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                Animation
              </div>
              <select
                className="prop-input"
                style={{ padding: '4px 6px' }}
                value={element.fragmentAnimation || 'fade-in'}
                onChange={(e) => onUpdate({ fragmentAnimation: e.target.value })}
              >
                <option value="fade-in">Fade In</option>
                <option value="fade-out">Fade Out</option>
                <option value="fade-up">Fade Up</option>
                <option value="fade-down">Fade Down</option>
                <option value="fade-left">Fade Left</option>
                <option value="fade-right">Fade Right</option>
                <option value="grow">Grow</option>
                <option value="shrink">Shrink</option>
                <option value="zoom-in">Zoom In</option>
                <option value="highlight-red">Highlight Red</option>
                <option value="highlight-green">Highlight Green</option>
                <option value="highlight-blue">Highlight Blue</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Drop Shadow */}
      {element.type !== 'html' && element.type !== 'code' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Drop Shadow
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 28px',
              gap: 6,
              alignItems: 'end',
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>X</div>
              <input
                className="prop-input"
                type="number"
                value={element.shadowX ?? 0}
                onChange={(e) => onUpdate({ shadowX: Number(e.target.value) })}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Y</div>
              <input
                className="prop-input"
                type="number"
                value={element.shadowY ?? 0}
                onChange={(e) => onUpdate({ shadowY: Number(e.target.value) })}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                Blur
              </div>
              <input
                className="prop-input"
                type="number"
                min="0"
                value={element.shadowBlur ?? 0}
                onChange={(e) => onUpdate({ shadowBlur: Number(e.target.value) })}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}></div>
              <input
                type="color"
                style={{
                  width: 28,
                  height: 28,
                  padding: 2,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                value={element.shadowColor || '#000000'}
                onChange={(e) => onUpdate({ shadowColor: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Layer buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button
          className="btn btn-secondary"
          style={{ flex: 1, fontSize: 11, padding: '5px 8px', justifyContent: 'center' }}
          onClick={onBringForward}
        >
          ↑ Forward
        </button>
        <button
          className="btn btn-secondary"
          style={{ flex: 1, fontSize: 11, padding: '5px 8px', justifyContent: 'center' }}
          onClick={onSendBackward}
        >
          ↓ Backward
        </button>
      </div>

      {/* Delete */}
      <button
        className="btn btn-danger"
        style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
        onClick={onDelete}
      >
        Delete Element
      </button>
    </>
  )
}
