import { ColorPicker } from '../../components/ui'
import { clampNumber } from '../../utils/number-input'
import GameProperties from './game-properties.jsx'

/**
 * Misc element properties: callout, icon, qrcode, drawing, line/arrow, svg, html, latex, markdown, game.
 */
export default function MiscProperties({ element, onUpdate, onEditHtml, onEditLatex }) {
  const t = element.type

  if (t === 'game') {
    return <GameProperties element={element} onUpdate={onUpdate} onDelete={() => {}} />
  }

  if (t === 'html')
    return (
      <div className="mb-2.5">
        <button
          data-testid="prop-html-edit"
          className="btn btn-secondary w-full justify-center text-xs mb-1.5"
          onClick={onEditHtml}
        >
          Edit HTML / D3 Code
        </button>
        <p className="text-[11px] text-text-muted">
          Double-click element to open code editor
        </p>
      </div>
    )

  if (t === 'latex')
    return (
      <div className="mb-2.5">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Font Size</div>
            <input
              data-testid="prop-latex-font-size"
              className="prop-input"
              type="number"
              min="8"
              max="96"
              value={element.fontSize || 16}
              onChange={(e) => {
                const value = clampNumber(e.target.value, 8, 96, null)
                if (value === null) return
                onUpdate({ fontSize: value })
              }}
            />
          </div>
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Color</div>
            <ColorPicker
              data-testid="prop-latex-text-color"
              value={element.textColor || '#ffffff'}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
              className="w-full h-7 border border-border rounded cursor-pointer"
            />
          </div>
        </div>
        <button
          data-testid="prop-latex-edit"
          className="btn btn-secondary w-full justify-center text-xs mb-1.5"
          onClick={onEditLatex}
        >
          Edit LaTeX / TikZ
        </button>
        <p className="text-[11px] text-text-muted">
          Double-click element to open editor
        </p>
      </div>
    )

  if (t === 'markdown')
    return (
      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-1">
          Markdown Content
        </div>
        <textarea
          data-testid="prop-markdown-content"
          value={element.content || ''}
          onChange={(e) => onUpdate({ content: e.target.value })}
          className="w-full min-h-[120px] bg-hover border border-border text-text-primary px-2 py-1.5 rounded text-[11px] font-mono resize-y box-border"
          spellCheck={false}
        />
      </div>
    )

  if (t === 'callout')
    return (
      <div className="mb-2.5">
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[
            ['Number', 'calloutNumber', 1, 'number', { min: 1, max: 99 }],
            ['Font Size', 'fontSize', 16, 'number', { min: 8, max: 48 }],
          ].map(([l, k, d, type, extra]) => (
            <div key={k}>
              <div className="text-[11px] text-text-muted mb-0.5">{l}</div>
              <input
                className="prop-input"
                type={type}
                {...extra}
                value={element[k] || d}
                onChange={(e) => {
                  const min = extra?.min ?? null
                  const max = extra?.max ?? null
                  const value = clampNumber(e.target.value, min, max, null)
                  if (value === null) return
                  onUpdate({ [k]: value })
                }}
              />
            </div>
          ))}
          {[
            ['BG Color', 'calloutColor', '#ef4444'],
            ['Text Color', 'calloutTextColor', '#ffffff'],
          ].map(([l, k, d]) => (
            <div key={k}>
              <div className="text-[11px] text-text-muted mb-0.5">{l}</div>
              <ColorPicker
                value={element[k] || d}
                onChange={(e) => onUpdate({ [k]: e.target.value })}
                className="w-full h-7 border border-border rounded cursor-pointer"
              />
            </div>
          ))}
        </div>
      </div>
    )

  if (t === 'icon')
    return (
      <div className="mb-2.5">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Color</div>
            <ColorPicker
              value={element.iconColor || '#ffffff'}
              onChange={(e) => onUpdate({ iconColor: e.target.value })}
              className="w-full h-7 border border-border rounded cursor-pointer"
            />
          </div>
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Stroke</div>
            <input
              className="prop-input"
              type="number"
              min="0.5"
              max="4"
              step="0.5"
              value={element.iconStrokeWidth || 2}
              onChange={(e) => {
                const value = clampNumber(e.target.value, 0.5, 4, null)
                if (value === null) return
                onUpdate({ iconStrokeWidth: value })
              }}
            />
          </div>
        </div>
        <div className="text-[11px] text-text-muted mb-0.5">
          Icon: {element.iconName || 'Star'}
        </div>
      </div>
    )

  if (t === 'qrcode')
    return (
      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-1">
          QR Data / URL
        </div>
        <input
          className="prop-input mb-2"
          type="text"
          value={element.qrData || ''}
          onChange={(e) => onUpdate({ qrData: e.target.value })}
          placeholder="https://example.com"
        />
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[
            ['Foreground', 'qrColor', '#000000'],
            ['Background', 'qrBgColor', '#ffffff'],
          ].map(([l, k, d]) => (
            <div key={k}>
              <div className="text-[11px] text-text-muted mb-0.5">{l}</div>
              <ColorPicker
                value={element[k] || d}
                onChange={(e) => onUpdate({ [k]: e.target.value })}
                className="w-full h-8 border border-border rounded cursor-pointer"
              />
            </div>
          ))}
        </div>
        <div className="text-[11px] text-text-muted mb-1">
          Error Correction Level
        </div>
        <select
          className="prop-input px-1.5 py-1 mb-2"
          value={element.qrErrorLevel || 'M'}
          onChange={(e) => onUpdate({ qrErrorLevel: e.target.value })}
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
      <div className="mb-2.5">
        <div className="grid grid-cols-[1fr_80px] gap-2 mb-2">
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">
              Stroke Color
            </div>
            <ColorPicker
              value={element.strokeColor || '#ffffff'}
              onChange={(e) => onUpdate({ strokeColor: e.target.value })}
              className="w-full h-7 border border-border rounded cursor-pointer"
            />
          </div>
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Width</div>
            <input
              className="prop-input"
              type="number"
              min="1"
              max="20"
              value={element.strokeWidth || 3}
              onChange={(e) => {
                const value = clampNumber(e.target.value, 1, 20, null)
                if (value === null) return
                onUpdate({ strokeWidth: value })
              }}
            />
          </div>
        </div>
        <div className="text-[10px] text-text-muted">
          {(element.paths || []).length} path(s)
        </div>
      </div>
    )

  if (t === 'line')
    return (
      <div className="mb-2.5">
        <div className="grid grid-cols-[1fr_80px] gap-2 mb-2">
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">
              Stroke Color
            </div>
            <ColorPicker
              value={element.stroke || '#ffffff'}
              onChange={(e) => onUpdate({ stroke: e.target.value })}
              className="w-full h-7 border border-border rounded cursor-pointer"
            />
          </div>
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Width</div>
            <input
              className="prop-input"
              type="number"
              min="1"
              max="20"
              value={element.strokeWidth || 2}
              onChange={(e) => {
                const value = clampNumber(e.target.value, 1, 20, null)
                if (value === null) return
                onUpdate({ strokeWidth: value })
              }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[
            ['Start', 'arrowStart'],
            ['End', 'arrowEnd'],
          ].map(([l, k]) => (
            <div key={k}>
              <div className="text-[11px] text-text-muted mb-0.5">{l}</div>
              <select
                className="prop-input px-1.5 py-1"
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
        <div className="mb-2">
          <div className="text-[11px] text-text-muted mb-0.5">
            Dash Pattern
          </div>
          <select
            className="prop-input px-1.5 py-1"
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
      <div className="mb-2.5">
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[
            ['Fill Override', 'fillOverride', '#6366f1'],
            ['Stroke Override', 'strokeOverride', '#ffffff'],
          ].map(([l, k, d]) => (
            <div key={k}>
              <div className="text-[11px] text-text-muted mb-0.5">{l}</div>
              <ColorPicker
                value={element[k] || d}
                onChange={(e) => onUpdate({ [k]: e.target.value })}
                className="w-full h-7 border border-border rounded cursor-pointer"
              />
            </div>
          ))}
        </div>
        <button
          className="btn btn-secondary w-full text-[11px] px-2 py-1 justify-center mb-1"
          onClick={() => onUpdate({ fillOverride: null, strokeOverride: null })}
        >
          Reset Overrides
        </button>
      </div>
    )

  return null
}
