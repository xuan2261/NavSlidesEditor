import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import IconGallery from './IconGallery'

const iconPaths = {
  Star: '<polygon points="12 2 15 9 22 9 17 14 19 22 12 18 5 22 7 14 2 9 9 9 12 2"/>',
  Heart: '<path d="M12 21C12 21 4 13 4 8a4 4 0 0 1 8 0a4 4 0 0 1 8 0c0 5 -8 13 -8 13z"/>',
  ArrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  Check: '<path d="M20 6 9 17l-5-5"/>',
  Circle: '<circle cx="12" cy="12" r="10"/>',
}

function renderGallery(props = {}) {
  const anchorRef = { current: document.createElement('button') }
  document.body.appendChild(anchorRef.current)
  return render(
    <IconGallery
      open
      anchorRef={anchorRef}
      iconPaths={iconPaths}
      onSelect={props.onSelect || vi.fn()}
      onClose={props.onClose || vi.fn()}
    />
  )
}

describe('IconGallery', () => {
  it('renders search input and icon grid when open', () => {
    renderGallery()
    expect(screen.getByTestId('icon-gallery-search')).toBeTruthy()
    expect(screen.getByTestId('icon-gallery-grid')).toBeTruthy()
  })

  it('shows all icons from iconPaths when no search query', () => {
    renderGallery()
    expect(screen.getByTestId('icon-gallery-item-Star')).toBeTruthy()
    expect(screen.getByTestId('icon-gallery-item-Heart')).toBeTruthy()
    expect(screen.getByTestId('icon-gallery-item-Check')).toBeTruthy()
  })

  it('filters icons when search query is typed', () => {
    renderGallery()
    const search = screen.getByTestId('icon-gallery-search')
    fireEvent.change(search, { target: { value: 'heart' } })
    expect(screen.getByTestId('icon-gallery-item-Heart')).toBeTruthy()
    expect(screen.queryByTestId('icon-gallery-item-Star')).toBeNull()
    expect(screen.queryByTestId('icon-gallery-item-Check')).toBeNull()
  })

  it('shows "no match" message when search yields no results', () => {
    renderGallery()
    const search = screen.getByTestId('icon-gallery-search')
    fireEvent.change(search, { target: { value: 'xyznonexistent' } })
    expect(screen.getByText(/No icons match/i)).toBeTruthy()
  })

  it('calls onSelect and onClose when an icon is clicked', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    renderGallery({ onSelect, onClose })
    const heartButton = screen.getByTestId('icon-gallery-item-Heart')
    fireEvent.mouseDown(heartButton)
    expect(onSelect).toHaveBeenCalledWith('Heart')
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when open is false', () => {
    const anchorRef = { current: document.createElement('button') }
    document.body.appendChild(anchorRef.current)
    render(
      <IconGallery
        open={false}
        anchorRef={anchorRef}
        iconPaths={iconPaths}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.queryByTestId('icon-gallery-search')).toBeNull()
  })

  it('renders icon SVG previews inside buttons', () => {
    renderGallery()
    const star = screen.getByTestId('icon-gallery-item-Star')
    const svg = star.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg.innerHTML).toContain('polygon')
  })
})
