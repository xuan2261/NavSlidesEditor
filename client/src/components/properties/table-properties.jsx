import { useState } from 'react'
import { Button, Input, ColorPicker, Select } from '../../components/ui'
import { clampNumber } from '../../utils/number-input'
import { clampTableCell, normalizeTableShape } from './table-properties-utils'
export default function TableProperties({ element, onUpdate }) {
  const data = element.data || [['']]
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 })
  const clampedCell = clampTableCell(selectedCell, data)
  const cellStyles = element.cellStyles || {}
  const getCellStyle = (key, fallback) => cellStyles[key]?.[clampedCell.row]?.[clampedCell.col] ?? fallback
  const updateCellStyle = (key, value) => {
    const next = { ...cellStyles, [key]: (cellStyles[key] || []).map((row) => [...(row || [])]) }
    while (next[key].length < data.length) next[key].push([])
    while (next[key][clampedCell.row].length < (data[clampedCell.row] || []).length) {
      next[key][clampedCell.row].push(null)
    }
    next[key][clampedCell.row][clampedCell.col] = value
    onUpdate({ cellStyles: next })
  }

  return (
    <div className="mb-2.5">
      <div className="flex gap-1.5 mb-2">
        {[
          [
            '+Row',
            'prop-table-add-row',
            () => {
              const d = [...data]
              d.push(Array((d[0] || []).length).fill(''))
              onUpdate(normalizeTableShape({ data: d }, element))
            },
          ],
          [
            '-Row',
            'prop-table-remove-row',
            () => {
              if (data.length > 1) onUpdate(normalizeTableShape({ data: data.slice(0, -1) }, element))
            },
          ],
          [
            '+Col',
            'prop-table-add-col',
            () => onUpdate(normalizeTableShape({ data: data.map((r) => [...r, '']) }, element)),
          ],
          [
            '-Col',
            'prop-table-remove-col',
            () => {
              if ((data[0] || []).length > 1) {
                onUpdate(normalizeTableShape({ data: data.map((r) => r.slice(0, -1)) }, element))
              }
            },
          ],
        ].map(([label, testId, fn]) => (
          <Button
            data-testid={testId}
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
          data-testid="prop-table-header-row"
          type="checkbox"
          checked={element.headerRow || false}
          onChange={(e) => onUpdate({ headerRow: e.target.checked })}
          className="accent-accent"
        />
        <span className="text-xs text-text-secondary">Header row</span>
      </label>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {[
          ['Header BG', 'headerBgColor', '#6366f1', 'prop-table-header-bg'],
          ['Header Text', 'headerTextColor', '#ffffff', 'prop-table-header-text-color'],
          ['Text Color', 'textColor', '#ffffff', 'prop-table-text-color'],
          ['Border', 'borderColor', '#555555', 'prop-table-border-color'],
        ].map(([l, k, d, testId]) => (
          <div key={k}>
            <div className="text-[11px] text-text-muted mb-0.5">{l}</div>
            <ColorPicker
              data-testid={testId}
              className="w-full h-7 border border-border rounded cursor-pointer bg-card"
              value={element[k] || d}
              onChange={(e) => onUpdate({ [k]: e.target.value })}
            />
          </div>
        ))}
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Border Style</div>
          <Select
            data-testid="prop-table-border-style"
            className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs"
            value={element.borderStyle || 'solid'}
            onChange={(e) => onUpdate({ borderStyle: e.target.value })}
          >
            {['solid', 'dashed', 'dotted', 'double'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Font Size</div>
          <Input
            data-testid="prop-table-font-size"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            min="8"
            max="32"
            value={element.fontSize || 14}
            onChange={(e) => {
              const value = clampNumber(e.target.value, 8, 32, null)
              if (value === null) return
              onUpdate({ fontSize: value })
            }}
          />
        </div>
      </div>
      <div className="text-[11px] text-text-muted mb-1">Edit Cells</div>
      <div className="max-h-[200px] overflow-auto border border-border rounded">
        {data.map((row, ri) => (
          <div key={ri} className="flex">
            {(row || []).map((cell, ci) => (
              <input
                data-testid={`prop-table-cell-${ri}-${ci}`}
                key={ci}
                type="text"
                value={cell || ''}
                onFocus={() => setSelectedCell({ row: ri, col: ci })}
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
      <div className="text-[11px] text-text-muted mt-2 mb-1">
        Selected Cell R{clampedCell.row + 1}C{clampedCell.col + 1}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Cell BG</div>
          <ColorPicker
            data-testid="prop-table-cell-bg"
            className="w-full h-7 border border-border rounded cursor-pointer bg-card"
            value={getCellStyle('bgColors', element.cellBgColor || '#1e1e2e')}
            onChange={(e) => updateCellStyle('bgColors', e.target.value)}
          />
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Cell Text</div>
          <ColorPicker
            data-testid="prop-table-cell-text"
            className="w-full h-7 border border-border rounded cursor-pointer bg-card"
            value={getCellStyle('textColors', element.textColor || '#ffffff')}
            onChange={(e) => updateCellStyle('textColors', e.target.value)}
          />
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
          <input
            data-testid="prop-table-cell-bold"
            type="checkbox"
            checked={Boolean(getCellStyle('isBold', false))}
            onChange={(e) => updateCellStyle('isBold', e.target.checked)}
            className="accent-accent"
          />
          <span>Cell Bold</span>
        </label>
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Cell Align</div>
          <Select
            data-testid="prop-table-cell-align"
            className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs"
            value={getCellStyle('aligns', 'left')}
            onChange={(e) => updateCellStyle('aligns', e.target.value)}
          >
            {['left', 'center', 'right', 'justify'].map((align) => (
              <option key={align} value={align}>
                {align}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Cell VAlign</div>
          <Select
            data-testid="prop-table-cell-valign"
            className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs"
            value={getCellStyle('vAligns', 'middle')}
            onChange={(e) => updateCellStyle('vAligns', e.target.value)}
          >
            {['top', 'middle', 'bottom'].map((align) => (
              <option key={align} value={align}>
                {align}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  )
}
