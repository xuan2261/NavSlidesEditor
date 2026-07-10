import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SlideThumbnail from './SlideThumbnail'

describe('SlideThumbnail', () => {
  it('keeps the scripted preview out of the accessibility tree', () => {
    const html = renderToString(<SlideThumbnail id="deck-1" />)

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('tabindex="-1"')
  })
})
