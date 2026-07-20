import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RibbonOverflowGroupMenu from './ribbon-overflow-group-menu'

describe('RibbonOverflowGroupMenu', () => {
  it('is named, keyboard operable, and restores trigger focus on Escape', () => {
    render(
      <RibbonOverflowGroupMenu label="Media">
        <button>Video</button>
      </RibbonOverflowGroupMenu>
    )
    const trigger = screen.getByRole('button', { name: 'Media' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(trigger.getAttribute('aria-haspopup')).toBeNull()
    expect(screen.getByRole('group', { name: 'Media' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Video' }))
    fireEvent.keyDown(screen.getByRole('group', { name: 'Media' }), { key: 'Escape' })
    expect(document.activeElement).toBe(trigger)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('keeps the popup open while an embedded form control is used', () => {
    render(
      <RibbonOverflowGroupMenu label="Embed">
        <label>
          Source
          <input aria-label="Source" />
        </label>
      </RibbonOverflowGroupMenu>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Embed' }))
    fireEvent.click(screen.getByRole('textbox', { name: 'Source' }))
    expect(screen.getByRole('group', { name: 'Embed' })).toBeTruthy()
  })

  it('closes after a contained action is activated', () => {
    const action = vi.fn()
    render(
      <RibbonOverflowGroupMenu label="Embed">
        <button onClick={action}>HTML</button>
      </RibbonOverflowGroupMenu>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Embed' }))
    fireEvent.click(screen.getByRole('button', { name: 'HTML' }))
    expect(action).toHaveBeenCalledOnce()
    expect(screen.queryByRole('group', { name: 'Embed' })).toBeNull()
  })
})
