import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ColorPicker } from './ColorPicker'
import { Input } from './Input'
import { Select } from './Select'

describe('form primitives', () => {
  it('renders input with stable warm-editor focus contract', () => {
    const html = renderToString(<Input placeholder="Name" />)

    expect(html).toContain('bg-card')
    expect(html).toContain('border-border')
    expect(html).toContain('focus:ring-2')
    expect(html).toContain('focus:ring-focus')
  })

  it('renders select with the same focus and surface contract as input', () => {
    const html = renderToString(
      <Select defaultValue="a">
        <option value="a">A</option>
      </Select>
    )

    expect(html).toContain('bg-card')
    expect(html).toContain('border-border')
    expect(html).toContain('focus:ring-2')
    expect(html).toContain('focus:ring-focus')
  })

  it('keeps color picker compact and keyboard-focus visible', () => {
    const html = renderToString(<ColorPicker value="#c96442" aria-label="Accent color" />)

    expect(html).toContain('type="color"')
    expect(html).toContain('aria-label="Accent color"')
    expect(html).toContain('focus-visible:ring-2')
    expect(html).toContain('focus-visible:ring-focus')
    expect(html).toContain('focus-visible:ring-offset-secondary')
    expect(html).not.toContain('focus-visible:ring-offset-primary')
  })
})
