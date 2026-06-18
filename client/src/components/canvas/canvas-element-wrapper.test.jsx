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

  it('uses legacy videoUrl only when src is empty', () => {
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

  it('uses canonical src before stale legacy videoUrl', () => {
    renderCanvasElement({
      ...baseElement,
      src: 'https://example.com/current.mp4',
      videoUrl: 'https://example.com/stale.mp4',
      startTime: 3,
    })
    const wrapper = screen.getByTestId('slide-element-video-1')
    const video = wrapper.querySelector('video')

    expect(video.getAttribute('src')).toBe('https://example.com/current.mp4#t=3')
  })

  it('applies audio preview flags consistently with export attributes', () => {
    renderCanvasElement({
      id: 'audio-1',
      type: 'audio',
      x: 0,
      y: 0,
      width: 300,
      height: 60,
      src: '/uploads/a.mp3',
      autoplay: true,
      loop: true,
      muted: true,
    })
    const wrapper = screen.getByTestId('slide-element-audio-1')
    const audio = wrapper.querySelector('audio')

    expect(audio.getAttribute('src')).toBe('/uploads/a.mp3')
    expect(audio.autoplay).toBe(true)
    expect(audio.loop).toBe(true)
    expect(audio.muted).toBe(true)
    expect(audio.controls).toBe(true)
  })

  it('neutralizes unsafe media URLs on canvas', () => {
    renderCanvasElement({
      ...baseElement,
      src: 'javascript:alert(1)',
      poster: 'file:///secret.png',
    })
    const wrapper = screen.getByTestId('slide-element-video-1')
    const video = wrapper.querySelector('video')

    expect(video.getAttribute('src')).toBe('')
    expect(video.getAttribute('poster')).toBeNull()
  })
})

describe('CanvasElement PPTX text insets', () => {
  const textElement = {
    id: 'text-1',
    type: 'text',
    x: 0,
    y: 0,
    width: 200,
    height: 80,
    content: '<p>Hi</p>',
  }

  it('applies imported px text insets as inline padding', () => {
    renderCanvasElement({
      ...textElement,
      _pptxImportMeta: {
        textInsets: { left: 10, right: 11, top: 5, bottom: 6 },
        textInsetsUnit: 'px',
      },
    })

    const content = screen.getByTestId('slide-element-text-1').querySelector('.slide-text-content')
    expect(content.style.paddingLeft).toBe('10px')
    expect(content.style.paddingRight).toBe('11px')
    expect(content.style.paddingTop).toBe('5px')
    expect(content.style.paddingBottom).toBe('6px')
  })

  it('converts legacy unmarked text insets from pt to px before rendering', () => {
    renderCanvasElement({
      ...textElement,
      _pptxImportMeta: {
        textInsets: { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6 },
      },
    })

    const content = screen.getByTestId('slide-element-text-1').querySelector('.slide-text-content')
    expect(content.style.paddingLeft).toBe('9.6px')
    expect(content.style.paddingTop).toBe('4.8px')
  })

  it('applies wrap-safe layout only to imported PPTX text', () => {
    const { rerender } = renderCanvasElement(textElement)
    let content = screen.getByTestId('slide-element-text-1').querySelector('.slide-text-content')
    expect(content.style.overflowWrap).toBe('')

    rerender(
      <CanvasElement
        element={{ ...textElement, _pptxImportMeta: { textFit: 'wrap', version: 1 } }}
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

    content = screen.getByTestId('slide-element-text-1').querySelector('.slide-text-content')
    expect(content.style.overflowWrap).toBe('anywhere')
    expect(content.style.whiteSpace).toBe('pre-wrap')
    expect(content.style.wordBreak).toBe('normal')
  })
})

describe('CanvasElement image crop diagnostics', () => {
  const imageElement = {
    id: 'image-1',
    type: 'image',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    src: '/uploads/image.png',
    objectFit: 'contain',
  }

  it('does not mark regular images as source-cropped', () => {
    renderCanvasElement(imageElement)
    const wrapper = screen.getByTestId('slide-element-image-1')
    expect(wrapper.getAttribute('data-pptx-crop-intent')).toBeNull()
  })

  it('marks imported source crop metadata for audit diagnostics', () => {
    renderCanvasElement({
      ...imageElement,
      imageW: 250,
      imageH: 120,
      imageOffsetX: -20,
      imageOffsetY: -10,
      _pptxImportMeta: {
        sourceCrop: true,
        cropData: { left: 0.1, right: 0.1, top: 0.05, bottom: 0.05 },
      },
    })
    const wrapper = screen.getByTestId('slide-element-image-1')
    expect(wrapper.getAttribute('data-pptx-crop-intent')).toBe('source-crop')
    expect(wrapper.getAttribute('data-pptx-crop-data')).toContain('"left":0.1')
  })
})

describe('CanvasElement code walkthrough', () => {
  it('[cap:element.code depth:behavior] highlights default walkthrough line range', () => {
    renderCanvasElement({
      id: 'code-1',
      type: 'code',
      x: 0,
      y: 0,
      width: 400,
      height: 240,
      content: 'const a = 1\nconst b = 2\nreturn a + b',
      language: 'javascript',
      walkthroughSteps: [{ label: 'Return', startLine: 2, endLine: 3 }],
      defaultStepIndex: 0,
    })

    const wrapper = screen.getByTestId('slide-element-code-1')
    expect(wrapper.querySelector('[data-code-line="1"]').getAttribute('data-walkthrough-active')).toBeNull()
    expect(wrapper.querySelector('[data-code-line="2"]').getAttribute('data-walkthrough-active')).toBe('true')
    expect(wrapper.querySelector('[data-code-line="3"]').getAttribute('data-walkthrough-active')).toBe('true')
  })

  it('[cap:element.code depth:behavior] renders plaintext for unsupported legacy languages', () => {
    renderCanvasElement({
      id: 'code-legacy',
      type: 'code',
      x: 0,
      y: 0,
      width: 400,
      height: 240,
      content: 'legacy <tag>',
      language: 'made-up-language',
      walkthroughSteps: [{ label: 'Legacy', startLine: 1, endLine: 1 }],
      defaultStepIndex: 0,
    })

    const wrapper = screen.getByTestId('slide-element-code-legacy')
    expect(wrapper.querySelector('[data-code-line="1"]').textContent).toBe('legacy <tag>')
    expect(wrapper.querySelector('[data-code-line="1"]').getAttribute('data-walkthrough-active')).toBe('true')
  })
})

describe('CanvasElement html embed sandbox', () => {
  const htmlElement = {
    id: 'html-1',
    type: 'html',
    x: 0,
    y: 0,
    width: 500,
    height: 380,
    content:
      '<script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"></script><div id="anim"></div>',
  }

  it('renders html embed iframe with allow-same-origin so CDN scripts can load', () => {
    renderCanvasElement(htmlElement)
    const wrapper = screen.getByTestId('slide-element-html-1')
    const iframe = wrapper.querySelector('iframe')

    expect(iframe).not.toBeNull()
    const sandbox = iframe.getAttribute('sandbox') || ''
    expect(sandbox).toContain('allow-scripts')
    expect(sandbox).toContain('allow-same-origin')
  })

  it('uses element.content as srcDoc for html embeds', () => {
    renderCanvasElement(htmlElement)
    const wrapper = screen.getByTestId('slide-element-html-1')
    const iframe = wrapper.querySelector('iframe')

    expect(iframe.getAttribute('srcdoc')).toContain('animejs')
  })

  it('renders Mermaid html embeds from mermaidSource with the vendored runtime', () => {
    renderCanvasElement({
      ...htmlElement,
      embedKind: 'mermaid',
      mermaidSource: 'flowchart TD\n  A-->B',
      content: '',
    })
    const wrapper = screen.getByTestId('slide-element-html-1')
    const iframe = wrapper.querySelector('iframe')

    expect(iframe.getAttribute('title')).toBe('Mermaid diagram preview')
    expect(iframe.getAttribute('srcdoc')).toContain('/vendor/mermaid/mermaid.min.js')
    expect(iframe.getAttribute('srcdoc')).toContain('flowchart TD')
  })
})
