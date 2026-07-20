import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import EditorWorkspace from './editor-workspace'

vi.mock('./editor-ribbon', () => ({ default: () => null }))
vi.mock('./editor-canvas-workspace', () => ({
  default: () => <main data-testid="canvas-workspace" />,
}))
vi.mock('./editor-navigator', () => ({
  default: ({ overlay }) => (overlay ? <aside data-testid="navigator-overlay" /> : null),
}))
vi.mock('./editor-inspector', () => ({
  default: ({ overlay }) => (overlay ? <aside data-testid="inspector-overlay" /> : null),
}))

const context = { presentation: { slides: [] } }

function renderOverlay(setActiveWorkspaceOverlay) {
  render(
    <EditorWorkspace
      workspaceRef={null}
      workspaceTier="compact"
      leftPanelOpen
      inspectorRequested
      navigatorDocked={false}
      inspectorDocked={false}
      compactOverlay="navigator"
      setActiveWorkspaceOverlay={setActiveWorkspaceOverlay}
      c={context}
    />
  )
}

function renderControlledOverlay() {
  function Harness() {
    const [compactOverlay, setActiveWorkspaceOverlay] = useState(null)
    return (
      <EditorWorkspace
        workspaceRef={null}
        workspaceTier="compact"
        leftPanelOpen
        inspectorRequested
        navigatorDocked={false}
        inspectorDocked={false}
        compactOverlay={compactOverlay}
        setActiveWorkspaceOverlay={setActiveWorkspaceOverlay}
        c={context}
      />
    )
  }

  return render(<Harness />)
}

describe('EditorWorkspace compact overlay', () => {
  it('closes the overlay when its backdrop receives a pointer activation', () => {
    const setActiveWorkspaceOverlay = vi.fn()
    renderOverlay(setActiveWorkspaceOverlay)

    fireEvent.click(screen.getByRole('button', { name: 'Close workspace overlay' }))

    expect(setActiveWorkspaceOverlay).toHaveBeenCalledWith(null)
  })

  it('closes the overlay when Escape is pressed while the launcher retains focus', () => {
    const setActiveWorkspaceOverlay = vi.fn()
    renderOverlay(setActiveWorkspaceOverlay)

    fireEvent.keyDown(screen.getByRole('button', { name: 'Open slide navigator' }), {
      bubbles: true,
      key: 'Escape',
    })

    expect(setActiveWorkspaceOverlay).toHaveBeenCalledWith(null)
  })

  it('closes after keyboard-opening the overlay and pressing Escape immediately', async () => {
    const user = userEvent.setup()
    renderControlledOverlay()

    const launcher = screen.getByRole('button', { name: 'Open slide navigator' })
    launcher.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByTestId('navigator-overlay')).toBeTruthy()
    expect(document.activeElement).toBe(launcher)

    await user.keyboard('{Escape}')

    expect(screen.queryByTestId('navigator-overlay')).toBeNull()
  })
})
