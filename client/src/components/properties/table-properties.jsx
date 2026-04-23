import { Input, ColorPicker } from '../../components/ui'
import { Button } from '../../components/ui'
/**
 * Table properties: row/col management, header, colors, cell editor.
 */
export default function TableProperties({ element, onUpdate }) {
  const data = element.data || [['']];
  return (
    <div className="mb-2.5">
      <div className="flex gap-1.5 mb-2">
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
            className="flex-1 text-[11px] px-1.5 py-1 justify-center"
            onClick={fn}
          >
            {label}
          </Button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer mb-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={element.headerRow || false}
          onChange={(e) => onUpdate({ headerRow: e.target.checked })}
          className="accent-accent"
        />
        <span className="text-xs text-text-secondary">Header row</span>
      </label>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {[
          ['Header BG', 'headerBgColor', '#6366f1'],
          ['Text Color', 'textColor', '#ffffff'],
          ['Border', 'borderColor', '#555555'],
        ].map(([l, k, d]) => (
          <div key={k}>
            <div className="text-[11px] text-text-muted mb-0.5">{l}</div>
            <ColorPicker
              className="w-full h-7 border border-border rounded cursor-pointer bg-card"
              value={element[k] || d}
              onChange={(e) => onUpdate({ [k]: e.target.value })}
            />
          </div>
        ))}
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Font Size</div>
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
      <div className="text-[11px] text-text-muted mb-1">Edit Cells</div>
      <div className="max-h-[200px] overflow-auto border border-border rounded">
        {data.map((row, ri) => (
          <div key={ri} className="flex">
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
                className="flex-1 min-w-0 px-1.5 py-1 border border-border bg-card text-text-primary text-[11px] outline-none rounded-none"
                placeholder={ri === 0 ? `H${ci + 1}` : `R${ri}C${ci + 1}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
