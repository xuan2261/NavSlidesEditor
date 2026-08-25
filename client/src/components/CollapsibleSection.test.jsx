import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CollapsibleSection from './CollapsibleSection'

describe('CollapsibleSection', () => {
  it('[cap:control.properties.disclosure] renders the header as an accessible disclosure button', () => {
    const html = renderToString(
      <CollapsibleSection title="Layout">
        <div>Controls</div>
      </CollapsibleSection>
    )

    expect(html).toContain('type="button"')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Layout')
    expect(html).toContain('Controls')
  })

  it('[cap:control.properties.disclosure] preserves focus and expanded state while toggling content', () => {
    render(
      <CollapsibleSection title="Layout">
        <div>Controls</div>
      </CollapsibleSection>
    )
    const trigger = screen.getByRole('button', { name: 'Layout' })

    trigger.focus()
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Controls')).toBeNull()
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Controls')).toBeTruthy()
    expect(document.activeElement).toBe(trigger)
  })
})
