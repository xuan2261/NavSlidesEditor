import React, { StrictMode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorWorkspaceWidth } from './use-editor-workspace-width'

// Like a provider's cold-loading branch, this changes host ancestry without
// changing the component that owns the measurement hook.
function HostBranches({ ready, workspaceRef, children }) {
  return ready ? (
    <section>
      <div ref={workspaceRef} data-testid="host">
        {children}
      </div>
    </section>
  ) : (
    <div ref={workspaceRef} data-testid="host">
      {children}
    </div>
  )
}
function Workspace({ ready = false }) {
  const { workspaceRef, workspaceWidth } = useEditorWorkspaceWidth()
  const tier = workspaceWidth >= 1280 ? 'wide' : workspaceWidth >= 1024 ? 'standard' : 'compact'
  return (
    <HostBranches ready={ready} workspaceRef={workspaceRef}>
      <output>
        {workspaceWidth}:{tier}
      </output>
    </HostBranches>
  )
}

let observers
let events
beforeEach(() => {
  observers = []
  events = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback) {
        this.callback = callback
        this.observe = vi.fn((node) => {
          this.node = node
          events.push(['observe', node])
        })
        this.disconnect = vi.fn(() => events.push(['disconnect', this.node]))
        observers.push(this)
      }
      deliver(width, target = this.node) {
        this.callback([{ target, contentRect: { width } }])
      }
    }
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function expectWidth(width, tier) {
  expect(screen.getByText(`${width}:${tier}`)).toBeTruthy()
}

describe('useEditorWorkspaceWidth host lifetime', () => {
  it('disconnects a replaced host and rejects its late zero-width delivery', () => {
    const view = render(<Workspace />)
    const oldNode = screen.getByTestId('host')
    const oldObserver = observers[0]
    act(() => oldObserver.deliver(1440))
    view.rerender(<Workspace ready />)
    const newNode = screen.getByTestId('host')
    const current = observers[1]
    expect(newNode).not.toBe(oldNode)
    expect(oldNode.isConnected).toBe(false)
    expect(current.observe).toHaveBeenCalledWith(newNode)
    expect(events).toEqual([
      ['observe', oldNode],
      ['disconnect', oldNode],
      ['observe', newNode],
    ])
    act(() => oldObserver.deliver(0))
    expectWidth(1440, 'wide')
    act(() => current.deliver(1100))
    expectWidth(1100, 'standard')
    act(() => oldObserver.deliver(0))
    expectWidth(1100, 'standard')
    // Even a current observer's entry must refer to its current host.
    act(() => current.deliver(0, oldNode))
    expectWidth(1100, 'standard')
    act(() => current.deliver(900))
    expectWidth(900, 'compact')
    act(() => current.deliver(1440))
    expectWidth(1440, 'wide')
    expect(observers).toHaveLength(2)
  })

  it.each([
    [1280, 'wide'],
    [1279, 'standard'],
    [1024, 'standard'],
    [1023, 'compact'],
    [0, 'compact'],
  ])('retains the actual current width %i and tier %s', (width, tier) => {
    render(<Workspace />)
    act(() => observers[0].deliver(width))
    expectWidth(width, tier)
  })

  it('invalidates deliveries on unmount before they can read width or update state', () => {
    const view = render(<Workspace />)
    const observer = observers[0]
    view.unmount()
    expect(observer.disconnect).toHaveBeenCalledOnce()
    const readRect = vi.fn(() => ({ width: 0 }))
    act(() =>
      observer.callback([
        {
          target: observer.node,
          get contentRect() {
            return readRect()
          },
        },
      ])
    )
    expect(readRect).not.toHaveBeenCalled()
  })

  it('handles StrictMode mounts, host transitions, and remounts without stale deliveries', () => {
    const view = render(
      <StrictMode>
        <Workspace />
      </StrictMode>
    )
    const first = observers.at(-1)
    view.rerender(
      <StrictMode>
        <Workspace ready />
      </StrictMode>
    )
    const second = observers.at(-1)
    expect(second).not.toBe(first)
    act(() => second.deliver(1024))
    act(() => first.deliver(0))
    expectWidth(1024, 'standard')
    view.rerender(
      <StrictMode>
        <Workspace />
      </StrictMode>
    )
    const third = observers.at(-1)
    expect(third).not.toBe(second)
    act(() => third.deliver(1280))
    act(() => second.deliver(0))
    expectWidth(1280, 'wide')
    view.unmount()
    const remount = render(
      <StrictMode>
        <Workspace ready />
      </StrictMode>
    )
    const latest = observers.at(-1)
    act(() => latest.deliver(1100))
    act(() => observers.slice(0, -1).forEach((observer) => observer.deliver(0)))
    expectWidth(1100, 'standard')
    remount.unmount()
    for (const observer of observers) expect(observer.disconnect).toHaveBeenCalledOnce()
  })

  it('keeps the 1440 default without ResizeObserver and during SSR', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const view = render(<Workspace />)
    expectWidth(1440, 'wide')
    view.rerender(<Workspace ready />)
    expectWidth(1440, 'wide')
    expect(renderToString(<Workspace ready />)).toContain('1440')
    expect(observers).toHaveLength(0)
  })
})
