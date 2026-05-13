import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CollapsibleSection from './CollapsibleSection'

describe('CollapsibleSection', () => {
  it('renders the header as an accessible disclosure button', () => {
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
})
