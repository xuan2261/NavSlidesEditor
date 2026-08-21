import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  deriveResponsiveWorkspace,
  ResponsiveEditorWorkspaceProvider,
  useResponsiveEditorWorkspace,
} from './responsive-editor-workspace-context'

const preferences = {
  leftPanelOpen: true,
  rightPanelOpen: true,
  showDesignIdeas: true,
}

describe('deriveResponsiveWorkspace', () => {
  it.each([
    [767, 'compact', false, false],
    [768, 'compact', false, false],
    [1024, 'standard', true, false],
    [1440, 'wide', true, true],
  ])(
    'derives the %ipx %s workspace without duplicate docks',
    (width, tier, navigatorDocked, inspectorDocked) => {
      expect(deriveResponsiveWorkspace(width, preferences)).toMatchObject({
        tier,
        navigatorDocked,
        inspectorDocked,
        inspectorTab: 'ideas',
        activeOverlay: null,
      })
    }
  )

  it('keeps requested preferences separate from compact overlay state', () => {
    const workspace = deriveResponsiveWorkspace(768, preferences, 'navigator')

    expect(workspace.activeOverlay).toBe('navigator')
    expect(preferences).toEqual({
      leftPanelOpen: true,
      rightPanelOpen: true,
      showDesignIdeas: true,
    })
  })

  it('allows one overlay at standard width and clears it at wide width', () => {
    expect(deriveResponsiveWorkspace(1024, preferences, 'inspector').activeOverlay).toBe(
      'inspector'
    )
    expect(deriveResponsiveWorkspace(1440, preferences, 'inspector').activeOverlay).toBeNull()
  })

  it('derives its tier from the measured editor container', () => {
    let resize
    globalThis.ResizeObserver = vi.fn(function ResizeObserver(callback) {
      resize = (width) => callback([{ contentRect: { width } }])
      this.observe = vi.fn()
      this.disconnect = vi.fn()
    })

    function Probe() {
      const { observeContainer, tier } = useResponsiveEditorWorkspace()
      // The context deliberately exposes a callback ref for the measured shell.
      return <div ref={observeContainer}>{tier}</div>
    }

    render(
      <ResponsiveEditorWorkspaceProvider preferences={preferences}>
        <Probe />
      </ResponsiveEditorWorkspaceProvider>
    )
    act(() => resize(1024))
    expect(screen.getByText('standard')).toBeTruthy()
    act(() => resize(768))
    expect(screen.getByText('compact')).toBeTruthy()
  })
})
