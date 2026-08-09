import { useState, useEffect, useRef } from 'react'
import { resolveColorField, resolveMergedCells } from 'revealjs-shared'

function safeCssColor(value, fallback) {
  const color = typeof value === 'string' ? value.trim() : ''
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(color)) return color
  if (/^hsla?\(\s*[\d.\s,%deg]+\)$/i.test(color)) return color
  if (/^var\(--ns-[a-z0-9-]+\)$/.test(color)) return color
  if (['transparent', 'currentColor'].includes(color)) return color
  return fallback
}

function safeBorderStyle(value) {
  const style = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return ['solid', 'dashed', 'dotted', 'double', 'none'].includes(style) ? style : 'solid'
}

function safeFontSize(value, fallback) {
  const size = Number(value)
  return Number.isFinite(size) && size > 0 ? Math.round(size * 10) / 10 : fallback
}

function safeFontFamily(value) {
  const family = typeof value === 'string' ? value.trim() : ''
  if (!family) return undefined
  if ([...family].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return undefined
  if (/[;:()\\/]/.test(family)) return undefined
  if (/\/\*|\*\/|url|import|expression|javascript|behavior|binding/i.test(family)) return undefined
  return /^[a-zA-Z0-9 _.-]+$/.test(family) ? family : undefined
}

export function TableRenderer({ element, isEditing, onUpdateElement }) {
  const data = Array.isArray(element.data) && element.data.length ? element.data : [['']]
  const headerBg = resolveColorField(element.headerBgColor, 'table', 'headerBgColor') || 'rgba(99,102,241,0.3)'
  const cellBg = resolveColorField(element.cellBgColor, 'table', 'cellBgColor') || 'transparent'
  const borderColor = resolveColorField(element.borderColor, 'table', 'borderColor') || 'rgba(20,20,19,0.22)'
  const borderWidth = element.borderWidth ?? 1
  const textColor = resolveColorField(element.textColor, 'table', 'textColor') || '#141413'
  const headerTextColor = resolveColorField(element.headerTextColor, 'table', 'headerTextColor') || textColor
  const fontSize = element.fontSize || 14
  const cellPadding = element.cellPadding || 8
  const cellStyles = element.cellStyles || {}
  const { spans: mergeByStart, covered: coveredCells } = resolveMergedCells(element.mergedCells)
  const getCellStyle = (key, ri, ci) => cellStyles[key]?.[ri]?.[ci]
  const colWidths = Array.isArray(element.colWidths) ? element.colWidths : []
  const rowHeights = Array.isArray(element.rowHeights) ? element.rowHeights : []
  const tableBorderStyle = safeBorderStyle(element.borderStyle)
  const getBorderStyle = (ri, ci) => {
    const borders = getCellStyle('borders', ri, ci)
    if (!borders) return { border: `${borderWidth}px ${tableBorderStyle} ${borderColor}` }
    const style = {}
    ;['top', 'right', 'bottom', 'left'].forEach((side) => {
      const border = borders[side] || {}
      const width = Number.isFinite(Number(border.width)) ? Math.max(0, Number(border.width)) : borderWidth
      const borderStyle = safeBorderStyle(border.style ?? element.borderStyle)
      const color = safeCssColor(border.color, borderColor)
      style[`border${side[0].toUpperCase()}${side.slice(1)}`] =
        `${width}px ${borderStyle} ${color}`
    })
    return style
  }

  const [focusCell, setFocusCell] = useState(null)
  const inputRefs = useRef({})
  const focusRow = focusCell?.ri ?? (isEditing && data.length ? 0 : null)
  const focusColumn = focusCell?.ci ?? (isEditing && data.length ? 0 : null)

  useEffect(() => {
    if (isEditing && focusRow !== null && focusColumn !== null) {
      const input = inputRefs.current[`${focusRow}-${focusColumn}`]
      if (input) {
        input.focus()
        if (typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(input.value.length, input.value.length)
        }
      }
    }
  }, [focusColumn, focusRow, isEditing])

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <table
        style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
      >
        {colWidths.length > 0 && (
          <colgroup>
            {colWidths.map((width, index) => {
              const safeWidth = Number(width)
              return (
                <col
                  key={index}
                  style={Number.isFinite(safeWidth) && safeWidth > 0 ? { width: Math.round(safeWidth) } : undefined}
                />
              )
            })}
          </colgroup>
        )}
        <tbody>
          {data.map((row, ri) => {
            const safeRowHeight = Number(rowHeights[ri])
            return (
              <tr
                key={ri}
                style={Number.isFinite(safeRowHeight) && safeRowHeight > 0 ? { height: Math.round(safeRowHeight) } : undefined}
              >
                {(Array.isArray(row) ? row : []).map((cell, ci) => {
                if (coveredCells.has(`${ri}:${ci}`)) return null
                const merge = mergeByStart.get(`${ri}:${ci}`)
                const isHeader = element.headerRow && ri === 0
                const cellTextColor = getCellStyle('textColors', ri, ci) || (isHeader ? headerTextColor : textColor)
                const cellBackground = getCellStyle('bgColors', ri, ci) || (isHeader ? headerBg : cellBg)
                const cellBold = getCellStyle('isBold', ri, ci)
                const cellFontSize = safeFontSize(getCellStyle('fontSizes', ri, ci), fontSize)
                const cellFontFamily = safeFontFamily(getCellStyle('fontFamilies', ri, ci))
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
                      fontSize: cellFontSize,
                      fontFamily: cellFontFamily,
                      fontWeight: cellBold != null ? (cellBold ? 600 : 400) : isHeader ? 600 : 400,
                      textAlign,
                      verticalAlign,
                      overflow: 'hidden',
                    }}
                  >
                    {isEditing ? (
                      <textarea
                        ref={(el) => (inputRefs.current[`${ri}-${ci}`] = el)}
                        value={String(cell ?? '')}
                        onChange={(e) => {
                          const newData = data.map((r) => (Array.isArray(r) ? [...r] : []))
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
                        {String(cell ?? '')}
                      </div>
                    )}
                  </td>
                )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
