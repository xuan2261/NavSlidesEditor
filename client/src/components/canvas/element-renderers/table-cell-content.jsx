import { isRichTableCell, tableCellHtml, tableCellText, updateTableCellText } from 'revealjs-shared'
import TableRichCellEditor from './table-rich-cell-editor'

export default function TableCellContent({ cell, isEditing, focused, row, column, inputRef, onFocus, onChange }) {
  const rich = isRichTableCell(cell)
  if (isEditing && rich && focused) {
    return <TableRichCellEditor cell={cell} row={row} column={column} onChange={onChange} />
  }
  if (isEditing && !rich) {
    return <textarea
      ref={inputRef}
      aria-label={`Table cell row ${row + 1} column ${column + 1}`}
      value={tableCellText(cell)}
      onFocus={onFocus}
      onChange={(event) => onChange(updateTableCellText(cell, event.target.value))}
      onMouseDown={(event) => { event.stopPropagation(); onFocus() }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      style={{ width: '100%', height: '100%', background: 'transparent', border: 'none',
        color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none',
        textAlign: 'inherit', fontFamily: 'inherit', resize: 'none', overflow: 'hidden' }}
    />
  }
  return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
    dangerouslySetInnerHTML={{ __html: tableCellHtml(cell) }} />
}
