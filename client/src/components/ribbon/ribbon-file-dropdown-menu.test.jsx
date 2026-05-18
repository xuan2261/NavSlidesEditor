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

  it('shows export options', () => {
    render(<FileDropdown />)
    fireEvent.mouseDown(screen.getByLabelText('File menu'))
    expect(screen.getByText('Export PDF')).toBeTruthy()
    expect(screen.getByText('Export PPTX')).toBeTruthy()
    expect(screen.getByText('Export HTML')).toBeTruthy()
    expect(screen.getByText('Export Offline HTML')).toBeTruthy()
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
})
