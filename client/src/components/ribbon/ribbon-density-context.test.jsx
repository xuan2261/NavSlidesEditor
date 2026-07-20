import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RibbonDensityProvider, useRibbonDensity } from './ribbon-density-context'

class ResizeObserverMock {
  constructor(callback) {
    this.callback = callback
  }
  observe(element) {
    this.callback([{ contentRect: { width: Number(element.dataset.width) } }])
  }
  disconnect() {}
}

function Probe() {
  return <output>{useRibbonDensity()}</output>
}

describe('RibbonDensityProvider', () => {
  it.each([
    [767, 'compact'],
    [1024, 'condensed'],
    [1200, 'wide'],
  ])('derives density from its container width (%i)', (width, density) => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    render(
      <RibbonDensityProvider data-width={width}>
        <Probe />
      </RibbonDensityProvider>
    )
    expect(screen.getByText(density)).toBeTruthy()
    vi.unstubAllGlobals()
  })
})
