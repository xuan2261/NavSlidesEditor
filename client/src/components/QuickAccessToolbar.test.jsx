// Issue #8: QuickAccessToolbar Undo/Redo render Lucide Undo2/Redo2.
// No inline <svg> blocks remain. disabled state preserved.

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Undo2, Redo2 } from 'lucide-react'
import QuickAccessToolbar from './QuickAccessToolbar'

function lucideClass(Icon) {
  const html = renderToStaticMarkup(<Icon size={18} />)
  return html.match(/class="([^"]+)"/)?.[1] ?? ''
}

describe('QuickAccessToolbar — Lucide Undo/Redo', () => {
  it('renders Undo button with the Lucide Undo2 icon', () => {
    render(
      <QuickAccessToolbar
        onSave={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        saving={false}
        hasChanges={false}
      />,
    )
    const undoBtn = screen.getByTitle(/^Undo \(Ctrl\+Z\)$/)
    const svg = undoBtn.querySelector('svg.lucide')
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('class')).toBe(lucideClass(Undo2))
  })

  it('renders Redo button with the Lucide Redo2 icon', () => {
    render(
      <QuickAccessToolbar
        onSave={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        saving={false}
        hasChanges={false}
      />,
    )
    const redoBtn = screen.getByTitle(/^Redo \(Ctrl\+Y\)$/)
    const svg = redoBtn.querySelector('svg.lucide')
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('class')).toBe(lucideClass(Redo2))
  })

  it('contains zero raw inline <svg> outside Lucide-rendered icons', () => {
    const { container } = render(
      <QuickAccessToolbar
        onSave={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        saving={false}
        hasChanges={false}
      />,
    )
    const svgs = Array.from(container.querySelectorAll('svg'))
    for (const svg of svgs) {
      const cls = svg.getAttribute('class') || ''
      expect(cls).toMatch(/\blucide\b/)
    }
  })

  it('Save button still works (regression guard)', () => {
    const onSave = vi.fn()
    render(
      <QuickAccessToolbar
        onSave={onSave}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        saving={false}
        hasChanges
      />,
    )
    const saveBtn = screen.getByTitle(/Save \(Ctrl\+S\)/)
    saveBtn.click()
    expect(onSave).toHaveBeenCalled()
  })
})
