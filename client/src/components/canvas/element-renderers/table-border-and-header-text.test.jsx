import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TableRenderer } from './table-element-renderer'

describe('Phase 4: table renderer consumes borderStyle + headerTextColor', () => {
  it('applies element.borderStyle to the default cell border (not hardcoded solid)', () => {
    const { container } = render(
      <TableRenderer
        element={{ type: 'table', data: [['a', 'b']], borderStyle: 'dashed', borderColor: '#555555' }}
        isEditing={false}
      />
    )
    const cell = container.querySelector('td, th')
    expect(cell).not.toBeNull()
    expect(cell.style.border).toContain('dashed')
  })

  it('applies headerTextColor to header cells when headerRow is set', () => {
    const { container } = render(
      <TableRenderer
        element={{ type: 'table', data: [['H1', 'H2'], ['a', 'b']], headerRow: true, headerTextColor: '#ff0000' }}
        isEditing={false}
      />
    )
    const headerCell = container.querySelector('th') || container.querySelector('td')
    expect(headerCell.style.color).toBe('rgb(255, 0, 0)')
  })
})
