// Issue #9 + part of #10: SelectionPane chart row uses BarChart3, image row
// uses ImageIcon (alias for the Lucide Image component).

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BarChart2, BarChart3, Image as LucideImage } from 'lucide-react'
import SelectionPane from './SelectionPane'

const elements = [
  { id: 'el-img', type: 'image', name: 'Hero image' },
  { id: 'el-chart', type: 'chart', name: 'Bar chart' },
  { id: 'el-text', type: 'text', name: 'Title' },
]

function defaultProps() {
  return {
    elements,
    selectedIds: [],
    onSelect: vi.fn(),
    onToggleVisibility: vi.fn(),
    onToggleLock: vi.fn(),
    onRename: vi.fn(),
    onReorder: vi.fn(),
  }
}

function lucideClass(Icon) {
  // The class lucide-react stamps onto its SVG depends on the icon. Resolve
  // it dynamically per version rather than hard-coding kebab-case strings.
  const html = renderToStaticMarkup(<Icon size={13} />)
  return html.match(/class="([^"]+)"/)?.[1] ?? ''
}

describe('SelectionPane icon consistency', () => {
  it('[cap:control.selection-pane] chart row uses BarChart3 (not BarChart2)', () => {
    const { container } = render(<SelectionPane {...defaultProps()} />)
    const chart3Class = lucideClass(BarChart3)
    const chart2Class = lucideClass(BarChart2)
    const svgs = Array.from(container.querySelectorAll('svg.lucide'))
    const classes = svgs.map((s) => s.getAttribute('class') || '')
    const hasBarChart3 = classes.some((c) => c.split(/\s+/).includes(chart3Class.split(/\s+/).pop()))
    const hasBarChart2 = classes.some((c) => c.split(/\s+/).includes(chart2Class.split(/\s+/).pop()))
    expect(hasBarChart3).toBe(true)
    expect(hasBarChart2).toBe(false)
  })

  it('image row renders the Lucide Image icon (alias-renamed import still works)', () => {
    const { container } = render(<SelectionPane {...defaultProps()} />)
    const imageClassToken = lucideClass(LucideImage).split(/\s+/).pop()
    const svgs = Array.from(container.querySelectorAll('svg.lucide'))
    const tokens = svgs.flatMap((s) => (s.getAttribute('class') || '').split(/\s+/))
    expect(tokens).toContain(imageClassToken)
  })
})

describe('SelectionPane keyboard access', () => {
  it('exposes focusable semantic rows and selects with Enter or Space', () => {
    const props = defaultProps()
    render(<SelectionPane {...props} />)

    const imageRow = screen.getByRole('listitem', { name: /Hero image/i })
    const chartRow = screen.getByRole('listitem', { name: /Bar chart/i })

    expect(imageRow.tabIndex).toBe(0)
    fireEvent.keyDown(imageRow, { key: 'Enter' })
    fireEvent.keyDown(chartRow, { key: ' ', ctrlKey: true })

    expect(props.onSelect).toHaveBeenNthCalledWith(1, 'el-img', false)
    expect(props.onSelect).toHaveBeenNthCalledWith(2, 'el-chart', true)
  })

  it('starts rename with F2, commits with Enter, and cancels with Escape', () => {
    const props = defaultProps()
    render(<SelectionPane {...props} />)
    const row = screen.getByRole('listitem', { name: /Hero image/i })

    fireEvent.keyDown(row, { key: 'F2' })
    const input = screen.getByRole('textbox', { name: /Rename Hero image/i })
    fireEvent.change(input, { target: { value: 'Cover artwork' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(props.onRename).not.toHaveBeenCalled()

    fireEvent.keyDown(row, { key: 'F2' })
    const reopenedInput = screen.getByRole('textbox', { name: /Rename Hero image/i })
    fireEvent.change(reopenedInput, { target: { value: 'Cover artwork' } })
    fireEvent.keyDown(reopenedInput, { key: 'Enter' })
    expect(props.onRename).toHaveBeenCalledWith('el-img', 'Cover artwork')
  })

  it('reorders with Alt+Arrow keys but does not reorder locked rows', () => {
    const props = defaultProps()
    const lockedElements = elements.map((element) =>
      element.id === 'el-chart' ? { ...element, locked: true } : element
    )
    render(<SelectionPane {...props} elements={lockedElements} />)

    fireEvent.keyDown(screen.getByRole('listitem', { name: /Hero image/i }), {
      key: 'ArrowDown',
      altKey: true,
    })
    fireEvent.keyDown(screen.getByRole('listitem', { name: /Bar chart/i }), {
      key: 'ArrowDown',
      altKey: true,
    })

    expect(props.onReorder).toHaveBeenCalledTimes(1)
    expect(props.onReorder).toHaveBeenCalledWith(0, 1)
  })

  it('does not select a row when a nested visibility button handles Enter', () => {
    const props = defaultProps()
    render(<SelectionPane {...props} />)

    fireEvent.keyDown(screen.getByTestId('selection-pane-toggle-visibility-el-img'), {
      key: 'Enter',
    })

    expect(props.onSelect).not.toHaveBeenCalled()
  })
})
