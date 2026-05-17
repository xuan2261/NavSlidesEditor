import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThreeModal from './three-js-3d-scene-template-selector-modal.jsx'

describe('ThreeJs3dSceneTemplateSelectorModal', () => {
  it('renders template options', () => {
    render(<ThreeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Rotating Cube')).toBeTruthy()
    expect(screen.getByText('Wireframe Sphere')).toBeTruthy()
    expect(screen.getByText('Particle Cloud')).toBeTruthy()
    expect(screen.getByText('Torus Knot')).toBeTruthy()
    expect(screen.getByText('Wave Plane')).toBeTruthy()
    expect(screen.getByText('Galaxy')).toBeTruthy()
    expect(screen.getByText('Terrain')).toBeTruthy()
    expect(screen.getByText('Instanced Spheres')).toBeTruthy()
    expect(screen.getByText('Custom Code')).toBeTruthy()
  })

  it('calls onInsert with HTML containing Three.js CDN', () => {
    const onInsert = vi.fn()
    render(<ThreeModal onInsert={onInsert} onClose={vi.fn()} />)
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    fireEvent.click(insertBtn)
    const html = onInsert.mock.calls[0][0]
    expect(html).toContain('three')
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('generates rotating cube by default', () => {
    const onInsert = vi.fn()
    render(<ThreeModal onInsert={onInsert} onClose={vi.fn()} />)
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    fireEvent.click(insertBtn)
    const html = onInsert.mock.calls[0][0]
    expect(html).toContain('BoxGeometry')
    expect(html).toContain('THREE')
  })

  it('switches template on click', () => {
    render(<ThreeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Torus Knot'))
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    expect(insertBtn).toBeTruthy()
  })

  it('allows custom code when Custom Code selected', () => {
    render(<ThreeModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Custom Code'))
    const textareas = screen.getAllByRole('textbox')
    expect(textareas.length).toBeGreaterThan(0)
  })
})
