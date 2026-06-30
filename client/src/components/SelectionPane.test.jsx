// Issue #9 + part of #10: SelectionPane chart row uses BarChart3, image row
// uses ImageIcon (alias for the Lucide Image component).

import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
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
