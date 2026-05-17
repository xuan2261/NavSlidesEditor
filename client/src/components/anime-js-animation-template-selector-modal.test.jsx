import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AnimeModal from './anime-js-animation-template-selector-modal.jsx'

describe('AnimeJsAnimationTemplateSelectorModal', () => {
  it('renders template options', () => {
    render(<AnimeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Scatter Dots')).toBeTruthy()
    expect(screen.getByText('Stagger Grid')).toBeTruthy()
    expect(screen.getByText('Path Morph')).toBeTruthy()
    expect(screen.getByText('Orbital')).toBeTruthy()
    expect(screen.getByText('Wave Bars')).toBeTruthy()
    expect(screen.getByText('Particle Burst')).toBeTruthy()
    expect(screen.getByText('Text Scramble')).toBeTruthy()
    expect(screen.getByText('Breathing')).toBeTruthy()
    expect(screen.getByText('Cascade Lines')).toBeTruthy()
    expect(screen.getByText('Spring Grid')).toBeTruthy()
    expect(screen.getByText('Pendulum')).toBeTruthy()
    expect(screen.getByText('Fireworks')).toBeTruthy()
    expect(screen.getByText('Custom Code')).toBeTruthy()
  })

  it('calls onInsert with HTML containing anime.js CDN', () => {
    const onInsert = vi.fn()
    render(<AnimeModal onInsert={onInsert} onClose={vi.fn()} />)
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    fireEvent.click(insertBtn)
    const html = onInsert.mock.calls[0][0]
    expect(html).toContain('animejs')
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('generates scatter-dots animation by default', () => {
    const onInsert = vi.fn()
    render(<AnimeModal onInsert={onInsert} onClose={vi.fn()} />)
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    fireEvent.click(insertBtn)
    const html = onInsert.mock.calls[0][0]
    expect(html).toContain('canvas')
    expect(html).toContain('anime')
  })

  it('switches template on click', () => {
    render(<AnimeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Fireworks'))
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    expect(insertBtn).toBeTruthy()
  })

  it('allows custom code when Custom Code selected', () => {
    render(<AnimeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Custom Code'))
    const textareas = screen.getAllByRole('textbox')
    expect(textareas.length).toBeGreaterThan(0)
  })
})
