import React, { useRef, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RibbonFloatingOverlay from './ribbon-floating-overlay'

function Harness({ onClose = vi.fn(), align = 'left' }) {
  const [open, setOpen] = useState(true)
  const buttonRef = useRef(null)
  return (
    <div>
      <button ref={buttonRef}>Anchor</button>
      <RibbonFloatingOverlay
        open={open}
        anchorRef={buttonRef}
        onClose={() => {
          setOpen(false)
          onClose()
        }}
        align={align}
        dataRibbonPopup="test-popup"
        className="w-[180px]"
      >
        <button role="menuitem">Action</button>
      </RibbonFloatingOverlay>
    </div>
  )
}

function BottomAnchorHarness() {
  const buttonRef = useRef(null)
  return (
    <div>
      <button ref={buttonRef}>Bottom Anchor</button>
      <RibbonFloatingOverlay
        open
        anchorRef={buttonRef}
        onClose={vi.fn()}
        dataRibbonPopup="bottom-popup"
        className="w-[180px]"
      >
        <div className="h-[120px]">Tall popup</div>
      </RibbonFloatingOverlay>
    </div>
  )
}

describe('RibbonFloatingOverlay', () => {
  it('renders popups through a body portal with a stable selector', () => {
    render(<Harness />)

    const popup = document.body.querySelector('[data-ribbon-popup="test-popup"]')
    expect(popup).toBeTruthy()
    expect(popup.contains(screen.getByRole('menuitem', { name: 'Action' }))).toBe(true)
  })

  it('closes on Escape and restores focus to the anchor', () => {
    render(<Harness />)

    const anchor = screen.getByRole('button', { name: 'Anchor' })
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(document.body.querySelector('[data-ribbon-popup="test-popup"]')).toBeNull()
    expect(document.activeElement).toBe(anchor)
  })

  it('closes on outside mouse down but ignores anchor and overlay clicks', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Anchor' }))
    fireEvent.mouseDown(document.body.querySelector('[data-ribbon-popup="test-popup"]'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('recomputes position on resize and scroll events', async () => {
    render(<Harness />)
    const popup = document.body.querySelector('[data-ribbon-popup="test-popup"]')

    await waitFor(() => expect(popup.style.top).not.toBe('0px'))
    const initialTop = popup.style.top

    fireEvent.scroll(window)
    fireEvent.resize(window)

    expect(popup.style.position).toBe('fixed')
    expect(popup.style.top).toBe(initialTop)
  })

  it('clamps vertically when the popup would overflow the viewport bottom', async () => {
    render(<BottomAnchorHarness />)
    const anchor = screen.getByRole('button', { name: 'Bottom Anchor' })
    anchor.getBoundingClientRect = () => ({
      x: 20,
      y: 160,
      width: 40,
      height: 20,
      top: 160,
      left: 20,
      right: 60,
      bottom: 180,
      toJSON: () => {},
    })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 200 })

    const popup = document.body.querySelector('[data-ribbon-popup="bottom-popup"]')
    popup.getBoundingClientRect = () => ({
      x: 20,
      y: 0,
      width: 180,
      height: 120,
      top: 0,
      left: 20,
      right: 200,
      bottom: 120,
      toJSON: () => {},
    })

    fireEvent.resize(window)

    await waitFor(() => {
      const top = Number.parseFloat(popup.style.top)
      expect(top).toBeGreaterThanOrEqual(8)
      expect(top + 120).toBeLessThanOrEqual(200 - 8)
    })
  })
})
