import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const previewFrameMock = vi.hoisted(() => vi.fn())

vi.mock('../hooks/use-reveal-preview-frame', () => ({
  useRevealPreviewFrame: (htmlContent, state) => {
    previewFrameMock(htmlContent, state)
    return {
      iframeRef: { current: null },
      deckRef: { current: null },
    }
  },
}))

import AnimationPreviewModal from './AnimationPreviewModal.jsx'

describe('AnimationPreviewModal', () => {
  it('renders preview html for only the current slide with initial fragment state', () => {
    const presentation = {
      title: 'Demo Deck',
      theme: 'black',
      slides: [
        {
          id: 'slide-1',
          elements: [{ id: 'first', type: 'text', content: '<p>First slide</p>' }],
        },
        {
          id: 'slide-2',
          elements: [
            { id: 'title', type: 'text', content: '<p>Second slide</p>' },
            { id: 'frag-a', type: 'text', fragment: true, fragmentIndex: 1, content: '<p>A</p>' },
            { id: 'frag-b', type: 'text', fragment: true, fragmentIndex: 3, content: '<p>B</p>' },
          ],
        },
      ],
    }

    previewFrameMock.mockReset()
    const html = renderToString(
      React.createElement(AnimationPreviewModal, {
        presentation,
        slideIndex: 1,
        onClose: () => {},
      })
    )

    expect(html).toContain('Animation Preview')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="animation-preview-title"')
    expect(html).toContain('id="animation-preview-title"')
    expect(html).toContain('aria-label="Close preview"')
    expect(html).toContain('Play')
    expect(html).toContain('Next')
    expect(previewFrameMock).toHaveBeenCalled()
    expect(previewFrameMock.mock.calls.at(-1)[0]).toContain('Second slide')
    expect(previewFrameMock.mock.calls.at(-1)[0]).not.toContain('First slide')
    expect(previewFrameMock.mock.calls.at(-1)[1]).toEqual({
      slideIndex: 0,
      verticalIndex: 0,
      fragmentIndex: 0,
    })
  })
})
