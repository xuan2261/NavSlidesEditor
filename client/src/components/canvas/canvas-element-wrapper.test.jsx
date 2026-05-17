import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import CanvasElement from './canvas-element-wrapper'

const baseElement = {
  id: 'video-1',
  type: 'video',
  x: 0,
  y: 0,
  width: 320,
  height: 180,
  src: 'https://example.com/video.ogv',
  controls: true,
  playbackRate: 1,
}

function renderCanvasElement(element) {
  return render(
    <CanvasElement
      element={element}
      isSelected={false}
      isEditing={false}
      isCropping={false}
      cropState={null}
      isDragging={false}
      editor={null}
      onPointerDown={vi.fn()}
      onClick={vi.fn()}
      onDoubleClick={vi.fn()}
      onContextMenu={vi.fn()}
      onCropHandleDown={vi.fn()}
      onCommitCrop={vi.fn()}
      onUpdateElement={vi.fn()}
      iconPaths={{}}
    />
  )
}

describe('CanvasElement video playback', () => {
  it('updates playbackRate when the selected video element changes', () => {
    const { rerender } = renderCanvasElement(baseElement)
    const wrapper = screen.getByTestId('slide-element-video-1')
    const video = wrapper.querySelector('video')

    expect(video.playbackRate).toBe(1)

    rerender(
      <CanvasElement
        element={{ ...baseElement, playbackRate: 1.25 }}
        isSelected={false}
        isEditing={false}
        isCropping={false}
        cropState={null}
        isDragging={false}
        editor={null}
        onPointerDown={vi.fn()}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
        onContextMenu={vi.fn()}
        onCropHandleDown={vi.fn()}
        onCommitCrop={vi.fn()}
        onUpdateElement={vi.fn()}
        iconPaths={{}}
      />
    )

    expect(video.playbackRate).toBe(1.25)
  })

  it('uses videoUrl when provided for URL-based video elements', () => {
    renderCanvasElement({
      ...baseElement,
      src: '',
      videoUrl: 'https://example.com/from-url.mp4',
      startTime: 5,
      endTime: 12,
    })
    const wrapper = screen.getByTestId('slide-element-video-1')
    const video = wrapper.querySelector('video')

    expect(video.getAttribute('src')).toBe('https://example.com/from-url.mp4#t=5,12')
  })
})
