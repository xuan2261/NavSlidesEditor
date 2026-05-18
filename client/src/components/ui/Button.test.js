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
    expect(classes).toContain('focus-visible:ring-2')
    expect(classes).toContain('focus-visible:ring-focus')
    expect(classes).toContain('focus-visible:ring-offset-secondary')
    expect(classes).not.toContain('focus-visible:ring-offset-primary')
  })

  it('should return primary classes', () => {
    const classes = buttonVariants({ variant: 'primary' })
    expect(classes).toContain('bg-brand')
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
    expect(classes).toContain('min-h-0')
  })

  it('should return icon classes with fixed 32x32 size', () => {
    const classes = buttonVariants({ variant: 'icon' })
    expect(classes).toContain('w-8')
    expect(classes).toContain('h-8')
    expect(classes).toContain('!p-0')
    expect(classes).toContain('justify-center')
    expect(classes).toContain('border-transparent')
    expect(classes).toContain('focus-visible:ring-2')
  })

  it('should return ribbon classes with auto width and padding', () => {
    const classes = buttonVariants({ variant: 'ribbon' })
    expect(classes).toContain('w-auto')
    expect(classes).toContain('min-w-8')
    expect(classes).toContain('h-8')
    expect(classes).toContain('px-2')
    expect(classes).not.toContain('!p-0')
    expect(classes).toContain('gap-1.5')
    expect(classes).toContain('text-[11px]')
  })

  it('should allow custom className to override or append', () => {
    const classes = buttonVariants({ variant: 'primary', className: 'custom-class bg-red-500' })
    expect(classes).toContain('custom-class')
    expect(classes).toContain('bg-red-500')
  })

  it('should derive icon button aria-label from title as fallback', () => {
    const html = renderToString(
      React.createElement(Button, { variant: 'icon', title: 'Settings' }, 'S')
    )

    expect(html).toContain('title="Settings"')
    expect(html).toContain('aria-label="Settings"')
  })

  it('should derive ribbon button aria-label from title as fallback', () => {
    const html = renderToString(
      React.createElement(Button, { variant: 'ribbon', title: 'Add text' }, 'Text')
    )

    expect(html).toContain('title="Add text"')
    expect(html).toContain('aria-label="Add text"')
  })
})
