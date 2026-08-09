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

  it('focuses the first item and supports roving arrow, Home, and End navigation', () => {
    render(
      <RibbonDropdownMenuGroup
        icon={Package}
        label="Advanced"
        items={[
          { id: 'kinetic', icon: Sparkles, label: 'Kinetic Text', onAction: vi.fn() },
          { id: 'anime', icon: Sparkles, label: 'Anime', onAction: vi.fn() },
          { id: 'three', icon: Sparkles, label: 'Three.js', onAction: vi.fn() },
        ]}
      />
    )

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Advanced' }))
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])

    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(items[1], { key: 'ArrowRight' })
    expect(document.activeElement).toBe(items[2])
    fireEvent.keyDown(items[2], { key: 'Home' })
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(items[0], { key: 'End' })
    expect(document.activeElement).toBe(items[2])
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

  it('omits visible label text when triggerVariant is icon (still accessible via aria-label)', () => {
    render(
      <RibbonDropdownMenuGroup
        icon={Package}
        label="More advanced insert options"
        triggerVariant="icon"
        triggerClassName="h-7 w-7"
        items={[{ id: 'x', icon: Sparkles, label: 'X', onAction: vi.fn() }]}
      />
    )

    const trigger = screen.getByRole('button', { name: 'More advanced insert options' })
    expect(trigger.getAttribute('aria-label')).toBe('More advanced insert options')
    expect(trigger.textContent ?? '').not.toContain('More advanced insert options')
  })

  it('keeps visible label text for the default ribbon-variant trigger', () => {
    render(
      <RibbonDropdownMenuGroup
        icon={Package}
        label="Advanced"
        items={[{ id: 'x', icon: Sparkles, label: 'X', onAction: vi.fn() }]}
      />
    )

    const trigger = screen.getByRole('button', { name: 'Advanced' })
    expect(trigger.textContent).toContain('Advanced')
  })
})
