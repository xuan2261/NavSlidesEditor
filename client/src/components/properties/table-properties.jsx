import { Input, Select, ColorPicker } from '../../components/ui'
import { Button } from '../../components/ui'
/**
 * Table properties: row/col management, header, colors, cell editor.
 */
export default function TableProperties({ element, onUpdate }) {
  const data = element.data || [['']]
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[
          [
            '+Row',
            () => {
              const d = [...data]
              d.push(Array((d[0] || []).length).fill(''))
              onUpdate({ data: d })
            },
          ],
          [
            '-Row',
            () => {
              if (data.length > 1) onUpdate({ data: data.slice(0, -1) })
            },
          ],
          ['+Col', () => onUpdate({ data: data.map((r) => [...r, '']) })],
          [
            '-Col',
            () => {
              if ((data[0] || []).length > 1) onUpdate({ data: data.map((r) => r.slice(0, -1)) })
            },
          ],
        ].map(([label, fn]) => (
          <Button
            variant="secondary"
            key={label}
            style={{ flex: 1, fontSize: 11, padding: '4px 6px', justifyContent: 'center' }}
            onClick={fn}
          >
            {label}
          </Button>
        ))}
      </div>
      <label
        className="text-xs text-secondary"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          marginBottom: 8,
        }}
      >
        <input
          type="checkbox"
          checked={element.headerRow || false}
          onChange={(e) => onUpdate({ headerRow: e.target.checked })}
          style={{ accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Header row</span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        {[
          ['Header BG', 'headerBgColor', '#6366f1'],
          ['Text Color', 'textColor', '#ffffff'],
          ['Border', 'borderColor', '#555555'],
        ].map(([l, k, d]) => (
          <div key={k}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{l}</div>
            <ColorPicker
              className="w-9 h-7 border border-border rounded cursor-pointer p-[1px] bg-card shrink-0"
              value={element[k] || d}
              onChange={(e) => onUpdate({ [k]: e.target.value })}
              style={{
                width: '100%',
                height: 28,
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--bg-card)',
                cursor: 'pointer',
              }}
            />
          </div>
        ))}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Font Size</div>
          <Input
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            min="8"
            max="32"
            value={element.fontSize || 14}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
          />
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Edit Cells</div>
      <div
        style={{
          maxHeight: 200,
          overflow: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 4,
        }}
      >
        {data.map((row, ri) => (
          <div key={ri} style={{ display: 'flex' }}>
            {(row || []).map((cell, ci) => (
              <input
                key={ci}
                type="text"
                value={cell || ''}
                onChange={(e) => {
                  const d = data.map((r) => [...r])
                  d[ri][ci] = e.target.value
                  onUpdate({ data: d })
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '4px 6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: 11,
                  outline: 'none',
                  borderRadius: 0,
                }}
                placeholder={ri === 0 ? `H${ci + 1}` : `R${ri}C${ci + 1}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
