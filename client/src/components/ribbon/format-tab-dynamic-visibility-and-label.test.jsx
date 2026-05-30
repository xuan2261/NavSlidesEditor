import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as Tabs from '@radix-ui/react-tabs'
import { useUIStore } from '../../stores/ui-store'
import TabBar from './tab-bar-with-scroll-and-icons'
import RibbonPanel from './ribbon-panel'

function renderTabBar(activeTab = 'home') {
  return render(
    <Tabs.Root value={activeTab}>
      <TabBar activeTab={activeTab} onTabChange={() => {}} />
    </Tabs.Root>
  )
}

beforeEach(() => {
  useUIStore.setState({
    activeTab: 'home',
    formatContext: { hasSelection: false, elementType: null },
    formatAutoActivatedForSelection: false,
  })
})

describe('Format tab dynamic visibility', () => {
  it('hides the Format tab when there is no selection', () => {
    useUIStore.setState({ formatContext: { hasSelection: false, elementType: null } })
    renderTabBar()
    expect(screen.queryByTestId('ribbon-tab-format')).toBeNull()
  })

  it('shows the Format tab when an element is selected', () => {
    useUIStore.setState({ formatContext: { hasSelection: true, elementType: 'image' } })
    renderTabBar()
    expect(screen.getByTestId('ribbon-tab-format')).toBeTruthy()
  })
})

describe('Format tab dynamic label', () => {
  const cases = [
    ['image', 'Picture Format'],
    ['table', 'Table Design'],
    ['chart', 'Chart Design'],
    ['shape', 'Shape Format'],
    ['code', 'Code'],
    ['video', 'Media'],
  ]
  for (const [type, label] of cases) {
    it(`labels a ${type} selection as "${label}"`, () => {
      useUIStore.setState({ formatContext: { hasSelection: true, elementType: type } })
      renderTabBar()
      const tab = screen.getByTestId('ribbon-tab-format')
      expect(tab.textContent).toContain(label)
      expect(tab.getAttribute('aria-label')).toBe(label)
    })
  }
})

describe('RibbonPanel effectiveTab guard', () => {
  it('does not render the Format panel when activeTab=format but nothing is selected', () => {
    // Simulates a reload where localStorage persisted activeTab='format' but the
    // editor has no selection yet — radix would otherwise flash the empty panel.
    useUIStore.setState({
      activeTab: 'format',
      formatContext: { hasSelection: false, elementType: null },
    })
    render(<RibbonPanel />)
    const formatPanel = screen.getByTestId('ribbon-tab-format-content')
    expect(formatPanel.getAttribute('data-state')).toBe('inactive')
    const homePanel = screen.getByTestId('ribbon-tab-home-content')
    expect(homePanel.getAttribute('data-state')).toBe('active')
  })

  it('renders the Format panel when activeTab=format and an element is selected', () => {
    useUIStore.setState({
      activeTab: 'format',
      formatContext: { hasSelection: true, elementType: 'shape' },
    })
    render(<RibbonPanel />)
    const formatPanel = screen.getByTestId('ribbon-tab-format-content')
    expect(formatPanel.getAttribute('data-state')).toBe('active')
  })
})
