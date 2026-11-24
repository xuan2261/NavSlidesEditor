import { Button } from '../ui'
import { mergeTableCellRight, unmergeTableCell } from './table-cell-merges'

export default function TableMergeControls({
  element,
  selectedCell,
  onUpdate,
  selectedElementIds = [element.id],
}) {
  const merge = mergeTableCellRight(element, selectedCell)
  const unmerge = unmergeTableCell(element, selectedCell)
  const disabled = element.locked || selectedElementIds.length > 1
  return (
    <div className="flex flex-wrap gap-1.5 my-2">
      <Button
        variant="secondary"
        data-testid="prop-table-merge-right"
        aria-label="Merge selected cell right"
        disabled={!merge || disabled}
        onClick={() => {
          if (merge && !disabled) onUpdate(merge)
        }}
      >
        Merge selected cell right
      </Button>
      <Button
        variant="secondary"
        data-testid="prop-table-unmerge"
        aria-label="Unmerge selected cell"
        disabled={!unmerge || disabled}
        onClick={() => {
          if (unmerge && !disabled) onUpdate(unmerge)
        }}
      >
        Unmerge selected cell
      </Button>
    </div>
  )
}
