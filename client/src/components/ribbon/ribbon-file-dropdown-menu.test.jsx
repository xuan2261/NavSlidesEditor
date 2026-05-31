import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FileDropdown from './ribbon-file-dropdown-menu'

describe('FileDropdown', () => {
  it('renders a File button', () => {
    render(<FileDropdown />)
    expect(screen.getByLabelText('File menu')).toBeTruthy()
  })

  it('opens dropdown on click', () => {
    render(<FileDropdown />)
    fireEvent.mouseDown(screen.getByLabelText('File menu'))
    expect(screen.getByText('Open Project')).toBeTruthy()
  })

  it('[cap:control.file.menu] opens and exposes expected file commands', () => {
    render(<FileDropdown />)
    fireEvent.mouseDown(screen.getByLabelText('File menu'))
    expect(screen.getByText('Open Project')).toBeTruthy()
    expect(screen.getByText('Export PDF')).toBeTruthy()
    expect(screen.getByText('Export PPTX')).toBeTruthy()
    expect(screen.getByText('Export HTML')).toBeTruthy()
    expect(screen.getByText('Export Offline HTML')).toBeTruthy()
    expect(screen.getByText('Export Project')).toBeTruthy()
    expect(screen.getByText('Save to GitHub')).toBeTruthy()
    expect(screen.getByText('Sync to Cloud')).toBeTruthy()
    expect(screen.getByText('Version History')).toBeTruthy()
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
})
