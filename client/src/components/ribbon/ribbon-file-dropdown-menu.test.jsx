import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FileDropdown from './ribbon-file-dropdown-menu'
import { useState } from 'react'

describe('FileDropdown', () => {
  it('requires an explicit reversible teacher opt-in and warns before revealed static export', () => {
    function ControlledMenu() {
      const [teacherReveal, setTeacherReveal] = useState(false)
      return (
        <FileDropdown
          staticExportTeacherReveal={teacherReveal}
          onStaticExportTeacherRevealChange={setTeacherReveal}
        />
      )
    }
    render(<ControlledMenu />)
    fireEvent.keyDown(screen.getByLabelText('File menu'), { key: 'Enter' })
    const checkbox = screen.getByRole('menuitemcheckbox', {
      name: 'Include answers in PDF / reconstructed PPTX',
    })
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.keyDown(checkbox, { key: ' ' })
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('note').textContent).toContain('Answer keys')
    fireEvent.keyDown(checkbox, { key: 'Enter' })
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByRole('note')).toBeNull()
  })
  it('renders a File button', () => {
    render(<FileDropdown />)
    expect(screen.getByLabelText('File menu')).toBeTruthy()
  })

  it('opens dropdown on click', () => {
    render(<FileDropdown />)
    fireEvent.mouseDown(screen.getByLabelText('File menu'))
    expect(screen.getByText('Open Project')).toBeTruthy()
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('renders imported presentation fidelity choices with explicit actions', () => {
    const downloadOriginal = vi.fn()
    render(
      <FileDropdown
        pptxFidelity={{
          fidelity: { status: 'source-backed', editabilityTier: 'structural-mvp' },
          exports: {
            original: { available: true },
            validatedEdited: { available: false },
            reconstructed: { available: true },
          },
          officeCli: { available: true },
        }}
        pptxActions={{ downloadOriginal }}
      />
    )
    fireEvent.mouseDown(screen.getByLabelText('File menu'))

    expect(screen.getByLabelText('PPTX fidelity')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download Original' })).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: 'Export Validated Edited Revision',
      }).disabled
    ).toBe(true)
    expect(screen.getByRole('button', { name: 'Generate Reconstructed PPTX' })).toBeTruthy()
  })

  it('shows version history option', () => {
    render(<FileDropdown />)
    fireEvent.mouseDown(screen.getByLabelText('File menu'))
    expect(screen.getByText('Version History')).toBeTruthy()
  })

  it('calls onOpenProject when Open Project clicked', () => {
    const onOpenProject = vi.fn()
    render(<FileDropdown onOpenProject={onOpenProject} />)
    fireEvent.mouseDown(screen.getByLabelText('File menu'))
    fireEvent.mouseDown(screen.getByText('Open Project'))
    expect(onOpenProject).toHaveBeenCalled()
  })

  it('calls onSave when Save clicked', () => {
    const onSave = vi.fn()
    render(<FileDropdown onSave={onSave} />)
    fireEvent.mouseDown(screen.getByLabelText('File menu'))
    fireEvent.mouseDown(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('calls onExportPDF when Export PDF clicked', () => {
    const onExportPDF = vi.fn()
    render(<FileDropdown onExportPDF={onExportPDF} />)
    fireEvent.mouseDown(screen.getByLabelText('File menu'))
    fireEvent.mouseDown(screen.getByText('Export PDF'))
    expect(onExportPDF).toHaveBeenCalled()
  })

  it('calls onHistory when Version History clicked', () => {
    const onHistory = vi.fn()
    render(<FileDropdown onHistory={onHistory} />)
    fireEvent.mouseDown(screen.getByLabelText('File menu'))
    fireEvent.mouseDown(screen.getByText('Version History'))
    expect(onHistory).toHaveBeenCalled()
  })

  it('closes dropdown after action', () => {
    const onExportPDF = vi.fn()
    render(<FileDropdown onExportPDF={onExportPDF} />)
    fireEvent.mouseDown(screen.getByLabelText('File menu'))
    fireEvent.mouseDown(screen.getByText('Export PDF'))
    expect(screen.queryByText('Open Project')).toBeNull()
  })

  it('opens with keyboard and activates menu items with Enter', () => {
    const onExportPDF = vi.fn()
    render(<FileDropdown onExportPDF={onExportPDF} />)

    fireEvent.keyDown(screen.getByLabelText('File menu'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Export PDF' }), { key: 'Enter' })

    expect(onExportPDF).toHaveBeenCalled()
    expect(screen.queryByText('Open Project')).toBeNull()
  })

  it('opens with Space and activates menu items with Space', () => {
    const onHistory = vi.fn()
    render(<FileDropdown onHistory={onHistory} />)

    fireEvent.keyDown(screen.getByLabelText('File menu'), { key: ' ' })
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Version History' }), { key: ' ' })

    expect(onHistory).toHaveBeenCalled()
    expect(screen.queryByText('Open Project')).toBeNull()
  })

  it('closes on Escape and restores focus to the trigger', () => {
    render(<FileDropdown />)
    const trigger = screen.getByLabelText('File menu')

    fireEvent.mouseDown(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByText('Open Project')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('[F8] supports wrapped arrow navigation plus Home and End', () => {
    render(<FileDropdown />)

    fireEvent.keyDown(screen.getByLabelText('File menu'), { key: 'Enter' })

    const first = screen.getByRole('menuitem', { name: 'Open Project' })
    const last = screen.getByRole('menuitem', { name: 'Version History' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(first, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(last)

    fireEvent.keyDown(last, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(first, { key: 'End' })
    expect(document.activeElement).toBe(last)

    fireEvent.keyDown(last, { key: 'Home' })
    expect(document.activeElement).toBe(first)
  })

  it('dismisses the File menu and restores trigger focus before a pending Original download finishes', () => {
    render(<FileDropdown pptxFidelity={{
      fidelity: { status: 'source-backed', editabilityTier: 'structural-mvp' },
      exports: { original: { available: true }, validatedEdited: { available: false }, reconstructed: { available: true } },
      officeCli: { available: true },
    }}
      pptxActions={{ downloadOriginal: () => new Promise(() => {}) }} />)
    const trigger = screen.getByRole('button', { name: 'File menu' })
    fireEvent.mouseDown(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Download Original' }))
    expect(screen.queryByRole('menu', { name: 'File menu' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
    fireEvent.mouseDown(trigger)
    expect(screen.getByRole('menuitem', { name: 'Export Project' })).toBeTruthy()
  })
})
