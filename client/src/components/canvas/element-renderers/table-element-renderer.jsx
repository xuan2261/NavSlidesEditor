import { useState, useEffect, useRef } from 'react'

function safeCssColor(value, fallback) {
  const color = typeof value === 'string' ? value.trim() : ''
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(color)) return color
  if (/^hsla?\(\s*[\d.\s,%deg]+\)$/i.test(color)) return color
  if (['transparent', 'currentColor'].includes(color)) return color
  return fallback
}

function safeBorderStyle(value) {
  const style = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return ['solid', 'dashed', 'dotted', 'double', 'none'].includes(style) ? style : 'solid'
}

export function TableRenderer({ element, isEditing, onUpdateElement }) {
  const data = element.data || [['']]
  const headerBg = element.headerBgColor || 'rgba(99,102,241,0.3)'
  const cellBg = element.cellBgColor || 'transparent'
  const borderColor = element.borderColor || 'rgba(255,255,255,0.2)'
  const borderWidth = element.borderWidth ?? 1
  const textColor = element.textColor || '#ffffff'
  const headerTextColor = element.headerTextColor || textColor
  const fontSize = element.fontSize || 14
  const cellPadding = element.cellPadding || 8
  const cellStyles = element.cellStyles || {}
  const mergedCells = Array.isArray(element.mergedCells) ? element.mergedCells : []
  const mergeByStart = new Map()
  const coveredCells = new Set()
  mergedCells.forEach((merge) => {
    const row = Number(merge.row) || 0
    const col = Number(merge.col) || 0
    const rowSpan = Math.max(1, Number(merge.rowSpan) || 1)
    const colSpan = Math.max(1, Number(merge.colSpan) || 1)
    mergeByStart.set(`${row}:${col}`, { rowSpan, colSpan })
    for (let ri = row; ri < row + rowSpan; ri++) {
      for (let ci = col; ci < col + colSpan; ci++) {
        if (ri !== row || ci !== col) coveredCells.add(`${ri}:${ci}`)
      }
    }
  })
  const getCellStyle = (key, ri, ci) => cellStyles[key]?.[ri]?.[ci]
  const getBorderStyle = (ri, ci) => {
    const borders = getCellStyle('borders', ri, ci)
    if (!borders) return { border: `${borderWidth}px solid ${borderColor}` }
    const style = {}
    ;['top', 'right', 'bottom', 'left'].forEach((side) => {
      const border = borders[side] || {}
      const width = Number.isFinite(Number(border.width)) ? Math.max(0, Number(border.width)) : borderWidth
      const borderStyle = safeBorderStyle(border.style)
      const color = safeCssColor(border.color, borderColor)
      style[`border${side[0].toUpperCase()}${side.slice(1)}`] =
        `${width}px ${borderStyle} ${color}`
    })
    return style
  }

  const [focusCell, setFocusCell] = useState(null)
  const inputRefs = useRef({})

  useEffect(() => {
    if (isEditing && focusCell) {
      const key = `${focusCell.ri}-${focusCell.ci}`
      const input = inputRefs.current[key]
      if (input) {
        input.focus()
        if (typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(input.value.length, input.value.length)
        }
      }
    }
  }, [isEditing, focusCell])

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <table
        style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
      >
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri}>
              {(row || []).map((cell, ci) => {
                if (coveredCells.has(`${ri}:${ci}`)) return null
                const merge = mergeByStart.get(`${ri}:${ci}`)
                const isHeader = element.headerRow && ri === 0
                const cellTextColor = getCellStyle('textColors', ri, ci) || (isHeader ? headerTextColor : textColor)
                const cellBackground = getCellStyle('bgColors', ri, ci) || (isHeader ? headerBg : cellBg)
                const cellBold = getCellStyle('isBold', ri, ci)
                const textAlign = getCellStyle('aligns', ri, ci) || 'left'
                const verticalAlign = getCellStyle('vAligns', ri, ci) || 'top'
                return (
                  <td
                    key={ci}
                    colSpan={merge?.colSpan}
                    rowSpan={merge?.rowSpan}
                    onMouseDown={() => {
                      if (!isEditing) {
                        setFocusCell({ ri, ci })
                      }
                    }}
                    style={{
                      padding: cellPadding,
                      ...getBorderStyle(ri, ci),
                      background: cellBackground,
                      color: cellTextColor,
                      fontSize,
                      fontWeight: cellBold != null ? (cellBold ? 600 : 400) : isHeader ? 600 : 400,
                      textAlign,
                      verticalAlign,
                      overflow: 'hidden',
                    }}
                  >
                    {isEditing ? (
                      <textarea
                        ref={(el) => (inputRefs.current[`${ri}-${ci}`] = el)}
                        value={cell || ''}
                        onChange={(e) => {
                          const newData = data.map((r) => [...r])
                          newData[ri][ci] = e.target.value
                          onUpdateElement(element.id, { data: newData })
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'transparent',
                          border: 'none',
                          color: 'inherit',
                          fontSize: 'inherit',
                          fontWeight: 'inherit',
                          outline: 'none',
                          textAlign: 'inherit',
                          fontFamily: 'inherit',
                          resize: 'none',
                          overflow: 'hidden',
                        }}
                      />
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {cell || ''}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
