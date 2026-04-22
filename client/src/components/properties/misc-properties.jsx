import { ColorPicker } from '../../components/ui'

/**
 * Misc element properties: callout, icon, qrcode, drawing, line/arrow, svg, html, latex, markdown.
 */
export default function MiscProperties({ element, onUpdate, onEditHtml, onEditLatex }) {
  const t = element.type

  if (t === 'html')
    return (
      <div style={{ marginBottom: 10 }}>
        <button
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginBottom: 6 }}
          onClick={onEditHtml}
        >
          Edit HTML / D3 Code
        </button>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Double-click element to open code editor
        </p>
      </div>
    )

  if (t === 'latex')
    return (
      <div style={{ marginBottom: 10 }}>
        <button
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginBottom: 6 }}
          onClick={onEditLatex}
        >
          Edit LaTeX / TikZ
        </button>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Double-click element to open editor
        </p>
      </div>
    )

  if (t === 'markdown')
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          Markdown Content
        </div>
        <textarea
          value={element.content || ''}
          onChange={(e) => onUpdate({ content: e.target.value })}
          style={{
            width: '100%',
            minHeight: 120,
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            padding: '6px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontFamily: 'monospace',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
          spellCheck={false}
        />
      </div>
    )

  if (t === 'callout')
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            ['Number', 'calloutNumber', 1, 'number', { min: 1, max: 99 }],
            ['Font Size', 'fontSize', 16, 'number', { min: 8, max: 48 }],
          ].map(([l, k, d, type, extra]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{l}</div>
              <input
                className="prop-input"
                type={type}
                {...extra}
                value={element[k] || d}
                onChange={(e) => onUpdate({ [k]: Number(e.target.value) })}
              />
            </div>
          ))}
          {[
            ['BG Color', 'calloutColor', '#ef4444'],
            ['Text Color', 'calloutTextColor', '#ffffff'],
          ].map(([l, k, d]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{l}</div>
              <ColorPicker
                value={element[k] || d}
                onChange={(e) => onUpdate({ [k]: e.target.value })}
                style={{
                  width: '100%',
                  height: 28,
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    )

  if (t === 'icon')
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Color</div>
            <ColorPicker
              value={element.iconColor || '#ffffff'}
              onChange={(e) => onUpdate({ iconColor: e.target.value })}
              style={{
                width: '100%',
                height: 28,
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Stroke</div>
            <input
              className="prop-input"
              type="number"
              min="0.5"
              max="4"
              step="0.5"
              value={element.iconStrokeWidth || 2}
              onChange={(e) => onUpdate({ iconStrokeWidth: Number(e.target.value) })}
            />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
          Icon: {element.iconName || 'Star'}
        </div>
      </div>
    )

  if (t === 'qrcode')
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          QR Data / URL
        </div>
        <input
          className="prop-input"
          type="text"
          value={element.qrData || ''}
          onChange={(e) => onUpdate({ qrData: e.target.value })}
          placeholder="https://example.com"
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            ['Foreground', 'qrColor', '#000000'],
            ['Background', 'qrBgColor', '#ffffff'],
          ].map(([l, k, d]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{l}</div>
              <ColorPicker
                value={element[k] || d}
                onChange={(e) => onUpdate({ [k]: e.target.value })}
                style={{
                  width: '100%',
                  height: 32,
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          Error Correction Level
        </div>
        <select
          className="prop-input"
          value={element.qrErrorLevel || 'M'}
          onChange={(e) => onUpdate({ qrErrorLevel: e.target.value })}
          style={{ padding: '4px 6px', marginBottom: 8 }}
        >
          <option value="L">L - Low (7%)</option>
          <option value="M">M - Medium (15%)</option>
          <option value="Q">Q - Quartile (25%)</option>
          <option value="H">H - High (30%)</option>
        </select>
      </div>
    )

  if (t === 'drawing')
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
              Stroke Color
            </div>
            <ColorPicker
              value={element.strokeColor || '#ffffff'}
              onChange={(e) => onUpdate({ strokeColor: e.target.value })}
              style={{
                width: '100%',
                height: 28,
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Width</div>
            <input
              className="prop-input"
              type="number"
              min="1"
              max="20"
              value={element.strokeWidth || 3}
              onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
            />
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {(element.paths || []).length} path(s)
        </div>
      </div>
    )

  if (t === 'line')
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
              Stroke Color
            </div>
            <ColorPicker
              value={element.stroke || '#ffffff'}
              onChange={(e) => onUpdate({ stroke: e.target.value })}
              style={{
                width: '100%',
                height: 28,
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Width</div>
            <input
              className="prop-input"
              type="number"
              min="1"
              max="20"
              value={element.strokeWidth || 2}
              onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            ['Start', 'arrowStart'],
            ['End', 'arrowEnd'],
          ].map(([l, k]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{l}</div>
              <select
                className="prop-input"
                style={{ padding: '4px 6px' }}
                value={element[k] || 'none'}
                onChange={(e) => onUpdate({ [k]: e.target.value })}
              >
                {['none', 'arrow', 'diamond', 'circle', 'square'].map((v) => (
                  <option key={v} value={v}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
            Dash Pattern
          </div>
          <select
            className="prop-input"
            style={{ padding: '4px 6px' }}
            value={element.dashArray || ''}
            onChange={(e) => onUpdate({ dashArray: e.target.value })}
          >
            <option value="">Solid</option>
            <option value="8 4">Dashed</option>
            <option value="2 4">Dotted</option>
            <option value="12 4 4 4">Dash-dot</option>
          </select>
        </div>
      </div>
    )

  if (t === 'svg')
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            ['Fill Override', 'fillOverride', '#6366f1'],
            ['Stroke Override', 'strokeOverride', '#ffffff'],
          ].map(([l, k, d]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{l}</div>
              <ColorPicker
                value={element[k] || d}
                onChange={(e) => onUpdate({ [k]: e.target.value })}
                style={{
                  width: '100%',
                  height: 28,
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              />
            </div>
          ))}
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => onUpdate({ fillOverride: null, strokeOverride: null })}
          style={{
            width: '100%',
            fontSize: 11,
            padding: '4px 8px',
            justifyContent: 'center',
            marginBottom: 4,
          }}
        >
          Reset Overrides
        </button>
      </div>
    )

  return null
}
