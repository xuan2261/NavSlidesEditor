import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import CodeEditorModal from './CodeEditorModal'
import StemSimulationPresetModal from './stem-simulation-preset-modal'
import PropertiesPanel from './PropertiesPanel'
import StatusBar from './layout/StatusBar'
import { useUIStore } from '../stores/ui-store'
import { CommandPalette } from './command-palette'
import { SlideThumbnailPreview } from './slide-panel/slide-thumbnail-preview'
import InsertTabContent from './ribbon/ribbon-insert-tab-element-galleries-panel'
import { createElement } from '../utils/element-factory'

afterEach(cleanup)

describe('editor audit regressions', () => {
  it('names the code source and language for assistive technology', () => {
    render(<CodeEditorModal state={{ content: 'print(1)', language: 'python' }} onChange={vi.fn()} onApply={vi.fn()} onCancel={vi.fn()} onChangeTheme={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Code source' }).value).toBe('print(1)')
    expect(screen.getByRole('combobox', { name: 'Code language' }).value).toBe('python')
  })

  it('dismisses STEM with Escape and restores the opener', () => {
    function Example() {
      const [open, setOpen] = useState(false)
      return <><button onClick={() => setOpen(true)}>Open simulation</button>{open && <StemSimulationPresetModal onCancel={() => setOpen(false)} />}</>
    }
    render(<Example />)
    const opener = screen.getByRole('button', { name: 'Open simulation' })
    opener.focus()
    fireEvent.click(opener)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('lets an unselected hidden element be found and made visible', () => {
    function Example() {
      const [elements, setElements] = useState([{ id: 'hidden', type: 'text', name: 'Hidden title', content: '<p>Secret</p>', hidden: true }])
      return <PropertiesPanel slide={{ id: 's', elements }} selectedElementIds={[]} onUpdateElement={(id, updates) => setElements((items) => items.map((item) => item.id === id ? { ...item, ...updates } : item))} />
    }
    render(<Example />)
    fireEvent.click(screen.getByRole('button', { name: 'Selection Pane' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show element' }))
    expect(screen.getByRole('button', { name: 'Hide element' })).toBeTruthy()
  })

  it('announces the active vertical slide rather than its parent alone', () => {
    useUIStore.setState({ slidePosition: { current: 0, total: 3, vertical: 0 } })
    render(<StatusBar />)
    expect(screen.getByTestId('statusbar-slide-position').textContent).toBe('Slide 1.1 / 3')
  })

  it('announces master editing instead of implying a slide is being edited', () => {
    useUIStore.setState({ slidePosition: { current: 0, total: 3, masterName: 'Course master' } })
    render(<StatusBar />)
    expect(screen.getByTestId('statusbar-slide-position').textContent).toBe('Editing master: Course master')
  })

  it('does not run a disabled command from the keyboard or pointer', () => {
    const action = vi.fn()
    render(<CommandPalette open commands={[{ id: 'cut', label: 'Cut', action, disabled: true, disabledReason: 'Selection is locked' }]} onClose={vi.fn()} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: /cut/i }))
    expect(action).not.toHaveBeenCalled()
    expect(screen.getByText('Selection is locked')).toBeTruthy()
  })

  it('creates a plain line and an arrow as different element geometry', () => {
    function Example() {
      const [elements, setElements] = useState([])
      return <><InsertTabContent onAddLine={(overrides) => setElements((items) => [...items, createElement('line', overrides)])} /><output>{JSON.stringify(elements.map((element) => element.arrowEnd))}</output></>
    }
    render(<Example />)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Add line' }))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Add arrow' }))
    expect(screen.getByRole('status').textContent).toBe('["none","arrow"]')
  })

  it('renders theme backgrounds and excludes hidden text in slide previews', () => {
    const { container } = render(<SlideThumbnailPreview designTokens={{ colors: { bg: '#101020', text: '#eeeeee' } }} slide={{ background: { type: 'none' }, elements: [{ id: 'secret', type: 'text', hidden: true, content: '<p>Hidden text</p>' }] }} />)
    expect(container.firstChild.style.backgroundColor).toBe('rgb(16, 16, 32)')
    expect(within(container).queryByText('Hidden text')).toBeNull()
  })
})
