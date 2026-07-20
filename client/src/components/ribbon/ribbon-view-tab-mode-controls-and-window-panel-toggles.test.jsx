import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ViewTabContent from './ribbon-view-mode-controls-content'
import { useEditorStore } from '../../stores/editor-store'
import { useUIStore } from '../../stores/ui-store'

beforeEach(() => {
  useEditorStore.setState({
    showGrid: false,
    gridSize: 40,
    smartGuidesEnabled: true,
    showRulers: false,
    zoom: 1,
  })
  useUIStore.setState({
    leftPanelOpen: true,
    rightPanelOpen: true,
    showDesignIdeas: false,
  })
})

describe('ViewTabContent', () => {
  it('renders Show and Window sections', () => {
    const { container } = render(<ViewTabContent />)
    const labels = container.querySelectorAll('.text-text-muted')
    const labelTexts = [...labels].map((el) => el.textContent)
    expect(labelTexts).toContain('Show')
    expect(labelTexts).toContain('Window')
  })

  it('renders canvas control buttons from Show section', () => {
    render(<ViewTabContent />)
    expect(screen.getByLabelText('Toggle grid')).toBeTruthy()
    expect(screen.getByLabelText('Toggle smart guides')).toBeTruthy()
    expect(screen.getByLabelText('Toggle rulers')).toBeTruthy()
  })

  it('renders zoom controls from Show section', () => {
    render(<ViewTabContent />)
    expect(screen.getByLabelText('Zoom in')).toBeTruthy()
    expect(screen.getByLabelText('Zoom out')).toBeTruthy()
    expect(screen.getByLabelText('Fit to window')).toBeTruthy()
  })

  it('returns zoom to automatic fit mode from the View ribbon', () => {
    useUIStore.setState({ userZoomMode: true })
    render(<ViewTabContent />)

    fireEvent.click(screen.getByLabelText('Fit to window'))

    expect(useUIStore.getState().userZoomMode).toBe(false)
  })

  it('renders window panel toggles', () => {
    render(<ViewTabContent />)
    expect(screen.getByLabelText('Toggle slide panel')).toBeTruthy()
    expect(screen.getByLabelText('Toggle properties panel')).toBeTruthy()
  })

  it('shows panel labels', () => {
    render(<ViewTabContent />)
    expect(screen.getByText('Slides')).toBeTruthy()
    expect(screen.getByText('Properties')).toBeTruthy()
  })

  it('renders legacy View menu actions', () => {
    render(<ViewTabContent />)
    expect(screen.getByLabelText('Find & Replace')).toBeTruthy()
    expect(screen.getByLabelText('Animation Timeline')).toBeTruthy()
    expect(screen.getByLabelText('Custom CSS')).toBeTruthy()
    expect(screen.getByLabelText('Speaker Notes')).toBeTruthy()
    expect(screen.getByLabelText('Slide Sorter')).toBeTruthy()
  })

  it('calls View action callbacks', () => {
    const onFindReplace = vi.fn()
    const onSpeakerNotes = vi.fn()
    const onToggleSlideSorter = vi.fn()
    render(
      <ViewTabContent
        onFindReplace={onFindReplace}
        onSpeakerNotes={onSpeakerNotes}
        onToggleSlideSorter={onToggleSlideSorter}
      />,
    )

    fireEvent.click(screen.getByLabelText('Find & Replace'))
    fireEvent.click(screen.getByLabelText('Speaker Notes'))
    fireEvent.mouseDown(screen.getByLabelText('Slide Sorter'))

    expect(onFindReplace).toHaveBeenCalled()
    expect(onSpeakerNotes).toHaveBeenCalled()
    expect(onToggleSlideSorter).toHaveBeenCalled()
  })

  it('[cap:control.view.smartGuides] toggles smart guide state from the View ribbon', () => {
    render(<ViewTabContent />)

    const smartGuides = screen.getByLabelText('Toggle smart guides')
    expect(smartGuides.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(smartGuides)

    expect(useEditorStore.getState().smartGuidesEnabled).toBe(false)
    expect(screen.getByLabelText('Toggle smart guides').getAttribute('aria-pressed')).toBe('false')
  })

  it('[cap:control.view.selectionPane] toggles the right properties pane from the View ribbon', () => {
    render(<ViewTabContent />)

    const propertiesPane = screen.getByLabelText('Toggle properties panel')
    expect(propertiesPane.getAttribute('aria-pressed')).toBe('true')

    fireEvent.mouseDown(propertiesPane)

    expect(useUIStore.getState().rightPanelOpen).toBe(false)
    expect(screen.getByLabelText('Toggle properties panel').getAttribute('aria-pressed')).toBe('false')
  })
})
