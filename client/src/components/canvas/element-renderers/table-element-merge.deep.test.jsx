import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TableRenderer } from './table-element-renderer'

// Merge logic lives inside the renderer (no pure export), so assert behavior at
// the render boundary: the anchor cell carries the right span and covered cells
// are not emitted. Reading the DOM is the verification of the exact rule.
function renderTable(mergedCells) {
  const element = {
    data: [
      ['A1', 'B1', 'C1'],
      ['A2', 'B2', 'C2'],
      ['A3', 'B3', 'C3'],
    ],
    headerRow: false,
    mergedCells,
  }
  const { container } = render(<TableRenderer element={element} isEditing={false} />)
  return container
}

describe('[cap:element.table tier:deep] cell merge spans', () => {
  it('renders a 3×3 grid as 9 cells with no merges', () => {
    const container = renderTable([])
    expect(container.querySelectorAll('td')).toHaveLength(9)
  })

  it('applies rowSpan/colSpan to the merge anchor and drops covered cells', () => {
    // Merge a 2×2 block at (0,0): anchor spans 2×2, cells (0,1)(1,0)(1,1) covered.
    const container = renderTable([{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }])
    const tds = container.querySelectorAll('td')
    // 9 - 3 covered = 6 rendered cells
    expect(tds).toHaveLength(6)
    const spanned = [...tds].find((td) => td.getAttribute('colspan') === '2')
    expect(spanned).toBeTruthy()
    expect(spanned.getAttribute('rowspan')).toBe('2')
  })

  it('clamps a span of 1 to no covered cells (degenerate merge)', () => {
    const container = renderTable([{ row: 1, col: 1, rowSpan: 1, colSpan: 1 }])
    expect(container.querySelectorAll('td')).toHaveLength(9) // nothing covered
  })

  it('supports a horizontal-only span (1×3) covering 2 cells in the row', () => {
    const container = renderTable([{ row: 2, col: 0, rowSpan: 1, colSpan: 3 }])
    const tds = container.querySelectorAll('td')
    expect(tds).toHaveLength(7) // 9 - 2 covered
    const spanned = [...tds].find((td) => td.getAttribute('colspan') === '3')
    expect(spanned).toBeTruthy()
  })
})
