import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useUIStore } from '../../stores/ui-store'
import RibbonShell from './ribbon-toolbar-shell-with-tab-panels'
import RibbonHeaderBar from './ribbon-header-bar'
import RibbonPanel from './ribbon-panel'

describe('RibbonShell', () => {
  beforeEach(() => {
    useUIStore.setState({ activeTab: 'home' })
  })

  it('renders 7 tab triggers', () => {
    render(<RibbonShell />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(7)
  })

  it('has role="tablist" on tab bar', () => {
    render(<RibbonShell />)
    expect(screen.getByRole('tablist')).toBeTruthy()
  })

  it('has role="tabpanel" on content area', () => {
    render(<RibbonShell />)
    expect(screen.getByRole('tabpanel')).toBeTruthy()
  })

  it('links active tab and tabpanel with stable ARIA ids', () => {
    render(<RibbonShell />)
    const selectedTab = screen.getByRole('tab', { selected: true })
    const panel = screen.getByRole('tabpanel')

    expect(selectedTab.id).toBe('ribbon-tab-home')
    expect(selectedTab.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(selectedTab.id)
  })

  it('activates Home tab by default', () => {
    render(<RibbonShell />)
    const homeTab = screen.getByRole('tab', { name: /home/i })
    expect(homeTab.getAttribute('aria-selected')).toBe('true')
  })

  it('switches tab on click', () => {
    render(<RibbonShell />)
    const insertTab = screen.getByRole('tab', { name: /insert/i })
    fireEvent.click(insertTab)
    expect(insertTab.getAttribute('aria-selected')).toBe('true')
    expect(useUIStore.getState().activeTab).toBe('insert')
  })

  it('tablist has aria-orientation attribute', () => {
    render(<RibbonShell />)
    const tablist = screen.getByRole('tablist')
    expect(tablist.getAttribute('aria-orientation')).toBe('horizontal')
  })

  it('has aria-selected on active tab', () => {
    render(<RibbonShell />)
    const tabs = screen.getAllByRole('tab')
    const selectedTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true')
    expect(selectedTab).toBeTruthy()
    expect(selectedTab.textContent).toMatch(/home/i)
  })

  it('renders all tab labels', () => {
    render(<RibbonShell />)
    const expectedLabels = ['Home', 'Insert', 'Design', 'Format', 'Transitions', 'Animations', 'View']
    const tabs = screen.getAllByRole('tab')
    for (const label of expectedLabels) {
      const found = tabs.some((t) => t.textContent.includes(label))
      expect(found).toBe(true)
    }
  })

  it('renders File dropdown in header', () => {
    render(<RibbonShell />)
    expect(screen.getByLabelText('File menu')).toBeTruthy()
  })

  it('passes file callbacks to FileDropdown', () => {
    const onExportPDF = vi.fn()
    render(<RibbonShell onExportPDF={onExportPDF} />)
    fireEvent.mouseDown(screen.getByLabelText('File menu'))
    fireEvent.mouseDown(screen.getByText('Export PDF'))
    expect(onExportPDF).toHaveBeenCalled()
  })

  it('keeps header tab selection synced with panel content through ui-store', () => {
    render(
      <>
        <RibbonHeaderBar />
        <RibbonPanel />
      </>
    )

    fireEvent.click(screen.getByRole('tab', { name: /view/i }))

    expect(useUIStore.getState().activeTab).toBe('view')
    expect(screen.getByRole('tab', { name: /view/i }).getAttribute('aria-selected')).toBe('true')
    const panel = screen.getByRole('tabpanel')
    const tab = screen.getByRole('tab', { name: /view/i })
    expect(panel.textContent).toMatch(/Show/)
    expect(tab.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id)
  })

  it('renders header right-side AI Share and Present actions', () => {
    const onAIGenerator = vi.fn()
    const onShare = vi.fn()
    const onPresent = vi.fn()

    render(
      <RibbonHeaderBar
        onAIGenerator={onAIGenerator}
        onShare={onShare}
        onPresent={onPresent}
      />
    )

    fireEvent.mouseDown(screen.getByRole('button', { name: /^AI$/i }))
    fireEvent.mouseDown(screen.getByText('AI Slide Generator'))
    fireEvent.mouseDown(screen.getByRole('button', { name: /^Share$/i }))
    fireEvent.mouseDown(screen.getByText('Share Link'))
    fireEvent.click(screen.getByRole('button', { name: /Present/i }))

    expect(onAIGenerator).toHaveBeenCalledTimes(1)
    expect(onShare).toHaveBeenCalledTimes(1)
    expect(onPresent).toHaveBeenCalledTimes(1)
  })
})
