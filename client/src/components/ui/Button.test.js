import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { Button, buttonVariants } from './Button'

describe('buttonVariants', () => {
  it('should return base classes for all buttons', () => {
    const classes = buttonVariants({})
    expect(classes).toContain('inline-flex')
    expect(classes).toContain('items-center')
    expect(classes).toContain('rounded-md')
  })

  it('should return primary classes', () => {
    const classes = buttonVariants({ variant: 'primary' })
    expect(classes).toContain('bg-accent')
    expect(classes).toContain('text-white')
  })

  it('should return secondary classes', () => {
    const classes = buttonVariants({ variant: 'secondary' })
    expect(classes).toContain('bg-card')
    expect(classes).toContain('border')
    expect(classes).toContain('border-border')
    expect(classes).not.toContain('border-none')
  })

  it('should return danger classes', () => {
    const classes = buttonVariants({ variant: 'danger' })
    expect(classes).toContain('bg-danger')
  })

  it('should return ghost classes', () => {
    const classes = buttonVariants({ variant: 'ghost' })
    expect(classes).toContain('hover:bg-hover')
  })

  it('should return icon classes', () => {
    const classes = buttonVariants({ variant: 'icon' })
    expect(classes).toContain('w-8')
    expect(classes).toContain('h-8')
    expect(classes).toContain('justify-center')
    expect(classes).toContain('border-transparent')
  })

  it('should allow custom className to override or append', () => {
    const classes = buttonVariants({ variant: 'primary', className: 'custom-class bg-red-500' })
    expect(classes).toContain('custom-class')
    expect(classes).toContain('bg-red-500') // Assuming twMerge correctly handles this
  })

  it('should derive icon button aria-label from title as fallback', () => {
    const html = renderToString(
      React.createElement(Button, { variant: 'icon', title: 'Settings' }, 'S')
    )

    expect(html).toContain('title="Settings"')
    expect(html).toContain('aria-label="Settings"')
  })
})
