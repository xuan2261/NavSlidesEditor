import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LaserPointer } from './laser-pointer.jsx'

describe('LaserPointer', () => {
  it('renders when visible=true and position provided', () => {
    const { container } = render(<LaserPointer visible={true} position={{ x: 100, y: 200 }} />)
    expect(container.firstChild).not.toBeNull()
    expect(container.querySelector('.laser-pointer')).not.toBeNull()
  })

  it('returns null when visible=false', () => {
    const { container } = render(<LaserPointer visible={false} position={{ x: 100, y: 200 }} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when position=null', () => {
    const { container } = render(<LaserPointer visible={true} position={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('positions at provided x/y coordinates', () => {
    const { container } = render(<LaserPointer visible={true} position={{ x: 150, y: 250 }} />)
    const el = container.querySelector('.laser-pointer')
    expect(el).not.toBeNull()
    expect(el.style.left).toBe('150px')
    expect(el.style.top).toBe('250px')
  })
})
