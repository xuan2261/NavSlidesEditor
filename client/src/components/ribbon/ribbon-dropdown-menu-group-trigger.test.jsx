import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Package, Sparkles } from 'lucide-react'
import RibbonDropdownMenuGroup from './ribbon-dropdown-menu-group-trigger'

describe('RibbonDropdownMenuGroup', () => {
  it('opens a configurable flyout and toggles aria-expanded', () => {
    render(
      <RibbonDropdownMenuGroup
        icon={Package}
        label="Advanced"
        menuClassName="w-[260px] min-w-[260px]"
        itemsClassName="grid grid-cols-2 gap-1"
        items={[{ id: 'kinetic', icon: Sparkles, label: 'Kinetic Text', onAction: vi.fn() }]}
      />
    )

    const trigger = screen.getByRole('button', { name: 'Advanced' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.mouseDown(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menu').className).toContain('w-[260px]')
    expect(screen.getByRole('menuitem', { name: 'Kinetic Text' })).toBeTruthy()
  })

  it('activates menu items with keyboard and closes the menu', () => {
    const onAction = vi.fn()
    render(
      <RibbonDropdownMenuGroup
        icon={Package}
        label="Advanced"
        items={[{ id: 'kinetic', icon: Sparkles, label: 'Kinetic Text', onAction }]}
      />
    )

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Advanced' }))
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Kinetic Text' }), { key: 'Enter' })

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on Escape and restores focus to the trigger', () => {
    render(
      <RibbonDropdownMenuGroup
        icon={Package}
        label="Advanced"
        items={[{ id: 'kinetic', icon: Sparkles, label: 'Kinetic Text', onAction: vi.fn() }]}
      />
    )

    const trigger = screen.getByRole('button', { name: 'Advanced' })
    fireEvent.mouseDown(trigger)
    expect(screen.getByRole('menu')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes when clicking outside the menu', () => {
    render(
      <RibbonDropdownMenuGroup
        icon={Package}
        label="Advanced"
        items={[{ id: 'kinetic', icon: Sparkles, label: 'Kinetic Text', onAction: vi.fn() }]}
      />
    )

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByRole('menu')).toBeTruthy()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('menu')).toBeNull()
  })
})
