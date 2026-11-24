import userEvent from '@testing-library/user-event'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EditorWorkspace from './editor-workspace'
import { useEditorStore } from '../../stores/editor-store'

vi.mock('./editor-ribbon', () => ({ default: () => null }))
vi.mock('./editor-canvas-workspace', () => ({
  default: () => <main data-testid="canvas-workspace" />,
}))
vi.mock('./editor-navigator', () => ({
  default: ({ overlay }) => (overlay ? <aside data-testid="navigator-overlay" /> : null),
}))
vi.mock('./editor-inspector', () => ({
  default: ({ overlay }) =>
    overlay ? (
      <aside data-testid="inspector-overlay">
        <button onClick={() => useEditorStore.getState().setGeometryPointEditingElementId('shape')}>
          Edit geometry points
        </button>
      </aside>
    ) : null,
}))

const context = { presentation: { slides: [] } }

afterEach(() => {
  act(() => useEditorStore.getState().setGeometryPointEditingElementId(null))
})

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
  it('returns to the canvas on point-edit entry and permits reopening the inspector', () => {
    renderControlledOverlay()
    const launcher = screen.getByRole('button', { name: 'Open inspector' })
    fireEvent.click(launcher)
    expect(screen.getByTestId('inspector-overlay')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Edit geometry points' }))
    expect(screen.queryByTestId('inspector-overlay')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close workspace overlay' })).toBeNull()

    fireEvent.click(launcher)
    expect(screen.getByTestId('inspector-overlay')).toBeTruthy()
    act(() => useEditorStore.getState().setGeometryPointEditingElementId('shape'))
    expect(screen.getByTestId('inspector-overlay')).toBeTruthy()
  })

  it('does not close an inspector opened with point editing already active', () => {
    act(() => useEditorStore.getState().setGeometryPointEditingElementId('shape'))
    renderControlledOverlay()
    fireEvent.click(screen.getByRole('button', { name: 'Open inspector' }))
    expect(screen.getByTestId('inspector-overlay')).toBeTruthy()
  })

  it('keeps a docked desktop inspector open on point-edit entry', () => {
    const close = vi.fn()
    render(
      <EditorWorkspace
        workspaceTier="wide"
        inspectorDocked
        compactOverlay={null}
        setActiveWorkspaceOverlay={close}
        c={context}
      />
    )
    act(() => useEditorStore.getState().setGeometryPointEditingElementId('shape'))
    expect(close).not.toHaveBeenCalled()
  })

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
